import { suggestSearchProvider, SearchError } from '../search/search.providers.mjs';
// Rename extractLearnings to processResults in the import
import { generateQueries, processResults } from '../../features/ai/research.providers.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';

/**
 * Represents a single research path exploring queries depth-first.
 */
export class ResearchPath {
    constructor(engineConfig, progressData) {
        this.config = engineConfig; // Contains API keys, user info, handlers
        this.progress = progressData; // Shared progress object
        this.output = this.config.outputHandler;
        this.error = this.config.errorHandler;
        this.debug = this.config.debugHandler;
        this.progressCallback = this.config.progressHandler; // Function to call with updates

        // Initialize search provider using the key from config
        try {
            this.searchProvider = suggestSearchProvider({
                type: 'web',
                apiKey: this.config.braveApiKey // Pass the key here
            });
            this.debug('[ResearchPath] BraveSearchProvider initialized successfully.');
        } catch (providerError) {
            this.error(`[ResearchPath] Failed to initialize search provider: ${providerError.message}`);
            // Rethrow or handle? Rethrowing ensures the engine knows initialization failed.
            throw new Error(`Failed to initialize search provider: ${providerError.message}`);
        }

        this.visitedUrls = new Set(); // Track visited URLs within this path
        this.processedQueries = new Set(); // Track processed queries to avoid loops
    }

    /**
     * Updates and reports progress.
     */
    updateProgress(updates) {
        // Ensure completedQueries doesn't exceed totalQueries if total is known
        if (this.progress.totalQueries > 0 && updates.completedQueries !== undefined) {
            updates.completedQueries = Math.min(updates.completedQueries, this.progress.totalQueries);
        }
        // Update progress object
        Object.assign(this.progress, updates);

        if (this.progressCallback) {
            try {
                // Send a copy to avoid downstream mutations affecting the shared object
                this.progressCallback({ ...this.progress });
            } catch (callbackError) {
                this.error(`[ResearchPath] Error in progress callback: ${callbackError.message}`);
            }
        }
    }


    /**
     * Starts the research process for a given query, depth, and breadth.
     * Called when NOT using overrideQueries.
     * @param {object} params - Research parameters.
     * @param {object} params.query - The initial query object { original: string, metadata?: any }.
     * @param {number} params.depth - Research depth.
     * @param {number} params.breadth - Research breadth.
     * @returns {Promise<object>} Object containing learnings and sources.
     */
    async research({ query, depth, breadth }) {
        const learnings = [];
        const sources = new Set(); // Use Set for unique sources

        // Estimate total queries (rough estimate, might change)
        // Initial query + (breadth queries per level * depth levels)
        // This estimation is done in the engine now.
        // const estimatedTotal = 1 + (breadth * depth);
        // this.updateProgress({ totalQueries: estimatedTotal, status: 'Starting Research' });
        this.updateProgress({ status: 'Starting Research' }); // Total is set by engine

        try {
            await this.processQuery(query, depth, breadth, learnings, sources);
            this.updateProgress({ status: 'Consolidating Results' });
        } catch (err) {
            this.error(`[ResearchPath] Unhandled error during research for "${query.original}": ${err.message}`);
            console.error(err.stack); // Log stack trace
            learnings.push(`Critical error during research: ${err.message}`);
            this.updateProgress({ status: 'Error', error: err.message });
        }

        return {
            learnings: Array.from(new Set(learnings)), // Deduplicate learnings
            sources: Array.from(sources) // Convert Set to Array
        };
    }

