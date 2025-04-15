/**
 * Chat Module for MCP Web Terminal
 * 
 * Handles chat sessions and interactions with the chat API
 */
class Chat {
  constructor(terminal) {
    this.terminal = terminal;
    this.webcomm = window.webcomm;
    this.active = false;
    this.history = [];
    this.sessionId = null;
    
    // Register chat-related event handlers
    if (this.webcomm) {
      this.webcomm.registerHandler('chat-response', this.handleChatResponse.bind(this));
      this.webcomm.registerHandler('chat-error', this.handleChatError.bind(this));
      this.webcomm.registerHandler('chat-ready', this.handleChatReady.bind(this));
      this.webcomm.registerHandler('chat-exit', this.handleChatExit.bind(this));
    }
  }
  
  /**
   * Process a chat command
   * 
   * @param {string} command - Command string including arguments
   * @returns {Promise<boolean>} Success indicator
   */
  async processChatCommand(command) {
    if (!this.webcomm) {
      this.terminal.appendOutput('Error: WebSocket communicator not initialized');
      this.terminal.enableInput();
      return false;
    }
    
    try {
      // Parse command options if any
      const commandParts = command.trim().split(/\s+/);
      const options = {};
      
      // Extract options like --memory=true
      commandParts.forEach(part => {
        if (part.startsWith('--')) {
          const [key, value] = part.substring(2).split('=');
          options[key] = value || true;
        }
      });
      
      // Send the command to server
      await this.webcomm.sendInput(command);
      
      // Mark chat as active - will be confirmed by chat-ready event
      this.active = true;
      
      return true;
    } catch (error) {
      console.error('Error processing chat command:', error);
      this.terminal.appendOutput(`Error: ${error.message}`);
      this.terminal.enableInput();
      return false;
    }
  }
  
  /**
   * Handle a message received in chat mode
   * 
   * @param {string} message - User message to send
   * @returns {Promise<boolean>} Success indicator
   */
  async sendChatMessage(message) {
    if (!this.active) {
      this.terminal.appendOutput('Error: Chat session is not active');
      return false;
    }
    
    try {
      // Add user message to history
      this.history.push({ role: 'user', content: message });
      
      // Send to server
      await this.webcomm.sendInput(message, {
        chatMode: true,
        sessionId: this.sessionId
      });
      
      return true;
    } catch (error) {
      console.error('Error sending chat message:', error);
      this.terminal.appendOutput(`Error: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Handle chat response from server
   * 
   * @param {Object} data - Response data
   */
  handleChatResponse(data) {
    if (data.content) {
      // Add to history
      this.history.push({ role: 'assistant', content: data.content });
      
      // Display in terminal
      this.terminal.appendOutput(`[AI] ${data.content}`);
    }
    
    // Re-enable input
    this.terminal.enableInput();
  }
  
  /**
   * Handle chat error from server
   * 
   * @param {Object} data - Error data
   */
  handleChatError(data) {
    if (data.error) {
      this.terminal.appendOutput(`Error: ${data.error}`);
    }
    
    // Re-enable input
    this.terminal.enableInput();
  }
  
  /**
   * Handle chat ready event
   * 
   * @param {Object} data - Ready event data
   */
  handleChatReady(data) {
    this.active = true;
    this.sessionId = data.sessionId;
    
    // Show welcome message if provided
    if (data.welcome) {
      this.terminal.appendOutput(data.welcome);
    } else {
      this.terminal.appendOutput('Chat session started. Type /exit to end chat mode.');
    }
    
    // Update prompt to show chat mode
    this.terminal.setPrompt('[chat] > ');
    
    // Enable input
    this.terminal.enableInput();
  }
  
  /**
   * Handle chat exit event
   */
  handleChatExit() {
    this.active = false;
    this.sessionId = null;
    
    // Reset prompt
    this.terminal.setPrompt('> ');
    
    // Notify user
    this.terminal.appendOutput('Chat session ended.');
    
    // Enable input
    this.terminal.enableInput();
  }
  
  /**
   * Exit chat mode
   * 
   * @returns {Promise<boolean>} Success indicator
   */
  async exitChat() {
    if (!this.active) {
      return true; // Already not in chat mode
    }
    
    try {
      // Send exit command
      await this.webcomm.sendInput('/exit', {
        chatMode: true,
        sessionId: this.sessionId
      });
      
      // Reset state
      this.active = false;
      this.sessionId = null;
      
      // Reset prompt
      this.terminal.setPrompt('> ');
      
      return true;
    } catch (error) {
      console.error('Error exiting chat:', error);
      return false;
    }
  }
  
  /**
   * Check if chat mode is active
   * 
   * @returns {boolean} Is chat active
   */
  isActive() {
    return this.active;
  }

  /**
   * Ensure input is locked during command execution and re-enabled after completion.
   * This method centralizes input handling for chat commands.
   * 
   * @param {Function} commandFn - The command function to execute.
   * @returns {Promise<void>} Resolves when the command completes.
   */
  async executeWithInputLock(commandFn) {
    try {
      this.terminal.disableInput(); // Lock input
      await commandFn();
    } catch (error) {
      console.error('Error during command execution:', error);
      this.terminal.appendOutput(`Error: ${error.message}`);
    } finally {
      this.terminal.enableInput(); // Re-enable input
    }
  }
}

// Create a global chat instance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for terminal to be initialized first
  if (window.terminal) {
    window.chat = new Chat(window.terminal);
  } else {
    window.addEventListener('terminal-ready', () => {
      window.chat = new Chat(window.terminal);
    });
  }
});