/**
 * Contract
 * Why: Provide reusable helpers for cloning session users and mediating WebSocket IO for the research terminal.
 * What: Exposes utilities to enable/disable client input plus structured output/error senders shared across handlers.
 * How: Wraps ws send operations with safeSend, masks sensitive payloads, and centralises clone logic.
 */

import { WebSocket } from 'ws';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';

const clientLogger = createModuleLogger('research.websocket.client-io');

export function cloneUserRecord(user) {
  if (!user) return null;
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(user)
      : JSON.parse(JSON.stringify(user));
  } catch (error) {
    clientLogger.warn('Failed to clone user record; returning shallow copy.', { error });
    return { ...user };
  }
}

export function enableClientInput(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    clientLogger.debug('Sending enable_input event.', { readyState: ws.readyState });
    safeSend(ws, { type: 'enable_input' });
  } else {
    clientLogger.warn('Attempted to enable input on closed or invalid socket.', {
      readyState: ws?.readyState
    });
  }
}

export function disableClientInput(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    clientLogger.debug('Sending disable_input event.', { readyState: ws.readyState });
    safeSend(ws, { type: 'disable_input' });
  } else {
    clientLogger.warn('Attempted to disable input on closed or invalid socket.', {
      readyState: ws?.readyState
    });
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
      clientLogger.error('Failed to stringify output payload.', { error, dataType: typeof data });
    }
  }
  safeSend(ws, { type: 'output', data: outputData });
}

export function wsErrorHelper(ws, error, enableInputAfterError = true) {
  let errorString = '';
  if (typeof error === 'string') {
    errorString = error;
  } else if (error instanceof Error) {
    clientLogger.error('Sending error to client.', { error });
    errorString = error.message;
  } else if (error && typeof error.toString === 'function') {
    errorString = error.toString();
  } else {
    try {
      errorString = JSON.stringify(error);
    } catch (stringifyError) {
      errorString = '[Unserializable Error]';
      clientLogger.error('Failed to stringify error payload.', { error: stringifyError });
    }
  }
  safeSend(ws, { type: 'error', error: errorString });

  if (enableInputAfterError) {
    clientLogger.debug('Re-enabling input after error.');
    enableClientInput(ws);
  } else {
    clientLogger.debug('Leaving input disabled after error.');
  }
}
