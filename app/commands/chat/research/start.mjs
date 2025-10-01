/**
 * Why: Handle launching the research engine when `/chat` transitions into investigative mode.
 * What: Normalizes options, resolves API credentials, generates queries, and coordinates telemetry streams.
 * How: Validates inputs, composes helpers from the research suite, and returns structured success/error payloads.
 */

import { userManager } from '../../../features/auth/user-manager.mjs';
import { resolveResearchDefaults } from '../../../features/research/research.defaults.mjs';
import { ResearchEngine } from '../../../infrastructure/research/research.engine.mjs';
import { resolveApiKeys } from '../../../utils/api-keys.mjs';
import { output as outputManagerInstance } from '../../../utils/research.output-manager.mjs';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { generateResearchQueries } from './queries.mjs';

/**
 * Contract
 * Inputs: either positional signature (chatHistory, memoryBlocks, options) or an options object containing:
 *   - chatHistory?: Array
 *   - memoryBlocks?: Array
 *   - depth?, breadth?, isPublic?: overrides
 *   - classificationMetadata?: object
 *   - overrideQueries?: Array
 *   - output?, error?, progressHandler?, verbose?, isWebSocket?, webSocketClient?, session?, user?, telemetry?
 * Outputs: Promise<{ success: boolean; topic?: string; results?: object; error?: string }>
 * Error modes: missing chat history/queries, missing API keys, or engine failures surfaced via error handler and result payloads.
 * Side effects: emits telemetry events, streams progress via WebSocket, and instantiates the research engine.
 */
export async function startResearchFromChat(...args) {
  let options;
  if (Array.isArray(args[0])) {
    const [chatHistory, memoryBlocks = [], legacyOptions = {}] = args;
    options = { chatHistory, memoryBlocks, ...legacyOptions };
  } else {
    options = args[0] || {};
  }

  const {
    chatHistory = [],
    memoryBlocks = [],
    depth: depthOverride,
    breadth: breadthOverride,
    isPublic: visibilityOverride,
    verbose = false,
    classificationMetadata = null,
    overrideQueries,
    output: outputFn,
    error: errorFn,
    progressHandler,
    isWebSocket = false,
    webSocketClient = null,
    user: providedUser,
    telemetry = null,
  } = options;

  const sessionRef = options.session ?? null;

  const { depth, breadth, isPublic } = await resolveResearchDefaults({
    depth: depthOverride,
    breadth: breadthOverride,
    isPublic: visibilityOverride,
  });

  Object.assign(options, { depth, breadth, isPublic });

  const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
  const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;
  const telemetryChannel = telemetry || null;

  try {
    const hasPrebuiltQueries = Array.isArray(overrideQueries) && overrideQueries.length > 0;
    if (!hasPrebuiltQueries && (!Array.isArray(chatHistory) || chatHistory.length === 0)) {
      throw new Error('Chat history is required to start research.');
    }

    telemetryChannel?.emitStatus({
      stage: 'chat-bootstrap',
      message: hasPrebuiltQueries
        ? 'Using pre-generated research queries from chat context.'
        : 'Analyzing chat history for research directives.',
    });

    let queries = overrideQueries;
    if (!Array.isArray(queries) || queries.length === 0) {
      telemetryChannel?.emitStatus({
        stage: 'chat-queries',
        message: 'Generating follow-up research queries from chat history.',
      });
      queries = await generateResearchQueries(chatHistory, memoryBlocks, {
        numQueries: Math.max(3, breadth),
        metadata: classificationMetadata,
        output: effectiveOutput,
        error: effectiveError,
      });
    }

    if (!Array.isArray(queries) || queries.length === 0) {
      telemetryChannel?.emitStatus({
        stage: 'chat-error',
        message: 'Failed to derive research queries from chat history.',
      });
      throw new Error('Research requires generated queries (overrideQueries).');
    }

    const representativeQuery = queries[0]?.original || 'Research from chat history';

    telemetryChannel?.emitThought({
      text: `Primary query: ${representativeQuery}`,
      stage: 'planning',
    });

    let userInfo = providedUser;
    if (!userInfo) {
      try {
        userInfo = await userManager.getUserData();
      } catch (err) {
        effectiveOutput(`[startResearchFromChat] Unable to read stored user profile: ${err.message}. Using defaults.`);
        userInfo = null;
      }
    }
    userInfo = userInfo || userManager.getCurrentUser();

    const { brave: braveKey, venice: veniceKey } = await resolveApiKeys({ session: sessionRef });

    if (!braveKey) {
      effectiveError('Brave API key is missing. Configure it via /keys set brave <value> or set BRAVE_API_KEY.');
      return { success: false, error: 'Missing Brave API key', keepDisabled: false };
    }

    if (!veniceKey) {
      effectiveError('Venice API key is missing. Configure it via /keys set venice <value> or set VENICE_API_KEY.');
      return { success: false, error: 'Missing Venice API key', keepDisabled: false };
    }

    const wrappedProgressHandler = (progressData = {}) => {
      const emittedEvent = telemetryChannel ? telemetryChannel.emitProgress(progressData) : null;
      const enrichedProgress = emittedEvent
        ? { ...progressData, eventId: emittedEvent.id, timestamp: emittedEvent.timestamp }
        : { ...progressData };

      if (typeof progressHandler === 'function') {
        try {
          progressHandler(enrichedProgress);
        } catch (handlerError) {
          console.error('[startResearchFromChat] progressHandler threw an error:', handlerError);
        }
      } else if (isWebSocket && webSocketClient) {
        safeSend(webSocketClient, { type: 'progress', data: enrichedProgress });
      } else if (verbose) {
        console.log('[chat-research-progress]', enrichedProgress);
      }
    };

    effectiveOutput('Initializing research engine...');
    telemetryChannel?.emitStatus({
      stage: 'running',
      message: 'Initializing research engine for chat-derived mission.',
      meta: { depth, breadth, queries: queries.length, visibility: isPublic ? 'public' : 'private' },
    });

    const engine = new ResearchEngine({
      braveApiKey: braveKey,
      veniceApiKey: veniceKey,
      verbose,
      user: {
        username: userInfo?.username || 'operator',
        role: userInfo?.role || 'admin',
      },
      outputHandler: effectiveOutput,
      errorHandler: effectiveError,
      debugHandler: (msg) => {
        if (verbose) {
          effectiveOutput(`[DEBUG] ${msg}`);
        }
      },
      progressHandler: wrappedProgressHandler,
      isWebSocket,
      webSocketClient,
      overrideQueries: queries,
      telemetry: telemetryChannel,
    });

    effectiveOutput(`Starting research based on ${queries.length} generated queries (derived from chat history). Visibility: ${isPublic ? 'public' : 'private'}.`);

    const placeholderQueryObj = {
      original: representativeQuery,
      metadata: classificationMetadata,
    };

    const results = await engine.research({
      query: placeholderQueryObj,
      depth,
      breadth,
    });

    return {
      success: true,
      topic: representativeQuery,
      results,
    };
  } catch (error) {
    effectiveError(`Error during research from chat: ${error.message}`);
    telemetryChannel?.emitStatus({
      stage: 'chat-error',
      message: 'Research from chat failed.',
      detail: error.message,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}
