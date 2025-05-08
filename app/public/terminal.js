/**
 * Terminal UI Manager
 * 
 * Handles terminal interactions including input/output, command history,
 * and special input modes like password masking.
 */
class Terminal {
  constructor(elementId) {
    // The elementId is now expected to be the ID of the terminal output area, e.g., 'terminal-output'
    this.outputArea = document.getElementById(elementId);
    this.container = this.outputArea ? this.outputArea.closest('.terminal-container') : null; // Find container relative to output
    this.inputArea = null; // Will be found within initialize
    this.input = null; // Will be found within initialize
    this.prompt = null; // Will be found within initialize
    this.history = [];
    this.historyIndex = -1;
    this.inputEnabled = false; // Start disabled until server confirms connection and enables
    this.currentPrompt = '▶ '; // Default prompt from new UI
    this.passwordMode = false;
    this.pendingPasswordResolve = null; // To handle password prompts
    this.pendingPasswordReject = null; // To handle password prompt errors/cancel
    this.pendingPromptResolve = null; // To handle generic prompts
    this.pendingPromptReject = null; // To handle generic prompt errors/cancel
    this.progressBar = null; // Will be found within initialize
    this.statusElement = null; // Will be found within initialize (connection status)
    this.userStatusElement = null; // Will be found within initialize (user status)
    this.eventListenersInitialized = false;
    this.mode = 'command'; // Track current mode: 'command', 'chat', 'research', 'prompt'
    this.scrollTimeout = null; // For debouncing scroll
    this.lastInputHandledTime = 0; // To prevent rapid double-enter issues
    this.currentPromptTimeoutId = null; // Store timeout ID for client-side prompts
    this.currentPromptContext = null; // Store context for client-side prompts

    // Initialize terminal UI
    this.initialize();

    // Event listeners are initialized within initialize() now
  }

  /**
   * Initialize the terminal container and UI elements based on the new HTML structure
   */
  initialize() {
    if (!this.outputArea) {
      console.error("Terminal output area element not found (expected ID: 'terminal-output')");
      return;
    }
    if (!this.container) {
        console.error("Terminal container element not found (expected ancestor class: 'terminal-container')");
        // Attempt to find globally if ancestor search failed
        this.container = document.querySelector('.terminal-container');
        if (!this.container) return; // Still not found, exit
    }

    // Find elements based on IDs in the new HTML structure
    this.input = document.getElementById('terminal-input');
    this.prompt = document.getElementById('prompt');
    this.progressBar = document.getElementById('progress-bar');
    this.statusElement = document.getElementById('connection-status'); // Connection status
    this.userStatusElement = document.getElementById('user-status'); // User status

    if (!this.input || !this.prompt || !this.progressBar || !this.statusElement || !this.userStatusElement) {
        console.error("One or more required terminal elements (input, prompt, progress bar, status, user status) not found by ID.");
        return;
    }

    // Find the input area wrapper if needed for styling/layout, though not directly used by logic
    this.inputArea = this.input.closest('.terminal-input-wrapper');

    // Preserve initial content if desired, or clear specific lines
    // For now, we assume the initial HTML content is static and new output appends after it.
    // If clearing is needed:
    // this.outputArea.innerHTML = ''; // Clears everything
    // this.appendOutput('Welcome to MCP Web Terminal'); // Add back initial dynamic messages
    // this.appendOutput('Type /help for available commands');

    this.setPrompt(this.currentPrompt); // Ensure initial prompt is set visually
    this.hideProgressBar(); // Ensure progress bar is hidden initially
    this.disableInput(); // Ensure input starts visually disabled
    this.setStatus('disconnected'); // Set initial visual status
    this.updateUserStatus('public'); // Set initial user status

    console.log("Terminal initialized using new HTML structure. Input initially disabled.");

    // Initialize event listeners now that elements are found
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for terminal input
   */
  initializeEventListeners() {
    if (this.eventListenersInitialized) return;

    // Ensure elements exist before adding listeners
    if (!this.input || !this.container) {
      console.error("Cannot initialize event listeners: Input or container element not found.");
      return;
    }
    this.eventListenersInitialized = true; // Set flag early

    // Add event listener for keyboard events on the input field
    this.input.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Focus input when terminal output area (or container) is clicked
    // Use outputArea for more specific clicking
    this.outputArea.addEventListener('click', (event) => {
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
      webcomm.registerHandler('research_result_ready', this.handleResearchResultReady.bind(this));
      webcomm.registerHandler('research_complete', this.handleResearchComplete.bind(this));
      webcomm.registerHandler('chat-response', this.handleChatResponse.bind(this));
      webcomm.registerHandler('memory_commit', this.handleMemoryCommit.bind(this));
      webcomm.registerHandler('login_success', this.handleLoginSuccess.bind(this));
      webcomm.registerHandler('logout_success', this.handleLogoutSuccess.bind(this));
      webcomm.registerHandler('enable_input', this.handleEnableInput.bind(this));
      webcomm.registerHandler('disable_input', this.handleDisableInput.bind(this));
      webcomm.registerHandler('download_file', this.handleDownloadFile.bind(this));
    } else {
        console.error("WebComm not initialized when trying to register handlers.");
    }

    // Focus input field initially
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
        // --- Send cancellation input to server ---
        webcomm.sendInput("").catch(err => console.error("Error sending cancel input:", err));
        if (reject) reject(new Error("Password entry cancelled by user."));
        e.preventDefault();
      } else if (this.pendingPromptResolve) {
        console.log("Cancelling pending generic prompt.");
        this.appendOutput(`${this.currentPrompt}${this.input.value}`);
        this.appendOutput('Prompt cancelled.');
        const reject = this.pendingPromptReject;
        this.clearGenericPromptState(true); // Ensure mode/input reset on cancel
        // --- Send cancellation input to server ---
        webcomm.sendInput("").catch(err => console.error("Error sending cancel input:", err));
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
            this.appendOutput(message.data, 'output-default'); // Use a default type
        }
    }
    // REMOVED keepDisabled logic - rely on enable/disable messages
  }

