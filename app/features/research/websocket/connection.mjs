/**
 * Contract
 * Why: Orchestrate the lifecycle of research WebSocket sessions, including initialization, message routing, and cleanup.
 * What: Creates session records, wires telemetry and status feeds, delegates to command/chat/input handlers, and enforces inactivity timeouts.
 * How: Uses shared registries and IO helpers to maintain per-socket state, push structured events, and reclaim resources on disconnect or errors.
 */

import { WebSocket } from 'ws';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { output, outputManager } from '../../../utils/research.output-manager.mjs';
import { getStatusController } from '../../status/index.mjs';
import { getChatHistoryController } from '../../chat-history/index.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';
import { handleCommandMessage } from './command-handler.mjs';
import { handleChatMessage } from './chat-handler.mjs';
import { handleInputMessage } from './input-handler.mjs';
import { persistSessionFromRef } from '../../../infrastructure/session/session.store.mjs';
import {
  getSessionIdBySocket,
  getSessionById,
  unregisterSession,
  unregisterSessionBySocket,
  forEachSession,
  sessionCount,
} from './session-registry.mjs';
import { enableClientInput, disableClientInput, wsErrorHelper } from './client-io.mjs';
import { SESSION_INACTIVITY_TIMEOUT, STATUS_REFRESH_INTERVAL_MS } from './constants.mjs';
import { bootstrapSession } from './session-bootstrap.mjs';

const socketLogger = createModuleLogger('research.websocket.connection');
const messageLogger = socketLogger.child('message');
const cleanupLogger = socketLogger.child('cleanup');
const activityLogger = socketLogger.child('github-activity');

