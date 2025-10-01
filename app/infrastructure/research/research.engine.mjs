/**
 * Contract
 * Inputs:
 *   - config?: {
 *       braveApiKey?: string;
 *       veniceApiKey?: string;
 *       verbose?: boolean;
 *       user?: { username?: string; role?: string };
 *       outputHandler?: (line: string) => void;
 *       errorHandler?: (line: string) => void;
 *       debugHandler?: (line: string) => void;
 *       progressHandler?: (progress: object) => void;
 *       isWebSocket?: boolean;
 *       webSocketClient?: unknown;
 *       overrideQueries?: Array<{ original: string; metadata?: any }>;
 *       telemetry?: { emitStatus?: (payload: any) => void; emitThought?: (payload: any) => void };
 *       model?: string;
 *       character?: string | null;
 *     }
 * Outputs:
 *   - ResearchEngine instance with `research({ query, depth, breadth })` returning a Promise<ResearchOutcome> where
 *     ResearchOutcome = { learnings: string[]; sources: string[]; followUpQueries?: any[]; summary: string; markdownContent: string | null; suggestedFilename: string | null; error?: string }.
 * Error modes:
 *   - Throws during construction when required API keys are absent outside of test mode.
 *   - `research` rejects with validation errors for missing query/depth/breadth and propagates underlying provider failures.
 * Performance:
 *   - Designed for depth/breadth up to low double digits; uses rate limiter (5 req/sec). Markdown generation is in-memory.
 * Side effects:
 *   - Issues network calls via search providers and Venice LLM client, emits telemetry/log lines, and mutates progress handlers.
 */

