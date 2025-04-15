/**
 * Terminal UI Manager
 * 
 * Handles terminal interactions including input/output, command history,
 * and special input modes like password masking.
 */
class Terminal {
  constructor(elementId) {
    this.container = document.getElementById(elementId) || document.querySelector(elementId);
    this.outputArea = null;
    this.inputArea = null;
    this.input = null;
    this.prompt = null;
    this.history = [];
    this.historyIndex = -1;
    this.inputEnabled = true;
    this.currentPrompt = '> ';
    this.passwordMode = false;
    this.progressBar = null;
    this.statusElement = null;
    this.eventListenersInitialized = false;
    
    // Initialize terminal UI
    this.initialize();
    
    // Event listeners
    this.initializeEventListeners();
  }
  
  /**
   * Initialize the terminal container and UI elements
   */
  initialize() {
    if (!this.container) {
      console.error("Terminal container element not found");
      return;
    }
    
    // For direct usage of the element ID 'output' from HTML
    if (this.container.id === 'output') {
      // For the pre-existing HTML structure
      this.outputArea = this.container;
      this.input = document.getElementById('input');
      this.prompt = document.getElementById('prompt');
      
      // Clear the initial "Initializing Research CLI..." message
      this.outputArea.textContent = '';
      
      // Add initial messages
      this.appendOutput('Welcome to MCP Web Terminal');
      this.appendOutput('Type /help for available commands');
      
      return;
    }
    
    // Otherwise create a new terminal UI structure
    // Clear container
    this.container.innerHTML = '';
    this.container.className = 'terminal-container';
    
    // Create output area
    this.outputArea = document.createElement('div');
    this.outputArea.className = 'terminal-output';
    this.container.appendChild(this.outputArea);
    
    // Create progress bar (hidden by default)
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'terminal-progress';
    this.progressBar.style.display = 'none';
    this.container.appendChild(this.progressBar);
    
    // Create status indicator
    this.statusElement = document.createElement('div');
    this.statusElement.className = 'terminal-status';
    this.statusElement.style.display = 'none';
    this.container.appendChild(this.statusElement);
    
    // Create input area
    this.inputArea = document.createElement('div');
    this.inputArea.className = 'terminal-input-area';
    this.container.appendChild(this.inputArea);
    
    // Create prompt
    this.prompt = document.createElement('span');
    this.prompt.className = 'terminal-prompt';
    this.prompt.innerText = this.currentPrompt;
    this.inputArea.appendChild(this.prompt);
    
    // Create input field
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'terminal-input';
    this.input.autocapitalize = 'off';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.inputArea.appendChild(this.input);
    
    // Initial message
    this.appendOutput('Welcome to MCP Web Terminal');
    this.appendOutput('Type /help for available commands');
  }
  
  /**
   * Initialize event listeners for terminal input
   */
  initializeEventListeners() {
    if (this.eventListenersInitialized) return;
    this.eventListenersInitialized = true;
    
    if (!this.input) {
      console.error("Terminal input element not found");
      return;
    }
    
    // Add event listener for keyboard events on the input field
    this.input.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Focus input when terminal is clicked
    if (this.container) {
      this.container.addEventListener('click', () => {
        if (this.inputEnabled && this.input) {
          this.input.focus();
        }
      });
    }
    
    // Handle WebSocket system messages
    if (window.webcomm) {
      webcomm.registerHandler('system-message', this.handleSystemMessage.bind(this));
      webcomm.registerHandler('output', this.handleOutput.bind(this));
      webcomm.registerHandler('error', this.handleError.bind(this));
      webcomm.registerHandler('prompt', this.handlePrompt.bind(this));
    }
    
    // Focus input field
    setTimeout(() => {
      if (this.input) {
        this.input.focus();
      }
    }, 100);
  }
  
