import { output as defaultOutput } from '../../utils/research.output-manager.mjs'; // Use defaultOutput alias
import { ResearchPath } from './research.path.mjs';
import fs from 'fs/promises';
import path from 'path';
import { generateSummary } from '../../features/ai/research.providers.mjs';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import { LLMClient } from '../ai/venice.llm-client.mjs';
import { generateQueries } from '../../features/ai/research.providers.mjs';
// Import safeSend for progress updates
import { safeSend } from '../../utils/websocket.utils.mjs';
// --- Import suggestSearchProvider ---
import { suggestSearchProvider } from '../search/search.providers.mjs';

/**
 * Main research engine that coordinates research paths
 */
export class ResearchEngine {
  constructor(config = {}) {
    const {
      braveApiKey,
      veniceApiKey,
      verbose = false,
      user = {},
      outputHandler = console.log,   // <= NEW default
      errorHandler = console.error,  // <= NEW default
      debugHandler = () => {},       // <= NEW default
      progressHandler = () => {},    // <= NEW: Add progressHandler destructuring with default
      isWebSocket = false,
      webSocketClient = null,
      overrideQueries = null // --- NEW: Accept overrideQueries in config ---
    } = config;

    // --- store config ---
    this.braveApiKey   = braveApiKey;
    this.veniceApiKey  = veniceApiKey;
    this.verbose       = verbose;
    this.user          = user;

    // --- NEW: ensure handlers are always functions ---
    this.outputHandler = typeof outputHandler === 'function' ? outputHandler : console.log;
    this.errorHandler  = typeof errorHandler  === 'function' ? errorHandler  : console.error;
    this.debugHandler  = typeof debugHandler === 'function' ? debugHandler : () => {};
    // --- NEW: Assign progress handler ---
    this.progressHandler = typeof progressHandler === 'function' ? progressHandler : () => {}; // Assign from destructured var

    // --- misc flags ---
    this.isWebSocket   = isWebSocket;
    this.webSocketClient = webSocketClient;
    this.overrideQueries = overrideQueries; // --- Store overrideQueries ---

    // --- NEW: Add convenience aliases using the correctly assigned handlers ---
    this.output = this.outputHandler;
    this.error = this.errorHandler;
    this.debug = this.debugHandler;
    this.progress = this.progressHandler; // Use the assigned progressHandler

    // Store the original config object if needed elsewhere, though direct properties are preferred
    this.config = config; // Store the passed config

    // Validate essential config
    if (!this.braveApiKey || !this.veniceApiKey) {
        // Log the error using the provided handler before throwing
        this.error("[ResearchEngine] CRITICAL: ResearchEngine requires braveApiKey and veniceApiKey in config.");
        throw new Error("ResearchEngine requires braveApiKey and veniceApiKey in config.");
    }
     if (!this.user || !this.user.username) {
        this.debug("[ResearchEngine] Warning: User information not provided in config.");
        // Proceed without user info if necessary, but log warning
        this.user = this.user || { username: 'unknown', role: 'unknown' };
    }

    // --- Instantiate Search Provider ONCE ---
    try {
        this.searchProvider = suggestSearchProvider({
            type: 'web',
            apiKey: this.braveApiKey,
            outputFn: this.debug, // Use debug for provider logs
            errorFn: this.error
        });
        this.debug(`[ResearchEngine] Search provider initialized successfully.`);
    } catch (providerError) {
        this.error(`[ResearchEngine] CRITICAL: Failed to initialize search provider: ${providerError.message}`);
        throw providerError; // Re-throw critical error
    }
    // --- End Instantiate Search Provider ---

    this.debug(`[ResearchEngine] Initialized for user: ${this.user.username}`);
    if (this.overrideQueries) {
        this.debug(`[ResearchEngine] Initialized with ${this.overrideQueries.length} override queries.`);
    }
  }

