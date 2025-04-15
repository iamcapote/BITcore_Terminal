/**
 * Research module for the web terminal interface
 * 
 * Handles terminal integration for the web client.
 * Command processing is delegated to command-processor.js
 */
class Research {
  constructor(terminal) {
    this.terminal = terminal;
    this.activeMode = 'command'; // 'command', 'research', 'chat'
    this.running = false;
    this.currentUser = { username: 'public', role: 'public' };
    this.chatSessionId = null; // Add property to store chat session ID
    
    // Set up WebSocket message handlers for specific messages
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
    
    // Register handlers for research-related message types
    webcomm.registerHandler('research_start', this.handleResearchStart.bind(this));
    webcomm.registerHandler('research_complete', this.handleResearchComplete.bind(this));
    webcomm.registerHandler('progress', this.handleProgress.bind(this));
    webcomm.registerHandler('auth-status-change', this.handleAuthStatusChange.bind(this));
    webcomm.registerHandler('mode_change', this.handleModeChange.bind(this));
    webcomm.registerHandler('connection', this.handleConnectionChange.bind(this));
    webcomm.registerHandler('chat-ready', this.handleChatReady.bind(this));
    webcomm.registerHandler('chat-response', this.handleChatResponse.bind(this));
    webcomm.registerHandler('system-message', this.handleSystemMessage.bind(this));
  }
  
  /**
   * Check WebSocket connection status
   */
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
   * Process user input from the terminal
   * 
   * @param {string} input - User input from terminal
   * @returns {Promise<void>}
   */
  async processInput(input) {
    if (!input || !input.trim()) {
      return;
    }
    
    // Don't allow new input while a command is running
    if (this.running && !this.terminal.passwordMode) {
      this.terminal.appendOutput('Please wait for the current operation to complete.');
      return;
    }
    
    try {
      console.log('[Research] Processing input:', input.substring(0, 20) + (input.length > 20 ? '...' : ''));
      
      // Handle based on active mode
      if (this.activeMode === 'chat' && !input.startsWith('/')) {
        // In chat mode, send as chat message
        this.terminal.disableInput();
        try {
          if (!this.chatSessionId) {
            throw new Error('No active chat session. Please restart the chat session with /chat');
          }
          await webcomm.sendInput(input, { mode: 'chat', sessionId: this.chatSessionId });
          this.terminal.appendOutput(`You: ${input}`);
        } catch (error) {
          console.error('[Research] Error sending chat message:', error);
          this.terminal.appendOutput(`Error sending message: ${error.message}`);
        } finally {
          this.terminal.enableInput();
        }
        return;
      }
      
      // Input is a command or we're in command mode
      if (input.startsWith('/')) {
        this.running = true;
        this.terminal.disableInput();
        
        try {
          if (window.commandProcessor) {
            const result = await window.commandProcessor.executeCommand(input);
            if (!result.success && result.error) {
              this.terminal.appendOutput(`Error: ${result.error}`);
            }
            if (result.mode) {
              this.setMode(result.mode);
            }
          } else {
            await webcomm.sendInput(input);
          }
        } catch (error) {
          console.error('[Research] Error executing command:', error);
          this.terminal.appendOutput(`Error executing command: ${error.message}`);
        } finally {
          this.running = false;
          this.terminal.enableInput();
        }
      } else if (this.activeMode === 'command') {
        this.terminal.appendOutput("Please start commands with / (e.g., /research, /login, /status)");
      } else {
        this.terminal.disableInput();
        try {
          await webcomm.sendInput(input, { mode: this.activeMode });
        } catch (error) {
          console.error('[Research] Error sending input:', error);
          this.terminal.appendOutput(`Error: ${error.message}`);
        } finally {
          this.terminal.enableInput();
        }
      }
    } catch (error) {
      console.error('[Research] Error processing input:', error);
      this.terminal.appendOutput(`Error: ${error.message}`);
      this.running = false;
      this.terminal.enableInput();
    }
  }
  