  /**
   * Handle keyboard events
   * 
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    if (!this.inputEnabled) return;
    
    // History navigation
    if (e.key === 'ArrowUp') {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.input.value = this.history[this.historyIndex];
        e.preventDefault();
      }
    } else if (e.key === 'ArrowDown') {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.input.value = this.history[this.historyIndex];
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.input.value = '';
      }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const value = this.input.value.trim();
      if (value) {
        this.handleInput(value);
      }
      e.preventDefault();
    }
  }
  
  /**
   * Handle user input and execute commands
   * 
   * @param {string} value - User input
   */
  async handleInput(value) {
    // ...existing code...
    
    // Only process input if not empty
    if (!value) return;

    // Process password input only for explicit authentication prompts
    if (this.passwordMode) {
        if (this.currentPrompt.toLowerCase().includes('password')) {
            this.appendOutput(`${this.currentPrompt}${'*'.repeat(value.length)}`);
            if (window.commandProcessor && commandProcessor._pendingPasswordResolve) {
                this.passwordMode = false;
                commandProcessor.receivePasswordInput(value);
                this.setPrompt('> ');
            } else {
                console.error('Password prompt encountered but no pending password resolution.');
                this.appendOutput('Error: Password prompt is not supported in this mode.');
                this.passwordMode = false;
            }
            return;
        } else {
            // For non‑auth input clear any accidental password mode
            this.passwordMode = false;
        }
    }
    
    // ...existing code for processing regular input...
    const trimmedValue = value.trim();
    if (trimmedValue) {
        this.appendOutput(`${this.currentPrompt}${trimmedValue}`);
        this.history.unshift(trimmedValue);
        this.historyIndex = -1;
    }
    
    this.input.value = '';
    
    try {
        // ...existing command processing code (e.g., /chat, /research)...
        if (trimmedValue.startsWith('/chat') && window.chat) {
            this.disableInput();
            await chat.processChatCommand(trimmedValue);
            return;
        }
        if (window.research) {
            this.disableInput();
            await research.processInput(trimmedValue);
        } else {
            this.appendOutput('Error: Research module not initialized');
            this.enableInput();
        }
    } catch (error) {
        console.error('Error handling input:', error);
        this.appendOutput(`Error: ${error.message}`);
        this.enableInput();
    }
    
    // ...existing code...
  }
  
  /**
   * Handle system message
   * 
   * @param {Object} message - System message
   */
  handleSystemMessage(message) {
    if (message.message) {
      this.appendOutput(`System: ${message.message}`);
    }
    this.enableInput();
  }
  
  /**
   * Handle output message
   * 
   * @param {Object} message - Output message
   */
  handleOutput(message) {
    if (message.data) {
      this.appendOutput(message.data);
    }
    this.enableInput();
  }
  
  /**
   * Handle error message
   * 
   * @param {Object} message - Error message
   */
  handleError(message) {
    if (message.error) {
      this.appendOutput(`Error: ${message.error}`);
    }
    this.enableInput();
  }
  
  /**
   * Handle prompt message
   * 
   * @param {Object} message - Prompt message
   */
  handlePrompt(message) {
    if (message.data) {
      // Check if this is a password prompt
      const isPasswordPrompt = 
        message.data.toLowerCase().includes('password') || 
        message.data.toLowerCase().includes('enter your password');
      
      if (isPasswordPrompt) {
        this.setPasswordMode(true);
        this.previousPrompt = this.currentPrompt;
        this.setPrompt(message.data);
        this.enableInput(); // Make sure input is enabled
      } else {
        this.appendOutput(message.data);
        this.enableInput();
      }
    }
  }
  
  /**
   * Set the terminal prompt
   * 
   * @param {string} prompt - New prompt text
   */
  setPrompt(prompt) {
    this.currentPrompt = prompt;
    if (this.prompt) {
      this.prompt.innerText = prompt;
    }
  }
  
