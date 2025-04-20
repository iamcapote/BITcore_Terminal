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
    this.inputEnabled = false; // Start disabled until server confirms connection and enables
    this.currentPrompt = '> ';
    this.passwordMode = false;
    this.pendingPasswordResolve = null; // To handle password prompts
    this.pendingPasswordReject = null; // To handle password prompt errors/cancel
    this.pendingPromptResolve = null; // To handle generic prompts
    this.pendingPromptReject = null; // To handle generic prompt errors/cancel
    this.progressBar = null;
    this.statusElement = null;
    this.eventListenersInitialized = false;
    this.mode = 'command'; // Track current mode: 'command', 'chat', 'research', 'prompt'
    this.scrollTimeout = null; // For debouncing scroll
    this.lastInputHandledTime = 0; // To prevent rapid double-enter issues
    this.currentPromptTimeoutId = null; // Store timeout ID for client-side prompts

    // Initialize terminal UI
    this.initialize();

    // Add input field to input area if not already present
    if (this.inputArea && this.input && !this.inputArea.contains(this.input)) {
      this.inputArea.appendChild(this.input);
    }

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
      this.progressBar = document.getElementById('progress-bar'); // Get progress bar from HTML
      this.statusElement = document.getElementById('connection-status'); // Get status from HTML

      // Clear the initial "Initializing Research CLI..." message
      // this.outputArea.textContent = ''; // Keep initial content if any

      // Add initial messages only if output is empty
      if (!this.outputArea.textContent.trim()) {
        this.appendOutput('Welcome to MCP Web Terminal');
        this.appendOutput('Type /help for available commands');
      }
      this.setPrompt(this.currentPrompt); // Ensure initial prompt is set
      this.hideProgressBar(); // Ensure progress bar is hidden initially

      return;
    }

    // Otherwise create a new terminal UI structure (Fallback, less likely used now)
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
    this.progressBar.innerHTML = '<span></span>'; // Inner span for text/progress
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
    console.log("Terminal initialized. Input enabled:", this.inputEnabled); // Log initial state
    this.disableInput(); // Ensure input starts visually disabled
    console.log("Terminal initialized. Input initially disabled.");
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
      this.container.addEventListener('click', (event) => {
        // Prevent focusing if clicking on a link within the output
        if (event.target.tagName === 'A') {
          return;
        }
        // Only focus if input is enabled and not currently in a password prompt state handled elsewhere
        if (this.inputEnabled && this.input && !this.pendingPasswordResolve && !this.pendingPromptResolve) {
           // Check if text is selected, if so, don't focus to allow copying
           const selection = window.getSelection().toString();
           if (!selection) {
               this.input.focus();
           }
        }
      });
    }

    // Handle WebSocket messages
    if (window.webcomm) {
      // Register handlers BEFORE connecting in DOMContentLoaded
      webcomm.registerHandler('system-message', this.handleSystemMessage.bind(this));
      webcomm.registerHandler('output', this.handleOutput.bind(this));
      webcomm.registerHandler('error', this.handleError.bind(this));
      webcomm.registerHandler('prompt', this.handlePrompt.bind(this));
      webcomm.registerHandler('progress', this.handleProgress.bind(this));
      webcomm.registerHandler('connection', this.handleConnection.bind(this));
      webcomm.registerHandler('session-expired', this.handleSessionExpired.bind(this));
      webcomm.registerHandler('mode_change', this.handleModeChange.bind(this));
      webcomm.registerHandler('chat-ready', this.handleChatReady.bind(this));
      webcomm.registerHandler('chat-exit', this.handleChatExit.bind(this));
      webcomm.registerHandler('research_start', this.handleResearchStart.bind(this));
      webcomm.registerHandler('research_complete', this.handleResearchComplete.bind(this));
      webcomm.registerHandler('chat-response', this.handleChatResponse.bind(this));
      webcomm.registerHandler('memory_commit', this.handleMemoryCommit.bind(this));
      webcomm.registerHandler('login_success', this.handleLoginSuccess.bind(this));
      webcomm.registerHandler('logout_success', this.handleLogoutSuccess.bind(this));
      webcomm.registerHandler('enable_input', this.handleEnableInput.bind(this));
      webcomm.registerHandler('disable_input', this.handleDisableInput.bind(this));
    } else {
        console.error("WebComm not initialized when trying to register handlers.");
    }


    // Focus input field
    setTimeout(() => this.focusInput(), 100);
  }

  /**
   * Handle keyboard events
   *
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    // Allow Escape even when input is disabled to cancel prompts
    if (!this.inputEnabled && e.key === 'Escape') {
        console.log("Escape pressed while input disabled - handling prompt cancel.");
        this.handleEscapeKey(e);
        return; // Prevent further processing if input is disabled but Escape was handled
    }

    // Ignore other keys if input is disabled
    if (!this.inputEnabled) {
        // console.log("Input disabled, ignoring key:", e.key); // Debugging log - can be noisy
        return;
    }

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
      // Prevent rapid double-enter submissions
      const now = Date.now();
      if (now - this.lastInputHandledTime < 150) { // Increased debounce slightly
          console.warn("Ignoring rapid Enter key press.");
          e.preventDefault();
          return;
      }
      this.lastInputHandledTime = now;

      const value = this.input.value; // Don't trim() here, let handleInput decide based on context
      // Always handle input, even if empty, to allow clearing prompts etc.
      this.handleInput(value); // Pass untrimmed value
      e.preventDefault();
    } else if (e.key === 'Escape') {
      console.log("Escape pressed while input enabled - handling.");
      this.handleEscapeKey(e);
    }
  }

  /**
   * Handles the Escape key press, primarily for cancelling prompts.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleEscapeKey(e) {
      console.log("handleEscapeKey called.");
      if (this.pendingPasswordResolve) {
        console.log("Cancelling pending password prompt.");
        this.appendOutput(`${this.currentPrompt}${this.input.value}`); // Echo current input before cancelling
        this.appendOutput('Password entry cancelled.');
        const reject = this.pendingPasswordReject;
        this.clearPasswordPromptState(true); // Ensure mode/input reset on cancel
        if (reject) reject(new Error("Password entry cancelled by user."));
        e.preventDefault();
      } else if (this.pendingPromptResolve) {
        console.log("Cancelling pending generic prompt.");
        this.appendOutput(`${this.currentPrompt}${this.input.value}`);
        this.appendOutput('Prompt cancelled.');
        const reject = this.pendingPromptReject;
        this.clearGenericPromptState(true); // Ensure mode/input reset on cancel
        if (reject) reject(new Error("Prompt cancelled by user."));
        e.preventDefault();
      } else if (this.inputEnabled) {
        // If no prompt is active and input is enabled, clear the input field
        console.log("No active prompt, clearing input field.");
        this.input.value = '';
        e.preventDefault();
      } else {
          console.log("Escape pressed, but no active prompt and input disabled.");
      }
  }

  /**
   * Handle user input based on the current mode.
   *
   * @param {string} value - User input (potentially untrimmed)
   */
  async handleInput(value) {
    // Trim the value *unless* it's for a pending prompt (where whitespace might be significant)
    const processedValue = (this.pendingPasswordResolve || this.pendingPromptResolve) ? value : value.trim();

    console.log(`handleInput called. Value: "${processedValue}", Mode: ${this.mode}, InputEnabled: ${this.inputEnabled}, PendingPwd: ${!!this.pendingPasswordResolve}, PendingPrompt: ${!!this.pendingPromptResolve}`); // Add detailed log

    // Stricter check: If input is not enabled AND no prompt is waiting, do nothing.
    if (!this.inputEnabled && !this.pendingPasswordResolve && !this.pendingPromptResolve) {
        console.warn("handleInput called while input was disabled and no prompt active. Ignoring.");
        return;
    }

    // 1. Handle Pending Password Prompt
    if (this.pendingPasswordResolve) {
      console.log("Handling pending password prompt."); // Add log
      this.appendOutput(`${this.currentPrompt}${'*'.repeat(processedValue.length)}`); // Echo masked input
      const resolve = this.pendingPasswordResolve;
      const reject = this.pendingPasswordReject; // Keep reject for potential errors during send
      // Store value before clearing state
      const passwordValue = processedValue; // Use processed (untrimmed) value
      this.clearPasswordPromptState(false); // Clear state but don't reset mode/enable input yet
      this.input.value = ''; // Clear input field immediately
      this.disableInput(); // Disable input while backend processes password

      try {
        // Send the password input to the server
        console.log("Sending password input to server via webcomm.sendInput");
        await webcomm.sendInput(passwordValue);
        // Resolve the client-side promise *after* successfully sending
        console.log("Password input sent successfully, resolving client promise."); // Add log
        resolve(passwordValue);
        // Input remains disabled; server response will eventually re-enable input.
      } catch (sendError) {
        console.error("Error sending password input to server:", sendError);
        this.appendOutput(`Error: Failed to send password input. ${sendError.message}`);
        // Ensure prompt state is fully cleared on error before enabling
        this.clearPasswordPromptState(true); // Reset mode and enable input
        if (reject) reject(sendError); // Reject the client-side promise
      }
      return;
    }

    // 2. Handle Pending Generic Prompt
    if (this.pendingPromptResolve) {
        console.log("Handling pending generic prompt."); // Add log
        this.appendOutput(`${this.currentPrompt}${processedValue}`); // Echo input
        const resolve = this.pendingPromptResolve;
        const reject = this.pendingPromptReject; // Keep reject for potential errors during send
        // Store value before clearing state
        const inputValue = processedValue; // Use processed (untrimmed) value
        this.clearGenericPromptState(false); // Clear state but don't reset mode/enable input yet
        this.input.value = ''; // Clear input field immediately
        this.disableInput(); // Disable input while backend processes input

        try {
          // Send the input to the server (which resolves the wsPrompt promise)
          await webcomm.sendInput(inputValue);
          // Resolve the client-side promise *after* successfully sending
          console.log("Generic input sent successfully, resolving client promise."); // Add log
          resolve(inputValue);
          // Input remains disabled; server response will eventually re-enable input.
        } catch (sendError) {
          console.error("Error sending generic input to server:", sendError);
          this.appendOutput(`Error: Failed to send input. ${sendError.message}`);
          // Ensure prompt state is fully cleared on error before enabling
          this.clearGenericPromptState(true); // Reset mode and enable input
          if (reject) reject(sendError); // Reject the client-side promise
        }
        return;
    }

    // 3. Handle Regular Input based on Mode (Input MUST be enabled here)
    if (!this.inputEnabled) {
        console.error("CRITICAL: handleInput reached regular input section while input was disabled.");
        // As a fallback, try enabling input if it shouldn't be disabled
        this.enableInput();
        return; // Should not happen
    }
    console.log(`Handling regular input in mode: ${this.mode}`); // Add log

    // Use the trimmed value for regular commands/chat
    const trimmedValue = processedValue; // Already trimmed unless it was a prompt

    // Echo the input line including the prompt
    // Only echo non-empty regular input
    if (trimmedValue) {
      // This check should ideally not be needed if state is managed correctly, but keep as safeguard
      if (this.passwordMode && !this.pendingPasswordResolve) {
        // Don't echo password if it wasn't handled by the prompt logic above
        console.warn("Password mode active but no pending prompt. Input ignored.");
        this.input.value = '';
        return;
      } else {
        // Echo regular input or masked password handled above
        // The prompt handlers already echoed, so only echo here for non-prompt cases
        if (!this.pendingPasswordResolve && !this.pendingPromptResolve) {
             this.appendOutput(`${this.currentPrompt}${trimmedValue}`);
        }
      }

      // Add to history only if it's a command or chat message, not prompt response
      if (this.mode === 'command' || this.mode === 'chat') {
        if (this.history.length === 0 || this.history[0] !== trimmedValue) {
          this.history.unshift(trimmedValue);
          if (this.history.length > 50) { // Limit history size
            this.history.pop();
          }
        }
      }
      this.historyIndex = -1; // Reset history index on new input
    } else if (this.mode === 'command' || this.mode === 'chat') {
      // Echo empty line submission in command/chat mode
       this.appendOutput(this.currentPrompt);
    }

    // Clear input field AFTER echoing and history management
    this.input.value = '';

    // Disable input while processing regular command/chat message
    this.disableInput();

    try {
      switch (this.mode) {
        case 'command':
          if (trimmedValue) {
            console.log("Sending command:", trimmedValue);
            await webcomm.sendCommand(trimmedValue);
          } else {
            this.enableInput(); // Re-enable immediately if empty command
          }
          break;
        case 'chat':
          if (trimmedValue) {
            if (trimmedValue.startsWith('/')) {
              console.log("Sending in-chat command:", trimmedValue);
              // Send as a command message even in chat mode
              await webcomm.sendCommand(trimmedValue);
            } else {
              console.log("Sending chat message:", trimmedValue);
              await webcomm.sendChatMessage(trimmedValue);
            }
          } else {
             this.enableInput(); // Re-enable immediately if empty chat message
          }
          break;
        case 'research': // Should research mode allow direct input? Maybe only commands?
          console.warn("Input received in 'research' mode. Treating as command.");
          if (trimmedValue) {
            console.log("Sending command (from research mode):", trimmedValue);
            await webcomm.sendCommand(trimmedValue);
          } else {
             this.enableInput();
          }
          break;
        case 'prompt':
          // This case should ideally not be reached due to earlier checks
          console.warn("Reached 'prompt' case in handleInput switch, should have been handled earlier.");
          this.appendOutput("Error: Unexpected input during prompt.");
          this.clearPasswordPromptState(true);
          this.clearGenericPromptState(true);
          this.enableInput();
          break;
        default:
          console.error(`Unknown terminal mode: ${this.mode}`);
          this.appendOutput(`Error: Unknown terminal mode "${this.mode}". Resetting to command mode.`);
          this.setMode('command', '> ');
          this.enableInput();
          break;
      }
    } catch (error) {
      console.error('Error handling input:', error);
      this.appendOutput(`Client-side Error: ${error.message}`);
      this.enableInput(); // Ensure input is re-enabled after a client-side error during send
    }
  }

  // --- WebSocket Message Handlers ---

  handleSystemMessage(message) {
    this.appendOutput(`[System] ${message.message}`);
    // REMOVED keepDisabled logic - rely on enable/disable messages
  }

  handleOutput(message) {
    console.log("Received 'output' message:", message); // Add log
    if (message.data !== undefined && message.data !== null) { // Handle empty string output
        // Check if the message contains progress-like updates
        if (typeof message.data === 'string' && message.data.includes('ETA:') && message.data.includes('%')) {
            this.updateLastLine(message.data);
        } else {
            this.appendOutput(message.data);
        }
    }
    // REMOVED keepDisabled logic - rely on enable/disable messages
  }

  handleError(message) {
    console.log("Received 'error' message:", message); // Add log
    if (message.error) {
      this.appendOutput(`Error: ${message.error}`);
    }
    // --- Start: Reset prompt state on error ---
    if (this.pendingPromptResolve) {
        console.log("Clearing pending client prompt due to server error.");
        // Reject the pending promise to unblock any waiting code
        this.pendingPromptResolve = null; // Clear resolve first
        if (this.pendingPromptReject) {
            this.pendingPromptReject(new Error(`Server error occurred during prompt: ${message.error}`));
            this.pendingPromptReject = null;
        }
        if (this.promptTimeoutId) {
            clearTimeout(this.promptTimeoutId);
            this.promptTimeoutId = null;
        }
        this.isPasswordPrompt = false; // Reset flag
    }
    // --- End: Reset prompt state on error ---
    // REMOVED keepDisabled logic - rely on enable/disable messages
    // Server's wsErrorHelper should send enable_input if appropriate
    this.enableInput();
  }

  // --- NEW Input Control Handlers ---
  handleEnableInput() {
    console.log("Enabling input.");
    this.enableInput();
  }

  handleDisableInput() {
    console.log("Disabling input.");
    this.disableInput();
  }
  // ---

  handlePrompt(message) {
    console.log("Received 'prompt' message:", message);
    const { data: promptText, isPassword } = message;

    // Clear previous prompt state
    this.clearPasswordPromptState(false);
    this.clearGenericPromptState(false);

    if (isPassword) {
      this.promptForPassword(promptText)
        .then(value => console.log("Password prompt resolved."))
        .catch(err => console.log("Password prompt failed:", err.message));
    } else {
      this.promptForInput(promptText)
        .then(value => console.log("Generic prompt resolved."))
        .catch(err => console.log("Generic prompt failed:", err.message));
    }
  }

  handleProgress(message) {
    console.log("Received 'progress' message:", message); // Add log
    if (message.data) {
      // Simple text update for progress bar
      if (typeof message.data === 'string') {
          this.updateProgressBar(message.data);
      }
      // Handle object-based progress updates (e.g., research engine)
      else if (typeof message.data === 'object' && message.data.completedQueries !== undefined) {
          const progress = message.data;
          const percent = progress.totalQueries > 0 ? Math.round((progress.completedQueries / progress.totalQueries) * 100) : 0;
          this.updateProgressBar(`Research: ${progress.completedQueries}/${progress.totalQueries} (${percent}%) - ${progress.currentAction || ''}`);
      }
      else {
          // Fallback for unknown progress format
          this.updateProgressBar(JSON.stringify(message.data));
      }
      this.showProgressBar();
    }
    // Progress messages should keep input disabled
    this.disableInput();
  }

  /**
   * Handle WebSocket connection changes.
   * @param {Object} message - Connection status message.
   */
  handleConnection(message) {
    console.log("Received 'connection' message:", message);
    this.setStatus(message.connected ? 'connected' : 'disconnected');
    if (message.connected) {
        this.appendOutput('Connection established.');
        this.enableInput();
    } else {
        this.appendOutput(`Connection lost. ${message.reason || ''}`);
        this.disableInput();
        this.setMode('command', '> '); // Reset mode to command
        // --- Start: Clear pending prompt on disconnect ---
        if (this.pendingPromptResolve) {
            console.log("Clearing pending client prompt due to disconnect.");
            this.pendingPromptResolve = null;
            if (this.pendingPromptReject) {
                this.pendingPromptReject(new Error("WebSocket disconnected during prompt."));
                this.pendingPromptReject = null;
            }
            if (this.promptTimeoutId) {
                clearTimeout(this.promptTimeoutId);
                this.promptTimeoutId = null;
            }
            this.isPasswordPrompt = false;
        }
        // --- End: Clear pending prompt on disconnect ---
    }
  }

  handleSessionExpired() {
      console.log("Received 'session-expired' message"); // Add log
      this.appendOutput('Session expired due to inactivity. Please login again.');
      this.setMode('command');
      this.updateUserStatus('public');
      this.enableInput(); // Ensure input is re-enabled after session expiration
  }

  handleModeChange(message) {
      console.log("Received 'mode_change' message:", message); // Add log
      this.setMode(message.mode, message.prompt);
      // Mode changes generally enable input unless explicitly kept disabled
      // Input state handled by enable/disable messages
  }

  handleChatReady(message) {
      console.log("Received 'chat-ready' message:", message); // Add log
      this.setMode('chat', message.prompt || '[chat] ');
      this.appendOutput('Chat session ready. Type /exit to leave.');
      // Server should send enable_input
  }

  handleChatExit(message) {
      console.log("Received 'chat-exit' message"); // Add log
      this.appendOutput('Exited chat mode.');
      this.setMode('command', '> '); // Revert to command mode AND set prompt
      // Server should send enable_input
  }

  handleResearchStart(message) {
      console.log("Received 'research_start' message"); // Add log
      this.appendOutput('Research started...');
      // Don't change mode here, let server dictate if needed.
      // Research usually happens in 'command' mode context initiated by /research
      // this.setMode('research', '[research] ');
      this.showProgressBar();
      this.updateProgressBar('Initializing research...');
      // Research start should keep input disabled
  }

  handleResearchComplete(message) {
      console.log("Received 'research_complete' message:", message); // Add log
      this.hideProgressBar();
      this.appendOutput('Research complete.');
      if (message.summary) {
          this.appendOutput('--- Research Summary ---');
          this.appendOutput(message.summary);
          this.appendOutput('----------------------');
      }
      // Research finishes, ensure we are back in command mode with correct prompt
      // Only change mode if not currently in a prompt state
      if (!this.pendingPasswordResolve && !this.pendingPromptResolve) {
          this.setMode('command', '> '); // Revert to command mode AND set prompt
          // Server should send enable_input
      } else {
          console.warn("Research complete, but client prompt active. Mode/input state unchanged.");
      }
  }

  handleChatResponse(message) {
      console.log("Received 'chat-response' message"); // Add log
      this.appendOutput(`[AI] ${message.message}`);
      // Chat responses should enable input ONLY if still in chat mode AND no client prompt active
      // Server should send enable_input
  }

  handleMemoryCommit(message) {
      console.log("Received 'memory_commit' message:", message); // Add log
      this.appendOutput(`Memory finalized. ${message.commitSha ? `Commit: ${message.commitSha}` : '(Local)'}`);
      // Memory commit should enable input if no prompt is active
      // Server should send enable_input
  }

  handleLoginSuccess(message) {
      console.log("Received 'login_success' message:", message); // Add log
      this.appendOutput(`Login successful. Welcome, ${message.username}!`);
      this.updateUserStatus(message.username);
      // Login success implies command mode unless server sends another mode_change
      this.setMode('command', '> ');
      // Server should send enable_input
  }

  handleLogoutSuccess(message) {
      console.log("Received 'logout_success' message"); // Add log
      this.appendOutput('Logout successful.');
      this.updateUserStatus('public');
      // Logout success implies command mode
      this.setMode('command', '> ');
      // Server should send enable_input
  }

  /**
   * Handle generic WebSocket errors.
   * @param {Object} error - Error message.
   */
  handleWebSocketError(error) {
    console.error("WebSocket error:", error);
    this.appendOutput(`Error: ${error.message || 'Unknown WebSocket error'}`);
    this.disableInput(); // Disable input until connection is restored
  }

  // --- End WebSocket Message Handlers ---

  /**
   * Prompts the user for a password.
   * @param {string} promptText - The text to display for the prompt.
   * @returns {Promise<string>} A promise that resolves with the entered password.
   */
  promptForPassword(promptText) {
    console.log("Initiating client-side password prompt.");
    return new Promise((resolve, reject) => {
      if (this.pendingPasswordResolve || this.pendingPromptResolve) {
        console.warn("Attempted to start password prompt while another prompt was active.");
        // Reject the new prompt immediately
        return reject(new Error("Another prompt is already active."));
      }
      this.appendOutput(promptText); // Show the prompt text
      this.setMode('prompt', ''); // Use prompt mode, clear visual prompt
      this.setPasswordMode(true);
      this.pendingPasswordResolve = resolve;
      this.pendingPasswordReject = reject;

      // Clear any existing timeout
      clearTimeout(this.currentPromptTimeoutId);

      // Add a timeout for the password prompt
      this.currentPromptTimeoutId = setTimeout(() => {
          console.log("Client-side password prompt timed out.");
          if (this.pendingPasswordReject) { // Check if still pending
              this.appendOutput('\nPassword prompt timed out.');
              const rejectFn = this.pendingPasswordReject;
              this.clearPasswordPromptState(true); // Clear state and reset mode/input on timeout
              rejectFn(new Error("Password prompt timed out."));
          }
      }, 60000); // 60 second timeout

      // Ensure timeout is cleared if resolved or rejected normally
      const cleanup = () => {
          console.log("Cleaning up client-side password prompt timeout.");
          clearTimeout(this.currentPromptTimeoutId);
          this.currentPromptTimeoutId = null;
      };
      const originalResolve = this.pendingPasswordResolve;
      const originalReject = this.pendingPasswordReject;
      this.pendingPasswordResolve = (value) => { cleanup(); originalResolve(value); };
      this.pendingPasswordReject = (err) => { cleanup(); originalReject(err); };

      this.enableInput(); // Enable input specifically for the password
      this.focusInput();
    });
  }

  /**
   * Prompts the user for generic input.
   * @param {string} promptText - The text to display for the prompt.
   * @returns {Promise<string>} A promise that resolves with the entered input.
   */
  promptForInput(promptText) {
      console.log("Initiating client-side generic prompt.");
      return new Promise((resolve, reject) => {
          if (this.pendingPasswordResolve || this.pendingPromptResolve) {
              console.warn("Attempted to start generic prompt while another prompt was active.");
              return reject(new Error("Another prompt is already active."));
          }
          this.appendOutput(promptText);
          this.setMode('prompt', ''); // Use prompt mode, clear visual prompt
          this.setPasswordMode(false); // Ensure not in password mode
          this.pendingPromptResolve = resolve;
          this.pendingPromptReject = reject;

          // Clear any existing timeout
          clearTimeout(this.currentPromptTimeoutId);

          // Add a timeout for the generic prompt
          this.currentPromptTimeoutId = setTimeout(() => {
              console.log("Client-side generic prompt timed out.");
              if (this.pendingPromptReject) { // Check if still pending
                  this.appendOutput('\nPrompt timed out.');
                  const rejectFn = this.pendingPromptReject;
                  this.clearGenericPromptState(true); // Clear state and reset mode/input on timeout
                  rejectFn(new Error("Prompt timed out."));
              }
          }, 120000); // 120 second timeout

          // Ensure timeout is cleared if resolved or rejected normally
          const cleanup = () => {
              console.log("Cleaning up client-side generic prompt timeout.");
              clearTimeout(this.currentPromptTimeoutId);
              this.currentPromptTimeoutId = null;
          };
          const originalResolve = this.pendingPromptResolve;
          const originalReject = this.pendingPromptReject;
          this.pendingPromptResolve = (value) => { cleanup(); originalResolve(value); };
          this.pendingPromptReject = (err) => { cleanup(); originalReject(err); };

          this.enableInput(); // Enable input for the prompt
          this.focusInput();
      });
  }

  /** Clears state related to an active password prompt. */
  clearPasswordPromptState(resetModeAndEnableInput = true) {
      const wasPending = !!this.pendingPasswordResolve; // Check if it was actually pending
      if (!wasPending) return; // Do nothing if not pending

      console.log("Clearing password prompt state. Reset mode/input:", resetModeAndEnableInput);
      clearTimeout(this.currentPromptTimeoutId); // Clear timeout if active
      this.currentPromptTimeoutId = null;
      this.pendingPasswordResolve = null;
      this.pendingPasswordReject = null;
      this.setPasswordMode(false);
      if (this.input) this.input.value = ''; // Clear input field value regardless

      if (resetModeAndEnableInput) {
          // Only reset mode if we are currently in 'prompt' mode
          if (this.mode === 'prompt') {
              console.log("Resetting mode to 'command' after clearing password prompt.");
              this.setMode('command', '> '); // Revert to command mode with default prompt
          }
          this.enableInput(); // Always enable input after clearing prompt state this way
      } else {
          // If not resetting/enabling, ensure input is visually disabled
          this.disableInput();
          console.log("Cleared password prompt state without enabling input.");
      }
  }

  /** Clears state related to an active generic prompt. */
  clearGenericPromptState(resetModeAndEnableInput = true) {
    if (this.pendingPromptResolve) {
      clearTimeout(this.currentPromptTimeoutId);
      this.currentPromptTimeoutId = null;
      this.pendingPromptResolve = null;
      this.pendingPromptReject = null;
      this.input.value = '';
      if (resetModeAndEnableInput) {
        this.setMode('command', '> ');
        this.enableInput();
      }
    }
  }

  /**
   * Append output to the terminal
   *
   * @param {string} text - Text to append
   */
  appendOutput(text) {
    if (text === undefined || text === null || !this.outputArea) return;

    // Ensure text is a string
    const textString = String(text);

    const lines = textString.split('\n');
    const wasScrolledToBottom = this.outputArea.scrollHeight - this.outputArea.clientHeight <= this.outputArea.scrollTop + 1; // +1 for tolerance

    for (const line of lines) {
      const outputLine = document.createElement('div');
      outputLine.className = 'terminal-line';
      // Sanitize or escape HTML if necessary, for now just textContent
      outputLine.textContent = line;
      this.outputArea.appendChild(outputLine);
    }

    if (wasScrolledToBottom) {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.outputArea.scrollTop = this.outputArea.scrollHeight;
        }, 50); // Debounce scrolling
    }
  }

  /**
   * Update the last line of the terminal output
   *
   * @param {string} text - New text for the last line
   */
  updateLastLine(text) {
    if (text === undefined || text === null || !this.outputArea) return;

    const textString = String(text);
    const lines = this.outputArea.getElementsByClassName('terminal-line');
    const wasScrolledToBottom = this.outputArea.scrollHeight - this.outputArea.clientHeight <= this.outputArea.scrollTop + 1;

    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      lastLine.textContent = textString;
    } else {
      this.appendOutput(textString); // If no lines exist, append as new line
    }

    if (wasScrolledToBottom) {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.outputArea.scrollTop = this.outputArea.scrollHeight;
        }, 50); // Debounce scrolling
    }
  }

  /** Focus the input field */
  focusInput() {
      // Only focus if input is enabled AND no client-side prompt is active
      // (because prompts handle their own focus logic)
      if (this.input && this.inputEnabled && !this.pendingPasswordResolve && !this.pendingPromptResolve) {
          // Delay focus slightly to avoid issues with event timing
          setTimeout(() => {
              // Check again if input exists and is the active element
              if (this.input && document.activeElement !== this.input) {
                  try {
                      console.log("Attempting to focus input field.");
                      this.input.focus();
                  } catch (e) {
                      console.warn("Error focusing input:", e);
                  }
              }
          }, 50);
      } else if (this.input && !this.inputEnabled) {
          console.log("Focus skipped: Input is disabled.");
      } else if (this.input && (this.pendingPasswordResolve || this.pendingPromptResolve)) {
          console.log("Focus skipped: Client-side prompt is active.");
      }
  }

  /**
   * Enable input
   */
  enableInput() {
    console.log("[DEBUG] Enabling input");
    this.inputEnabled = true;
    // Use this.input instead of this.inputField
    if (this.input) this.input.disabled = false;
  }

  /**
   * Disable input
   */
  disableInput() {
    console.log("[DEBUG] Disabling input");
    this.inputEnabled = false;
    // Use this.input instead of this.inputField
    if (this.input) this.input.disabled = true;
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
   * Update the progress bar text/content
   * @param {string} text - Text to display in the progress bar
   */
  updateProgressBar(text) {
      if (this.progressBar) {
          const span = this.progressBar.querySelector('span');
          if (span) {
              span.textContent = text;
          } else {
              this.progressBar.textContent = text;
          }
      }
      if (this.outputArea) {
        this.outputArea.scrollTop = this.outputArea.scrollHeight;
      }
  }

  /**
   * Hide the progress bar
   */
  hideProgressBar() {
    if (this.progressBar) {
      this.progressBar.style.display = 'none';
      const span = this.progressBar.querySelector('span');
      if (span) span.textContent = '';
      else this.progressBar.textContent = '';
    }
  }

  /**
   * Set terminal connection status
   *
   * @param {string} status - Status ('connected', 'disconnected')
   */
  setStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.className = `status-${status}`;
        statusElement.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
    } else if (this.statusElement) {
        // Fallback if using dynamically created element
        this.statusElement.style.display = 'block';
        this.statusElement.className = `terminal-status terminal-status-${status}`;
        this.statusElement.innerText = status === 'connected' ? 'Connected' : 'Disconnected';

        setTimeout(() => {
          if (this.statusElement) {
            this.statusElement.style.display = 'none';
          }
        }, 3000);
    }
  }

  /**
   * Update the user status display.
   * @param {string} username - The username to display ('public' if logged out).
   */
  updateUserStatus(username) {
      const userStatusEl = document.getElementById('user-status');
      if (userStatusEl) {
          userStatusEl.textContent = `User: ${username || 'public'}`;
      }
  }

  /**
   * Set the current interaction mode and prompt display.
   * @param {string} mode - 'command', 'chat', 'research', 'prompt'
   * @param {string} [promptText] - Text for the prompt (optional)
   */
  setMode(mode, promptText) {
      console.log(`Setting mode to: ${mode}, Prompt: "${promptText}"`);
      this.mode = mode;
      if (promptText !== undefined) { // Allow setting mode without changing prompt
          this.currentPrompt = promptText;
          this.setPrompt(this.currentPrompt);
      }
      // Adjust input type for password mode if necessary
      // Only apply if not entering prompt mode (which handles its own password setting)
      if (mode !== 'prompt') {
        this.setPasswordMode(false); // Default to text unless specifically set later
      }
  }

  /**
   * Set the visual prompt text.
   * @param {string} text - The prompt text (e.g., '> ', '[chat] ')
   */
  setPrompt(text) {
      if (this.prompt) {
          this.prompt.textContent = text;
      }
  }

  /**
   * Enable or disable password masking mode for the input field.
   * @param {boolean} enabled - True to enable password mode, false otherwise.
   */
  setPasswordMode(enabled) {
      console.log(`Setting password mode: ${enabled}`);
      this.passwordMode = enabled;
      if (this.input) {
          this.input.type = enabled ? 'password' : 'text';
      }
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

// Create global instances when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Ensure webcomm is created ONLY here, with the correct URL
  if (!window.webcomm) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Use the URL the server expects
      const wsUrl = `${wsProtocol}//${window.location.host}/api/research/ws`;
      console.log("Initializing WebComm with URL:", wsUrl); // Add log
      window.webcomm = new WebComm(wsUrl); // Assuming WebComm class exists globally or is imported
      // Connection is initiated AFTER terminal and commandProcessor are initialized
  } else {
      console.warn("WebComm already existed during DOMContentLoaded.");
      // Ensure URL is correct if it existed somehow
      if (!window.webcomm.url || window.webcomm.url !== `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/research/ws`) {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${wsProtocol}//${window.location.host}/api/research/ws`;
          window.webcomm.url = wsUrl;
          console.log("Corrected WebComm URL:", wsUrl);
      }
  }

  // Initialize Terminal AFTER webcomm instance exists
  if (!window.terminal) {
      window.terminal = new Terminal('output'); // Assumes element with id="output" exists
      console.log("Terminal initialized.");
  } else {
      console.log("Terminal already initialized.");
  }


  // Ensure commandProcessor is created AFTER terminal and webcomm are ready
  if (window.terminal && window.webcomm && !window.commandProcessor) {
    console.log("Initializing CommandProcessor."); // Add log
    window.commandProcessor = new CommandProcessor(window.terminal, window.webcomm); // Assumes CommandProcessor class exists
  } else if (!window.commandProcessor) {
      console.error("Could not initialize CommandProcessor. Terminal:", !!window.terminal, "Webcomm:", !!window.webcomm);
  } else {
      console.log("CommandProcessor already initialized.");
  }

  // Set initial user status display
  if (window.terminal) {
      window.terminal.updateUserStatus('public');
  }

  // Start the connection attempt AFTER all components are initialized and handlers registered
  if (window.webcomm && !window.webcomm.isConnected() && !window.webcomm.isConnecting) {
      console.log("Connecting WebComm...");
      window.webcomm.connect();
  } else {
      console.log("WebComm already connected or connecting.");
  }
});