  /**
   * Set the active mode
   * 
   * @param {string} mode - New mode ('command', 'research', 'chat')
   */
  setMode(mode) {
    if (!mode || typeof mode !== 'string') {
      return;
    }
    
    const normalizedMode = mode.toLowerCase();
    
    if (['command', 'research', 'chat'].includes(normalizedMode)) {
      // Clear chat session ID if exiting chat mode
      if (this.activeMode === 'chat' && normalizedMode !== 'chat') {
        this.chatSessionId = null;
        console.log('[Research] Chat session ended, session ID cleared');
      }
      
      this.activeMode = normalizedMode;
      
      // Update prompt based on mode
      if (normalizedMode === 'command') {
        this.terminal.setPrompt("> ");
      } else if (normalizedMode === 'chat') {
        this.terminal.setPrompt("chat> ");
      } else if (normalizedMode === 'research') {
        this.terminal.setPrompt("research> ");
      }
      
      console.log(`[Research] Mode changed to: ${this.activeMode}`);
    }
  }
  
  /**
   * Handle research start event
   * 
   * @param {Object} message - Research start message
   */
  handleResearchStart(message) {
    console.log('[Research] Research started');
    this.running = true;
    this.setMode('research');
    this.terminal.showProgressBar();
    this.terminal.disableInput();
  }
  
  /**
   * Handle research complete event
   * 
   * @param {Object} message - Research complete message
   */
  handleResearchComplete(message) {
    console.log('[Research] Research completed');
    this.running = false;
    this.setMode('command');
    this.terminal.hideProgressBar();
    this.terminal.enableInput();
  }
  
  /**
   * Handle progress update event
   * 
   * @param {Object} message - Progress update message
   */
  handleProgress(message) {
    if (message.data) {
      let progressText;
      if (typeof message.data === 'string') {
        progressText = message.data;
      } else {
        progressText = message.data.message || `Progress: ${JSON.stringify(message.data)}`;
      }
      
      this.terminal.updateLastLine(progressText);
    }
  }
  
  /**
   * Handle auth status change event
   * 
   * @param {Object} message - Auth status message
   */
  handleAuthStatusChange(message) {
    if (message.user) {
      this.currentUser = message.user;
      console.log(`[Research] User changed: ${this.currentUser.username} (${this.currentUser.role})`);
    }
  }
  
  /**
   * Handle mode change event
   * 
   * @param {Object} message - Mode change message
   */
  handleModeChange(message) {
    if (message.mode) {
      this.setMode(message.mode);
    }
  }
  
  /**
   * Handle WebSocket connection change event
   * 
   * @param {Object} message - Connection change message
   */
  handleConnectionChange(message) {
    const status = message.connected ? 'connected' : 'disconnected';
    console.log(`[Research] Connection status: ${status}`);
    this.terminal.setStatus(status);
    
    if (message.connected) {
      this.terminal.appendOutput('Connected to server.');
      this.terminal.enableInput();
    } else {
      this.terminal.appendOutput('Connection lost. Attempting to reconnect...');
    }
  }
  
  /**
   * Handle chat ready event
   * 
   * @param {Object} message - Chat ready message
   */
  handleChatReady(message) {
    // Store the session ID for future chat messages
    if (message.sessionId) {
      this.chatSessionId = message.sessionId;
      console.log('[Research] Chat session ID stored:', this.chatSessionId);
    }
    
    this.terminal.appendOutput('Chat session initialized.');
    this.setMode('chat');
    this.terminal.enableInput();
  }
  
  /**
   * Handle chat response event
   * 
   * @param {Object} message - Chat response message
   */
  handleChatResponse(message) {
    if (message.message) {
      // Format as AI response
      this.terminal.appendOutput(`AI: ${message.message}`);
    }
    this.terminal.enableInput();
  }
  
  /**
   * Handle system message
   * 
   * @param {Object} message - System message
   */
  handleSystemMessage(message) {
    if (message.message) {
      this.terminal.appendOutput(`[System] ${message.message}`);
    }
  }
  
  /**
   * Get current user information
   * 
   * @returns {Object} Current user object
   */
  getCurrentUser() {
    return this.currentUser || { username: 'public', role: 'public' };
  }
  
  /**
   * Request information about the current user
   */
  async requestUserInfo() {
    try {
      await webcomm.sendCommand('/status');
    } catch (error) {
      console.error('Error requesting user info:', error);
    }
  }
  
  /**
   * Handle recovery from timeout or error
   */
  recoverFromTimeout() {
    this.running = false;
    this.terminal.enableInput();
    if (this.activeMode === 'chat') {
      this.terminal.appendOutput('Chat session timed out. Please restart the session.');
      this.setMode('command');
    }
  }
}
