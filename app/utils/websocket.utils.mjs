import crypto from 'crypto';
import { WebSocket } from 'ws';
import { createModuleLogger } from './logger.mjs';

/**
 * WebSocket Utility Suite
 * Why: Provide resilient helpers for consistent server-to-client messaging.
 * What: Normalizes outbound send operations with tracing metadata and failure reporting.
 * How: Serializes payloads, guards connection state, and emits structured logs for diagnostics.
 */

const moduleLogger = createModuleLogger('utils.websocket');

/**
 * Safely sends a JSON message over a WebSocket connection.
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} message - The message object to send.
 * @returns {boolean} True when the message is sent, false otherwise.
 */
export function safeSend(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            moduleLogger.error('Failed to send WebSocket message.', {
                message: error?.message || String(error),
                stack: error?.stack || null
            });
            return false;
        }
    }

    moduleLogger.warn('Attempted to send WebSocket message on closed or invalid socket.');
    return false;
}

// Add other WebSocket utility functions here if needed in the future.
