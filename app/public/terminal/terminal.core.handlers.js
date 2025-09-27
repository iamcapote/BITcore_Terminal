/**
 * Terminal Core Handlers
 * Why: Collect the generic WebSocket handlers that aren't domain-specific.
 * What: Adds system, chat, auth, and download response behaviours to the Terminal prototype.
 * How: Keeps logic cohesive so other feature modules can focus on their own events.
 */
(function extendTerminalCoreHandlers(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.core.handlers] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;
  const webcomm = () => global.webcomm || null;

  const isProgressLike = (text) => typeof text === 'string' && text.includes('ETA:') && text.includes('%');

  Object.assign(Terminal.prototype, {
    handleSystemMessage(message = {}) {
      const text = message.message || message.data || '';
      if (text) {
        this.appendOutput(`[System] ${text}`);
      }
    },

    handleOutput(message = {}) {
      const rawPayload = message.data ?? message.message ?? '';
      if (rawPayload === null || rawPayload === undefined) {
        return;
      }
      let payload = rawPayload;
      if (typeof payload === 'string') {
        const sanitized = payload.replace(/^[[]command[]][\s:>\-]*/i, '');
        if (sanitized.length > 0 || payload.length === 0) {
          payload = sanitized;
        }
      }
      if (isProgressLike(payload)) {
        this.updateLastLine(payload);
      } else {
        this.appendOutput(payload);
      }
    },

    handleError(message = {}) {
      if (message.error) {
        this.appendOutput(`Error: ${message.error}`, 'error-output');
      }

      const passwordReject = this.pendingPasswordReject;
      const promptReject = this.pendingPromptReject;

      if (typeof this.clearPasswordPromptState === 'function' && this.pendingPasswordResolve) {
        this.clearPasswordPromptState(false);
        passwordReject?.(new Error(`Server error during password prompt: ${message.error || 'unknown error'}`));
      }

      if (typeof this.clearGenericPromptState === 'function' && this.pendingPromptResolve) {
        this.clearGenericPromptState(false);
        promptReject?.(new Error(`Server error during prompt: ${message.error || 'unknown error'}`));
      }
    },

    handleEnableInput() {
      this.enableInput();
      this.focusInput();
    },

    handleDisableInput() {
      this.disableInput();
    },

    handlePrompt(message = {}) {
      const promptText = message.data || message.prompt || 'Input required:';
      const { isPassword = false, context = null } = message;

      if (isPassword && typeof this.promptForPassword === 'function') {
        this.promptForPassword(promptText, context).catch(() => {});
      } else if (typeof this.promptForInput === 'function') {
        this.promptForInput(promptText, context).catch(() => {});
      }
    },

    handleProgress(message = {}) {
      const data = message.data ?? message.payload;
      if (data === undefined || data === null) {
        return;
      }

      if (typeof this.handleResearchProgress === 'function') {
        this.handleResearchProgress({ data });
      } else if (typeof data === 'string') {
        this.updateProgressBar(data);
        this.showProgressBar();
      }

      this.disableInput();
    },

    handleConnection(message = {}) {
      const connected = Boolean(message.connected);
      this.setStatus(connected ? 'connected' : 'disconnected');

      if (connected) {
        this.appendOutput('Connection established.');
        return;
      }

      const reason = message.reason ? ` ${message.reason}` : '';
      this.appendOutput(`Connection lost.${reason}`.trim());
      this.disableInput();
      this.setMode('command', '> ');

      if (typeof this.clearPasswordPromptState === 'function' && this.pendingPasswordResolve) {
        const reject = this.pendingPasswordReject;
        this.clearPasswordPromptState(true);
        reject?.(new Error('WebSocket disconnected during password prompt.'));
      }

      if (typeof this.clearGenericPromptState === 'function' && this.pendingPromptResolve) {
        const reject = this.pendingPromptReject;
        this.clearGenericPromptState(true);
        reject?.(new Error('WebSocket disconnected during prompt.'));
      }
    },

    handleSessionExpired() {
      this.appendOutput('Session expired due to inactivity. Please login again.');
      this.setMode('command', '> ');
      this.updateUserStatus('public');
      this.enableInput();
    },

    handleModeChange(message = {}) {
      if (!message.mode) {
        return;
      }
      this.setMode(message.mode, message.prompt);
    },

    handleChatReady(message = {}) {
      this.setMode('chat', message.prompt || '[chat] > ');
      this.appendOutput('Chat session ready. Type /exit to leave.');
    },

    handleChatExit() {
      this.appendOutput('Exited chat mode.');
      this.setMode('command', '> ');
    },

    handleChatResponse(message = {}) {
      const text = message.message || message.data || '';
      if (text) {
        this.displayAiResponse(text);
      }
    },

    handleMemoryCommit(message = {}) {
      const commit = message.commitSha ? ` Commit: ${message.commitSha}` : '';
      this.appendOutput(`Memory finalized.${commit}`.trim());
    },

    handleLoginSuccess(message = {}) {
      const username = message.username || 'unknown user';
      this.appendOutput(`Login successful. Welcome, ${username}!`);
      this.updateUserStatus(username);
      this.setMode('command', '> ');
    },

    handleLogoutSuccess() {
      this.appendOutput('Logout successful.');
      this.updateUserStatus('public');
      this.setMode('command', '> ');
    },

    handleDownloadFile(message = {}) {
      const { filename, content } = message;
      if (!filename || content === undefined) {
        this.appendOutput('Error: Download failed – missing filename or content.');
        return;
      }

      try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        this.appendOutput(`Download initiated for ${filename}.`);
      } catch (error) {
        this.appendOutput(`Error initiating download: ${error.message}`);
      }
    },

    handleWebSocketError(error = {}) {
      const message = error.message || 'Unknown WebSocket error';
      console.error('[terminal.core.handlers] WebSocket error:', error);
      this.appendOutput(`Error: ${message}`);
      this.disableInput();
    },

    sendInput(value) {
      const client = webcomm();
      if (!client || typeof client.sendInput !== 'function') {
        return Promise.reject(new Error('WebComm client unavailable.'));
      }
      return client.sendInput(value);
    },
  });
})(window);
