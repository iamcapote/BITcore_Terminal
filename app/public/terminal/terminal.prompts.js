/**
 * Terminal Prompt Extensions
 * Why: Encapsulate password and generic prompt workflows with consistent UX.
 * What: Adds prompt orchestration helpers to the base Terminal prototype.
 * How: Provides promise-based prompt APIs, timeout handling, and cleanup helpers.
 */
(function extendTerminalPrompts(global) {
  const PASSWORD_TIMEOUT_MS = 60_000;
  const GENERIC_TIMEOUT_MS = 120_000;

  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.prompts] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;
  const webcomm = () => global.webcomm || null;

  Object.assign(Terminal.prototype, {
    promptForPassword(promptText, context = null) {
      return this._createPrompt({
        promptText,
        context,
        isPassword: true,
        timeoutMs: PASSWORD_TIMEOUT_MS,
      });
    },

    promptForInput(promptText, context = null) {
      return this._createPrompt({
        promptText,
        context,
        isPassword: false,
        timeoutMs: GENERIC_TIMEOUT_MS,
      });
    },

    clearPasswordPromptState(resetModeAndEnableInput = true) {
      if (!this.pendingPasswordResolve && !this.pendingPasswordReject) {
        return;
      }
    this._clearPromptTimeout();
      this.pendingPasswordResolve = null;
      this.pendingPasswordReject = null;
      this.currentPromptContext = null;
      this.setPasswordMode(false);
      if (this.input) {
        this.input.value = '';
      }
      if (resetModeAndEnableInput && this.mode === 'prompt') {
        this.setMode('command', '> ');
      }
      if (resetModeAndEnableInput) {
        this.enableInput();
      }
    },

    clearGenericPromptState(resetModeAndEnableInput = true) {
      if (!this.pendingPromptResolve && !this.pendingPromptReject) {
        return;
      }
    this._clearPromptTimeout();
      this.pendingPromptResolve = null;
      this.pendingPromptReject = null;
      this.currentPromptContext = null;
      if (this.input) {
        this.input.value = '';
      }
      if (resetModeAndEnableInput && this.mode === 'prompt') {
        this.setMode('command', '> ');
      }
      if (resetModeAndEnableInput) {
        this.enableInput();
      }
    },

    _createPrompt({ promptText, context, isPassword, timeoutMs }) {
      if (!promptText || typeof promptText !== 'string') {
        return Promise.reject(new Error('Prompt text must be a non-empty string.'));
      }
      if (this.pendingPasswordResolve || this.pendingPromptResolve) {
        return Promise.reject(new Error('Another prompt is already active.'));
      }

      this.appendOutput(promptText);
      this.setMode('prompt', '');
      this.setPasswordMode(isPassword);
      this.currentPromptContext = context;
    this._clearPromptTimeout();
      this.enableInput();
      this.focusInput();

      return new Promise((resolve, reject) => {
        if (isPassword) {
          this.pendingPasswordResolve = resolve;
          this.pendingPasswordReject = reject;
        } else {
          this.pendingPromptResolve = resolve;
          this.pendingPromptReject = reject;
        }

        const timeoutId = window.setTimeout(() => {
          const rejectFn = isPassword ? this.pendingPasswordReject : this.pendingPromptReject;
          if (typeof rejectFn === 'function') {
            this.appendOutput(isPassword ? '\nPassword prompt timed out.' : '\nPrompt timed out.');
            if (isPassword) {
              this.clearPasswordPromptState(true);
            } else {
              this.clearGenericPromptState(true);
            }
            rejectFn(new Error(isPassword ? 'Password prompt timed out.' : 'Prompt timed out.'));
          }
        }, timeoutMs);

        this.currentPromptTimeoutId = timeoutId;
      }).finally(() => {
        this._clearPromptTimeout();
      });
    },

    _clearPromptTimeout() {
      if (this.currentPromptTimeoutId) {
        window.clearTimeout(this.currentPromptTimeoutId);
        this.currentPromptTimeoutId = null;
      }
    },

    async _resolvePromptSubmission(value) {
      const activePasswordResolve = this.pendingPasswordResolve;
      const activePasswordReject = this.pendingPasswordReject;
      const activePromptResolve = this.pendingPromptResolve;
      const activePromptReject = this.pendingPromptReject;
      const isPassword = typeof activePasswordResolve === 'function';
      const resolveFn = isPassword ? activePasswordResolve : activePromptResolve;
      const rejectFn = isPassword ? activePasswordReject : activePromptReject;

      if (!resolveFn) {
        return;
      }

      try {
        if (isPassword) {
          this.appendOutput(`${this.currentPrompt}${'*'.repeat(value.length)}`);
          this.clearPasswordPromptState(false);
        } else {
          this.appendOutput(`${this.currentPrompt}${value}`);
          this.clearGenericPromptState(false);
        }

        this.input.value = '';
        this.disableInput();

        const client = webcomm();
        if (client && typeof client.sendInput === 'function') {
          await client.sendInput(value);
        }
        resolveFn(value);
      } catch (error) {
        this.appendOutput(`Error: Failed to send input. ${error.message}`);
        if (isPassword) {
          this.clearPasswordPromptState(true);
        } else {
          this.clearGenericPromptState(true);
        }
        if (rejectFn) {
          rejectFn(error);
        }
      }
    },
  });

  const originalHandleInput = Terminal.prototype.handleInput;
  Terminal.prototype.handleInput = async function patchedHandleInput(rawValue) {
    const awaitingPassword = typeof this.pendingPasswordResolve === 'function';
    const awaitingPrompt = typeof this.pendingPromptResolve === 'function';

    if (awaitingPassword || awaitingPrompt) {
      await this._resolvePromptSubmission(rawValue);
      return;
    }

    return originalHandleInput.call(this, rawValue);
  };

  const originalHandleEscape = Terminal.prototype.handleEscapeKey;
  Terminal.prototype.handleEscapeKey = function patchedHandleEscape(event) {
    const activePasswordReject = this.pendingPasswordReject;
    const activePromptReject = this.pendingPromptReject;

    if (typeof this.pendingPasswordResolve === 'function') {
      this.appendOutput(`${this.currentPrompt}${this.input?.value ?? ''}`);
      this.appendOutput('Password entry cancelled.');
      this.clearPasswordPromptState(true);
      const client = webcomm();
      client?.sendInput('');
      if (activePasswordReject) {
        activePasswordReject(new Error('Password entry cancelled by user.'));
      }
      event?.preventDefault();
      return;
    }

    if (typeof this.pendingPromptResolve === 'function') {
      this.appendOutput(`${this.currentPrompt}${this.input?.value ?? ''}`);
      this.appendOutput('Prompt cancelled.');
      this.clearGenericPromptState(true);
      const client = webcomm();
      client?.sendInput('');
      if (activePromptReject) {
        activePromptReject(new Error('Prompt cancelled by user.'));
      }
      event?.preventDefault();
      return;
    }

    originalHandleEscape.call(this, event);
  };
})(window);
