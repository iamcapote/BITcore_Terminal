/**
 * Terminal Core Events
 * Why: Provide keyboard, focus, and WebSocket event wiring for the terminal surface.
 * What: Binds DOM listeners, manages history traversal, and routes input to the backend.
 * How: Extends the base Terminal prototype with event-centric behaviours reused by other mixins.
 */
(function extendTerminalCoreEvents(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.core.events] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;
  const HISTORY_LIMIT = 50;
  const ENTER_DEBOUNCE_MS = 150;
  const webcomm = () => global.webcomm || null;

  Object.assign(Terminal.prototype, {
    initializeEventListeners() {
      if (this.eventListenersInitialized) {
        return;
      }

      if (!this.input || !this.container) {
        console.error('[terminal.core.events] Cannot bind terminal events without input and container.');
        return;
      }

      this.eventListenersInitialized = true;
      this.input.addEventListener('keydown', (event) => this.handleKeyDown(event));
      this.outputArea?.addEventListener('click', (event) => {
        if (!this.inputEnabled) {
          return;
        }
        if (event.target && event.target.tagName === 'A') {
          return;
        }
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          return;
        }
        if (!this.pendingPasswordResolve && !this.pendingPromptResolve) {
          this.focusInput();
        }
      });

      const client = webcomm();
      if (client) {
        const bind = (type, handlerName) => {
          if (typeof this[handlerName] === 'function') {
            client.registerHandler(type, this[handlerName].bind(this));
          }
        };

        bind('system-message', 'handleSystemMessage');
        bind('output', 'handleOutput');
        bind('error', 'handleError');
        bind('prompt', 'handlePrompt');
        bind('connection', 'handleConnection');
        bind('session-expired', 'handleSessionExpired');
        bind('mode_change', 'handleModeChange');
        bind('chat-ready', 'handleChatReady');
        bind('chat-exit', 'handleChatExit');
        bind('chat-response', 'handleChatResponse');
        bind('memory_commit', 'handleMemoryCommit');
        bind('login_success', 'handleLoginSuccess');
        bind('logout_success', 'handleLogoutSuccess');
        bind('enable_input', 'handleEnableInput');
        bind('disable_input', 'handleDisableInput');
        bind('download_file', 'handleDownloadFile');
        bind('progress', 'handleProgress');
        bind('research-progress', 'handleResearchProgress');
        bind('research-status', 'handleResearchStatus');
        bind('research-thought', 'handleResearchThought');
        bind('research-memory', 'handleResearchMemory');
        bind('research-suggestions', 'handleResearchSuggestions');
        bind('research-complete', 'handleResearchCompleteTelemetry');
        bind('research_start', 'handleResearchStart');
        bind('research_result_ready', 'handleResearchResultReady');
        bind('research_complete', 'handleResearchComplete');
        bind('memory-telemetry', 'handleMemoryTelemetry');
      }

      setTimeout(() => this.focusInput(), 100);
    },

    handleKeyDown(event) {
      if (!this.inputEnabled && event.key === 'Escape') {
        this.handleEscapeKey(event);
        return;
      }

      if (!this.inputEnabled) {
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex += 1;
            this.input.value = this.history[this.historyIndex];
          }
          event.preventDefault();
          break;
        case 'ArrowDown':
          if (this.historyIndex > 0) {
            this.historyIndex -= 1;
            this.input.value = this.history[this.historyIndex];
          } else if (this.historyIndex === 0) {
            this.historyIndex = -1;
            this.input.value = '';
          }
          event.preventDefault();
          break;
        case 'Enter': {
          const now = Date.now();
          if (now - this.lastInputHandledTime < ENTER_DEBOUNCE_MS) {
            event.preventDefault();
            return;
          }
          this.lastInputHandledTime = now;
          const value = this.input.value;
          this.handleInput(value);
          event.preventDefault();
          break;
        }
        case 'Escape':
          this.handleEscapeKey(event);
          break;
        default:
          break;
      }
    },

    handleEscapeKey(event) {
      if (this.input) {
        this.input.value = '';
      }
      event?.preventDefault();
    },

    async handleInput(rawValue) {
      if (!this.inputEnabled) {
        return;
      }

      const processedValue = typeof rawValue === 'string' ? rawValue.trim() : '';

      if (processedValue) {
        if (this.mode === 'command' || this.mode === 'chat') {
          if (this.history.length === 0 || this.history[0] !== processedValue) {
            this.history.unshift(processedValue);
            if (this.history.length > HISTORY_LIMIT) {
              this.history.pop();
            }
          }
        }
        this.historyIndex = -1;
        this.appendOutput(`${this.currentPrompt}${processedValue}`);
      } else if (this.mode === 'command' || this.mode === 'chat') {
        this.appendOutput(this.currentPrompt);
      }

      if (this.input) {
        this.input.value = '';
      }
      this.disableInput();

      try {
        if (!processedValue) {
          this.enableInput();
          return;
        }

        const client = webcomm();

        switch (this.mode) {
          case 'command':
            await client?.sendCommand?.(processedValue);
            break;
          case 'chat':
            if (processedValue.startsWith('/')) {
              await client?.sendCommand?.(processedValue);
            } else {
              await client?.sendChatMessage?.(processedValue);
            }
            break;
          case 'research':
            await client?.sendCommand?.(processedValue);
            break;
          case 'prompt':
            this.appendOutput('Error: Input not expected during prompt mode.');
            this.enableInput();
            break;
          default:
            this.appendOutput(`Error: Unknown terminal mode "${this.mode}".`);
            this.setMode('command', '> ');
            this.enableInput();
            break;
        }
      } catch (error) {
        console.error('[terminal.core.events] Error handling input:', error);
        this.appendOutput(`Client-side Error: ${error.message}`);
        this.enableInput();
      }
    },
  });
})(window);
