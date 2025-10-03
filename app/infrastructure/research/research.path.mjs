/**
 * Why: Orchestrate per-query research steps so CLI and Web flows can share traversal logic.
 * What: Normalizes queries, executes search via injected provider, extracts learnings, and schedules follow-up paths while tracking progress and telemetry.
 * How: Receives engine configuration and progress state, delegates IO to injected handlers, and aggregates results recursively with guarded logging.
 */

import { suggestSearchProvider } from '../search/search.providers.mjs'; // Keep for type checking if needed, but not for instantiation here
import { generateQueries, processResults } from '../../features/ai/research.providers.mjs';
import { LLMClient } from '../ai/venice.llm-client.mjs'; // Assuming LLMClient is used
import { createModuleLogger } from '../../utils/logger.mjs';

const logger = createModuleLogger('research.path');

const defaultOutput = (message, meta) => logger.info(message, meta);
const defaultError = (message, meta) => logger.error(message, meta);
const defaultDebug = (message, meta) => logger.debug(message, meta);

// Helper function to safely get query string
function getQueryString(query) {
    if (!query) return '';
    if (typeof query === 'string') {
        return query;
    }
    // --- FIX: Check for 'original' property ---
    if (query && typeof query.original === 'string') {
        return query.original;
    }
    // Fallback or error handling if query structure is unexpected
    logger.warn('[getQueryString] Unexpected query format, returning empty string.', { query });
    return ''; // Or throw an error
}

export class ResearchPath {
    constructor(engineConfig, progressData) { // Receive engine config and progress data object
        const {
            // query, // Query is passed to research method
            user,
            visitedUrls = new Set(),
            braveApiKey, // Still needed for potential direct use? Or remove if provider is always passed? Let's keep for now.
            veniceApiKey,
            output = defaultOutput,
            error = defaultError,
            debug = defaultDebug,
            progressHandler = () => {},
            searchProvider, // <-- ADD: Accept searchProvider instance
            telemetry = null
        } = engineConfig; // Destructure from engineConfig

        // if (!query) throw new Error('Query is required for ResearchPath'); // Query passed later
        if (!user) throw new Error('User context is required for ResearchPath');
        // if (!braveApiKey) throw new Error('Brave API key is required for ResearchPath'); // No longer needed if provider passed
        if (!veniceApiKey) throw new Error('Venice API key is required for ResearchPath');
        if (!searchProvider) throw new Error('Search provider instance is required for ResearchPath'); // Add check

        // this.query = query; // Store original query object/string - Stored per research call
        this.user = user;
        this.visitedUrls = visitedUrls;
        // this.braveApiKey = braveApiKey; // Store key - No longer needed directly
        this.veniceApiKey = veniceApiKey; // Store key
        this.output = output; // Store handler
        this.error = error;   // Store handler
        this.debug = debug;   // Store handler
        this.progressHandler = progressHandler; // Store handler
        this.progressData = progressData; // Store reference to progress data object
        this.config = engineConfig; // Store original config which NOW includes the provider
        this.searchProvider = searchProvider; // <-- STORE the passed provider instance
        this.telemetry = telemetry || null;

        // Pass handlers if LLMClient is used here (or create instance as needed)
        // this.llmClient = new LLMClient({ apiKey: this.veniceApiKey /*, other options */ });

        this.debug(`[ResearchPath] Initialized.`);
    }