  /**
   * Executes the research process.
   * @param {object} params - Research parameters.
   * @param {object} params.query - The query object { original: string, tokenClassification?: string, metadata?: any }. Used for context/summary, NOT necessarily for initial search if overrides exist.
   * @param {number} params.depth - Research depth.
   * @param {number} params.breadth - Research breadth.
   * @returns {Promise<object>} Research results including learnings, sources, summary, markdownContent, and suggestedFilename.
   */
  async research({ query, depth = 2, breadth = 3 }) {
    // Use parameters passed to this method
    const contextQuery = query; // Renamed for clarity - this provides context
    const currentDepth = depth;
    const currentBreadth = breadth;

    // Validate parameters
    if (!contextQuery || !contextQuery.original) {
        this.error('[ResearchEngine] Research requires a context query object with an "original" property.');
        throw new Error('Research context query object is invalid.');
    }
     if (isNaN(currentDepth) || currentDepth <= 0 || isNaN(currentBreadth) || currentBreadth <= 0) {
        this.error(`[ResearchEngine] Invalid depth (${currentDepth}) or breadth (${currentBreadth}). Must be positive numbers.`);
        throw new Error('Invalid research depth or breadth.');
    }

    this.outputHandler('\n[ResearchEngine] Starting research...');
    this.outputHandler(`[ResearchEngine] Context query: "${contextQuery.original}"`);
    if (contextQuery.metadata) { // Check metadata on contextQuery
        this.outputHandler('[ResearchEngine] Metadata attached to context query:');
        this.outputHandler(typeof contextQuery.metadata === 'object'
            ? JSON.stringify(contextQuery.metadata, null, 2)
            : String(contextQuery.metadata));
    }

    // --- Use the engine's progress handler ---
    const progressFn = this.progress;
    let progressData; // Define progressData in outer scope

    try {
      // Initialize progress tracking using current parameters
      progressData = { // Assign to outer scope variable
        currentDepth: 0, // Start at depth 0
        totalDepth: currentDepth,
        currentBreadth: 0, // Start at breadth 0
        totalBreadth: currentBreadth,
        totalQueries: 0, // Will be calculated later
        completedQueries: 0,
        status: 'Initializing',
        currentAction: 'Initializing research engine...'
      };
      // Send initial progress if handler exists
      progressFn(progressData);


      // Create ResearchPath with the engine's config (API keys, user, handlers, progress)
      // Pass the engine's config object, the progressData object, AND the shared searchProvider instance
      const pathConfig = {
          ...this.config, // Pass original config (keys, user, handlers)
          searchProvider: this.searchProvider // Pass the shared provider instance
      };
      const pathInstance = new ResearchPath(pathConfig, progressData); // Pass combined config and progressData object

      // Store path instance for potential override logic or testing
      this.path = pathInstance;

      let result;

      // --- FIX: Use this.overrideQueries stored during construction ---
      if (this.overrideQueries && Array.isArray(this.overrideQueries) && this.overrideQueries.length > 0) {
        this.output(`[ResearchEngine] Using ${this.overrideQueries.length} override queries.`);
        // --- FIX: Update totalQueries based on overrideQueries ---
        // Estimate: Each override query might go down 'depth' levels, generating 'breadth' sub-queries.
        // Simpler estimate: Just count the override queries as the main tasks.
        // Let's refine this: Each override query is processed, potentially recursively.
        // A better estimate might be overrideQueries.length * (1 + breadth * (depth - 1)) if depth > 0?
        // For simplicity, let's estimate based on the number of override queries and depth.
        // Each override query acts like a starting point.
        const estimatedTotal = this.overrideQueries.length * (1 + breadth * (depth - 1)); // Rough estimate
        this.path.updateProgress({ totalQueries: estimatedTotal > 0 ? estimatedTotal : this.overrideQueries.length }); // Use estimate or fallback

        // Pass runtime depth/breadth to the override execution logic
        result = await this.executeWithOverrideQueries(pathInstance, currentDepth, currentBreadth, this.overrideQueries); // Pass overrideQueries
      } else {
        // Execute standard research flow using the path instance
        this.output(`[ResearchEngine] Starting standard research flow for query: "${contextQuery.original}" (Depth: ${currentDepth}, Breadth: ${currentBreadth})`);
        // Estimate total queries for standard flow
        // A more accurate estimate considering recursion: Sum(breadth^i for i from 0 to depth)
        let estimatedTotal = 0;
        for (let i = 0; i <= currentDepth; i++) {
            estimatedTotal += Math.pow(currentBreadth, i);
        }
        this.path.updateProgress({ totalQueries: estimatedTotal });


        // Pass the runtime query, depth, breadth to the path's research method
        result = await pathInstance.research({ query: contextQuery, depth: currentDepth, breadth: currentBreadth });
      }

      // --- ADD: Deduplicate learnings and sources after main research completes ---
      const uniqueLearnings = [...new Set(result.learnings || [])];
      const uniqueSources = [...new Set(result.sources || [])];
      this.debug(`[ResearchEngine] Deduplicated results: ${uniqueLearnings.length} learnings, ${uniqueSources.length} sources.`);
      // --- END ADD ---


      // Generate summary using the results
      this.output('[ResearchEngine] Generating summary...');
      progressData.status = 'Generating Summary';
      progressData.currentAction = 'Generating final summary...';
      progressFn(progressData);

      const summary = await generateSummary({
        query: contextQuery.original, // Use original context query text
        // --- FIX: Use uniqueLearnings ---
        learnings: uniqueLearnings,
        // --- END FIX ---
        metadata: contextQuery.metadata || null, // Pass metadata if available
        apiKey: this.veniceApiKey, // Use engine's key
        outputFn: this.debug,
        errorFn: this.error
      });
      this.output('[ResearchEngine] Summary generated.');

      // Generate markdown content (no longer saves file)
      this.output('[ResearchEngine] Generating result markdown...');
      progressData.status = 'Generating Result';
      progressData.currentAction = 'Formatting final report...';
      progressFn(progressData);

      const resultData = await this.generateMarkdownResult(
        contextQuery.original, // Save using the original context query
        // --- FIX: Use uniqueLearnings and uniqueSources ---
        uniqueLearnings,
        uniqueSources,
        // --- END FIX ---
        summary
      );
      if (!resultData) throw new Error('Failed to generate markdown result content.');

      progressData.status = 'Complete';
      progressData.currentAction = 'Research complete.';
      progressFn(progressData);

      // --- FIX: Include unique learnings/sources in the final result ---
      this.output(`[ResearchEngine] Research complete. Suggested Filename: ${resultData.suggestedFilename}`);
      return {
          learnings: uniqueLearnings, // Return unique
          sources: uniqueSources,     // Return unique
          followUpQueries: result.followUpQueries, // Follow-ups are usually not deduplicated across levels
          summary,
          markdownContent: resultData.markdownContent,
          suggestedFilename: resultData.suggestedFilename };
      // --- END FIX ---

    } catch (error) {
      this.error(`[ResearchEngine] Error during research: ${error.message}`);
      console.error(error.stack); // Log stack for debugging
       // Send final progress update indicating error
       // Ensure progressData is defined before accessing properties
       const errorProgress = {
           status: 'Error',
           error: error.message,
           completedQueries: progressData?.completedQueries || 0,
           totalQueries: progressData?.totalQueries || 0,
           currentAction: `Error: ${error.message}`
       };
       progressFn(errorProgress);
      // Return a minimal error structure
      return {
        learnings: [`Research failed for query: ${contextQuery?.original || 'N/A'}`],
        sources: [],
        summary: `Error during research: ${error.message}`,
        markdownContent: null,
        suggestedFilename: null,
        error: error.message // Include error message in result
      };
    }
  }

