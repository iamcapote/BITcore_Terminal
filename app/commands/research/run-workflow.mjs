/**
 * Why: Encapsulate the core `/research` execution flow so the CLI entrypoint stays small and manageable.
 * What: Handles authentication checks, key resolution, query enrichment, engine execution, and post-run prompts for both CLI and WebSocket callers.
 * How: Composes helper modules (keys, memory, engine, prompts) behind a single async function that returns a uniform command result payload.
 * Contract
 *   Inputs:
 *     - params: ResearchWorkflowParams {
 *         options: object;
 *         researchQuery: string | null;
 *         queryState: { researchQuery: string | null; enhancedQuery: object | null };
 *         currentUser: { username: string; role: string } | null;
 *         isWebSocket: boolean;
 *         session: object | null;
 *         userPassword: string | null;
 *         effectiveOutput: Function;
 *         effectiveError: Function;
 *         effectiveDebug: Function;
 *         effectivePrompt: Function;
 *         effectiveProgress: Function;
 *         telemetryChannel: object | null;
 *         verbose: boolean;
 *         optionOverrideQueries: string[];
 *         webSocketClient: object | null;
 *         depth: number;
 *         breadth: number;
 *         isPublic: boolean;
 *         commandStartedAt: number;
 *         logger: object;
 *         formatError: Function
 *       }
 *   Outputs:
 *     - Promise<{ commandResult: { success: boolean; handled?: boolean; error?: string; keepDisabled?: boolean }, results?: object, researchStartedAt?: number }>
 *   Error modes:
 *     - Throws on unexpected infrastructure failures; returns handled=false for unclassified errors; handled=true for validation/key issues.
 *   Performance:
 *     - Guard + enrichment under 2s (soft), streaming engine work bounded by upstream providers; memory <15 MB via shared services.
 *   Side effects:
 *     - Emits WebSocket events, logs via provided logger, persists session snapshots, mutates shared queryState, updates CLI session cache.
 */

import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { logCommandStart } from '../../utils/cli-error-handler.mjs';
import { safeSend } from '../../utils/websocket.utils.mjs';
import { createMemoryService } from '../../features/memory/memory.service.mjs';
import { prepareMemoryContext } from './memory-context.mjs';
import {
  resolveResearchKeys,
  MissingResearchKeysError,
  ResearchKeyResolutionError
} from './keys.mjs';
import { enrichResearchQuery } from './query-classifier.mjs';
import { setCliResearchResult, clearCliResearchResult } from './state.mjs';
import { persistSessionFromRef } from '../../infrastructure/session/session.store.mjs';
import { saveResearchArtifact } from '../../infrastructure/research/research.archive.mjs';
import config from '../../config/index.mjs';

const sharedMemoryService = createMemoryService();
const MEMORY_CONTEXT_MAX_RECORDS = 5;
const POST_RESEARCH_PROMPT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Execute the research workflow and return the command result payload.
 * @param {Object} params - Execution context.
 * @param {Object} params.options - Raw command options for logging.
 * @param {string|null} params.researchQuery - Initial research query (may be null for CLI prompts).
 * @param {Object} params.queryState - Mutable holder for tracking original/enhanced queries.
 * @param {Object|null} params.currentUser - Active user record.
 * @param {boolean} params.isWebSocket - True when invoked from WebSocket flow.
 * @param {Object|null} params.session - Active WebSocket session.
 * @param {string|null} params.userPassword - Password (if any) resolved earlier in the pipeline.
 * @param {function} params.effectiveOutput - Output emitter.
 * @param {function} params.effectiveError - Error emitter.
 * @param {function} params.effectiveDebug - Debug emitter.
 * @param {function} params.effectivePrompt - Prompt helper (WebSocket or CLI variant).
 * @param {function} params.effectiveProgress - Progress emitter.
 * @param {Object|null} params.telemetryChannel - Telemetry channel instance.
 * @param {boolean} params.verbose - Verbose logging flag.
 * @param {Array} params.optionOverrideQueries - Override query list supplied via options.
 * @param {Object|null} params.webSocketClient - WebSocket client reference.
 * @param {number} params.depth - Research depth setting.
 * @param {number} params.breadth - Research breadth setting.
 * @param {boolean} params.isPublic - Public visibility flag.
 * @param {number} params.commandStartedAt - Timestamp marking when the command began.
 * @param {Object} params.logger - Module logger instance.
 * @param {function} params.formatError - Error formatter for user-facing messages.
 * @returns {Promise<{ commandResult: Object, results?: Object, researchStartedAt?: number }>}
 */
