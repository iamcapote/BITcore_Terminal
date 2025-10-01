/**
 * Why: Bridge the `/exitresearch` command from chat sessions into the research pipeline.
 * What: Prompts for scope, handles parameter overrides, orchestrates query generation, and wraps up telemetry/logging.
 * How: Coordinates session state, invokes the research engine launcher, and emits WebSocket events for clients.
 */

import { resolveResearchDefaults } from '../../../features/research/research.defaults.mjs';
import { callVeniceWithTokenClassifier } from '../../../utils/token-classifier.mjs';
import { resolveServiceApiKey } from '../../../utils/api-keys.mjs';
import { output as outputManagerInstance } from '../../../utils/research.output-manager.mjs';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { finalizeSessionConversation } from '../session.mjs';
import { generateResearchQueriesFromContext } from './queries.mjs';
import { startResearchFromChat } from './start.mjs';

const PROMPT_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Contract
 * Inputs: options object with session, output/error handlers, telemetry, wsPrompt, and WebSocket context.
 * Outputs: Promise<{ success: boolean; keepDisabled: boolean; error?: string }>
 * Error modes: missing session/chat history, prompt failures, API/key issues, or research errors reported via handlers.
 * Side effects: prompts user for scope/parameters, launches research pipeline, broadcasts WebSocket events, and finalises session state.
 */
