/**
 * WebSocket Communication Manager
 *
 * Handles sending and receiving messages over WebSocket.
 */
class WebComm {
    constructor(url) {
        this.url = url;
        this.ws = null;
    this.handlers = new Map(); // Store handlers for different message types (multiple allowed)
        this.reconnectInterval = 5000; // Reconnect every 5 seconds
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.isConnecting = false;
        this.connectionPromise = null;
        this.resolveConnectionPromise = null;
        this.rejectConnectionPromise = null;
        
        // Ping/Pong settings
        this.pingIntervalMs = 30000; // Send a ping every 30 seconds
        this.pongTimeoutMs = 10000; // Expect a pong within 10 seconds
        this.pingIntervalId = null;
        this.pongTimeoutId = null;
        this.terminal = null; // Will be set by Terminal instance
    }

    setTerminal(terminalInstance) {
        this.terminal = terminalInstance;
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocket already connected or connecting.");
            return this.connectionPromise || Promise.resolve();
        }
        if (this.isConnecting) {
            console.log("WebSocket connection attempt already in progress.");
            return this.connectionPromise;
        }

        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve, reject) => {
            this.resolveConnectionPromise = resolve;
            this.rejectConnectionPromise = reject;
        });

        // Determine the WebSocket protocol based on the page's protocol
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use the page's host for the WebSocket connection
        const wsHost = window.location.host;
        // --- MODIFIED LINE ---
        // Define the specific path for the WebSocket endpoint
        const wsPath = '/api/research/ws';
        // Construct the WebSocket URL including the correct path
        const wsUrl = `${wsProtocol}//${wsHost}${wsPath}`;
        // --- END MODIFICATION ---

        console.log(`Attempting to connect to WebSocket: ${wsUrl}`); // Log the correct URL
        this.triggerHandler('connection', { connected: false, reason: 'Connecting...' }); // Notify UI

        try {
            this.ws = new WebSocket(wsUrl); // Use the corrected URL
        } catch (error) {
            console.error("WebSocket constructor failed:", error);
            this.isConnecting = false;
            this.handleClose(null, `Connection failed: ${error.message}`); // Pass error message
            if (this.rejectConnectionPromise) this.rejectConnectionPromise(error);
            this.scheduleReconnect();
            return this.connectionPromise; // Return the pending promise which will be rejected
        }

        this.ws.onopen = () => {
            console.log("WebSocket connection established.");
            this.isConnecting = false;
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            this.triggerHandler('connection', { connected: true });
            if (this.resolveConnectionPromise) this.resolveConnectionPromise();
            this.startPinging(); // Start pinging once connected
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'pong') {
                    this.handlePong();
                    return;
                }

                // --- REMOVE direct handling for chat-response ---
                // Let chat-response be handled by triggerHandler like other messages.
                // The Chat class or Terminal class will have registered a handler for 'chat-response'.
                //
                // Old code that was here:
                // if (message.type === 'chat_response' || message.type === 'chat-response') {
                //     if (this.terminal?. _displayAiResponse) {
                //         this.terminal._displayAiResponse(message.message || message.data);
                //     } else if (this.terminal?.appendOutput) {
                //         this.terminal.appendOutput(message.message || message.data, 'ai-response-output');
                //     }
                //     return;                                   // already handled
                // }
                // ---------------------------------------------------------------

                this.triggerHandler(message.type, message);  // everything else
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error);
                this.triggerHandler('error', { error: 'Received invalid message format from server.' });
            }
        };

        this.ws.onerror = (event) => {
            // This often precedes onclose when there's an issue
            console.error("WebSocket error observed:", event);
            // Don't trigger connection handler here, onclose will handle it
            // Don't reject connection promise here, let onclose handle it
            // No need to call this.stopPinging() here, onclose will handle it.
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'N/A'}, Clean: ${event.wasClean}`);
            this.isConnecting = false;
            const reason = this.getCloseReason(event.code, event.reason);
            this.stopPinging(); // Stop pinging when connection closes
            this.handleClose(event, reason); // Pass event and reason
            if (this.rejectConnectionPromise) {
                this.rejectConnectionPromise(new Error(`WebSocket closed: ${reason}`));
                // Nullify to prevent multiple rejections if connect is called again before promise resolves/rejects
                this.rejectConnectionPromise = null;
                this.resolveConnectionPromise = null;
            }
            this.scheduleReconnect();
        };

        return this.connectionPromise;
    }

    handleClose(event, reason) {
        this.ws = null; // Clear the WebSocket instance
        this.triggerHandler('connection', { connected: false, reason: reason });
    }

    getCloseReason(code, reason) {
        if (reason) return reason;
        switch (code) {
            case 1000: return 'Normal closure';
            case 1001: return 'Going away';
            case 1002: return 'Protocol error';
            case 1003: return 'Unsupported data';
            case 1005: return 'No status received';
            case 1006: return 'Abnormal closure (check server logs/network)'; // Often indicates server crash or network issue
            case 1007: return 'Invalid frame payload data';
            case 1008: return 'Policy violation';
            case 1009: return 'Message too big';
            case 1010: return 'Missing extension';
            case 1011: return 'Internal server error';
            case 1015: return 'TLS handshake failure';
            default: return `Unknown closure code: ${code}`;
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max WebSocket reconnect attempts reached. Giving up.");
            this.triggerHandler('connection', { connected: false, reason: 'Max reconnect attempts reached.' });
            this.stopPinging(); // Stop pinging if giving up
            return;
        }
        this.reconnectAttempts++;
        const delay = this.reconnectInterval * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4)); // Exponential backoff capped
        console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay / 1000} seconds...`);
        this.stopPinging(); // Stop current pinging before scheduling a new connect attempt
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Send a command message to the server.
     * Parses the command string and sends a structured message.
     * @param {string} commandString - The full command string (e.g., "/login user pass").
     */
    sendCommand(commandString) {
        // Only messages starting with / should be treated as commands
        if (!commandString || !commandString.startsWith('/')) {
            console.error("Invalid command format for sendCommand:", commandString);
            this.triggerHandler('error', { error: 'Internal Error: Invalid command format.' });
            return Promise.reject(new Error("Invalid command format")); // Return a rejected promise
        }

        const parts = commandString.substring(1).split(' ');
        const command = parts[0]; // Base command name, e.g., "login"
        const args = parts.slice(1); // Arguments array

        const message = {
            type: 'command',
            command: command, // Send WITHOUT the leading slash
            args: args
        };

        return this.send(JSON.stringify(message));
    }

    /**
     * Send a chat message to the server.
     * @param {string} messageText - The text of the chat message.
     */
    sendChatMessage(messageText) {
        const message = {
            type: 'chat-message',
            message: messageText
        };
        return this.send(JSON.stringify(message));
    }

    /**
     * Send generic input to the server (e.g., response to a prompt).
     * @param {string} inputValue - The input value.
     */
    sendInput(inputValue) {
        const message = {
            type: 'input',
            value: inputValue
        };
        return this.send(JSON.stringify(message));
    }

    /**
     * Send a JSON message to the WebSocket server.
     * @param {string} message - The JSON string to send.
     */
    send(message) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.error("WebSocket not connected. Cannot send message.");
                this.triggerHandler('error', { error: 'Not connected to server.' });
                reject(new Error("WebSocket not connected."));
                return;
            }
            try {
                console.log("Sending message:", message); // Log message being sent
                this.ws.send(message);
                resolve(); // Resolve promise on successful send queuing
            } catch (error) {
                console.error("WebSocket send error:", error);
                this.triggerHandler('error', { error: `Failed to send message: ${error.message}` });
                reject(error); // Reject promise on error
            }
        });
    }

    /**
     * Register a handler for a specific message type.
     * @param {string} type - The message type (e.g., 'output', 'error').
     * @param {function} handler - The function to call when a message of this type is received.
     */
    registerHandler(type, handler) {
        if (!type || typeof handler !== 'function') {
            console.warn(`[WebComm] Ignoring invalid handler registration for type: ${type}`);
            return () => {};
        }

        const normalizedType = String(type);
        if (!this.handlers.has(normalizedType)) {
            this.handlers.set(normalizedType, new Set());
        }

        const handlerSet = this.handlers.get(normalizedType);
        handlerSet.add(handler);
        console.log(`Registered handler for type: ${normalizedType} (total ${handlerSet.size})`);

        return () => this.unregisterHandler(normalizedType, handler);
    }

    unregisterHandler(type, handler) {
        const normalizedType = String(type);
        const handlerSet = this.handlers.get(normalizedType);
        if (!handlerSet) {
            return;
        }

        handlerSet.delete(handler);
        if (handlerSet.size === 0) {
            this.handlers.delete(normalizedType);
        }
    }

    /**
     * Trigger the handler for a specific message type.
     * @param {string} type - The message type.
     * @param {object} message - The message data.
     */
    triggerHandler(type, message) {
        const handlers = this.handlers.get(type);
        if (!handlers || handlers.size === 0) {
            return;
        }

        for (const handler of handlers) {
            try {
                handler(message);
            } catch (error) {
                console.error(`Error in handler for message type "${type}":`, error);
                if (type !== 'error') {
                    const errorHandlers = this.handlers.get('error');
                    if (errorHandlers && errorHandlers.size > 0) {
                        for (const errorHandler of errorHandlers) {
                            try {
                                errorHandler({ error: `Client-side handler error: ${error.message}` });
                            } catch (innerError) {
                                console.error('[WebComm] Nested error handler failure:', innerError);
                            }
                        }
                    }
                }
            }
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    close() {
        if (this.ws) {
            console.log("Closing WebSocket connection explicitly.");
            this.stopPinging(); // Stop pinging on explicit close
            // Prevent automatic reconnection when closed explicitly
            this.reconnectAttempts = this.maxReconnectAttempts;
            this.ws.close(1000, "Client initiated disconnect");
        }
    }

    // --- Ping/Pong Methods ---
    startPinging() {
        this.stopPinging(); // Clear any existing interval
        this.pingIntervalId = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // console.log("[WebComm] Sending ping");
                this.send(JSON.stringify({ type: 'ping' })).catch(err => {
                    console.error("[WebComm] Error sending ping:", err);
                    // If ping fails to send, connection might be bad, trigger a close to attempt reconnect
                    this.ws.close(1006, "Ping send failed");
                });
                // Set a timeout to expect a pong
                this.pongTimeoutId = setTimeout(() => {
                    console.warn("[WebComm] Pong not received in time. Closing connection.");
                    this.ws.close(1006, "Pong timeout"); // 1006: Abnormal Closure
                }, this.pongTimeoutMs);
            } else {
                // console.warn("[WebComm] WebSocket not open, cannot send ping. Clearing ping interval.");
                this.stopPinging(); // Stop if ws is not open
            }
        }, this.pingIntervalMs);
    }

    handlePong() {
        // console.log("[WebComm] Pong received");
        clearTimeout(this.pongTimeoutId); // Clear the pong timeout
    }

    stopPinging() {
        // console.log("[WebComm] Stopping ping/pong timers.");
        clearInterval(this.pingIntervalId);
        clearTimeout(this.pongTimeoutId);
        this.pingIntervalId = null;
        this.pongTimeoutId = null;
    }
    // --- End Ping/Pong Methods ---
}