import { ResearchPath } from './research.path.mjs';
import { LLMClient } from '../ai/venice.llm-client.mjs';
import { BraveSearchProvider } from '../search/search.providers.mjs';
import { RateLimiter } from '../../utils/research.rate-limiter.mjs';
import {
  generateSummary,
  generateQueries,
  generateQueriesLLM,
  generateSummaryLLM,
  processResults
} from '../../features/ai/research.providers.mjs';
import { getDefaultResearchCharacterSlug } from '../ai/venice.characters.mjs';
import { buildResearchMarkdown } from './research.markdown.mjs';
import { runOverrideQueries } from './research.override-runner.mjs';

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
      overrideQueries = null, // --- NEW: Accept overrideQueries in config ---
      telemetry = null
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
    this.overrideQueries = overrideQueries;
    this.telemetry = telemetry || null;

    // --- NEW: Add convenience aliases using the correctly assigned handlers ---
    this.output = this.outputHandler;
    this.error = this.errorHandler;
    this.debug = this.debugHandler;
    this.progress = this.progressHandler; // Use the assigned progressHandler

    // Store the original config object if needed elsewhere, though direct properties are preferred
    this.config = config; // Store the passed config

    // Validate essential config
    if (!this.braveApiKey || !this.veniceApiKey) {
      const isVitest = !!process.env.VITEST;
      const isTestNode = typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'test');
      if (isVitest || isTestNode) {
        this.error('[ResearchEngine] WARNING: Missing API keys in test environment; continuing with mocks.');
      } else {
        this.error('[ResearchEngine] CRITICAL: ResearchEngine requires braveApiKey and veniceApiKey in config.');
        throw new Error('ResearchEngine requires braveApiKey and veniceApiKey in config.');
      }
    }

    if (!this.user || !this.user.username) {
      this.debug('[ResearchEngine] Warning: User information not provided in config.');
      this.user = this.user || { username: 'unknown', role: 'unknown' };
    }

    this.searchProvider = null;
    if (this.braveApiKey) {
      try {
        this.searchProvider = new BraveSearchProvider({ apiKey: this.braveApiKey, debugHandler: this.debugHandler });
        this.debug('[ResearchEngine] Search provider initialised successfully.');
      } catch (providerError) {
        this.error(`[ResearchEngine] CRITICAL: Failed to initialise search provider: ${providerError.message}`);
        if (!process.env.VITEST) throw providerError;
      }
    } else {
      this.debug('[ResearchEngine] Search provider not initialised due to missing Brave API key (test mode).');
    }

    this.debug(`[ResearchEngine] Initialized for user: ${this.user.username}`);
    if (this.overrideQueries) {
        this.debug(`[ResearchEngine] Initialized with ${this.overrideQueries.length} override queries.`);
    }

    const llmConfig = {};
    if (this.veniceApiKey) {
      llmConfig.apiKey = this.veniceApiKey;
    }
    if (config.model) { // Pass model from engine options to LLMClient
        llmConfig.model = config.model;
    }
    // Character is passed to specific AI provider functions, not set globally on LLMClient here.
    // ResearchEngine might have a default research character.
    this.researchCharacterSlug = config.character === 'None' ? null : (config.character || getDefaultResearchCharacterSlug());


    if (this.veniceApiKey) {
      this.llmClient = new LLMClient(llmConfig);
    } else {
      this.llmClient = {
        config: { model: llmConfig.model || 'mock-model' },
        completeChat: async () => ({ content: '' }),
        complete: async () => ({ content: '' })
      };
    }
    const llmModel = this.llmClient?.config?.model || llmConfig.model || 'mock-model';
    this.debugHandler(`ResearchEngine LLMClient initialized. API Key Set: ${!!this.veniceApiKey}, Model: ${llmModel}, Character for Research: ${this.researchCharacterSlug || 'Default (from provider)'}`);

    this.rateLimiter = new RateLimiter(5, 1000);

    if (!this.braveApiKey) {
      this.outputHandler('[ResearchEngine] Warning: Brave API key not provided or not decrypted. Search functionality will fail if global BRAVE_API_KEY is also missing.');
    }
    if (!this.veniceApiKey) {
      this.outputHandler('[ResearchEngine] Warning: Venice API key not provided or not decrypted. AI functionalities may fail or use environment fallbacks if global VENICE_API_KEY is also missing.');
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
    this.telemetry?.emitStatus({
      stage: 'engine-start',
      message: 'Research engine initialized.',
      meta: {
        query: contextQuery.original,
        depth: currentDepth,
        breadth: currentBreadth
      }
    });
    this.telemetry?.emitThought({
      text: `Exploring root query: "${contextQuery.original}"`,
      stage: 'engine'
    });
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
      searchProvider: this.searchProvider, // Pass the shared provider instance
      telemetry: this.telemetry
      };
      const pathInstance = new ResearchPath(pathConfig, progressData); // Pass combined config and progressData object

      // Store path instance for potential override logic or testing
      this.path = pathInstance;

      let result;

      // --- FIX: Use this.overrideQueries stored during construction ---
      if (this.overrideQueries && Array.isArray(this.overrideQueries) && this.overrideQueries.length > 0) {
        this.output(`[ResearchEngine] Using ${this.overrideQueries.length} override queries.`);
        this.telemetry?.emitStatus({
          stage: 'engine-override',
          message: `Executing override queries (${this.overrideQueries.length}).`
        });
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
        result = await runOverrideQueries({
          overrideQueries: this.overrideQueries,
          pathInstance,
          depth: currentDepth,
          breadth: currentBreadth,
          log: this.output,
          emitStatus: (payload) => this.telemetry?.emitStatus?.(payload),
          emitThought: (payload) => this.telemetry?.emitThought?.(payload)
        });
      } else {
        // Execute standard research flow using the path instance
        this.output(`[ResearchEngine] Starting standard research flow for query: "${contextQuery.original}" (Depth: ${currentDepth}, Breadth: ${currentBreadth})`);
        this.telemetry?.emitStatus({
          stage: 'engine-flow',
          message: 'Starting standard research flow.'
        });
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
      this.telemetry?.emitStatus({
        stage: 'summary',
        message: 'Generating final research summary.'
      });

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
      this.telemetry?.emitStatus({
        stage: 'finalizing',
        message: 'Formatting final research report.'
      });

      const resultData = await buildResearchMarkdown({
        query: contextQuery.original,
        learnings: uniqueLearnings,
        sources: uniqueSources,
        summary,
        logger: { info: this.output, error: this.error }
      });
      if (!resultData) throw new Error('Failed to generate markdown result content.');

      progressData.status = 'Complete';
      progressData.currentAction = 'Research complete.';
      progressFn(progressData);
      this.telemetry?.emitStatus({
        stage: 'engine-complete',
        message: 'Research engine completed successfully.'
      });

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
      this.telemetry?.emitStatus({
        stage: 'engine-error',
        message: 'Research engine encountered an error.',
        detail: error.message
      });
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
  async generateQueries(query, numQueries, learnings = [], metadata = null) {
    this.debugHandler(`Generating ${numQueries} queries for: "${query.original}" using character: ${this.researchCharacterSlug}`);
    try {
      return await generateQueriesLLM({
        llmClient: this.llmClient,
        query: query.original,
        numQueries,
        learnings,
        metadata,
        characterSlug: this.researchCharacterSlug
      });
    } catch (error) {
      this.errorHandler(`Error generating queries: ${error.message}`);
      throw error;
    }
  }

  async generateSummary(query, allLearnings, allSources) {
    this.debugHandler(`Generating summary for query: "${query.original}" using character: ${this.researchCharacterSlug}`);
    if (allLearnings.length === 0) {
      this.outputHandler("No learnings found to summarize.");
      return "No summary could be generated as no learnings were found.";
    }
    try {
      return await generateSummaryLLM({
        llmClient: this.llmClient,
        query: query.original,
        learnings: allLearnings,
        sources: allSources,
        characterSlug: this.researchCharacterSlug
      });
    } catch (error) {
      this.errorHandler(`Error generating summary: ${error.message}`);
      return `Summary generation failed: ${error.message}`;
    }
  }

  async processResults(results, query) {
    this.debugHandler(`Processing ${results.length} results for query: "${query}" using character: ${this.researchCharacterSlug}`);
    try {
      return await processResults({ // Assuming processResults is the actual function name
        results,
        query,
        llmClient: this.llmClient,
        characterSlug: this.researchCharacterSlug
      });
    } catch (error) {
      this.errorHandler(`Error processing results: ${error.message}`);
      throw error;
    }
  }
}
