/**
 * WebSocket Communication Manager
 *
 * Handles sending and receiving messages over WebSocket.
 */
class WebComm {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.handlers = {}; // Store handlers for different message types
        this.reconnectInterval = 5000; // Reconnect every 5 seconds
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.isConnecting = false;
        this.connectionPromise = null;
        this.resolveConnectionPromise = null;
        this.rejectConnectionPromise = null;
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


        console.log(`Attempting to connect to WebSocket: ${this.url}`);
        this.triggerHandler('connection', { connected: false, reason: 'Connecting...' }); // Notify UI

        try {
            this.ws = new WebSocket(this.url);
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
        };

        this.ws.onmessage = (event) => {
            // console.log("WebSocket message received:", event.data); // Can be noisy
            try {
                const message = JSON.parse(event.data);
                this.triggerHandler(message.type, message);
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
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'N/A'}, Clean: ${event.wasClean}`);
            this.isConnecting = false;
            const reason = this.getCloseReason(event.code, event.reason);
            this.handleClose(event, reason); // Pass event and reason
            if (this.rejectConnectionPromise) this.rejectConnectionPromise(new Error(`WebSocket closed: ${reason}`));
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
            return;
        }
        this.reconnectAttempts++;
        const delay = this.reconnectInterval * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4)); // Exponential backoff capped
        console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay / 1000} seconds...`);
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
        this.handlers[type] = handler;
        console.log(`Registered handler for type: ${type}`); // Add log
    }

    /**
     * Trigger the handler for a specific message type.
     * @param {string} type - The message type.
     * @param {object} message - The message data.
     */
    triggerHandler(type, message) {
        if (this.handlers[type]) {
            try {
                this.handlers[type](message);
            } catch (error) {
                console.error(`Error in handler for message type "${type}":`, error);
                // Avoid triggering the 'error' handler for an error *within* a handler
                // to prevent potential infinite loops if the error handler itself fails.
                if (type !== 'error' && this.handlers['error']) {
                    this.handlers['error']({ error: `Client-side handler error: ${error.message}` });
                }
            }
        } else {
            // console.warn(`No handler registered for message type: ${type}`); // Can be noisy
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    close() {
        if (this.ws) {
            console.log("Closing WebSocket connection explicitly.");
            // Prevent automatic reconnection when closed explicitly
            this.reconnectAttempts = this.maxReconnectAttempts;
            this.ws.close(1000, "Client initiated disconnect");
        }
    }
}