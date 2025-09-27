/**
 * Terminal Core
 * Why: Provide the foundational browser terminal implementation that other extensions can enhance.
 * What: Boots the UI, wires structural elements, and offers shared helpers for extensions to reuse.
 * How: Keeps behaviour slim; feature-specific logic is added through extension modules that augment the prototype.
 */
(function registerTerminalCore(global) {
  const DEFAULT_PROMPT = '▶ ';

  class Terminal {
    constructor(elementId) {
      this.elementId = elementId;
      this.outputArea = document.getElementById(elementId) || null;
      this.container = this.outputArea ? this.outputArea.closest('.terminal-container') : null;

      this.inputArea = null;
      this.input = null;
      this.prompt = null;
      this.progressBar = null;
      this.statusElement = null;
      this.userStatusElement = null;

      this.history = [];
      this.historyIndex = -1;
      this.inputEnabled = false;
      this.currentPrompt = DEFAULT_PROMPT;
      this.passwordMode = false;

      this.pendingPasswordResolve = null;
      this.pendingPasswordReject = null;
      this.pendingPromptResolve = null;
      this.pendingPromptReject = null;
      this.currentPromptTimeoutId = null;
      this.currentPromptContext = null;

      this.mode = 'command';
      this.eventListenersInitialized = false;
      this.lastInputHandledTime = 0;
      this.scrollTimeout = null;
      this.preferences = null;
      this.autoScrollEnabled = true;
      this.retainHistoryEnabled = true;

      if (typeof this.initializeMemoryTelemetryState === 'function') {
        this.initializeMemoryTelemetryState();
      }
      if (typeof this.initializeResearchTelemetryState === 'function') {
        this.initializeResearchTelemetryState();
      }
      if (typeof this.initializeMissionState === 'function') {
        this.initializeMissionState();
      }

      if (global.__terminalPreferences && typeof global.__terminalPreferences === 'object') {
        this.applyTerminalPreferences(global.__terminalPreferences, { silent: true });
      }

      this.initialize();
    }

    initialize() {
      if (!this.outputArea) {
        console.error('Terminal output element not found.');
        return;
      }

      if (!this.container) {
        this.container = document.querySelector('.terminal-container');
        if (!this.container) {
          console.error('Terminal container element not found.');
          return;
        }
      }

      this.input = document.getElementById('terminal-input');
      this.prompt = document.getElementById('prompt');
      this.progressBar = document.getElementById('progress-bar');
      this.statusElement = document.getElementById('connection-status');
      this.userStatusElement = document.getElementById('user-status');

      if (!this.input || !this.prompt || !this.progressBar || !this.statusElement || !this.userStatusElement) {
        console.error('Terminal UI elements missing.');
        return;
      }

      this.inputArea = this.input.closest('.terminal-input-wrapper');

      if (typeof this.captureMemoryTelemetryElements === 'function') {
        this.captureMemoryTelemetryElements();
      }
      if (typeof this.captureResearchTelemetryElements === 'function') {
        this.captureResearchTelemetryElements();
      }
      if (typeof this.captureMissionElements === 'function') {
        this.captureMissionElements();
      }

      if (typeof this.initializeMemoryTelemetryUI === 'function') {
        this.initializeMemoryTelemetryUI();
      }
      if (typeof this.initializeResearchTelemetryUI === 'function') {
        this.initializeResearchTelemetryUI();
      }
      if (typeof this.initializeMissionDashboard === 'function') {
        this.initializeMissionDashboard();
      }

      this.setPrompt(this.currentPrompt);
      this.hideProgressBar();
      this.disableInput();
      this.setStatus('disconnected');
      this.updateUserStatus('public');

      if (typeof this.initializeEventListeners === 'function') {
        this.initializeEventListeners();
      }
    }

    scrollToBottom() {
      if (this.outputArea && this.autoScrollEnabled) {
        this.outputArea.scrollTop = this.outputArea.scrollHeight;
      }
    }

    focusInput() {
      if (!this.input || !this.inputEnabled) {
        return;
      }

      if (this.pendingPasswordResolve || this.pendingPromptResolve) {
        return;
      }

      setTimeout(() => {
        if (!this.input || document.activeElement === this.input || !document.hasFocus()) {
          return;
        }
        try {
          this.input.focus();
        } catch (error) {
          console.warn('Failed to focus terminal input:', error);
        }
      }, 50);
    }

    enableInput() {
      this.inputEnabled = true;
      if (this.input) {
        this.input.disabled = false;
      }
    }

    disableInput() {
      this.inputEnabled = false;
      if (this.input) {
        this.input.disabled = true;
      }
    }

    showProgressBar() {
      if (this.progressBar) {
        this.progressBar.style.display = 'block';
      }
    }

    updateProgressBar(text) {
      if (!this.progressBar) return;
      const span = this.progressBar.querySelector('span');
      if (span) {
        span.textContent = text;
      } else {
        this.progressBar.textContent = text;
      }
      this.scrollToBottom();
    }

    hideProgressBar() {
      if (!this.progressBar) return;
      this.progressBar.style.display = 'none';
      const span = this.progressBar.querySelector('span');
      if (span) {
        span.textContent = '';
      } else {
        this.progressBar.textContent = '';
      }
    }

    setStatus(status) {
      if (!this.statusElement) return;
      this.statusElement.classList.remove('status-connected', 'status-disconnected');
      this.statusElement.classList.add(`status-${status}`);
      this.statusElement.textContent = `Status: ${status === 'connected' ? 'Connected' : 'Disconnected'}`;
    }

    updateUserStatus(username) {
      if (!this.userStatusElement) return;
      const label = username && username !== 'public' ? username : 'public';
      this.userStatusElement.textContent = `User: ${label}`;
      this.userStatusElement.classList.toggle('active', label !== 'public');
    }

    setMode(mode, promptText) {
      this.mode = mode;
      if (promptText !== undefined) {
        this.currentPrompt = promptText;
        this.setPrompt(this.currentPrompt);
      }
      if (mode !== 'prompt') {
        this.setPasswordMode(false);
      }
    }

    setPrompt(text) {
      if (this.prompt) {
        this.prompt.textContent = text;
      }
    }

    setPasswordMode(enabled) {
      this.passwordMode = enabled;
      if (this.input) {
        this.input.type = enabled ? 'password' : 'text';
      }
    }

    clear() {
      if (this.outputArea) {
        this.outputArea.innerHTML = '';
      }
    }

    truncateText(text, maxLength = 200) {
      if (typeof text !== 'string') {
        return '';
      }
      const trimmed = text.trim();
      if (!maxLength || trimmed.length <= maxLength) {
        return trimmed;
      }
      return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
    }

    setAutoScrollEnabled(enabled = true, { silent = false } = {}) {
      const next = Boolean(enabled);
      if (this.autoScrollEnabled === next) {
        return;
      }
      this.autoScrollEnabled = next;
      if (this.autoScrollEnabled && !silent) {
        this.scrollToBottom();
      }
    }

    setRetainHistoryEnabled(enabled = true) {
      this.retainHistoryEnabled = Boolean(enabled);
    }

    applyTerminalPreferences(preferences, options = {}) {
      if (!preferences || typeof preferences !== 'object') {
        return;
      }

      const silent = Boolean(options?.silent);

      this.preferences = {
        widgets: { ...(preferences.widgets || {}) },
        terminal: { ...(preferences.terminal || {}) },
        updatedAt: preferences.updatedAt ?? null,
      };

      if (this.preferences.terminal) {
        if (this.preferences.terminal.autoScroll !== undefined) {
          this.setAutoScrollEnabled(Boolean(this.preferences.terminal.autoScroll), { silent });
        }
        if (this.preferences.terminal.retainHistory !== undefined) {
          this.setRetainHistoryEnabled(Boolean(this.preferences.terminal.retainHistory));
        }
      }
    }
  }

  global.Terminal = Terminal;
})(window);