  /**
   * Set password mode on/off
   *
   * @param {boolean} isPasswordMode - Whether to enable password mode
   */
  setPasswordMode(isPasswordMode) {
    this.passwordMode = isPasswordMode;
    if (this.input) {
      this.input.type = isPasswordMode ? 'password' : 'text';
      this.input.className = isPasswordMode ? 'terminal-input password-input' : 'terminal-input';
    }
  }
  
  /**
   * Append output to the terminal
   * 
   * @param {string} text - Text to append
   */
  appendOutput(text) {
    if (!text || !this.outputArea) return;
    
    // Support multiple lines
    const lines = text.toString().split('\n');
    
    for (const line of lines) {
      const outputLine = document.createElement('div');
      outputLine.className = 'terminal-line';
      outputLine.textContent = line;
      this.outputArea.appendChild(outputLine);
    }
    
    // Scroll to bottom
    this.outputArea.scrollTop = this.outputArea.scrollHeight;
  }
  
  /**
   * Update the last line of the terminal output
   * 
   * @param {string} text - New text for the last line
   */
  updateLastLine(text) {
    if (!text || !this.outputArea) return;
    
    // Get the last line
    const lines = this.outputArea.getElementsByClassName('terminal-line');
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      lastLine.textContent = text;
    } else {
      this.appendOutput(text);
    }
    
    // Scroll to bottom
    this.outputArea.scrollTop = this.outputArea.scrollHeight;
  }
  
  /**
   * Enable or disable input
   * 
   * @param {boolean} passwordMode - Whether to enable password mode
   */
  enableInput(passwordMode = false) {
    this.inputEnabled = true;
    
    if (this.input) {
      this.input.disabled = false;
      
      // Apply password mode if specified
      if (passwordMode !== undefined) {
        this.setPasswordMode(passwordMode);
      }
      
      // Force a small delay before focusing to ensure the UI has updated
      setTimeout(() => {
        if (this.input && !this.input.disabled) {
          this.input.focus();
          
          // Try to position cursor at the end of input
          const len = this.input.value.length;
          if (len > 0) {
            this.input.setSelectionRange(len, len);
          }
        }
      }, 50);
    }
  }
  
  /**
   * Disable input
   */
  disableInput() {
    this.inputEnabled = false;
    this.passwordMode = false;
    if (this.input) {
      this.input.disabled = true;
    }
  }
  
  /**
   * Show the progress bar
   */
  showProgressBar() {
    if (this.progressBar) {
      this.progressBar.style.display = 'block';
    }
  }
  
  /**
   * Hide the progress bar
   */
  hideProgressBar() {
    if (this.progressBar) {
      this.progressBar.style.display = 'none';
    }
  }
  
  /**
   * Set terminal connection status
   * 
   * @param {string} status - Status ('connected', 'disconnected')
   */
  setStatus(status) {
    if (!this.statusElement) {
      // Use the connection-status element if available
      const statusElement = document.getElementById('connection-status');
      if (statusElement) {
        statusElement.className = `status-${status}`;
        statusElement.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
      }
      return;
    }
    
    this.statusElement.style.display = 'block';
    this.statusElement.className = `terminal-status terminal-status-${status}`;
    
    if (status === 'connected') {
      this.statusElement.innerText = 'Connected';
    } else {
      this.statusElement.innerText = 'Disconnected';
    }
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (this.statusElement) {
        this.statusElement.style.display = 'none';
      }
    }, 3000);
  }
  
  /**
   * Clear terminal output
   */
  clear() {
    if (this.outputArea) {
      this.outputArea.innerHTML = '';
    }
  }
}

// Create a global terminal instance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // We'll use the 'output' ID as the terminal container
  window.terminal = new Terminal('output');
  
  // Initialize research module after terminal is ready
  if (!window.research) {
    window.research = new Research(window.terminal);
  }
  
  // Initialize chat module if not already done
  if (!window.chat) {
    window.chat = new Chat(window.terminal);
  }
});
