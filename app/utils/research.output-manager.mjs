import { WebSocket } from 'ws';

/**
 * Manages output for both console and WebSocket clients.
 */
export class OutputManager {
    constructor() {
        this.webSocketClients = new Set();
        this.logHandler = console.log; // Default to console.log
        this.isBroadcasting = false; // Prevent infinite loops

        // Bind methods to ensure 'this' context is correct when passed as callbacks
        this.log = this.log.bind(this);
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.debug = this.debug.bind(this);
        this.commandStart = this.commandStart.bind(this);
        this.commandSuccess = this.commandSuccess.bind(this);
        this.commandError = this.commandError.bind(this);
        this.broadcast = this.broadcast.bind(this);
        this.setLogHandler = this.setLogHandler.bind(this);
        this.addWebSocketClient = this.addWebSocketClient.bind(this);
        this.removeWebSocketClient = this.removeWebSocketClient.bind(this);
        this._logInternal = this._logInternal.bind(this);
    }

    /**
     * Sets the handler function for logging messages (e.g., console.log or a custom function).
     * @param {Function} handler - The function to handle log messages (receives level, message).
     */
    setLogHandler(handler) {
        if (typeof handler === 'function') {
            this.logHandler = handler;
        } else {
            console.error("Log handler must be a function.");
        }
    }

    addWebSocketClient(client) {
        this.webSocketClients.add(client);
        console.log(`[OutputManager] WebSocket client added. Total clients: ${this.webSocketClients.size}`);
    }

    removeWebSocketClient(client) {
        this.webSocketClients.delete(client);
         console.log(`[OutputManager] WebSocket client removed. Total clients: ${this.webSocketClients.size}`);
    }

    /**
     * Sends a message to all connected WebSocket clients.
     * @param {Object|string} message - The message object or string to send.
     */
    broadcast(message) {
        if (this.isBroadcasting) return; // Prevent recursion if broadcast itself logs
        this.isBroadcasting = true;

        // console.log(`[OutputManager] Broadcasting to ${this.webSocketClients.size} clients:`, JSON.stringify(message).substring(0,100)); // Debug broadcast

        const messageToSend = typeof message === 'string' ? { type: 'output', data: message } : message;

        // Add server timestamp/ID if not present
        if (!messageToSend.serverMessageId) {
             messageToSend.serverMessageId = `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        const messageString = JSON.stringify(messageToSend);

        this.webSocketClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageString);
                } catch (error) {
                    console.error("[OutputManager] Error sending message to WebSocket client:", error);
                    // Optionally remove the client if sending fails repeatedly
                    // this.removeWebSocketClient(client);
                }
            } else {
                 console.warn("[OutputManager] Attempted to send message to non-open WebSocket client. State:", client.readyState);
                 // Clean up closed clients proactively
                 // this.removeWebSocketClient(client); // Be careful with modifying set during iteration
            }
        });
        this.isBroadcasting = false;
    }

    /**
     * Logs a message using the configured log handler.
     * Also broadcasts to WebSocket clients if any are connected.
     * @param {string} level - The log level (e.g., 'info', 'warn', 'error', 'debug').
     * @param {string} message - The message to log.
     */
    _logInternal(level, message) {
         // Use the configured handler (might be console.log or broadcast via setLogHandler in web mode)
        if (this.logHandler) {
             try {
                // Ensure logHandler is called with appropriate context if needed,
                // but the main issue is calling _logInternal itself.
                this.logHandler(level, message);
             } catch (handlerError) {
                 console.error("Error in custom log handler:", handlerError);
                 // Fallback to console.error if handler fails
                 console.error(`[${level.toUpperCase()}] ${message}`);
             }
        } else {
            // Fallback if no handler is set (shouldn't happen with default)
            console.log(`[${level.toUpperCase()}] ${message}`);
        }

        // Broadcast to WebSocket clients regardless of the console logHandler
        // Check if there are clients before broadcasting
        if (this.webSocketClients.size > 0) {
            const messageType = level === 'error' ? 'error' : 'output'; // Basic mapping
            const payload = { type: messageType };
            if (level === 'error') {
                payload.error = message;
            } else {
                payload.data = message; // Assuming 'output' type uses 'data'
            }
            // Add level info for non-error messages if desired
            // if (level !== 'error') payload.level = level;

            this.broadcast(payload);
        }
    }

    // Public log methods - Ensure they call _logInternal with correct 'this'
    log(message) {
        this._logInternal('info', message);
    }

    error(message) {
        this._logInternal('error', message);
    }

    warn(message) {
        this._logInternal('warn', message);
    }

    debug(message) {
        // Only log debug messages if DEBUG_MODE is enabled
        if (process.env.DEBUG_MODE === 'true') {
            this._logInternal('debug', message);
        }
    }

    // Specific output types for clarity
    commandStart(command) {
        this.log(`[CMD START] ${command}`);
    }

    commandSuccess(command, message = 'Completed successfully.') {
        this.log(`[CMD SUCCESS] ${command}: ${message}`);
    }

    commandError(command, errorMessage) {
        this.error(`[CMD ERROR] ${command}: ${errorMessage}`);
    }
}

// Export a singleton instance
export const output = new OutputManager();

// Ensure outputManager is exported
export const outputManager = new OutputManager();
