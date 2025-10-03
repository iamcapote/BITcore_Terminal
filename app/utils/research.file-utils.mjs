/**
 * Research File Utilities
 * Why: Support research workflows with helper logic for query normalization and path execution.
 * What: Provides query extraction helpers and the ResearchPath orchestrator used by CLI and Web flows.
 * How: Validates inputs, delegates to search and LLM providers, and emits structured telemetry via module loggers.
 */

import { suggestSearchProvider } from '../infrastructure/search/search.providers.mjs';
// Fix import for research.providers.mjs:
import { generateQueries, processResults } from '../features/ai/research.providers.mjs'; // Corrected relative path
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import fs from 'fs/promises';
import { createModuleLogger } from './logger.mjs';

const moduleLogger = createModuleLogger('utils.research-file');

function defaultOutput(message) {
    moduleLogger.info(message);
}

function defaultError(message) {
    moduleLogger.error(message);
}

function defaultDebug(message) {
    moduleLogger.debug(message);
}

// Helper function to safely get query string
function getQueryString(query) {
    if (typeof query === 'string') {
        return query;
    }
    if (query && typeof query.query === 'string') {
        return query.query;
    }
    // Fallback or error handling if query structure is unexpected
    moduleLogger.warn('Unexpected query format encountered while normalizing query string.', {
        receivedType: typeof query
    });
    return ''; // Or throw an error
}

export class ResearchPath {
    constructor(options) {
        const {
            query, // Can be string or { query: string, metadata: ... }
            user,
            visitedUrls = new Set(),
            braveApiKey, // Added
            veniceApiKey, // Added
            output = defaultOutput, // Added
            error = defaultError, // Added
            debug = defaultDebug, // Added
            progressHandler = () => {} // Added
        } = options;

        if (!query) throw new Error('Query is required for ResearchPath');
        if (!user) throw new Error('User context is required for ResearchPath');

        this.query = query; // Store original query object/string
        this.user = user;
        this.visitedUrls = visitedUrls;
        this.braveApiKey = braveApiKey; // Store key
        this.veniceApiKey = veniceApiKey; // Store key
        this.output = output; // Store handler
        this.error = error;   // Store handler
        this.debug = debug;   // Store handler
        this.progressHandler = progressHandler; // Store handler

        // Pass handlers if LLMClient is used here
        this.llmClient = new LLMClient({ apiKey: this.veniceApiKey /*, other options */ });

        this.debug(`[ResearchPath] Initialized for query: ${JSON.stringify(this.query).substring(0, 100)}`);
    }

    async research() {
        this.progressHandler({ message: 'Starting path...' });
        const queryString = getQueryString(this.query); // Get the string part for searching/logging

        try {
            this.output(`[ResearchPath] Processing query: "${queryString}"`);

            // 1. Generate Search Queries (if needed, or use provided query)
            // Assuming generateQueries is called by ResearchEngine or we use the direct query
            this.progressHandler({ message: 'Preparing search...' });
            const searchProvider = suggestSearchProvider({
                user: this.user,
                apiKey: this.braveApiKey // Pass the key
            });

            // 2. Execute Search
            this.progressHandler({ message: `Searching with ${searchProvider.constructor.name}...` });
            this.debug(`[ResearchPath] Executing search for: "${queryString}"`);
            // Truncate query before sending to search provider
            const truncatedQuery = queryString.length > 1000 ? queryString.substring(0, 1000) : queryString;
            if (truncatedQuery !== queryString) {
                this.debug(`[ResearchPath] Query truncated to ${truncatedQuery.length} chars for search provider.`);
            }
            const searchResults = await searchProvider.search(truncatedQuery); // Use truncated query
            this.debug(`[ResearchPath] Received ${searchResults?.length || 0} search results.`);
            this.progressHandler({ message: `Found ${searchResults?.length || 0} results.` });

            // Filter out visited URLs
            const newResults = searchResults.filter(result => result.url && !this.visitedUrls.has(result.url));
            newResults.forEach(result => this.visitedUrls.add(result.url)); // Add new URLs to visited set
            this.debug(`[ResearchPath] Processing ${newResults.length} new results after filtering visited URLs.`);

            if (newResults.length === 0) {
                this.output('[ResearchPath] No new relevant search results found.');
                this.progressHandler({ message: 'No new results found.' });
                return { learnings: [], sources: [], followUpQueries: [] };
            }

            // 3. Process Results (Extract Learnings)
            this.progressHandler({ message: 'Extracting learnings...' });
            // Pass LLM client with API key
            const { learnings, sources } = await processResults(newResults, this.llmClient);
            this.debug(`[ResearchPath] Extracted ${learnings.length} learnings.`);
            this.progressHandler({ message: `Extracted ${learnings.length} learnings.` });

            // 4. Generate Follow-up Queries
            this.progressHandler({ message: 'Generating follow-up queries...' });
            // Pass LLM client with API key
            const followUpQueries = await generateQueries(this.query, learnings, this.llmClient); // Use original query object/string
            this.debug(`[ResearchPath] Generated ${followUpQueries.length} follow-up queries.`);
            this.progressHandler({ message: `Generated ${followUpQueries.length} follow-up queries.` });

            // 5. Generate Summary (Optional - might be done at engine level)
            // const summary = await generateSummary(learnings, this.llmClient);
            // this.debug("[ResearchPath] Generated path summary.");

            this.progressHandler({ message: 'Path finished.' });
            return { learnings, sources, followUpQueries };

        } catch (err) {
            this.error(`[ResearchPath] Error processing path for query "${queryString}": ${err.message}`);
            this.debug(err.stack); // Log stack trace for debugging
            this.progressHandler({ message: `Path failed: ${err.message}` });
            // Re-throw or return error structure
            throw err; // Let the engine handle the settled promise
        }
    }
}

/**
 * Save data to a file (used by research CLI)
 * @param {string} filename - The file path to save to
 * @param {string|Buffer|Object} data - The data to write (object will be stringified)
 * @returns {Promise<void>}
 */
export async function saveToFile(filename, data) {
  const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
  await fs.writeFile(filename, content, 'utf8');
}