  handleError(message) {
    console.log("Received 'error' message:", message); // Add log
    if (message.error) {
      this.appendOutput(`Error: ${message.error}`, 'error-output'); // Use a specific type for errors
    }
    // --- Start: Reset prompt state on error ---
    // Check both password and generic prompts
    const wasPasswordPending = !!this.pendingPasswordResolve;
    const wasGenericPending = !!this.pendingPromptResolve;

    if (wasPasswordPending) {
        console.log("Clearing pending client password prompt due to server error.");
        const reject = this.pendingPasswordReject;
        this.clearPasswordPromptState(false); // Clear state but let server control input enable
        if (reject) reject(new Error(`Server error occurred during password prompt: ${message.error}`));
    }
    if (wasGenericPending) {
        console.log("Clearing pending client generic prompt due to server error.");
        const reject = this.pendingPromptReject;
        this.clearGenericPromptState(false); // Clear state but let server control input enable
        if (reject) reject(new Error(`Server error occurred during generic prompt: ${message.error}`));
    }
    // --- End: Reset prompt state on error ---
    // Server's wsErrorHelper should send enable_input if appropriate
    // this.enableInput(); // REMOVED - Rely on server message
  }

  // --- NEW Input Control Handlers ---
  handleEnableInput() {
    console.log("Enabling input.");
    this.enableInput();
    // Attempt to focus after enabling, unless a client-side prompt is now active
    this.focusInput();
  }

  handleDisableInput() {
    console.log("Disabling input.");
    this.disableInput();
  }
  // ---

  handlePrompt(message) {
    console.log("Received 'prompt' message:", message);
    // --- FIX: Use message.data for prompt text ---
    const { data: promptText, isPassword, context } = message;

    // Clear previous prompt state (important if server sends rapid prompts)
    this.clearPasswordPromptState(false); // Don't enable input yet
    this.clearGenericPromptState(false); // Don't enable input yet

    if (isPassword) {
      this.promptForPassword(promptText, context) // Pass context
        .then(value => console.log("Client password prompt resolved."))
        .catch(err => console.log("Client password prompt failed:", err.message));
    } else {
      this.promptForInput(promptText, context) // Pass context
        .then(value => console.log("Client generic prompt resolved."))
        .catch(err => console.log("Client generic prompt failed:", err.message));
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
        // Server should send enable_input after successful connection setup
        // this.enableInput(); // REMOVED - Rely on server message
    } else {
        this.appendOutput(`Connection lost. ${message.reason || ''}`);
        this.disableInput();
        this.setMode('command', '> '); // Reset mode to command
        // --- Start: Clear pending prompt on disconnect ---
        const wasPasswordPending = !!this.pendingPasswordResolve;
        const wasGenericPending = !!this.pendingPromptResolve;

        if (wasPasswordPending) {
            console.log("Clearing pending client password prompt due to disconnect.");
            const reject = this.pendingPasswordReject;
            this.clearPasswordPromptState(true); // Reset mode and enable input locally
            if (reject) reject(new Error("WebSocket disconnected during password prompt."));
        }
        if (wasGenericPending) {
            console.log("Clearing pending client generic prompt due to disconnect.");
            const reject = this.pendingPromptReject;
            this.clearGenericPromptState(true); // Reset mode and enable input locally
            if (reject) reject(new Error("WebSocket disconnected during generic prompt."));
        }
        // --- End: Clear pending prompt on disconnect ---
    }
  }