  /**
   * Execute research using override queries.
   * @param {ResearchPath} pathInstance - The research path instance (already configured with shared provider).
   * @param {number} depth - Runtime depth for each override query path.
   * @param {number} breadth - Runtime breadth for each override query path.
   * @param {Array<Object>} overrideQueries - The list of override query objects { original: string, metadata?: any }.
   * @returns {Promise<Object>} Research results.
   */
  async executeWithOverrideQueries(pathInstance, depth, breadth, overrideQueries) {
    const learnings = [];
    const sources = new Set(); // Use Set for unique sources

    // Process each override query sequentially for now to manage progress updates better
    for (let i = 0; i < overrideQueries.length; i++) {
      const queryObj = overrideQueries[i]; // Already in { original: string, metadata?: any } format

      // Add detailed check for queryObj structure
      if (!queryObj || typeof queryObj.original !== 'string') {
          this.error(`[executeWithOverrideQueries] Skipping invalid override query object at index ${i}: ${JSON.stringify(queryObj)}`);
          continue; // Skip this invalid query
      }

      this.output(`[ResearchEngine] Processing override query ${i+1}/${overrideQueries.length}: "${queryObj.original}"`);

      // Use the path instance's research method for each override query
      // This will handle the recursive search for each starting query.
      const pathResult = await pathInstance.research({
        query: queryObj,
        depth: depth, // Use runtime depth for this path
        breadth: breadth // Use runtime breadth for this path
      });

      // Accumulate results
      learnings.push(...pathResult.learnings);
      pathResult.sources.forEach(source => sources.add(source));

      // Results are accumulated directly in learnings/sources by processQuery
    }

    this.output(`[ResearchEngine] Completed processing ${overrideQueries.length} override queries.`);
    // Deduplicate learnings before returning
    return { learnings: Array.from(new Set(learnings)), sources: Array.from(sources) };
  }

