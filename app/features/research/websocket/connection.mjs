/**
 * Contract
 * Why: Orchestrate the lifecycle of research WebSocket sessions, including initialization, message routing, and cleanup.
 * What: Creates session records, wires telemetry and status feeds, delegates to command/chat/input handlers, and enforces inactivity timeouts.
 * How: Uses shared registries and IO helpers to maintain per-socket state, push structured events, and reclaim resources on disconnect or errors.
 */

import crypto from 'crypto';
import { WebSocket } from 'ws';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { output, outputManager } from '../../../utils/research.output-manager.mjs';
import { userManager } from '../../auth/user-manager.mjs';
import { createResearchTelemetry } from '../research.telemetry.mjs';
import { getStatusController } from '../status/index.mjs';
import { createGitHubActivityWebComm } from '../github-activity.webcomm.mjs';
import { getChatHistoryController } from '../chat-history/index.mjs';
import { logChannel } from '../../../utils/log-channel.mjs';
import { handleCommandMessage } from './command-handler.mjs';
import { handleChatMessage } from './chat-handler.mjs';
import { handleInputMessage } from './input-handler.mjs';
import { wsPrompt } from './prompt.mjs';
import {
  registerSession,
  getSessionIdBySocket,
  getSessionById,
  unregisterSession,
  unregisterSessionBySocket,
  forEachSession,
  sessionCount,
  getTelemetryChannel,
  setTelemetryChannel,
} from './session-registry.mjs';
import { enableClientInput, disableClientInput, cloneUserRecord, wsErrorHelper } from './client-io.mjs';
import { SESSION_INACTIVITY_TIMEOUT, STATUS_REFRESH_INTERVAL_MS } from './constants.mjs';

function attachTelemetryChannel(ws, telemetryKey) {
  let telemetryChannel = getTelemetryChannel(telemetryKey);
  if (!telemetryChannel) {
    telemetryChannel = createResearchTelemetry({
      send: (type, payload) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          safeSend(ws, { type, data: payload });
        }
      },
    });
    setTelemetryChannel(telemetryKey, telemetryChannel);
  } else {
    telemetryChannel.updateSender((type, payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        safeSend(ws, { type, data: payload });
      }
    });
    telemetryChannel.replay((type, payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        safeSend(ws, { type, data: payload });
      }
    });
    telemetryChannel.emitStatus({ stage: 'reconnected', message: 'Telemetry channel resumed after reconnect.' });
  }
  return telemetryChannel;
}