  handleSessionExpired() {
      console.log("Received 'session-expired' message"); // Add log
      this.appendOutput('Session expired due to inactivity. Please login again.');
      this.setMode('command', '> '); // Reset mode
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
      // Explicitly set mode to 'chat' here
      this.setMode('chat', message.prompt || '[chat] > ');
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

  // --- ADDED: Handler for research result ready ---
  handleResearchResultReady(message) {
      console.log("Received 'research_result_ready' message:", message);
      this.hideProgressBar(); // Ensure progress bar is hidden
      this.appendOutput(`\n--- Research Summary ---`);
      this.appendOutput(message.summary || 'Summary not available.');
      this.appendOutput(`----------------------`);
      // Trigger the client-side prompt for post-research action
      // The server has set the context 'post_research_action'
      this.promptForInput("Choose action: [Download] | [Upload] | [Keep]", 'post_research_action')
          .then(value => console.log("Post-research action prompt resolved."))
          .catch(err => console.log("Post-research action prompt failed:", err.message));
      // Input remains disabled until the prompt is resolved/rejected and server sends enable/disable
  }
  // ---

  handleResearchComplete(message) {
      // This might still be sent on error or if no prompt is needed (e.g., CLI mode)
      console.log("Received 'research_complete' message:", message); // Add log
      this.hideProgressBar();
      if (message.error) {
          this.appendOutput(`Research failed: ${message.error}`);
      } else {
          // Only output completion message if result wasn't handled by 'research_result_ready'
          if (!this.pendingPromptResolve && this.currentPromptContext !== 'post_research_action') {
              this.appendOutput('Research complete.');
              if (message.summary) {
                  this.appendOutput('--- Research Summary ---');
                  this.appendOutput(message.summary);
                  this.appendOutput('----------------------');
              }
          }
      }
      // Ensure we are back in command mode if no prompt is active
      if (!this.pendingPasswordResolve && !this.pendingPromptResolve) {
          this.setMode('command', '> ');
          // Server should send enable_input if appropriate
      } else {
          console.warn("Research complete message received, but client prompt active. Mode/input state unchanged.");
      }
  }

  handleChatResponse(message) {
      // REMOVED: this.appendOutput('[AI] ...thinking...', 'ai-thinking-output');

      // the actual response comes via _displayAiResponse
      this._displayAiResponse(message.message);
      // server will re-enable input
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

  handleDownloadFile(message) {
      console.log("Received 'download_file' message:", message);
      const { filename, content } = message;
      if (!filename || content === undefined) {
          this.appendOutput("Error: Download failed - missing filename or content."); // Use appendOutput
          // Server should enable input after this action completes or fails
          // this.enableInput(); // REMOVED - Rely on server message
          return;
      }
      try {
          const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          this.appendOutput(`Download initiated for ${filename}.`);
      } catch (error) {
          this.appendOutput(`Error initiating download: ${error.message}`); // Use appendOutput
      } finally {
          // Server should enable input after this action completes or fails
          // this.enableInput(); // REMOVED - Rely on server message
      }
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
   * @param {string|null} context - Optional context identifier.
   * @returns {Promise<string>} A promise that resolves with the entered password.
   */
  promptForPassword(promptText, context = null) {
    console.log(`Initiating client-side password prompt. Context: ${context}`);
    return new Promise((resolve, reject) => {
      if (this.pendingPasswordResolve || this.pendingPromptResolve) {
        console.warn("Attempted to start password prompt while another prompt was active.");
        return reject(new Error("Another prompt is already active."));
      }
      this.appendOutput(promptText); // Show the prompt text
      this.setMode('prompt', ''); // Use prompt mode, clear visual prompt
      this.setPasswordMode(true);
      this.pendingPasswordResolve = resolve;
      this.pendingPasswordReject = reject;
      this.currentPromptContext = context; // Store context

      // Clear any existing timeout
      clearTimeout(this.currentPromptTimeoutId);

      // Add a timeout for the password prompt
      this.currentPromptTimeoutId = setTimeout(() => {
          console.log("Client-side password prompt timed out.");
          if (this.pendingPasswordReject === reject) { // Check if still pending
              this.appendOutput('\nPassword prompt timed out.');
              const rejectFn = this.pendingPasswordReject;
              this.clearPasswordPromptState(true); // Clear state and reset mode/input on timeout
              // --- Send empty input on timeout? Or let server handle timeout? ---
              // webcomm.sendInput("").catch(err => console.error("Error sending timeout input:", err));
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
   * @param {string|null} context - Optional context identifier.
   * @returns {Promise<string>} A promise that resolves with the entered input.
   */
  promptForInput(promptText, context = null) {
      console.log(`Initiating client-side generic prompt. Context: ${context}`);
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
          this.currentPromptContext = context; // Store context

          // Clear any existing timeout
          clearTimeout(this.currentPromptTimeoutId);

          // Add a timeout for the generic prompt
          this.currentPromptTimeoutId = setTimeout(() => {
              console.log("Client-side generic prompt timed out.");
              if (this.pendingPromptReject === reject) { // Check if still pending
                  this.appendOutput('\nPrompt timed out.');
                  const rejectFn = this.pendingPromptReject;
                  this.clearGenericPromptState(true); // Clear state and reset mode/input on timeout
                  // --- Send empty input on timeout? ---
                  // webcomm.sendInput("").catch(err => console.error("Error sending timeout input:", err));
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
      this.currentPromptContext = null; // Clear context
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
          // Don't disable here, let the server control the final state via enable/disable messages
          // this.disableInput();
          console.log("Cleared password prompt state without enabling input (server controls final state).");
      }
  }

  /** Clears state related to an active generic prompt. */
  clearGenericPromptState(resetModeAndEnableInput = true) {
      const wasPending = !!this.pendingPromptResolve;
      if (!wasPending) return;

      console.log("Clearing generic prompt state. Reset mode/input:", resetModeAndEnableInput);
      clearTimeout(this.currentPromptTimeoutId);
      this.currentPromptTimeoutId = null;
      this.pendingPromptResolve = null;
      this.pendingPromptReject = null;
      this.currentPromptContext = null; // Clear context
      if (this.input) this.input.value = '';

      if (resetModeAndEnableInput) {
          if (this.mode === 'prompt') {
              console.log("Resetting mode to 'command' after clearing generic prompt.");
              this.setMode('command', '> ');
          }
          this.enableInput();
      } else {
          // Don't disable here, let the server control the final state
          // this.disableInput();
          console.log("Cleared generic prompt state without enabling input (server controls final state).");
      }
  }

  /**
   * Append output to the terminal
   *
   * @param {string} text - Text to append
   */
  appendOutput(message, type = 'output-default') { // Changed default type for clarity
    const outputContainer = this.outputArea; // FIX: Use this.outputArea
    if (!outputContainer) return;

    const line = document.createElement('div');
    // Add a base class and a type-specific class
    line.className = `terminal-line ${type}`; 

    if (typeof message === 'object') {
        // Pretty print JSON objects
        try {
            line.textContent = JSON.stringify(message, null, 2);
            line.classList.add('json-output'); // Add class for potential JSON styling
        } catch (e) {
            line.textContent = String(message);
        }
    } else {
        // For strings, handle newlines by converting to <br>
        line.innerHTML = String(message).replace(/\n/g, '<br>');
    }
    outputContainer.appendChild(line);
    this.scrollToBottom();
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

  /**
   * Scrolls the terminal output area to the bottom
   * Ensures newest content is visible
   */
  scrollToBottom() {
    if (this.outputArea) {
      this.outputArea.scrollTop = this.outputArea.scrollHeight;
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
                      // Check if the window/tab is focused before attempting to focus input
                      if (document.hasFocus()) {
                          console.log("Attempting to focus input field.");
                          this.input.focus();
                      } else {
                          console.log("Focus skipped: Window/tab is not focused.");
                      }
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
    // Use the specific status element found in initialize
    if (this.statusElement) {
        // Remove existing status classes and add the new one
        this.statusElement.classList.remove('status-connected', 'status-disconnected');
        this.statusElement.classList.add(`status-${status}`);
        // Update text content based on status
        this.statusElement.textContent = `Status: ${status === 'connected' ? 'Connected' : 'Disconnected'}`;
    } else {
        console.warn("Connection status element not found during setStatus.");
    }
  }

  /**
   * Update the user status display.
   * @param {string} username - The username to display ('public' if logged out).
   */
  updateUserStatus(username) {
      // Use the specific user status element found in initialize
      if (this.userStatusElement) {
          this.userStatusElement.textContent = `User: ${username || 'public'}`;
          // Optionally add/remove an 'active' class if needed by CSS
          if (username && username !== 'public') {
              this.userStatusElement.classList.add('active'); // Assuming 'active' means logged in
          } else {
              this.userStatusElement.classList.remove('active');
          }
      } else {
          console.warn("User status element not found during updateUserStatus.");
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

  _displayAiResponse(messageContent) {
    console.log("Raw message content:", messageContent);
    
    // Enhanced regex to match EITHER <thinking> OR <think> tags with robust whitespace handling
    const thinkingTagRegex = /<(thinking|think)\s*>([\s\S]*?)<\/\s*(thinking|think)\s*>/s;
    const match = messageContent.match(thinkingTagRegex);
    
    console.log("Regex match result:", match ? "Match found" : "No match");

    const outputContainer = this.outputArea;
    if (!outputContainer) return;

    if (match) {
      // match[2] contains the thinking content (the second capture group)
      const thinkingText = match[2].trim();
      console.log("Extracted thinking text length:", thinkingText.length);
      
      // Remove the entire thinking block from the message
      const replyText = messageContent.replace(thinkingTagRegex, '').trim();
      console.log("Extracted reply text length:", replyText.length);

      if (thinkingText) {
        const thinkingLine = document.createElement('div');
        thinkingLine.className = 'terminal-line thinking-line';
        thinkingLine.innerHTML = `<span class="thinking-header">[thinking]</span><br>${thinkingText.replace(/\n/g, '<br>')}`;
        outputContainer.appendChild(thinkingLine);
        
        // Add empty line for visual separation
        const spacerLine = document.createElement('div');
        spacerLine.className = 'terminal-line-spacer';
        spacerLine.innerHTML = '&nbsp;';
        outputContainer.appendChild(spacerLine);
      }

      if (replyText) {
        const replyLine = document.createElement('div');
        replyLine.className = 'terminal-line reply-line';
        replyLine.innerHTML = `<span class="reply-header">[reply]</span><br>${replyText.replace(/\n/g, '<br>')}`;
        outputContainer.appendChild(replyLine);
      }
    } else {
      // No thinking tag found, treat the whole message as a reply
      if (messageContent.trim()) {
        const replyLine = document.createElement('div');
        replyLine.className = 'terminal-line reply-line';
        replyLine.innerHTML = `<span class="reply-header">[reply]</span><br>${messageContent.replace(/\n/g, '<br>')}`;
        outputContainer.appendChild(replyLine);
      }
    }
    
    this.scrollToBottom();
  }
}

// Create global instances when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Ensure webcomm is created ONLY here, with the correct URL
  if (!window.webcomm) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/research/ws`;
      console.log("Initializing WebComm with URL:", wsUrl);
      window.webcomm = new WebComm(wsUrl);
  } else {
      console.warn("WebComm already existed during DOMContentLoaded.");
      // Correct URL if needed (logic remains the same)
      if (!window.webcomm.url || window.webcomm.url !== `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/research/ws`) {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${wsProtocol}//${window.location.host}/api/research/ws`;
          window.webcomm.url = wsUrl;
          console.log("Corrected WebComm URL:", wsUrl);
      }
  }

  // Initialize Terminal AFTER webcomm instance exists, targeting the new output ID
  if (!window.terminal) {
      // Pass the ID of the output area
      window.terminal = new Terminal('terminal-output');
      console.log("Terminal initialized.");
      // Dispatch a custom event if other modules need to know terminal is ready
      window.dispatchEvent(new CustomEvent('terminal-ready'));
  } else {
      console.log("Terminal already initialized.");
  }

  // --- ADD THIS LINE ---
  // Set the terminal instance on webcomm if both exist
  if (window.webcomm && window.terminal && !window.webcomm.terminal) {
    window.webcomm.setTerminal(window.terminal);
    console.log("Terminal instance set on WebComm.");
  }
  // --- END ADDITION ---

  // Ensure commandProcessor is created AFTER terminal and webcomm are ready
  if (window.terminal && window.webcomm && !window.commandProcessor) {
    console.log("Initializing CommandProcessor.");
    window.commandProcessor = new CommandProcessor(window.terminal, window.webcomm);
  } else if (!window.commandProcessor) {
      console.error("Could not initialize CommandProcessor. Terminal:", !!window.terminal, "Webcomm:", !!window.webcomm);
  } else {
      console.log("CommandProcessor already initialized.");
  }

  // Initial user status is set within terminal.initialize() now

  // Start the connection attempt AFTER all components are initialized and handlers registered
  if (window.webcomm && !window.webcomm.isConnected() && !window.webcomm.isConnecting) {
      console.log("Connecting WebComm...");
      window.webcomm.connect();
  } else {
      console.log("WebComm already connected or connecting.");
  }
});
