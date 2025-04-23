/**
 * Manages interactions with the DOM.
 */

// Assume these elements exist in your HTML
const terminalOutput = document.getElementById('terminal-output');
const inputField = document.getElementById('terminal-input');
const statusIndicator = document.getElementById('status-indicator'); // Example element

/**
 * Appends a message to the terminal output.
 * @param {string} text The message text.
 * @param {string} type The message type ('output', 'error', 'info', 'prompt', 'command') for styling.
 */
export const appendOutput = (text, type = 'output') => {
    if (!terminalOutput) return;
    const line = document.createElement('div');
    line.textContent = text;
    line.classList.add(`output-${type}`); // Add class for styling
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight; // Auto-scroll
};

/**
 * Clears the terminal output.
 */
export const clearOutput = () => {
    if (terminalOutput) {
        terminalOutput.innerHTML = '';
    }
};

/**
 * Enables or disables the input field.
 * @param {boolean} enabled True to enable, false to disable.
 */
export const setInputFieldEnabled = (enabled) => {
    if (inputField) {
        inputField.disabled = !enabled;
        if (enabled) {
            inputField.focus();
        }
    }
};

/**
 * Clears the input field.
 */
export const clearInputField = () => {
    if (inputField) {
        inputField.value = '';
    }
};

/**
 * Sets the input field type (e.g., 'text', 'password').
 * @param {string} type The input type.
 */
export const setInputFieldType = (type) => {
    if (inputField) {
        inputField.type = type;
    }
};

/**
 * Updates a status indicator element.
 * @param {string} text The status text.
 * @param {string} statusType 'connected', 'disconnected', 'error', 'busy' etc.
 */
export const updateStatus = (text, statusType = 'info') => {
    if (statusIndicator) {
        statusIndicator.textContent = text;
        // Remove previous status classes
        statusIndicator.className = 'status-indicator'; // Reset classes
        statusIndicator.classList.add(`status-${statusType}`);
    }
    console.log(`Status: [${statusType}] ${text}`);
};

/**
 * Triggers a file download in the browser.
 * @param {string} filename The name of the file.
 * @param {string} content The file content (or data URL).
 * @param {string} mimeType The MIME type of the file.
 */
export const triggerDownload = (filename, content, mimeType = 'application/octet-stream') => {
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        appendOutput(`Downloaded file: ${filename}`, 'info');
    } catch (error) {
        console.error('Download failed:', error);
        appendOutput(`Error downloading file: ${filename}`, 'error');
    }
};

// Initial UI setup
setInputFieldEnabled(false); // Disabled until connected
updateStatus('Disconnected', 'disconnected');
