/**
 * Contract
 * Why: Standardise server-initiated prompts over the research WebSocket session.
 * What: Exposes a single async function that emits prompt metadata, tracks session state, and resolves on client responses.
 * How: Registers resolve/reject handlers on the session, enforces timeouts, and relays failures via wsErrorHelper.
 */

import { safeSend } from '../../../utils/websocket.utils.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';
import { PROMPT_TIMEOUT_MS } from './constants.mjs';
import { wsErrorHelper } from './client-io.mjs';

const promptLogger = createModuleLogger('research.websocket.prompt');

export function wsPrompt(ws, session, promptMessage, timeoutMs = PROMPT_TIMEOUT_MS, isPassword = false, context = null) {
  return new Promise((resolve, reject) => {
    if (session.pendingPromptResolve) {
      promptLogger.warn('New prompt initiated while previous prompt pending.', {
        sessionId: session.sessionId
      });
      const previousReject = session.pendingPromptReject;
      clearTimeout(session.promptTimeoutId);
      session.pendingPromptResolve = null;
      session.pendingPromptReject = null;
      session.promptTimeoutId = null;
      session.promptIsPassword = false;
      session.promptContext = null;
      session.promptData = null;
      previousReject(new Error('New prompt initiated, cancelling previous one.'));
    }

    promptLogger.info('Initiating prompt for session.', {
      sessionId: session.sessionId,
      isPassword,
      context
    });

    session.pendingPromptResolve = resolve;
    session.pendingPromptReject = reject;
    session.promptIsPassword = isPassword;
    session.promptContext = context;

    try {
      safeSend(ws, {
        type: 'prompt',
        data: promptMessage,
        isPassword,
        context,
      });
      promptLogger.debug('Prompt message sent to client.', { sessionId: session.sessionId });

      session.promptTimeoutId = setTimeout(() => {
        if (session.pendingPromptReject === reject) {
          promptLogger.warn('Prompt timed out.', { sessionId: session.sessionId });
          session.pendingPromptResolve = null;
          session.pendingPromptReject = null;
          session.promptTimeoutId = null;
          session.promptIsPassword = false;
          session.promptContext = null;
          session.promptData = null;
          reject(new Error('Prompt timed out.'));
          wsErrorHelper(ws, 'Prompt timed out.', true);
        }
      }, timeoutMs);
    } catch (sendError) {
      promptLogger.error('Failed to send prompt message.', {
        sessionId: session.sessionId,
        error: sendError
      });
      session.pendingPromptResolve = null;
      session.pendingPromptReject = null;
      session.promptTimeoutId = null;
      session.promptIsPassword = false;
      session.promptContext = null;
      session.promptData = null;
      reject(new Error(`Failed to send prompt: ${sendError.message}`));
      wsErrorHelper(ws, 'Server error: Failed to send prompt.', true);
    }
  });
}
