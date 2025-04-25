import { suggestSearchProvider } from '../search/search.providers.mjs'; // Keep for type checking if needed, but not for instantiation here
import { generateQueries, processResults } from '../../features/ai/research.providers.mjs';
import { LLMClient } from '../ai/venice.llm-client.mjs'; // Assuming LLMClient is used

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
    console.warn('[getQueryString] Unexpected query format, returning empty string:', query);
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
            output = console.log,
            error = console.error,
            debug = () => {},
            progressHandler = () => {},
            searchProvider // <-- ADD: Accept searchProvider instance
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

        // Pass handlers if LLMClient is used here (or create instance as needed)
        // this.llmClient = new LLMClient({ apiKey: this.veniceApiKey /*, other options */ });

        this.debug(`[ResearchPath] Initialized.`);
    }

    // --- NEW: Helper to update progress ---
    updateProgress(update) {
        if (this.progressData && this.progressHandler) {
            Object.assign(this.progressData, update);
            // Ensure completed doesn't exceed total
            if (this.progressData.completedQueries > this.progressData.totalQueries) {
                this.debug(`[Progress Warning] Completed queries (${this.progressData.completedQueries}) exceeded total (${this.progressData.totalQueries}). Clamping.`);
                this.progressData.completedQueries = this.progressData.totalQueries;
            }
            this.progressHandler(this.progressData);
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
        this.updateProgress({ status: 'Processing Query', currentAction: `Processing: ${queryString.substring(0, 50)}...` });

        try {
            this.output(`[ResearchPath D:${depth}] Processing query: "${queryString}"`);

            // 1. Generate Search Queries (if needed, or use provided query)
            // For the first level (or if no sub-queries generated yet), use the main query.
            // In subsequent levels, this method is called with generated follow-up queries.
            this.updateProgress({ currentAction: `Searching web for: ${queryString.substring(0, 50)}...` });
            // --- Use the SHARED searchProvider instance ---
            // const searchProvider = suggestSearchProvider({ // REMOVE THIS
            //     type: 'web',
            //     user: this.user,
            //     apiKey: this.braveApiKey, // Pass the key
            //     outputFn: this.debug,      // Pass handlers
            //     errorFn: this.error
            // });
            const searchProvider = this.searchProvider; // Use the instance passed in constructor

            // 2. Execute Search
            this.debug(`[ResearchPath D:${depth}] Executing search for: "${queryString}"`);
            // Truncate query before sending to search provider
            const truncatedQuery = queryString.length > 1000 ? queryString.substring(0, 1000) : queryString;
            if (truncatedQuery !== queryString) {
                this.debug(`[ResearchPath D:${depth}] Query truncated to ${truncatedQuery.length} chars for search provider.`);
            }
            // --- Use the shared provider's search method ---
            const searchResults = await searchProvider.search(truncatedQuery); // Use truncated query
            this.debug(`[ResearchPath D:${depth}] Received ${searchResults?.length || 0} search results.`);
            this.updateProgress({ currentAction: `Found ${searchResults?.length || 0} web results for: ${queryString.substring(0, 50)}...` });

            // Filter out visited URLs and limit results processed per query
            const MAX_RESULTS_PER_QUERY = 5; // Limit processing to avoid excessive cost/time
            const newResults = searchResults.filter(result => result.url && !this.visitedUrls.has(result.url)).slice(0, MAX_RESULTS_PER_QUERY);
            const newContent = newResults.map(r => r.content || ''); // Extract content
            newResults.forEach(result => this.visitedUrls.add(result.url)); // Add new URLs to visited set
            this.debug(`[ResearchPath D:${depth}] Processing ${newResults.length} new results after filtering visited URLs.`);

            let currentLearnings = [];
            let currentSources = newResults.map(r => r.url); // Get sources from the new results

            if (newResults.length === 0) {
                this.output(`[ResearchPath D:${depth}] No new relevant search results found for "${queryString}".`);
                this.updateProgress({ completedQueries: (this.progressData.completedQueries || 0) + 1 }); // Increment completed count
            } else {
                // 3. Process Results (Extract Learnings)
                this.updateProgress({ currentAction: `Extracting learnings from ${newResults.length} results...` });
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
                        currentAction: `Extracted ${currentLearnings.length} learnings for: ${queryString.substring(0, 50)}...`
                    });
                } catch (procError) {
                    this.error(`[ResearchPath D:${depth}] Error processing results for "${queryString}": ${procError.message}`);
                    currentLearnings.push(`Error processing search results for: ${queryString}`);
                    this.updateProgress({ completedQueries: (this.progressData.completedQueries || 0) + 1 }); // Still increment count on error
                }
            }

            // 4. Generate Follow-up Queries (if depth > 0)
            let followUpQueries = [];
            if (depth > 0) {
                this.updateProgress({ currentAction: `Generating follow-up queries (Depth ${depth - 1})...` });
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
                    this.updateProgress({ currentAction: `Generated ${followUpQueries.length} follow-up queries...` });
                } catch (genError) {
                    this.error(`[ResearchPath D:${depth}] Error generating follow-up queries for "${queryString}": ${genError.message}`);
                    currentLearnings.push(`Error generating follow-up queries for: ${queryString}`);
                }
            } else {
                 this.debug(`[ResearchPath D:${depth}] Reached max depth, not generating follow-up queries.`);
                 this.updateProgress({ currentAction: 'Reached maximum research depth.' });
            }

            // --- FIX: Combine results from this path ---
            const pathResult = {
                learnings: [...currentLearnings], // Copy learnings from this level
                sources: [...currentSources],     // Copy sources from this level
                followUpQueries: followUpQueries  // Follow-up queries generated at this level
            };


            // --- FIX: Recursive calls for follow-up queries ---
            if (depth > 0 && followUpQueries.length > 0) {
                this.updateProgress({ currentAction: `Sequentially processing ${followUpQueries.length} sub-paths (Depth ${depth - 1})...` });

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


            this.debug(`[ResearchPath D:${depth}] Path finished for "${queryString}".`);
            // Return aggregated results from this path and its children
            return pathResult; // { learnings, sources, followUpQueries (only from this level) }

        } catch (err) {
            this.error(`[ResearchPath D:${depth}] Error processing path for query "${queryString}": ${err.message}`);
            this.debug(err.stack); // Log stack trace for debugging
            this.updateProgress({ currentAction: `Path failed: ${err.message}` });
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