/**
 * Why: Keep token-classification enrichment isolated so the research CLI remains readable.
 * What: Optionally calls the Venice token classifier to augment the query metadata and emits telemetry/output updates.
 * How: Checks the classify flag, invokes the classifier, surfaces metadata, and falls back gracefully on failure.
 * Contract
 *   Inputs:
 *     - params: {
 *         query: string;
 *         classify: boolean;
 *         veniceKey?: string;
 *         output: (message: string, newline?: boolean) => void;
 *         error: (message: string) => void;
 *         telemetry?: TelemetryChannel;
 *       }
 *   Outputs:
 *     - Promise<{ original: string; tokenClassification?: object; metadata?: object }>.
 *   Error modes:
 *     - Swallows classifier errors after logging and telemetry; never throws for classifier failures.
 *   Performance:
 *     - time: depends on Venice API latency (~1 s typical); memory negligible.
 *   Side effects:
 *     - Emits telemetry updates and prints output/error messages.
 */

import { callVeniceWithTokenClassifier } from '../../utils/token-classifier.mjs';

export async function enrichResearchQuery({
    query,
    classify,
    veniceKey,
    output,
    error,
    telemetry
}) {
    const enhancedQuery = { original: query };

    if (!classify) {
        return enhancedQuery;
    }

    output?.('Attempting token classification...', true);
    telemetry?.emitStatus({
        stage: 'classification',
        message: 'Running token classifier to enrich query.'
    });

    try {
        const tokenResponse = await callVeniceWithTokenClassifier(query, veniceKey);
        if (tokenResponse) {
            enhancedQuery.tokenClassification = tokenResponse;
            enhancedQuery.metadata = tokenResponse;
            output?.('Token classification successful.', true);
            output?.(`[TokenClassifier] Metadata:\n${JSON.stringify(tokenResponse, null, 2)}`);
            telemetry?.emitThought({
                text: 'Token classifier metadata captured.',
                stage: 'classification',
                meta: { keys: Object.keys(tokenResponse || {}) }
            });
        } else {
            output?.('Token classification returned no data.', true);
        }
    } catch (tokenError) {
        error?.(`Token classification failed: ${tokenError.message}. Proceeding without.`);
        telemetry?.emitStatus({
            stage: 'classification',
            message: 'Token classifier failed; continuing without metadata.',
            detail: tokenError.message
        });
    }

    return enhancedQuery;
}