export function handleWebSocketConnection(ws, req) {
  console.log('[WebSocket] New connection established');

  const statusController = getStatusController();
  let statusIntervalId = null;

  const pushStatusSummary = async ({ validate = false, reason = 'interval' } = {}) => {
    try {
      const summary = await statusController.summary({ validateGitHub: Boolean(validate) });
      safeSend(ws, { type: 'status-summary', data: summary, meta: { reason } });
    } catch (error) {
      console.error(`[WebSocket] Failed to emit status summary (${reason}): ${error.message}`);
      safeSend(ws, { type: 'status-summary', error: error.message, meta: { reason, failed: true } });
    }
  };

  try {
    const sessionId = crypto.randomUUID();
    const current = userManager.getCurrentUser();
    const telemetryKey = current?.username || 'operator';

    const telemetryChannel = attachTelemetryChannel(ws, telemetryKey);
    const currentUser = cloneUserRecord(current) || null;

    const sessionData = {
      sessionId,
      webSocketClient: ws,
      isChatActive: false,
      chatHistory: [],
      memoryManager: null,
      lastActivity: Date.now(),
      username: current?.username || 'operator',
      role: current?.role || 'admin',
      pendingPromptResolve: null,
      pendingPromptReject: null,
      promptTimeoutId: null,
      promptIsPassword: false,
      promptContext: null,
      promptData: null,
      password: null,
      currentUser,
      currentResearchResult: null,
      currentResearchFilename: null,
      sessionModel: null,
      sessionCharacter: null,
      researchTelemetry: telemetryChannel,
      githubActivityStream: null,
      githubActivityStreamDisposer: null,
      lastGitHubActivityTimestamp: null,
    };

    registerSession(sessionId, sessionData, ws);
    console.log(`[WebSocket] Created session ${sessionId} for new connection. Initial user: ${sessionData.username}`);

    output.addWebSocketClient(ws);

    safeSend(ws, { type: 'connection', connected: true });
    safeSend(ws, { type: 'login_success', username: sessionData.username });
    safeSend(ws, { type: 'output', data: 'Welcome to MCP Terminal!' });
    safeSend(ws, { type: 'output', data: `Single-user mode active as ${sessionData.username} (${sessionData.role}). No login required.` });
    safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });

    const initialLogSnapshot = logChannel.getSnapshot({ limit: 120 });
    if (initialLogSnapshot.length) {
      safeSend(ws, { type: 'log-snapshot', logs: initialLogSnapshot });
    }

    const githubActivityStream = createGitHubActivityWebComm({
      send: (eventType, payload) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          safeSend(ws, { type: eventType, data: payload });
        }
      },
      snapshotLimit: 80,
      logger: console,
    });
    githubActivityStream.attach({ limit: 80 });
    sessionData.githubActivityStream = githubActivityStream;
    const disposeListener = githubActivityStream.onEntry((entry) => {
      sessionData.lastGitHubActivityTimestamp = entry?.timestamp ?? Date.now();
    });
    sessionData.githubActivityStreamDisposer = typeof disposeListener === 'function' ? disposeListener : null;

    enableClientInput(ws);

    telemetryChannel.emitStatus({ stage: 'connected', message: 'Research telemetry channel ready.' });

    pushStatusSummary({ reason: 'initial' });
    statusIntervalId = setInterval(() => {
      pushStatusSummary({ reason: 'scheduled' });
    }, STATUS_REFRESH_INTERVAL_MS);

    console.log(`[WebSocket] Initial setup complete for session ${sessionId}.`);
  } catch (setupError) {
    console.error(`[WebSocket] CRITICAL ERROR during initial connection setup: ${setupError.message}`, setupError.stack);
    safeSend(ws, { type: 'error', error: `Server setup error: ${setupError.message}` });
    if (statusIntervalId) {
      clearInterval(statusIntervalId);
      statusIntervalId = null;
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1011, 'Server setup error');
    }
    const failedSessionId = getSessionIdBySocket(ws);
    if (failedSessionId) {
      unregisterSession(failedSessionId);
      console.log(`[WebSocket] Cleaned up partially created session ${failedSessionId} after setup error.`);
    }
    output.removeWebSocketClient(ws);
    return;
  }

  ws.on('message', async (raw) => {
    const currentSessionId = getSessionIdBySocket(ws);
    const currentSession = currentSessionId ? getSessionById(currentSessionId) : null;

    if (!currentSession) {
      console.error('[WebSocket] Error: No session found for incoming message from ws.');
      try {
        wsErrorHelper(ws, 'Internal Server Error: Session not found. Please refresh.', false);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, 'Session lost');
        }
      } catch (sendError) {
        console.error('[WebSocket] Error sending session not found message:', sendError);
      }
      return;
    }

    currentSession.lastActivity = Date.now();
    if (!currentSession.pendingPromptResolve) {
      disableClientInput(ws);
    } else {
      console.log('[WebSocket] Input remains enabled for pending server-side prompt.');
    }

    let message;
    let enableInputAfterProcessing = false;

    try {
      message = JSON.parse(raw.toString());
      const logPayload = { ...message };
      if (logPayload.password) logPayload.password = '******';
      if (logPayload.input && currentSession.pendingPromptResolve && currentSession.promptIsPassword) {
        logPayload.input = '******';
      }
      if (logPayload.type === 'input' && logPayload.value && currentSession.pendingPromptResolve && currentSession.promptIsPassword) {
        logPayload.value = '******';
      }
      if (message.type !== 'ping') {
        console.log(`[WebSocket] Received message (Session ${currentSessionId}, User: ${currentSession.username}):`, JSON.stringify(logPayload).substring(0, 250));
      }

      if (!message.type) {
        throw new Error('Message type is missing');
      }

      if (message.type === 'status-refresh') {
        const validateFlag = message.validate;
        const shouldValidate = validateFlag === true
          || validateFlag === 1
          || (typeof validateFlag === 'string' && ['1', 'true', 'yes', 'on'].includes(validateFlag.toLowerCase()));
        pushStatusSummary({ validate: shouldValidate, reason: 'client' });
        enableInputAfterProcessing = true;
      } else if (message.type === 'github-activity:command') {
        const stream = currentSession.githubActivityStream;
        if (stream && typeof stream.handleRequest === 'function') {
          const result = stream.handleRequest(message);
          if (result && result.ok === false) {
            safeSend(ws, {
              type: 'github-activity:error',
              data: { error: result.error || 'Invalid GitHub activity command.', command: message.command ?? null },
            });
            wsErrorHelper(ws, result.error || 'Invalid GitHub activity command.', true);
          }
        }
        enableInputAfterProcessing = true;
      } else if (message.type === 'command') {
        if (currentSession.isChatActive) {
          console.log('[WebSocket] Routing command message to handleChatMessage (chat active).');
          enableInputAfterProcessing = await handleChatMessage(ws, { message: `/${message.command} ${message.args.join(' ')}` }, currentSession);
        } else {
          console.log('[WebSocket] Routing command message to handleCommandMessage (chat inactive).');
          enableInputAfterProcessing = await handleCommandMessage(ws, message, currentSession);
        }
      } else if (message.type === 'chat-message') {
        if (currentSession.isChatActive) {
          enableInputAfterProcessing = await handleChatMessage(ws, message, currentSession);
        } else {
          wsErrorHelper(ws, 'Cannot send chat messages when not in chat mode.', true);
        }
      } else if (message.type === 'input') {
        console.log('[WebSocket] Routing input message to handleInputMessage.');
        enableInputAfterProcessing = await handleInputMessage(ws, message, currentSession);
      } else if (message.type === 'ping') {
        currentSession.lastActivity = Date.now();
        safeSend(ws, { type: 'pong' });
        enableInputAfterProcessing = true;
      } else {
        console.warn(`[WebSocket] Unexpected message type '${message.type}' received (Session ${currentSessionId}).`);
        wsErrorHelper(ws, `Unexpected message type: ${message.type}`, true);
        enableInputAfterProcessing = false;
      }

      const sessionAfterProcessing = getSessionById(currentSessionId);
      const isServerPromptPending = !!(sessionAfterProcessing && sessionAfterProcessing.pendingPromptResolve);

      if (enableInputAfterProcessing && !isServerPromptPending) {
        console.log('[WebSocket] Handler allows enable, no server prompt active. Enabling client input.');
        enableClientInput(ws);
      } else if (enableInputAfterProcessing && isServerPromptPending) {
        console.log('[WebSocket] Handler allows enable, but server prompt is now active. Input remains disabled.');
      } else {
        console.log(`[WebSocket] Handler requires input disabled (enableInputAfterProcessing=${enableInputAfterProcessing}) OR server prompt active (isServerPromptPending=${isServerPromptPending}). Input remains disabled.`);
      }
    } catch (error) {
      console.error(`[WebSocket] Error processing message (Session ${currentSessionId}): ${error.message}`, error.stack, raw.toString());
      try {
        const sessionOnError = getSessionById(currentSessionId);
        const isPromptStillPendingOnError = !!(sessionOnError && sessionOnError.pendingPromptResolve);
        wsErrorHelper(ws, `Error processing message: ${error.message}`, !isPromptStillPendingOnError);
      } catch (sendError) {
        console.error('[WebSocket] Error sending processing error message:', sendError);
      }
      enableInputAfterProcessing = false;
    }
  });

  ws.on('close', async (code, reason) => {
    const closedSessionId = getSessionIdBySocket(ws);
    const reasonString = reason ? reason.toString() : 'N/A';
    console.log(`[WebSocket] Connection closed (Session ${closedSessionId}, Code: ${code}, Reason: ${reasonString})`);
    if (statusIntervalId) {
      clearInterval(statusIntervalId);
      statusIntervalId = null;
    }
    output.removeWebSocketClient(ws);

    const session = unregisterSessionBySocket(ws) || (closedSessionId ? unregisterSession(closedSessionId) : null);
    if (session) {
      if (session.researchTelemetry) {
        session.researchTelemetry.updateSender(null);
      }
      if (typeof session.githubActivityStreamDisposer === 'function') {
        try {
          session.githubActivityStreamDisposer();
        } catch (unsubscribeError) {
          outputManager.warn(`[WebSocket] Failed to dispose GitHub activity listener for session ${closedSessionId}: ${unsubscribeError.message}`);
        }
      }
      if (session.githubActivityStream) {
        try {
          session.githubActivityStream.dispose?.();
        } catch (streamError) {
          outputManager.warn(`[WebSocket] Failed to dispose GitHub activity stream for session ${closedSessionId}: ${streamError.message}`);
        }
      }
      if (session.pendingPromptReject) {
        console.log(`[WebSocket] Rejecting pending server-side prompt for closed session ${closedSessionId}.`);
        clearTimeout(session.promptTimeoutId);
        const rejectFn = session.pendingPromptReject;
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false;
        session.promptContext = null;
        session.promptData = null;
        rejectFn(new Error('WebSocket connection closed during prompt.'));
      }
      if (session.memoryManager) {
        console.log(`[WebSocket] Nullifying memory manager for closed session ${closedSessionId}`);
        session.memoryManager = null;
      }
      if (session.chatHistoryConversationId) {
        try {
          const chatHistoryController = getChatHistoryController();
          await chatHistoryController.closeConversation(session.chatHistoryConversationId, { reason: `socket-close-${code}` });
        } catch (error) {
          outputManager.warn(`[WebSocket] Failed to finalize chat conversation for closed session ${closedSessionId}: ${error.message}`);
        }
      }
      session.password = null;
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      session.githubActivityStream = null;
      session.githubActivityStreamDisposer = null;
      session.lastGitHubActivityTimestamp = null;
      console.log(`[WebSocket] Cleaned up session: ${closedSessionId}`);
    } else {
      console.warn('[WebSocket] Could not find session to clean up for closed connection.');
    }
  });

  ws.on('error', async (error) => {
    const errorSessionId = getSessionIdBySocket(ws);
    console.error(`[WebSocket] Connection error (Session ${errorSessionId || 'N/A'}):`, error.message, error.stack);

    wsErrorHelper(ws, `WebSocket connection error: ${error.message}`, false);
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      console.log(`[WebSocket] Force closing socket for session ${errorSessionId} due to error.`);
      ws.close(1011, 'WebSocket error occurred');
    }

    const session = unregisterSessionBySocket(ws) || (errorSessionId ? unregisterSession(errorSessionId) : null);
    if (session) {
      console.log(`[WebSocket] Cleaning up session ${errorSessionId} after error.`);

      if (session.pendingPromptReject) {
        console.log(`[WebSocket] Rejecting pending prompt for errored session ${errorSessionId}.`);
        clearTimeout(session.promptTimeoutId);
        const rejectFn = session.pendingPromptReject;
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false;
        session.promptContext = null;
        session.promptData = null;
        rejectFn(new Error('WebSocket connection error during prompt.'));
      }

      session.password = null;

      if (session.memoryManager) {
        console.log(`[WebSocket] Releasing memory manager for session ${errorSessionId}.`);
        session.memoryManager = null;
      }
      if (session.chatHistoryConversationId) {
        try {
          const chatHistoryController = getChatHistoryController();
          await chatHistoryController.closeConversation(session.chatHistoryConversationId, { reason: 'socket-error' });
        } catch (closeError) {
          outputManager.warn(`[WebSocket] Failed to finalize chat conversation after error for session ${errorSessionId}: ${closeError.message}`);
        }
      }
      if (session.researchTelemetry) {
        session.researchTelemetry.updateSender(null);
      }
      if (typeof session.githubActivityStreamDisposer === 'function') {
        try {
          session.githubActivityStreamDisposer();
        } catch (unsubscribeError) {
          outputManager.warn(`[WebSocket] Failed to dispose GitHub activity listener after error for session ${errorSessionId}: ${unsubscribeError.message}`);
        }
      }
      if (session.githubActivityStream) {
        try {
          session.githubActivityStream.dispose?.();
        } catch (streamError) {
          outputManager.warn(`[WebSocket] Failed to dispose GitHub activity stream after error for session ${errorSessionId}: ${streamError.message}`);
        }
      }
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      session.githubActivityStream = null;
      session.githubActivityStreamDisposer = null;
      session.lastGitHubActivityTimestamp = null;

      console.log(`[WebSocket] Session ${errorSessionId} cleaned up successfully.`);
    }
    output.removeWebSocketClient(ws);
  });
}

