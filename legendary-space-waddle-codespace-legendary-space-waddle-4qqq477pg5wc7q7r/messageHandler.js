import {
    appendOutput,
    setInputFieldEnabled,
    setInputFieldType,
    triggerDownload,
    updateStatus,
    clearOutput
} from './uiManager.js';
import {
    setCurrentMode,
    setLoggedInUser,
    setCurrentPromptContext,
    setInputEnabled
} from './stateManager.js';

/**
 * Handles incoming messages from the WebSocket server.
 * @param {object} message The parsed JSON message.
 */
export const handleMessage = (message) => {
    const { type, payload } = message;

    if (!type) {
        console.error('Received message without type:', message);
        appendOutput('Received invalid message from server.', 'error');
        return;
    }

    try {
        switch (type) {
            case 'output':
                appendOutput(payload.text || payload, 'output');
                break;
            case 'error':
                appendOutput(payload.message || payload, 'error');
                break;
            case 'progress':
                // TODO: Implement a more sophisticated progress indicator if needed
                updateStatus(payload.message || `Progress: ${payload.percentage}%`, 'busy');
                appendOutput(`Progress: ${payload.message || payload.percentage + '%'}`, 'info');
                break;
            case 'prompt':
                appendOutput(payload.text, 'prompt');
                setInputFieldType(payload.inputType || 'text'); // e.g., 'text', 'password'
                setCurrentPromptContext(payload.context || null); // Store context for sending response
                setCurrentMode('prompt');
                setInputEnabled(true);
                setInputFieldEnabled(true);
                break;
            case 'mode_change':
                setCurrentMode(payload.mode);
                appendOutput(`Mode changed to: ${payload.mode}`, 'info');
                updateStatus(`Mode: ${payload.mode}`, 'info');
                // Input enabled state might change based on mode, handled by enable/disable messages
                break;
            case 'login_success':
                setLoggedInUser(payload.user);
                appendOutput(`Login successful. Welcome, ${payload.user}!`, 'info');
                // Mode might change after login, expect 'mode_change' message
                break;
            case 'logout_success':
                setLoggedInUser(null);
                setCurrentMode('command'); // Or whatever the default logged-out mode is
                appendOutput('Logout successful.', 'info');
                updateStatus('Logged Out', 'info');
                break;
            case 'enable_input':
                setInputEnabled(true);
                setInputFieldEnabled(true);
                appendOutput('Input enabled.', 'info');
                break;
            case 'disable_input':
                setInputEnabled(false);
                setInputFieldEnabled(false);
                appendOutput('Input disabled.', 'info');
                break;
            case 'download_file':
                triggerDownload(payload.filename, payload.content, payload.mimeType);
                break;
            case 'memory_commit':
                appendOutput(`Memory commit successful: ${payload.message}`, 'info');
                break;
            case 'research_complete':
                appendOutput(`Research complete: ${payload.message}`, 'info');
                updateStatus('Idle', 'info'); // Update status after long task
                break;
            case 'connection': // e.g., initial connection info
                appendOutput(`Server connection info: ${payload.message}`, 'info');
                break;
            case 'session-expired':
                appendOutput('Your session has expired. Please log in again.', 'error');
                setLoggedInUser(null);
                setCurrentMode('disconnected'); // Or appropriate state
                setInputEnabled(false);
                setInputFieldEnabled(false);
                updateStatus('Session Expired', 'error');
                // Optionally force a reconnect or redirect to login
                break;
            case 'clear_screen': // Example of a UI command from backend
                 clearOutput();
                 appendOutput('Screen cleared by server.', 'info');
                 break;
            default:
                console.warn(`Received unhandled message type: ${type}`, payload);
                appendOutput(`Received unknown message type: ${type}`, 'info');
        }
    } catch (error) {
        console.error(`Error handling message type ${type}:`, error);
        appendOutput(`Error processing server message: ${error.message}`, 'error');
    }
};
