import { getState, getCurrentMode, getCurrentPromptContext } from './stateManager.js';
import { sendMessage } from './webSocketManager.js';
import { appendOutput, clearInputField } from './uiManager.js';

// Optional: Command history
const commandHistory = [];
let historyIndex = -1;

/**
 * Parses a command string into command and arguments.
 * Based on public/command-processor.js logic.
 * @param {string} input The raw input string starting with '/'.
 * @returns {{command: string, args: string[]}}
 */
const parseCommand = (input) => {
    const parts = input.substring(1).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const command = parts[0] || '';
    const args = parts.slice(1).map(arg => arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg);
    return { command, args };
};

/**
 * Processes the user input based on the current application mode.
 * @param {string} rawInput The raw text from the input field.
 */
export const processInput = (rawInput) => {
    const input = rawInput.trim();
    if (!input) return; // Ignore empty input

    const state = getState();

    // Add to history (optional)
    if (input !== commandHistory[commandHistory.length - 1]) {
        commandHistory.push(input);
    }
    historyIndex = commandHistory.length; // Reset history navigation index

    // Display the submitted input/command in the terminal
    appendOutput(`> ${input}`, 'command'); // Style as a command input

    try {
        switch (state.currentMode) {
            case 'command':
            case 'research': // Commands might be allowed in research mode too
                if (input.startsWith('/')) {
                    const { command, args } = parseCommand(input);
                    if (command) {
                        sendMessage('command', { command, args });
                    } else {
                        appendOutput('Invalid command format.', 'error');
                    }
                } else {
                    // Treat non-command input as error or specific action depending on mode
                     if (state.currentMode === 'research') {
                         // Maybe send as implicit input for research? Depends on backend.
                         // sendMessage('input', { text: input }); // Example
                         appendOutput('Input ignored. Use /commands in this mode.', 'info');
                     } else {
                         appendOutput('Invalid input. Use /commands.', 'error');
                     }
                }
                break;
            case 'chat':
                if (input.startsWith('/')) {
                    const { command, args } = parseCommand(input);
                     if (command) {
                        sendMessage('command', { command, args });
                    } else {
                        appendOutput('Invalid command format.', 'error');
                    }
                } else {
                    sendMessage('chat-message', { text: input });
                }
                break;
            case 'prompt':
                // Send input with context if available
                sendMessage('input', { text: input, context: state.currentPromptContext });
                // Backend should change mode and context after receiving input
                break;
            case 'disconnected':
                appendOutput('Cannot send input: Disconnected.', 'error');
                break;
            default:
                appendOutput(`Cannot process input in current mode: ${state.currentMode}`, 'error');
        }
    } catch (error) {
        console.error('Error processing input:', error);
        appendOutput(`Error processing input: ${error.message}`, 'error');
    } finally {
        clearInputField(); // Clear input after processing
    }
};

// Optional: Functions for command history navigation
export const getPreviousHistory = () => {
    if (historyIndex > 0) {
        historyIndex--;
        return commandHistory[historyIndex];
    }
    return commandHistory.length > 0 ? commandHistory[0] : '';
};

export const getNextHistory = () => {
    if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        return commandHistory[historyIndex];
    }
    historyIndex = commandHistory.length; // Point after the last item
    return ''; // Return empty string to clear input
};
