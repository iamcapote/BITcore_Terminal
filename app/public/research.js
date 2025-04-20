/**
 * Research module for the web terminal interface
 * 
 * Handles terminal integration for the web client.
 * Command processing is delegated to command-processor.js
 * 
 * DEVELOPER NOTE: This file should ONLY handle research-specific functionality.
 * It should NOT manage passwords, API keys, or other authentication concerns.
 * Authentication and general command handling should be in separate modules.
 * 
 * @module research.js
 */
class Research {
  constructor(terminal) {
    this.terminal = terminal;
    this.running = false;
    // Set up WebSocket message handlers for research-specific messages
    this.setupMessageHandlers();
    // Initial connection check
    this.checkConnection();
  }

  /**
   * Set up WebSocket message handlers for research-specific messages
   */
  setupMessageHandlers() {
    if (!window.webcomm) {
      console.error('WebSocket communicator not initialized.');
      return;
    }
    // Register handlers for research-related message types only
    webcomm.registerHandler('research_start', this.handleResearchStart.bind(this));
    webcomm.registerHandler('research_complete', this.handleResearchComplete.bind(this));
    webcomm.registerHandler('progress', this.handleProgress.bind(this));
    webcomm.registerHandler('connection', this.handleConnectionChange.bind(this));
    webcomm.registerHandler('system-message', this.handleSystemMessage.bind(this));
  }

  checkConnection() {
    if (window.webcomm) {
      const status = webcomm.getStatus();
      this.handleConnectionChange({
        type: 'connection',
        connected: status.connected
      });
    }
  }

  /**
   * Process user input from the terminal (only for research commands)
   * @param {string} input - User input from terminal
   * @returns {Promise<void>}
   */
  async processInput(input) {
    if (!input || !input.trim()) return;
    if (this.running) {
      this.terminal.appendOutput('Please wait for the current research to complete.');
      return;
    }
    // Delegate all command processing to commandProcessor
    try {
      if (window.commandProcessor) {
        await window.commandProcessor.executeCommand(input);
      }
    } catch (error) {
      this.terminal.appendOutput(`Error executing command: ${error.message}`);
    }
  }

  handleResearchStart(message) {
    this.running = true;
    this.terminal.showProgressBar();
    // Input locking is handled by terminal.js
  }

  handleResearchComplete(message) {
    this.running = false;
    this.terminal.hideProgressBar();
    // Input unlocking is handled by terminal.js
  }

  handleProgress(message) {
    if (message.data) {
      let progressText = typeof message.data === 'string' ? message.data : (message.data.message || `Progress: ${JSON.stringify(message.data)}`);
      this.terminal.updateLastLine(progressText);
      this.terminal.showProgressBar();
    }
  }

  handleConnectionChange(message) {
    const status = message.connected ? 'connected' : 'disconnected';
    this.terminal.setStatus(status);
    if (message.connected) {
      this.terminal.appendOutput('Connected to server.');
      this.terminal.enableInput();
    } else {
      this.terminal.appendOutput('Connection lost. Please log in again.');
      this.terminal.disableInput();
      // Optionally reset mode and prompt
      this.running = false;
      this.terminal.mode = 'command';
      this.terminal.setPrompt('> ');
    }
  }

  handleSystemMessage(message) {
    if (message.message) {
      this.terminal.appendOutput(`[System] ${message.message}`);
    }
  }

  /**
   * Handle recovery from timeout or error
   */
  recoverFromTimeout() {
    this.running = false;
    this.terminal.enableInput();
    this.terminal.appendOutput('Research session timed out. Please try again.');
  }

  /**
   * Returns true if research mode is active.
   */
  isActive() {
    return !!this.running;
  }

  /**
   * Set research mode (for terminal reset, etc)
   */
  setMode(mode) {
    if (mode === 'command') {
      this.running = false;
    }
  }
}

window.Research = Research;