export function cleanupInactiveSessions() {
  const now = Date.now();
  console.log(`[Session Cleanup] Running cleanup task. Current sessions: ${sessionCount()}`);
  forEachSession((session, sessionId) => {
    if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
      console.log(`[Session Cleanup] Session ${sessionId} timed out due to inactivity.`);
      const ws = session.webSocketClient;
      if (session.pendingPromptReject) {
        console.log(`[Session Cleanup] Rejecting pending prompt for inactive session ${sessionId}.`);
        clearTimeout(session.promptTimeoutId);
        const rejectFn = session.pendingPromptReject;
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false;
        session.promptContext = null;
        session.promptData = null;
        rejectFn(new Error('Session timed out during prompt.'));
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        safeSend(ws, { type: 'session-expired' });
        ws.close(1000, 'Session Timeout');
      }
      output.removeWebSocketClient(ws);
      if (session.memoryManager) {
        console.log(`[Session Cleanup] Releasing memory manager for timed out session ${sessionId}.`);
        session.memoryManager = null;
      }
      session.password = null;
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      unregisterSession(sessionId);
      console.log(`[Session Cleanup] Cleaned up inactive session: ${sessionId}`);
    }
  });

  console.log(`[Session Cleanup] Finished cleanup task. Remaining sessions: ${sessionCount()}`);
}

let cleanupTimer = null;

export function startSessionCleanupScheduler() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupInactiveSessions, 5 * 60 * 1000);
  }
}

startSessionCleanupScheduler();
