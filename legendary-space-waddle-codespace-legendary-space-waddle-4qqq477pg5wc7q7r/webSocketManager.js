import { setConnected, setCurrentMode } from './stateManager.js';
import { handleMessage } from './messageHandler.js';
import { updateStatus, appendOutput, setInputFieldEnabled } from './uiManager.js';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000; // 1 second base delay

const getWebSocketURL = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/research/ws`;
};

const connect = () => {
    const url = getWebSocketURL();
    updateStatus(`Connecting to ${url}...`, 'busy');
    appendOutput(`Attempting connection to ${url}...`, 'info');

    try {
        socket = new WebSocket(url);
    } catch (error) {
        console.error("WebSocket creation failed:", error);
        appendOutput(`WebSocket creation failed: ${error.message}`, 'error');
        scheduleReconnect();
        return;
    }


    socket.onopen = () => {
        console.log('WebSocket connection established.');
        appendOutput('Connection established.', 'info');
        updateStatus('Connected', 'connected');
        setConnected(true);
        setInputFieldEnabled(true); // Enable input on successful connection
        reconnectAttempts = 0; // Reset reconnect attempts on success
        // Backend should send initial state/mode message
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message);
            handleMessage(message); // Delegate to message handler
        } catch (error) {
            console.error('Failed to parse incoming message or handle it:', error);
            appendOutput(`Error processing message: ${error.message}`, 'error');
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        appendOutput(`WebSocket error occurred.`, 'error');
        // Don't schedule reconnect here, onclose will handle it
    };

    socket.onclose = (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        appendOutput(`Connection closed. ${event.reason ? `Reason: ${event.reason}` : ''}`, 'error');
        updateStatus('Disconnected', 'disconnected');
        setConnected(false);
        setCurrentMode('disconnected');
        setInputFieldEnabled(false);
        socket = null;

        // Only attempt reconnect if the closure was unexpected
        if (!event.wasClean || event.code === 1006) { // 1006 is abnormal closure
             scheduleReconnect();
        } else {
            appendOutput('Connection closed cleanly.', 'info');
        }
    };
};

const scheduleReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnect attempts reached.');
        appendOutput('Could not reconnect to the server after multiple attempts.', 'error');
        updateStatus('Disconnected (Failed to reconnect)', 'error');
        return;
    }

    reconnectAttempts++;
    const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts - 1); // Exponential backoff
    console.log(`Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms...`);
    appendOutput(`Connection lost. Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`, 'info');
    updateStatus(`Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, 'busy');

    setTimeout(() => {
        connect();
    }, delay);
};

/**
 * Sends a structured message to the WebSocket server.
 * @param {string} type The message type.
 * @param {object} payload The message payload.
 */
export const sendMessage = (type, payload) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            const message = JSON.stringify({ type, payload });
            console.log('Sending message:', message);
            socket.send(message);
        } catch (error) {
            console.error('Failed to send message:', error);
            appendOutput(`Error sending message: ${error.message}`, 'error');
        }
    } else {
        console.error('Cannot send message: WebSocket is not open.');
        appendOutput('Cannot send message: Connection is not active.', 'error');
    }
};

// Initial connection attempt
export const initializeWebSocket = () => {
    connect();
};
