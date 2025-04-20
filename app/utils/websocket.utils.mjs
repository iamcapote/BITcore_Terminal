import crypto from 'crypto';
import { WebSocket } from 'ws'; // Import WebSocket for type checking if needed

/**
 * Safely sends a JSON message over a WebSocket connection.
 * Adds a server message ID for tracing.
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} message - The message object to send.
 * @returns {boolean} - True if the message was sent successfully, false otherwise.
 */
export function safeSend(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error("[WebSocket] Error sending message:", error);
            return false;
        }
    } else {
        console.warn("[WebSocket] Attempted to send message on closed/invalid socket.");
        return false;
    }
}

// Add other WebSocket utility functions here if needed in the future.
