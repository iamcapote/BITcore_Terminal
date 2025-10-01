/**
 * Why: Encapsulate research memory enrichment so the CLI entrypoint can stay focused on orchestration.
 * What: Fetches memory intelligence, emits telemetry, and derives follow-up queries seeded from past context.
 * How: Asynchronously pulls from the shared memory service, projects telemetry insights, and returns override queries for the research engine.
 * Contract
 *   Inputs:
 *     - params: {
 *         query: string;
 *         memoryService: MemoryService | null;
 *         user?: { username?: string };
 *         fallbackUsername?: string;
 *         limit?: number;
 *         telemetry?: TelemetryChannel;
 *         debug?: (message: string) => void;
 *       }
 *   Outputs:
 *     - Promise<{ memoryContext: MemoryContext | null; overrideQueries: Array<MemoryQueryOverride> }>.
 *   Error modes:
 *     - Returns empty overrides on memory failures; propagates argument errors.
 *   Performance:
 *     - time: dominated by memoryService access (<500 ms typical); memory: bounded by limit (<= limit * 2 KB).
 *   Side effects:
 *     - Emits telemetry events; reads from memory service only.
 */

import { fetchMemoryIntelligence, deriveMemoryFollowUpQueries, projectMemorySuggestions } from '../../utils/research.memory-intelligence.mjs';

const DEFAULT_LIMIT = 5;

export async function prepareMemoryContext(params) {
    const {
        query,
        memoryService,
        user,
        fallbackUsername,
        limit = DEFAULT_LIMIT,
        telemetry,
        debug = () => {}
    } = params;

    const username = user?.username ?? fallbackUsername;
    const canSampleMemory = Boolean(memoryService && username);

    if (!canSampleMemory) {
        return { memoryContext: null, overrideQueries: [] };
    }

    telemetry?.emitStatus({
        stage: 'memory',
        message: 'Sampling memory intelligence for context.'
    });

    try {
        const memoryContext = await fetchMemoryIntelligence({
            query,
            memoryService,
            user,
            fallbackUsername: username,
            limit,
            logger: debug
        });

        const records = memoryContext?.records ?? [];
        const recordCount = records.length;

        if (telemetry && memoryContext?.telemetryPayload) {
            telemetry.emitMemoryContext(memoryContext.telemetryPayload);
        }

        if (telemetry) {
            if (recordCount > 0) {
                telemetry.emitThought({
                    text: `Loaded ${recordCount} memory snippet${recordCount === 1 ? '' : 's'} for context.`,
                    stage: 'memory',
                    meta: {
                        layers: Array.from(
                            new Set(records.map((record) => record.layer).filter(Boolean))
                        ).slice(0, 4)
                    }
                });
            } else {
                telemetry.emitThought({
                    text: 'No matching memory snippets found; continuing with live research.',
                    stage: 'memory'
                });
            }
        }

        const overrideQueries = recordCount
            ? deriveMemoryFollowUpQueries({
                baseQuery: query,
                memoryContext,
                maxQueries: limit
            })
            : [];

        if (overrideQueries.length && telemetry) {
            telemetry.emitStatus({
                stage: 'memory-prioritization',
                message: `Injecting ${overrideQueries.length} memory-guided follow-up queries.`
            });
            telemetry.emitThought({
                text: `Prioritizing ${overrideQueries.length} memory-guided follow-up queries before generating new leads.`,
                stage: 'planning',
                meta: {
                    memorySeeded: true,
                    memoryIds: overrideQueries
                        .map((entry) => entry.metadata?.memoryId)
                        .filter(Boolean)
                        .slice(0, 4)
                }
            });
        }

        const telemetrySuggestions = projectMemorySuggestions(overrideQueries);
        if (telemetry && telemetrySuggestions.length) {
            telemetry.emitSuggestions({
                source: 'memory',
                suggestions: telemetrySuggestions
            });
        }

        return { memoryContext, overrideQueries };
    } catch (error) {
        debug(`[prepareMemoryContext] Memory intelligence fetch failed: ${error.message}`);
        telemetry?.emitStatus({
            stage: 'memory-warning',
            message: 'Memory intelligence unavailable.',
            detail: error.message
        });
        return { memoryContext: null, overrideQueries: [] };
    }
}