  /**
   * Generate research queries from chat context
   * ... JSDoc ...
   */
  async generateQueriesFromChatContext(chatHistory, memoryBlocks = [], numQueries = 3) {
    // ... existing code ...
    // This method seems less relevant now as query generation is handled in executeExitResearch
    // Keep it for potential future use or direct calls? For now, leave as is.
    this.output('[ResearchEngine] generateQueriesFromChatContext called (potentially deprecated).');
    // Placeholder implementation if needed
    const context = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    return generateQueries({
        apiKey: this.veniceApiKey,
        query: context,
        numQueries: numQueries,
        outputFn: this.debug,
        errorFn: this.error
    });
  }

  /**
   * Generates markdown content for research results. Does not save to file.
   * @param {string} query - The original query.
   * @param {Array<string>} learnings - Array of key learnings.
   * @param {Array<string>} sources - Array of source URLs.
   * @param {string} [summary='No summary available.'] - The research summary.
   * @returns {Promise<{suggestedFilename: string, markdownContent: string}|null>} Object containing suggested filename and markdown content, or null on error.
   */
  async generateMarkdownResult(query, learnings, sources, summary = 'No summary available.') {
    try {
      // Ensure 'research' directory exists for potential temporary use if needed, but not for saving final result
      // await ensureDir('research'); // Can be removed if no temp files are ever created

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Sanitize query for filename more robustly
      const subject = (query || 'untitled-research') // Ensure a default subject
          .replace(/[^a-zA-Z0-9\s-]+/g, '') // Remove non-alphanumeric (allow spaces and hyphens)
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .toLowerCase()
          .substring(0, 50); // Limit length
      // Suggest a filename based on the 'research' directory structure, even if not saved there
      const suggestedFilename = path.join('research', `research-${subject}-${timestamp}.md`).replace(/\\/g, '/'); // Use forward slashes

      // Generate markdown
      const markdownContent = [
        '# Research Results',
        '---',
        `## Query\n\n${query}`,
        '',
        `## Summary\n\n${summary}`,
        '',
        `## Key Learnings\n`,
        // Use bullet points for learnings
        ...(learnings || []).map(l => `- ${l}`), // Handle potentially undefined learnings
        '',
        `## References\n`,
        ...(sources || []).map(s => `- ${s}`), // Handle potentially undefined sources
      ].join('\n');

      // await fs.writeFile(filename, markdownContent); // REMOVED: Do not save file locally
      this.output(`[ResearchEngine] Markdown content generated (suggested filename: ${suggestedFilename})`); // Use engine's output handler
      return { suggestedFilename: suggestedFilename, markdownContent: markdownContent }; // Return filename suggestion and content
    } catch (error) {
      this.error(`[ResearchEngine] Error generating markdown result: ${error.message}`); // Use engine's error handler
      console.error(error.stack);
      return null;
    }
  }
}

export default ResearchEngine;