export async function executeExitResearch(options = {}) {
  const {
    session,
    output: outputFn,
    error: errorFn,
    currentUser,
    password: providedPassword,
    isWebSocket,
    webSocketClient,
    telemetry = null,
    depth: depthOverride,
    breadth: breadthOverride,
    isPublic: visibilityOverride,
  } = options;
  const wsPrompt = options.wsPrompt;

  const { depth: resolvedDepth, breadth: resolvedBreadth, isPublic } = await resolveResearchDefaults({
    depth: depthOverride,
    breadth: breadthOverride,
    isPublic: visibilityOverride,
  });

  Object.assign(options, { depth: resolvedDepth, breadth: resolvedBreadth, isPublic });

  if (isWebSocket && !wsPrompt) {
    const missingPromptError = 'Internal Error: wsPrompt function not provided for executeExitResearch.';
    if (typeof errorFn === 'function') errorFn(missingPromptError);
    if (session) {
      session.isChatActive = false;
      session.chatHistory = [];
      session.memoryManager = null;
      await finalizeSessionConversation(session, 'exitresearch-missing-wsprompt');
    }
    if (isWebSocket && webSocketClient) {
      safeSend(webSocketClient, { type: 'chat-exit' });
      safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
    }
    return { success: false, keepDisabled: false };
  }

  const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
  const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;
  const telemetryChannel = telemetry || null;

  if (!session || !session.isChatActive) {
    effectiveError('Not currently in an active chat session.');
    return { success: false, keepDisabled: false };
  }
  const chatHistory = session.chatHistory || [];
  if (chatHistory.length === 0) {
    effectiveError('Chat history is empty. Cannot start research.');
    session.isChatActive = false;
    session.memoryManager = null;
    session.chatHistory = [];
    await finalizeSessionConversation(session, 'exitresearch-empty-history');
    if (isWebSocket && webSocketClient) {
      safeSend(webSocketClient, { type: 'chat-exit' });
      safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
    }
    return { success: false, keepDisabled: false };
  }

  let researchDepth = resolvedDepth;
  let researchBreadth = resolvedBreadth;
  let researchVisibility = isPublic;

  telemetryChannel?.emitStatus({
    stage: 'chat-transition',
    message: 'Transitioning from chat dialogue to research pipeline.',
    meta: {
      depth: researchDepth,
      breadth: researchBreadth,
      visibility: researchVisibility ? 'public' : 'private',
    },
  });

  const transitionStartedAt = Date.now();

  effectiveOutput(`Exiting chat and starting research based on chat history... (depth ${researchDepth}, breadth ${researchBreadth}, ${researchVisibility ? 'public' : 'private'} visibility)`);
  if (isWebSocket && webSocketClient) {
    safeSend(webSocketClient, { type: 'research_start' });
  }

  let researchQueryString = '';
  try {
    let useLastMessage = false;
    if (isWebSocket && webSocketClient && wsPrompt) {
      const choice = await wsPrompt(
        webSocketClient,
        session,
        'Use (1) last message or (2) entire chat history for research? [1/2]: ',
        PROMPT_TIMEOUT_MS,
        false,
        'exitresearch_scope',
      );
      if (choice && choice.trim().startsWith('1')) {
        useLastMessage = true;
      }
    }

    if (useLastMessage) {
      const lastUserMsg = [...chatHistory].reverse().find((msg) => msg.role === 'user');
      researchQueryString = lastUserMsg ? lastUserMsg.content : '';
      if (!researchQueryString) {
        effectiveError('No user message found in chat history.');
        return { success: false, keepDisabled: false };
      }
      effectiveOutput('Using last user message as research query.');
    } else {
      researchQueryString = chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n---\n');
      effectiveOutput('Using entire chat history as research query.');
    }
  } catch (promptError) {
    effectiveError(`Scope prompt failed: ${promptError.message}`);
    return { success: false, keepDisabled: false };
  }

  let researchResult = { success: false, error: 'Research initialization failed' };
  let userPassword = providedPassword || session.password;
  let useClassification = false;
  let classificationMetadata = null;
  let generatedQueries = [];

  try {
    if (isWebSocket && webSocketClient && wsPrompt) {
      try {
        const breadthInput = await wsPrompt(
          webSocketClient,
          session,
          `Enter query generation breadth [1-5, default: ${researchBreadth}]: `,
          PROMPT_TIMEOUT_MS,
        );
        const parsedBreadth = parseInt(breadthInput, 10);
        if (!Number.isNaN(parsedBreadth) && parsedBreadth >= 1 && parsedBreadth <= 5) {
          researchBreadth = parsedBreadth;
        } else if (breadthInput.trim() !== '') {
          effectiveOutput(`Invalid breadth input. Using default: ${researchBreadth}`);
        }
        const depthInput = await wsPrompt(
          webSocketClient,
          session,
          `Enter research depth [1-3, default: ${researchDepth}]: `,
          PROMPT_TIMEOUT_MS,
        );
        const parsedDepth = parseInt(depthInput, 10);
        if (!Number.isNaN(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 3) {
          researchDepth = parsedDepth;
        } else if (depthInput.trim() !== '') {
          effectiveOutput(`Invalid depth input. Using default: ${researchDepth}`);
        }
        const classifyInput = await wsPrompt(
          webSocketClient,
          session,
          'Use token classification? [y/n, default: n]: ',
          PROMPT_TIMEOUT_MS,
        );
        if (classifyInput.trim().toLowerCase() === 'y') {
          useClassification = true;
          effectiveOutput('Token classification enabled.');
        }
      } catch (promptError) {
        effectiveOutput(`Research parameter prompt failed: ${promptError.message}. Using defaults.`);
      }
    } else if (!isWebSocket) {
      effectiveOutput(`Using default research parameters: Query Breadth=${researchBreadth}, Depth=${researchDepth}, Visibility=${researchVisibility ? 'public' : 'private'}, Classification=${useClassification}`);
    }

    const veniceKey = await resolveServiceApiKey('venice', { session });
    if (!veniceKey) {
      throw new Error('Venice API key is missing. Configure it via /keys set venice <value> or set VENICE_API_KEY.');
    }

    if (useClassification) {
      try {
        effectiveOutput('Performing token classification on research query...');
        classificationMetadata = await callVeniceWithTokenClassifier(researchQueryString, veniceKey);
        if (!classificationMetadata) {
          effectiveOutput('Token classification returned no metadata.');
        } else {
          effectiveOutput('Token classification successful.');
          effectiveOutput(`Metadata: ${JSON.stringify(classificationMetadata).substring(0, 200)}...`);
        }
      } catch (classifyError) {
        effectiveError(`Token classification failed: ${classifyError.message}. Proceeding without classification.`);
        classificationMetadata = null;
      }
    }

    generatedQueries = await generateResearchQueriesFromContext(
      [{ role: 'user', content: researchQueryString }],
      [],
      researchBreadth,
      veniceKey,
      classificationMetadata,
      effectiveOutput,
      effectiveError,
    );

    if (generatedQueries.length === 0) {
      throw new Error('Failed to generate research queries from chat history.');
    }

    const researchOptions = {
      depth: researchDepth,
      breadth: researchBreadth,
      isPublic: researchVisibility,
      password: userPassword,
      currentUser,
      isWebSocket,
      webSocketClient,
      classificationMetadata,
      overrideQueries: generatedQueries,
      output: effectiveOutput,
      error: effectiveError,
      progressHandler: options.progressHandler,
      telemetry: telemetryChannel,
      session,
      chatHistory,
    };

    let relevantMemories = [];
    if (session.memoryManager) {
      try {
        relevantMemories = await session.memoryManager.retrieveRelevantMemories(researchQueryString, 5);
        if (relevantMemories.length > 0) {
          telemetryChannel?.emitThought({
            text: `Retrieved ${relevantMemories.length} relevant memory blocks for context.`,
            stage: 'memory',
          });
        }
      } catch (memError) {
        console.error(`[WebSocket] Error retrieving memory for exitResearch: ${memError.message}`);
        effectiveOutput(`[System] Warning: Could not retrieve relevant memories - ${memError.message}`);
        telemetryChannel?.emitStatus({
          stage: 'memory-warning',
          message: 'Memory retrieval failed.',
          detail: memError.message,
        });
      }
    }

    researchResult = await startResearchFromChat(researchOptions);

    if (researchResult.success) {
      const durationMs = Date.now() - transitionStartedAt;
      telemetryChannel?.emitStatus({
        stage: 'summary',
        message: 'Chat-derived research complete.',
      });
      telemetryChannel?.emitComplete({
        success: true,
        durationMs,
        learnings: researchResult.results?.learnings?.length || 0,
        sources: researchResult.results?.sources?.length || 0,
        suggestedFilename: researchResult.results?.suggestedFilename || null,
        summary: researchResult.results?.summary || null,
      });
      if (isWebSocket && webSocketClient) {
        safeSend(webSocketClient, {
          type: 'research_complete',
          summary: researchResult.results?.summary,
          suggestedFilename: researchResult.results?.suggestedFilename,
          keepDisabled: false,
        });
      }
    } else {
      const durationMs = Date.now() - transitionStartedAt;
      telemetryChannel?.emitStatus({
        stage: 'chat-error',
        message: 'Chat-derived research failed.',
        detail: researchResult.error,
      });
      telemetryChannel?.emitComplete({
        success: false,
        durationMs,
        error: researchResult.error,
      });
      if (isWebSocket && webSocketClient) {
        safeSend(webSocketClient, { type: 'research_complete', error: researchResult.error, keepDisabled: false });
      }
    }
  } catch (error) {
    effectiveError(`Error during exitResearch: ${error.message}`);
    researchResult = { success: false, error: error.message };
    if (error.message.toLowerCase().includes('password') || error.message.toLowerCase().includes('api key')) {
      if (session) session.password = null;
    }
    const durationMs = Date.now() - transitionStartedAt;
    telemetryChannel?.emitStatus({
      stage: 'chat-error',
      message: 'Exit research encountered an error.',
      detail: error.message,
    });
    telemetryChannel?.emitComplete({
      success: false,
      durationMs,
      error: error.message,
    });
    if (isWebSocket && webSocketClient) {
      safeSend(webSocketClient, { type: 'research_complete', error: error.message, keepDisabled: false });
    }
  } finally {
    if (session) {
      session.isChatActive = false;
      session.chatHistory = [];
      if (session.memoryManager) {
        console.log(`[WebSocket] Clearing memory manager on /exitresearch for session ${session.sessionId}.`);
        session.memoryManager = null;
      }
      await finalizeSessionConversation(session, 'exitresearch');
    }
    if (isWebSocket && webSocketClient) {
      safeSend(webSocketClient, { type: 'chat-exit' });
      safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
    }
  }

  return { ...researchResult, keepDisabled: false };
}
