/**
 * Manages the application's state.
 */
const state = {
    isConnected: false,
    currentMode: 'disconnected', // disconnected, command, chat, research, prompt
    isInputEnabled: false,
    loggedInUser: null,
    currentPromptContext: null,
};

export const getState = () => ({ ...state });

export const setState = (newState) => {
    Object.assign(state, newState);
    // Optionally, trigger UI updates or other side effects based on state changes
    console.log('State updated:', state);
};

export const setConnected = (isConnected) => {
    setState({ isConnected });
};

export const setCurrentMode = (mode) => {
    setState({ currentMode: mode });
};

export const setInputEnabled = (isEnabled) => {
    setState({ isInputEnabled });
};

export const setLoggedInUser = (user) => {
    setState({ loggedInUser: user });
};

export const setCurrentPromptContext = (context) => {
    setState({ currentPromptContext: context });
};

// Initialize state
console.log('Initial state:', state);