export async function handleWebSocketConnection(ws, req) {
  socketLogger.info('New WebSocket connection established.');

  const statusController = getStatusController();
  let statusIntervalId = null;

  const pushStatusSummary = async ({ validate = false, reason = 'interval' } = {}) => {
    try {
      const summary = await statusController.summary({ validateGitHub: Boolean(validate) });
      safeSend(ws, { type: 'status-summary', data: summary, meta: { reason } });
    } catch (error) {
  socketLogger.error('Failed to emit status summary.', { reason, error });
      safeSend(ws, { type: 'status-summary', error: error.message, meta: { reason, failed: true } });
    }
  };

  try {
    const { sessionId } = await bootstrapSession({
      ws,
      pushStatusSummary,
      activityLogger
    });

    statusIntervalId = setInterval(() => {
      pushStatusSummary({ reason: 'scheduled' });
    }, STATUS_REFRESH_INTERVAL_MS);

    socketLogger.info('Initial setup complete for session.', { sessionId });
  } catch (setupError) {
    socketLogger.error('Critical error during initial connection setup.', { error: setupError, stack: setupError.stack });
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
      socketLogger.warn('Cleaned up partially created session after setup error.', { sessionId: failedSessionId });
    }
    output.removeWebSocketClient(ws);
    return;
  }

  ws.on('message', async (raw) => {
    const currentSessionId = getSessionIdBySocket(ws);
  const currentSession = currentSessionId ? getSessionById(currentSessionId) : null;

    if (!currentSession) {
      messageLogger.error('No session found for incoming message.', { raw: raw.toString() });
      try {
        wsErrorHelper(ws, 'Internal Server Error: Session not found. Please refresh.', false);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, 'Session lost');
        }
      } catch (sendError) {
        messageLogger.error('Failed to notify client about missing session.', { error: sendError });
      }
      return;
    }

  currentSession.lastActivity = Date.now();
    if (!currentSession.pendingPromptResolve) {
      disableClientInput(ws);
    } else {
      messageLogger.debug('Input remains enabled due to pending server-side prompt.', { sessionId: currentSessionId });
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
        messageLogger.debug('Received message payload.', {
          sessionId: currentSessionId,
          username: currentSession.username,
          payload: JSON.stringify(logPayload).substring(0, 250)
        });
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
          messageLogger.debug('Routing command message to chat handler.', { sessionId: currentSessionId });
          enableInputAfterProcessing = await handleChatMessage(ws, { message: `/${message.command} ${message.args.join(' ')}` }, currentSession);
        } else {
          messageLogger.debug('Routing command message to command handler.', { sessionId: currentSessionId });
          enableInputAfterProcessing = await handleCommandMessage(ws, message, currentSession);
        }
      } else if (message.type === 'chat-message') {
        if (currentSession.isChatActive) {
          enableInputAfterProcessing = await handleChatMessage(ws, message, currentSession);
        } else {
          wsErrorHelper(ws, 'Cannot send chat messages when not in chat mode.', true);
        }
      } else if (message.type === 'input') {
        messageLogger.debug('Routing input message to input handler.', { sessionId: currentSessionId });
        enableInputAfterProcessing = await handleInputMessage(ws, message, currentSession);
      } else if (message.type === 'ping') {
        currentSession.lastActivity = Date.now();
        safeSend(ws, { type: 'pong' });
        enableInputAfterProcessing = true;
      } else {
        messageLogger.warn('Unexpected message type received.', { sessionId: currentSessionId, messageType: message.type });
        wsErrorHelper(ws, `Unexpected message type: ${message.type}`, true);
        enableInputAfterProcessing = false;
      }

      const sessionAfterProcessing = getSessionById(currentSessionId);
      const isServerPromptPending = !!(sessionAfterProcessing && sessionAfterProcessing.pendingPromptResolve);

      if (enableInputAfterProcessing && !isServerPromptPending) {
        messageLogger.debug('Enabling client input post handler.', { sessionId: currentSessionId });
        enableClientInput(ws);
      } else if (enableInputAfterProcessing && isServerPromptPending) {
        messageLogger.debug('Handler allows enable but server prompt active; keeping input disabled.', { sessionId: currentSessionId });
      } else {
        messageLogger.debug('Keeping client input disabled after handler execution.', {
          sessionId: currentSessionId,
          enableInputAfterProcessing,
          isServerPromptPending
        });
      }
    } catch (error) {
      messageLogger.error('Error processing incoming message.', {
        sessionId: currentSessionId,
        error,
        payload: raw.toString()
      });
      try {
        const sessionOnError = getSessionById(currentSessionId);
        const isPromptStillPendingOnError = !!(sessionOnError && sessionOnError.pendingPromptResolve);
        wsErrorHelper(ws, `Error processing message: ${error.message}`, !isPromptStillPendingOnError);
      } catch (sendError) {
        messageLogger.error('Failed to notify client about processing error.', { error: sendError });
      }
      enableInputAfterProcessing = false;
    }
  });

  ws.on('close', async (code, reason) => {
    const closedSessionId = getSessionIdBySocket(ws);
    const reasonString = reason ? reason.toString() : 'N/A';
    socketLogger.info('Connection closed.', { sessionId: closedSessionId, code, reason: reasonString });
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
        socketLogger.warn('Rejecting pending prompt after socket close.', { sessionId: closedSessionId });
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
        socketLogger.debug('Nullifying memory manager for closed session.', { sessionId: closedSessionId });
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
      try {
        await persistSessionFromRef(session);
      } catch (persistError) {
        socketLogger.warn('Failed to persist session snapshot during close.', {
          sessionId: closedSessionId,
          message: persistError?.message || String(persistError),
        });
      }
      session.password = null;
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
  session.currentResearchSummary = null;
  session.currentResearchQuery = null;
      session.githubActivityStream = null;
      session.githubActivityStreamDisposer = null;
      session.lastGitHubActivityTimestamp = null;
      socketLogger.info('Cleaned up session after close.', { sessionId: closedSessionId });
    } else {
      socketLogger.warn('Session not found during close cleanup.');
    }
  });

  ws.on('error', async (error) => {
    const errorSessionId = getSessionIdBySocket(ws);
    socketLogger.error('WebSocket connection error.', { sessionId: errorSessionId ?? 'N/A', error });

    wsErrorHelper(ws, `WebSocket connection error: ${error.message}`, false);
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      socketLogger.warn('Force closing socket due to connection error.', { sessionId: errorSessionId });
      ws.close(1011, 'WebSocket error occurred');
    }

    const session = unregisterSessionBySocket(ws) || (errorSessionId ? unregisterSession(errorSessionId) : null);
    if (session) {
      socketLogger.info('Cleaning up session after socket error.', { sessionId: errorSessionId });

      if (session.pendingPromptReject) {
        socketLogger.warn('Rejecting pending prompt after socket error.', { sessionId: errorSessionId });
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
        socketLogger.debug('Releasing memory manager after socket error.', { sessionId: errorSessionId });
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
      try {
        await persistSessionFromRef(session);
      } catch (persistError) {
        socketLogger.warn('Failed to persist session snapshot during error cleanup.', {
          sessionId: errorSessionId,
          message: persistError?.message || String(persistError),
        });
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

      socketLogger.info('Session cleaned up after socket error.', { sessionId: errorSessionId });
    }
    output.removeWebSocketClient(ws);
  });
}

export function cleanupInactiveSessions() {
  const now = Date.now();
  cleanupLogger.info('Running cleanup task.', { sessionCount: sessionCount() });
  forEachSession((session, sessionId) => {
    if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
      cleanupLogger.warn('Session timed out due to inactivity.', { sessionId });
      const ws = session.webSocketClient;
      if (session.pendingPromptReject) {
        cleanupLogger.warn('Rejecting pending prompt for inactive session.', { sessionId });
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
        cleanupLogger.debug('Releasing memory manager for timed out session.', { sessionId });
        session.memoryManager = null;
      }
      session.password = null;
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      unregisterSession(sessionId);
      cleanupLogger.info('Cleaned up inactive session.', { sessionId });
    }
  });

  cleanupLogger.info('Finished cleanup task.', { sessionCount: sessionCount() });
}

let cleanupTimer = null;

export function startSessionCleanupScheduler() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupInactiveSessions, 5 * 60 * 1000);
  }
}

startSessionCleanupScheduler();