    // --- NEW: Helper to update progress ---
    updateProgress(update = {}, stage = null) {
        if (!this.progressData || !this.progressHandler) {
            return;
        }

        const { stage: stageFromUpdate, ...rest } = update;
        Object.assign(this.progressData, rest);

        if (
            typeof this.progressData.totalQueries === 'number' &&
            this.progressData.totalQueries > 0 &&
            typeof this.progressData.completedQueries === 'number' &&
            this.progressData.completedQueries > this.progressData.totalQueries
        ) {
            this.debug(`[Progress Warning] Completed queries (${this.progressData.completedQueries}) exceeded total (${this.progressData.totalQueries}). Clamping.`);
            this.progressData.completedQueries = this.progressData.totalQueries;
        }

        const resolvedStage = stage || stageFromUpdate || this.progressData.status;
        const snapshot = { ...this.progressData };
        if (resolvedStage) {
            snapshot.stage = resolvedStage;
        }

        this.progressHandler({ ...snapshot });
        if (this.telemetry?.emitProgress) {
            this.telemetry.emitProgress({ ...snapshot });
        }
    }

    /**
     * Processes a single query node in the research graph.
     * @param {object} params - Research parameters for this node.
     * @param {object} params.query - The query object { original: string, metadata?: any }.
     * @param {number} params.depth - Remaining depth for recursion.
     * @param {number} params.breadth - Breadth for generating sub-queries.
     * @returns {Promise<{learnings: string[], sources: string[], followUpQueries: object[]}>} Aggregated results from this path.
     */
    async research({ query, depth, breadth }) {
        const queryString = getQueryString(query); // Get the string part for searching/logging
    this.updateProgress({ status: 'Processing Query', currentAction: `Processing: ${queryString.substring(0, 50)}...` }, 'path:start');
        this.telemetry?.emitStatus({
            stage: 'path-processing',
            message: `Processing query at depth ${depth}.`,
            meta: { query: queryString, depth, breadth }
        });
        this.telemetry?.emitThought({
            text: `Exploring: ${queryString}`,
            stage: 'path'
        });

        try {
            this.output(`[ResearchPath D:${depth}] Processing query: "${queryString}"`);

            // 1. Generate Search Queries (if needed, or use provided query)
            // For the first level (or if no sub-queries generated yet), use the main query.
            // In subsequent levels, this method is called with generated follow-up queries.
            this.updateProgress({ status: 'Searching', currentAction: `Searching web for: ${queryString.substring(0, 50)}...` }, 'path:searching');
            const searchProvider = this.searchProvider; // Use the instance passed in constructor

            // 2. Execute Search
            this.debug(`[ResearchPath D:${depth}] Executing search for: "${queryString}"`);
            // Truncate query before sending to search provider
            const truncatedQuery = queryString.length > 1000 ? queryString.substring(0, 1000) : queryString;
            if (truncatedQuery !== queryString) {
                this.debug(`[ResearchPath D:${depth}] Query truncated to ${truncatedQuery.length} chars for search provider.`);
            }
            const searchResults = await searchProvider.search(truncatedQuery);

            // --- ADD DEBUG LOGGING BEFORE FILTERING ---
            this.debug(`[ResearchPath D:${depth}] Raw search results received (${searchResults?.length || 0}):`, searchResults);
            // --- END ADD DEBUG LOGGING ---

            this.updateProgress({ status: 'Analyzing', currentAction: `Analyzing ${searchResults?.length || 0} candidates for: ${queryString.substring(0, 50)}...` }, 'path:analyzing');

            // Filter out visited URLs and limit results processed per query
            const MAX_RESULTS_PER_QUERY = 5; // Limit processing to avoid excessive cost/time
            // --- FIX: Ensure result.url exists before checking visitedUrls ---
            const newResults = (searchResults || []) // Handle null/undefined searchResults
                                .filter(result => result && result.url && !this.visitedUrls.has(result.url))
                                .slice(0, MAX_RESULTS_PER_QUERY);
            // --- END FIX ---
            const newContent = newResults.map(r => r.content || ''); // Extract content
            newResults.forEach(result => this.visitedUrls.add(result.url)); // Add new URLs to visited set
            this.debug(`[ResearchPath D:${depth}] Processing ${newResults.length} new results after filtering visited URLs.`);

            let currentLearnings = [];
            // --- FIX: Ensure result.url exists before adding to sources ---
            let currentSources = newResults.map(r => r.url).filter(Boolean); // Get sources from the new results, filter out null/empty URLs
            // --- END FIX ---
            let allowFollowUps = false;

            if (newResults.length === 0) {
                // --- ADD REASON TO LOG ---
                const reason = (searchResults?.length || 0) > 0 ? "All results were already visited or invalid." : "Search provider returned no results.";
                this.output(`[ResearchPath D:${depth}] No new relevant search results found for "${queryString}". Reason: ${reason}`);
                // --- END ADD REASON ---
                this.updateProgress({ completedQueries: (this.progressData.completedQueries || 0) + 1, status: 'Complete', currentAction: `No new sources for: ${queryString.substring(0, 50)}...` }, 'path:complete'); // Increment completed count
                allowFollowUps = false;
            } else {
                // 3. Process Results (Extract Learnings)
                this.updateProgress({ status: 'Extracting', currentAction: `Extracting learnings from ${newResults.length} results...` }, 'path:extracting');
                try {
                    const processed = await processResults({
                        apiKey: this.veniceApiKey, // Pass API key
                        query: queryString,        // Pass query string for context
                        content: newContent,       // Pass search results content array
                        outputFn: this.debug,      // Pass handlers
                        errorFn: this.error
                    });
                    currentLearnings = processed.learnings || [];
                    // Note: processResults doesn't return sources, we got them above
                    this.debug(`[ResearchPath D:${depth}] Extracted ${currentLearnings.length} learnings.`);
                    this.updateProgress({
                        completedQueries: (this.progressData.completedQueries || 0) + 1, // Increment completed count
                        currentAction: `Extracted ${currentLearnings.length} learnings for: ${queryString.substring(0, 50)}...`,
                        status: 'Synthesizing'
                    }, 'path:synthesizing');
                    this.telemetry?.emitStatus({
                        stage: 'path-processing',
                        message: `Learnings extracted for query.` ,
                        meta: { query: queryString, learnings: currentLearnings.length, depth }
                    });
                    allowFollowUps = currentLearnings.length > 0;
                } catch (procError) {
                    this.error(`[ResearchPath D:${depth}] Error processing results for "${queryString}": ${procError.message}`);
                    currentLearnings.push(`Error processing search results for: ${queryString}`);
                    this.updateProgress({ completedQueries: (this.progressData.completedQueries || 0) + 1, status: 'Error', currentAction: `Processing failed for: ${queryString.substring(0, 50)}...` }, 'path:error'); // Still increment count on error
                    this.telemetry?.emitStatus({
                        stage: 'path-error',
                        message: 'Error processing search results.',
                        detail: procError.message,
                        meta: { query: queryString, depth }
                    });
                    allowFollowUps = false;
                }
            }

            // 4. Generate Follow-up Queries (if depth > 0)
            let followUpQueries = [];
            if (depth > 0 && allowFollowUps) {
                this.updateProgress({ status: 'Planning', currentAction: `Generating follow-up queries (Depth ${depth - 1})...` }, 'path:planning');
                try {
                    followUpQueries = await generateQueries({
                        apiKey: this.veniceApiKey, // Pass API key
                        query: queryString,        // Pass original query string for context
                        learnings: currentLearnings, // Pass learnings from this level
                        numQueries: breadth,       // Pass breadth
                        metadata: query.metadata,  // Pass metadata from original query object
                        outputFn: this.debug,      // Pass handlers
                        errorFn: this.error
                    });
                    this.debug(`[ResearchPath D:${depth}] Generated ${followUpQueries.length} follow-up queries.`);
                    this.updateProgress({ status: 'Planning', currentAction: `Generated ${followUpQueries.length} follow-up queries...` }, 'path:planning');
                    this.telemetry?.emitStatus({
                        stage: 'path-followups',
                        message: `Generated ${followUpQueries.length} follow-up queries.`,
                        meta: { query: queryString, depth }
                    });
                } catch (genError) {
                    this.error(`[ResearchPath D:${depth}] Error generating follow-up queries for "${queryString}": ${genError.message}`);
                    currentLearnings.push(`Error generating follow-up queries for: ${queryString}`);
                }
            } else if (depth > 0 && !allowFollowUps) {
                this.debug(`[ResearchPath D:${depth}] Skipping follow-up generation due to lack of new learnings.`);
            } else {
                 this.debug(`[ResearchPath D:${depth}] Reached max depth, not generating follow-up queries.`);
                 this.updateProgress({ status: 'Complete', currentAction: 'Reached maximum research depth.' }, 'path:complete');
            }

            // --- FIX: Combine results from this path ---
            const pathResult = {
                learnings: [...currentLearnings], // Copy learnings from this level
                sources: [...currentSources],     // Copy sources from this level
                followUpQueries: followUpQueries  // Follow-up queries generated at this level
            };


            // --- FIX: Recursive calls for follow-up queries ---
            if (depth > 0 && followUpQueries.length > 0) {
                this.updateProgress({ status: 'Traversing', currentAction: `Sequentially processing ${followUpQueries.length} sub-paths (Depth ${depth - 1})...` }, 'path:traversing');

                // --- CHANGE: Process follow-up queries sequentially ---
                for (const followUpQueryObj of followUpQueries) {
                    const subQueryString = getQueryString(followUpQueryObj);
                    this.debug(`[ResearchPath D:${depth}] Starting sub-path for: "${subQueryString}"`);
                    try {
                        // Create a new path instance for the sub-query
                        // Pass the *current* config (this.config), which includes the shared searchProvider
                        // Pass the *same* progressData object for shared updates
                        const subPath = new ResearchPath(this.config, this.progressData);
                        // Recursively call research with decremented depth
                        const subResult = await subPath.research({ query: followUpQueryObj, depth: depth - 1, breadth: breadth });

                        // Aggregate learnings and sources
                        pathResult.learnings.push(...subResult.learnings);
                        pathResult.sources.push(...subResult.sources);
                        // Note: We don't typically aggregate follow-up queries from sub-paths

                    } catch (subError) { // Catch errors from the awaited subPath.research call
                        this.error(`[ResearchPath D:${depth}] Sub-path failed for query "${subQueryString}": ${subError?.message || subError}`);
                        // Optionally add an error learning
                        pathResult.learnings.push(`Error processing sub-query: ${subQueryString}`);
                    }
                    this.debug(`[ResearchPath D:${depth}] Finished sub-path for: "${subQueryString}"`);
                }
                // --- END CHANGE ---

                 // Deduplicate learnings and sources after aggregation
                pathResult.learnings = [...new Set(pathResult.learnings)];
                pathResult.sources = [...new Set(pathResult.sources)];
            }
            // --- End FIX ---


            this.updateProgress({ status: 'Complete', currentAction: `Completed query: ${queryString.substring(0, 50)}...` }, 'path:complete');
            this.debug(`[ResearchPath D:${depth}] Path finished for "${queryString}".`);
            // Return aggregated results from this path and its children
            return pathResult; // { learnings, sources, followUpQueries (only from this level) }

        } catch (err) {
            this.error(`[ResearchPath D:${depth}] Error processing path for query "${queryString}": ${err.message}`);
            this.debug(err.stack); // Log stack trace for debugging
            this.updateProgress({ status: 'Error', currentAction: `Path failed: ${err.message}` }, 'path:error');
            this.telemetry?.emitStatus({
                stage: 'path-error',
                message: 'Research path failed.',
                detail: err.message,
                meta: { query: queryString, depth }
            });
            // Re-throw or return error structure
            // Return a structure indicating failure but allowing summary generation
            return {
                learnings: [`Error during research path for "${queryString}": ${err.message}`],
                sources: [],
                followUpQueries: [],
                error: err.message // Include error message
            };
            // throw err; // Don't throw, let the engine handle aggregation and summary
        }
    }
}