export async function runResearchWorkflow({
  options,
  researchQuery,
  queryState,
  currentUser,
  isWebSocket,
  session,
  userPassword,
  effectiveOutput,
  effectiveError,
  effectiveDebug,
  effectivePrompt,
  effectiveProgress,
  telemetryChannel,
  verbose,
  optionOverrideQueries = [],
  webSocketClient,
  depth,
  breadth,
  isPublic,
  commandStartedAt,
  logger,
  formatError
}) {
  const currentUsername = currentUser ? currentUser.username : 'public';
  const currentUserRole = currentUser ? currentUser.role : 'public';
  const isAuthenticated = Boolean(currentUser && currentUser.role !== 'public');

  effectiveDebug(`[runResearchWorkflow] Authentication check: currentUser=${currentUsername}, role=${currentUserRole}, isAuthenticated=${isAuthenticated}`);

  if (!isAuthenticated) {
    effectiveError('You must be logged in to use the /research command.');
    return {
      commandResult: {
        success: false,
        error: 'Authentication required',
        handled: true,
        keepDisabled: false
      }
    };
  }

  logCommandStart('research', options);

  if (!isWebSocket) {
    clearCliResearchResult();
  }

  let braveKey;
  let veniceKey;
  try {
    ({ braveKey, veniceKey } = await resolveResearchKeys({
      username: currentUsername,
      session,
      telemetry: telemetryChannel,
      debug: effectiveDebug
    }));
  } catch (keyError) {
    if (keyError instanceof MissingResearchKeysError) {
      const missingLabel = keyError.missingKeys.join(', ');
      effectiveError(`Missing API key(s) required for research: ${missingLabel}. Use /keys set to configure.`);
      return {
        commandResult: {
          success: false,
          error: keyError.message,
          handled: true,
          keepDisabled: false
        }
      };
    }
    if (keyError instanceof ResearchKeyResolutionError) {
      effectiveError(`Unable to resolve API key(s): ${keyError.message}. Configure them via /keys set or environment variables.`);
      return {
        commandResult: {
          success: false,
          error: keyError.message,
          handled: true,
          keepDisabled: false
        }
      };
    }
    throw keyError;
  }

  if (!researchQuery) {
    if (isWebSocket) {
      effectiveError('Internal Error: Research query is missing in WebSocket mode after prompt.');
      return {
        commandResult: {
          success: false,
          error: 'Query required',
          handled: true,
          keepDisabled: false
        }
      };
    }
    researchQuery = await effectivePrompt('What would you like to research? ');
    if (!researchQuery) {
      effectiveError('Research query cannot be empty.');
      return {
        commandResult: {
          success: false,
          error: 'Empty query',
          handled: true,
          keepDisabled: false
        }
      };
    }
  }

  queryState.researchQuery = researchQuery;

  telemetryChannel?.emitThought({
    text: `Research focus: ${researchQuery}`,
    stage: 'planning'
  });
  telemetryChannel?.emitStatus({
    stage: 'planning',
    message: 'Research query accepted.',
    meta: {
      depth,
      breadth,
      visibility: isPublic ? 'public' : 'private'
    }
  });

  const enhancedQuery = await enrichResearchQuery({
    query: researchQuery,
    classify: options.classify || false,
    veniceKey,
    output: effectiveOutput,
    error: effectiveError,
    telemetry: telemetryChannel
  });
  queryState.enhancedQuery = enhancedQuery;

  if (isWebSocket && session) {
    session.currentResearchQuery = enhancedQuery?.original || researchQuery;
    session.currentResearchResult = null;
    session.currentResearchFilename = null;
    session.currentResearchSummary = null;
  }

  const { overrideQueries: memoryOverrides } = await prepareMemoryContext({
    query: researchQuery,
    memoryService: sharedMemoryService,
    user: currentUser,
    fallbackUsername: currentUsername,
    limit: MEMORY_CONTEXT_MAX_RECORDS,
    telemetry: telemetryChannel,
    debug: effectiveDebug
  });

  const combinedOverrideQueries = [
    ...(Array.isArray(optionOverrideQueries) ? optionOverrideQueries : []),
    ...memoryOverrides
  ];

  const userInfo = { username: currentUsername, role: currentUserRole };
  const engineConfig = {
    braveApiKey: braveKey,
    veniceApiKey: veniceKey,
    verbose,
    user: userInfo,
    outputHandler: effectiveOutput,
    errorHandler: effectiveError,
    debugHandler: effectiveDebug,
    progressHandler: effectiveProgress,
    telemetry: telemetryChannel,
    isWebSocket,
    webSocketClient
  };

  if (combinedOverrideQueries.length) {
    engineConfig.overrideQueries = combinedOverrideQueries;
  }

  const controller = new ResearchEngine(engineConfig);

  effectiveOutput(`Starting research pipeline... (depth ${depth}, breadth ${breadth}, ${isPublic ? 'public' : 'private'} visibility)`, true);
  telemetryChannel?.emitStatus({
    stage: 'running',
    message: 'Executing research pipeline.',
    meta: {
      depth,
      breadth,
      query: enhancedQuery.original,
      visibility: isPublic ? 'public' : 'private'
    }
  });
  telemetryChannel?.emitThought({
    text: `Initiating research for "${enhancedQuery.original}"`,
    stage: 'running'
  });

  if (isWebSocket && webSocketClient) {
    safeSend(webSocketClient, { type: 'research_start', keepDisabled: true });
  }

  const researchStartedAt = Date.now();
  const results = await controller.research({
    query: enhancedQuery,
    depth,
    breadth
  });

  if (!results || results.success === false) {
    const failureMessage = formatError(new Error(results?.error || 'Unknown error during research execution.'), {
      stage: 'engine',
      query: enhancedQuery?.original || researchQuery
    });
    effectiveError(failureMessage);
    if (!isWebSocket) {
      clearCliResearchResult();
    }
    return {
      commandResult: {
        success: false,
        error: results?.error || 'Research failed',
        handled: true,
        keepDisabled: false
      },
      results,
      researchStartedAt
    };
  }

  if (results.markdownContent && isWebSocket && session) {
    session.currentResearchResult = results.markdownContent;
    session.currentResearchFilename = results.suggestedFilename;
    session.promptData = { suggestedFilename: results.suggestedFilename };
    effectiveDebug('Stored research markdown content and suggested filename in session and promptData.');
    if (session.password !== userPassword) session.password = userPassword;
    try {
      await persistSessionFromRef(session, {
        currentResearchSummary: results.summary ?? null,
        currentResearchQuery: enhancedQuery?.original ?? researchQuery
      });
    } catch (persistError) {
      logger.warn('Failed to persist session snapshot after research completion.', {
        message: persistError?.message || String(persistError),
        sessionId: session?.sessionId || null
      });
    }
  } else if (results.suggestedFilename && isWebSocket && session) {
    effectiveError(`Internal Warning: Suggested filename exists but markdown content is missing in session ${session.sessionId}.`);
  } else if (!isWebSocket && results.markdownContent) {
    setCliResearchResult({
      content: results.markdownContent,
      filename: results.suggestedFilename,
      summary: results.summary ?? null,
      query: enhancedQuery?.original ?? researchQuery,
      generatedAt: new Date().toISOString()
    });
  }

  if (results.markdownContent && config?.research?.archive?.enabled !== false) {
    try {
      await saveResearchArtifact({
        content: results.markdownContent,
        summary: results.summary ?? null,
        query: enhancedQuery?.original ?? researchQuery,
        filename: results.suggestedFilename ?? null,
        depth,
        breadth,
        isPublic,
        createdBy: currentUsername,
        engine: results?.engineMetadata ?? null
      });
    } catch (archiveError) {
      logger.warn('Failed to persist research artifact archive entry.', {
        message: archiveError?.message || String(archiveError)
      });
    }
  }

  if (isWebSocket && webSocketClient) {
    safeSend(webSocketClient, {
      type: 'research_complete',
      summary: results?.summary,
      suggestedFilename: results?.suggestedFilename,
      keepDisabled: true
    });
    effectiveOutput('Research complete. Choose an action:');

    if (typeof effectivePrompt !== 'function') {
      effectiveError('Internal Error: Prompt function not available for post-research action.');
      return {
        commandResult: {
          success: true,
          results,
          keepDisabled: false
        },
        results,
        researchStartedAt
      };
    }

    effectivePrompt(
      webSocketClient,
      session,
      `Choose action for "${results.suggestedFilename || 'research results'}": [Download] | [Upload] | [Keep] | [Discard]`,
      POST_RESEARCH_PROMPT_TIMEOUT_MS,
      false,
      'post_research_action'
    );
    if (session && session.password !== userPassword) {
      session.password = userPassword;
    }
    effectiveDebug('Post-research action prompt sent. Server awaits response via handleInputMessage with context "post_research_action".');
  } else if (!isWebSocket) {
    effectiveOutput('[CMD SUCCESS] research: Completed successfully.');
    if (results.summary) {
      effectiveOutput('');
      effectiveOutput('Summary:');
      effectiveOutput(results.summary.trim());
    }
    if (results.markdownContent) {
      effectiveOutput('');
      effectiveOutput('--- Research Content ---');
      effectiveOutput(results.markdownContent);
      effectiveOutput('--- End Content ---');
      effectiveOutput('');
      effectiveOutput('Next steps: run /export to save locally or /storage save <filename> to upload to GitHub. Latest results stay cached for CLI follow-up commands.');
    }
  }

  return {
    commandResult: {
      success: true,
      results,
      keepDisabled: isWebSocket
    },
    results,
    researchStartedAt
  };
}