    /**
     * Recursively processes a query.
     * @param {object} queryObj - The query object { original: string, metadata?: any }.
     * @param {number} depth - Remaining depth.
     * @param {number} breadth - Breadth for generating sub-queries.
     * @param {Array<string>} learnings - Accumulated learnings.
     * @param {Set<string>} sources - Accumulated sources.
     */
    async processQuery(queryObj, depth, breadth, learnings, sources) {
        // Add detailed check for queryObj structure
        if (!queryObj || typeof queryObj.original !== 'string') {
             const errorMsg = `[processQuery] Invalid queryObj received. Expected { original: string, ... }, got: ${JSON.stringify(queryObj)}`;
             this.error(errorMsg);
             learnings.push(`Internal error: Invalid query object received.`);
             // Increment completed count even for invalid queries to prevent progress stall
             this.updateProgress({
                 completedQueries: (this.progress.completedQueries || 0) + 1,
                 status: `Error processing invalid query object`
             });
             return; // Stop processing this path
        }

        const queryText = cleanQuery(queryObj.original);
        // Add detailed logging for queryText type and value
        this.debug(`[processQuery] Processing queryText (type: ${typeof queryText}): "${queryText}"`);
        this.debug(`[processQuery] Depth=${depth}, Breadth=${breadth}`);


        if (depth <= 0 || this.processedQueries.has(queryText)) {
            this.debug(`[processQuery] Skipping query (depth=${depth}, processed=${this.processedQueries.has(queryText)}): "${queryText}"`);
            return;
        }
        this.processedQueries.add(queryText);
        this.updateProgress({
            // currentDepth calculation might be less accurate with override queries, focus on completed/total
            // currentDepth: this.progress.totalDepth - depth + 1,
            status: `Processing: ${queryText}`
        });


        try {
            // 1. Search
            this.debug(`[search] Attempting search with queryText (type: ${typeof queryText}): "${queryText}"`);
            if (typeof queryText !== 'string' || !queryText.trim()) { // Extra safety check + empty check
                throw new Error(`[processQuery] queryText is not a valid non-empty string before search: "${queryText}"`);
            }
            const searchResults = await this.searchProvider.search(queryText);
            this.debug(`[search] Found ${searchResults.length} results for: "${queryText}"`);

            // Add sources from search results
            searchResults.forEach(r => sources.add(r.source));

            // 2. Extract Learnings
            if (searchResults.length > 0) {
                this.updateProgress({ status: `Extracting learnings: ${queryText}` });
                const contentArray = searchResults.map(result => result.content).filter(Boolean);

                if (contentArray.length > 0) {
                    this.debug(`[learnings] Calling processResults with queryText (type: ${typeof queryText}): "${queryText}"`);
                    if (typeof queryText !== 'string') { // Extra safety check
                         throw new Error(`[processQuery] queryText is not a string before processResults: ${typeof queryText}`);
                    }
                    // --- Start: Add try/catch around processResults ---
                    try {
                        const learningResult = await processResults({
                            apiKey: this.config.veniceApiKey, // Pass API key
                            query: queryText,
                            content: contentArray, // Pass array of content strings
                            // numLearnings: 3, // Optional: Default is 3
                            // numFollowUpQuestions: 3, // Optional: Default is 3
                            metadata: queryObj.metadata || null
                        });

                        if (learningResult && learningResult.learnings && learningResult.learnings.length > 0) {
                            this.debug(`[learnings] Extracted ${learningResult.learnings.length} learnings for "${queryText}". Adding to main list.`);
                            learnings.push(...learningResult.learnings); // Add extracted learnings
                        } else {
                            this.debug(`[learnings] processResults returned no learnings for "${queryText}".`);
                            learnings.push(`No specific learnings extracted from content for: ${queryText}`); // Add placeholder
                        }
                        // Optionally handle followUpQuestions if needed later
                        // if (learningResult.followUpQuestions && learningResult.followUpQuestions.length > 0) {
                        //     this.debug(`[learnings] Extracted ${learningResult.followUpQuestions.length} follow-up questions.`);
                        // }

                    } catch (learningError) {
                        this.error(`[learnings] Error calling processResults for query "${queryText}": ${learningError.message}`);
                        console.error(learningError.stack); // Log stack trace for learning error
                        learnings.push(`Error extracting learnings for '${queryText}': ${learningError.message}`);
                    }
                    // --- End: Add try/catch around processResults ---

                } else {
                    this.debug(`[learnings] No content extracted from search results for: "${queryText}"`);
                    learnings.push(`No usable content found in search results for: ${queryText}`);
                }

            } else {
                learnings.push(`No search results found for: ${queryText}`);
            }

            // Increment completed queries *after* processing this query
            this.updateProgress({ completedQueries: (this.progress.completedQueries || 0) + 1 });


            // 3. Generate & Recurse (if depth > 1)
            if (depth > 1) {
                this.updateProgress({ status: `Generating sub-queries: ${queryText}` });
                this.debug(`[sub-queries] Calling generateQueries with queryText (type: ${typeof queryText}): "${queryText}"`);
                 if (typeof queryText !== 'string') { // Extra safety check
                     throw new Error(`[processQuery] queryText is not a string before generateQueries: ${typeof queryText}`);
                 }
                // --- Start: Add try/catch around generateQueries ---
                let subQueries = [];
                try {
                    // --- FIX: Use accumulated learnings correctly ---
                    // Pass only the learnings relevant to *this* query, or a subset of recent ones?
                    // Passing *all* accumulated learnings might become too large.
                    // Let's pass the learnings extracted *in this step* if available, otherwise the original query.
                    const recentLearnings = learnings.slice(-5); // Pass last 5 learnings as context

                    subQueries = await generateQueries({
                        query: queryText,
                        learnings: recentLearnings, // Use recent learnings for context
                        numQueries: breadth,
                        metadata: queryObj.metadata || null,
                        apiKey: this.config.veniceApiKey // Pass API key
                    });
                    this.debug(`[sub-queries] Generated ${subQueries.length} sub-queries.`);
                } catch (queryGenError) {
                    this.error(`[sub-queries] Error calling generateQueries for query "${queryText}": ${queryGenError.message}`);
                    console.error(queryGenError.stack); // Log stack trace for query generation error
                    learnings.push(`Error generating sub-queries for '${queryText}': ${queryGenError.message}`);
                    // Continue without sub-queries if generation fails
                }
                // --- End: Add try/catch around generateQueries ---


                // Process sub-queries concurrently only if subQueries were generated
                if (subQueries.length > 0) {
                    const subQueryPromises = subQueries.map(subQueryObj =>
                        // Ensure subQueryObj is valid before recursing
                        this.processQuery(subQueryObj, depth - 1, breadth, learnings, sources)
                    );
                    await Promise.all(subQueryPromises);
                } else {
                    this.debug(`[sub-queries] No sub-queries generated or generation failed, skipping recursion for "${queryText}".`);
                }
            }

        } catch (error) {
            // Make error message more specific
            this.error(`[processQuery] Error during processing of query "${queryText}": ${error.message}`);
            console.error(error.stack); // Log full stack trace for better debugging
            learnings.push(`Error researching '${queryText}': ${error.message}`);
            // Increment completed count even if there was an error to avoid progress getting stuck
            this.updateProgress({
                 completedQueries: (this.progress.completedQueries || 0) + 1,
                 status: `Error on: ${queryText}`
            });
            // Optionally re-throw if the error should halt the entire research?
            // For now, we log, add an error learning, and continue if possible.
            // If it's an auth error from search, maybe re-throw?
            if (error instanceof SearchError && error.code === 'AUTH_ERROR') {
                this.error(`[processQuery] Authentication error encountered. Aborting further searches.`);
                throw error; // Re-throw auth errors to stop the engine
            }
             // If it's the 422 error, log specific warning but don't necessarily stop everything
             if (error instanceof SearchError && error.status === 422) {
                 this.error(`[processQuery] Validation error (422) encountered for query "${queryText}". This query might be invalid for the search provider.`);
                 // Don't re-throw, allow other paths to continue.
             }
        }
    }
}