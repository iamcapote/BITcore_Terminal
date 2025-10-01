/**
 * Contract
 * Why: Standardise server-initiated prompts over the research WebSocket session.
 * What: Exposes a single async function that emits prompt metadata, tracks session state, and resolves on client responses.
 * How: Registers resolve/reject handlers on the session, enforces timeouts, and relays failures via wsErrorHelper.
 */

import { safeSend } from '../../../utils/websocket.utils.mjs';
import { PROMPT_TIMEOUT_MS } from './constants.mjs';
import { wsErrorHelper } from './client-io.mjs';

export function wsPrompt(ws, session, promptMessage, timeoutMs = PROMPT_TIMEOUT_MS, isPassword = false, context = null) {
  return new Promise((resolve, reject) => {
    if (session.pendingPromptResolve) {
      console.warn(`[wsPrompt] New prompt initiated while another was pending for session ${session.sessionId}. Rejecting previous prompt.`);
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

    console.log(`[wsPrompt] Initiating prompt for session ${session.sessionId}. Message: "${promptMessage}", Password: ${isPassword}, Context: ${context}`);

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
      console.log(`[WebSocket] Prompt message sent to client (Session ${session.sessionId})`);

      session.promptTimeoutId = setTimeout(() => {
        if (session.pendingPromptReject === reject) {
          console.log(`[wsPrompt] Prompt timed out for session ${session.sessionId}.`);
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
      console.error(`[wsPrompt] Failed to send prompt message for session ${session.sessionId}: ${sendError.message}`);
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
