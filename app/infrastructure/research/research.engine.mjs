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
   * @returns {Promise<object>} Research results including learnings, sources, summary, and filename.
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
      };
      // Send initial progress if handler exists
      progressFn(progressData);


      // Create ResearchPath with the engine's config (API keys, user, handlers, progress)
      // Pass the engine's config object and the progressData object
      const pathInstance = new ResearchPath(this.config, progressData); // Pass engine config and progressData object

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
        const estimatedTotal = 1 + (breadth * depth);
        this.path.updateProgress({ totalQueries: estimatedTotal });

        // Pass the runtime query, depth, breadth to the path's research method
        result = await pathInstance.research({ query: contextQuery, depth: currentDepth, breadth: currentBreadth });
      }

      // Generate summary using the results
      this.output('[ResearchEngine] Generating summary...');
      progressData.status = 'Generating Summary';
      progressFn(progressData);

      const summary = await generateSummary({
        query: contextQuery.original, // Use original context query text
        learnings: result.learnings,
        metadata: contextQuery.metadata || null, // Pass metadata if available
        apiKey: this.veniceApiKey // Use engine's key
      });
      this.output('[ResearchEngine] Summary generated.');

      // Save results
      this.output('[ResearchEngine] Saving results...');
      progressData.status = 'Saving Results';
      progressFn(progressData);

      const filename = await this.saveResults(
        contextQuery.original, // Save using the original context query
        result.learnings,
        result.sources,
        summary
      );

      progressData.status = 'Complete';
      progressFn(progressData);

      this.output(`[ResearchEngine] Research complete. Results saved to: ${filename}`);
      return { ...result, summary, filename }; // Include summary in the final result

    } catch (error) {
      this.error(`[ResearchEngine] Error during research: ${error.message}`);
      console.error(error.stack); // Log stack for debugging
       // Send final progress update indicating error
       // Ensure progressData is defined before accessing properties
       const errorProgress = {
           status: 'Error',
           error: error.message,
           completedQueries: progressData?.completedQueries || 0,
           totalQueries: progressData?.totalQueries || 0
       };
       progressFn(errorProgress);
      // Return a minimal error structure
      return {
        learnings: [`Research failed for query: ${contextQuery?.original || 'N/A'}`],
        sources: [],
        summary: `Error during research: ${error.message}`,
        filename: null,
        error: error.message // Include error message in result
      };
    }
  }

  /**
   * Execute research using override queries.
   * @param {ResearchPath} pathInstance - The research path instance.
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

      // Use the path instance's processQuery method for each override query
      // This will handle the recursive search for each starting query.
      await pathInstance.processQuery(
        queryObj,
        depth, // Use runtime depth for this path
        breadth, // Use runtime breadth for this path
        learnings, // Accumulate learnings
        sources    // Accumulate sources (passed as Set)
      );

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
  }

  async saveResults(query, learnings, sources, summary = 'No summary available.') {
    try {
      await ensureDir('research');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Sanitize query for filename more robustly
      const subject = (query || 'untitled')
          .replace(/[^a-zA-Z0-9\s]+/g, '') // Remove non-alphanumeric (allow spaces)
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .toLowerCase()
          .substring(0, 50); // Limit length
      const filename = path.join('research', `research-${subject}-${timestamp}.md`);

      // Generate markdown
      const markdown = [
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

      await fs.writeFile(filename, markdown);
      this.output(`[ResearchEngine] Results saved to ${filename}`); // Use engine's output handler
      return filename;
    } catch (error) {
      this.error(`[ResearchEngine] Error saving research results: ${error.message}`); // Use engine's error handler
      console.error(error.stack);
      return null;
    }
  }
}
