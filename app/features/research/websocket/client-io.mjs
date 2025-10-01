/**
 * Contract
 * Why: Provide reusable helpers for cloning session users and mediating WebSocket IO for the research terminal.
 * What: Exposes utilities to enable/disable client input plus structured output/error senders shared across handlers.
 * How: Wraps ws send operations with safeSend, masks sensitive payloads, and centralises clone logic.
 */

import { WebSocket } from 'ws';
import { safeSend } from '../../../utils/websocket.utils.mjs';

export function cloneUserRecord(user) {
  if (!user) return null;
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(user)
      : JSON.parse(JSON.stringify(user));
  } catch (error) {
    console.warn(`[WebSocket] Failed to clone user record: ${error.message}`);
    return { ...user };
  }
}

export function enableClientInput(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[WebSocket] Sending enable_input');
    safeSend(ws, { type: 'enable_input' });
  } else {
    console.warn('[WebSocket] Tried to enable input on closed/invalid socket.');
  }
}

export function disableClientInput(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[WebSocket] Sending disable_input');
    safeSend(ws, { type: 'disable_input' });
  } else {
    console.warn('[WebSocket] Tried to disable input on closed/invalid socket.');
  }
}

export function wsOutputHelper(ws, data) {
  let outputData = '';
  if (typeof data === 'string') {
    outputData = data;
  } else if (data && typeof data.toString === 'function') {
    outputData = data.toString();
  } else {
    try {
      outputData = JSON.stringify(data);
    } catch (error) {
      outputData = '[Unserializable Output]';
      console.error('Failed to stringify output data:', data);
    }
  }
  safeSend(ws, { type: 'output', data: outputData });
}

export function wsErrorHelper(ws, error, enableInputAfterError = true) {
  let errorString = '';
  if (typeof error === 'string') {
    errorString = error;
  } else if (error instanceof Error) {
    console.error(`[wsErrorHelper] Sending error to client: ${error.message}`, error.stack);
    errorString = error.message;
  } else if (error && typeof error.toString === 'function') {
    errorString = error.toString();
  } else {
    try {
      errorString = JSON.stringify(error);
    } catch (stringifyError) {
      errorString = '[Unserializable Error]';
      console.error('[wsErrorHelper] Failed to stringify error data:', error);
    }
  }
  safeSend(ws, { type: 'error', error: errorString });

  if (enableInputAfterError) {
    console.log('[wsErrorHelper] Attempting to re-enable input after error.');
    enableClientInput(ws);
  } else {
    console.log('[wsErrorHelper] Input remains disabled after error as requested.');
  }
}
