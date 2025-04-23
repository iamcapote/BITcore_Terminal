import { initializeWebSocket } from './webSocketManager.js';
import { processInput, getPreviousHistory, getNextHistory } from './inputProcessor.js';
import { getState } from './stateManager.js';
import { appendOutput } from './uiManager.js'; // For initial messages

// DOM Elements (ensure these IDs exist in your HTML)
const inputField = document.getElementById('terminal-input');
const terminalForm = document.getElementById('terminal-form'); // Assuming input is in a form

/**
 * Initializes the application modules and sets up event listeners.
 */
const initializeApp = () => {
    console.log('Initializing Deep Research Privacy App Frontend...');
    appendOutput('Welcome to the Deep Research Terminal.', 'info');

    // Initialize WebSocket connection
    initializeWebSocket();

    // Setup input submission listener
    if (terminalForm) {
        terminalForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission
            if (inputField && !inputField.disabled) {
                processInput(inputField.value);
            }
        });
    } else if (inputField) {
        // Fallback if no form, listen for Enter key on input directly
        inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !inputField.disabled) {
                event.preventDefault(); // Prevent newline in input if it's a textarea
                processInput(inputField.value);
            }
            // Optional: Handle command history (ArrowUp/ArrowDown)
            else if (event.key === 'ArrowUp') {
                 event.preventDefault();
                 inputField.value = getPreviousHistory();
                 inputField.setSelectionRange(inputField.value.length, inputField.value.length); // Move cursor to end
            } else if (event.key === 'ArrowDown') {
                 event.preventDefault();
                 inputField.value = getNextHistory();
                 inputField.setSelectionRange(inputField.value.length, inputField.value.length); // Move cursor to end
            }
        });
    } else {
        console.error('Could not find terminal input form or input field.');
        appendOutput('Error: Terminal input element not found.', 'error');
    }

    // Initial focus
    if (inputField) {
       // inputField.focus(); // Focus might be delayed until connection/input enabled
    }

    console.log('Application initialized.');
    appendOutput('Connecting to server...', 'info');
};

// Start the application when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
