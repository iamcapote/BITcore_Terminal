(function initializeStatusClient(global) {
  const { TRUE_VALUES } = global.statusConfig || {};
  const { updateStatusElement } = global.statusDom || {};
  const StatusPresenceController = global.StatusPresenceController;

  class StatusClient {
    constructor({ endpoint, refreshMs, validateGitHub } = {}) {
      const body = document.body || {};
      this.endpoint = endpoint || body.dataset.statusEndpoint || '/api/status/summary';
      const refreshAttr = body.dataset.statusRefreshMs;
      const parsedInterval = Number(refreshAttr);
      this.refreshMs = Number.isFinite(refreshMs)
        ? refreshMs
        : (Number.isFinite(parsedInterval) && parsedInterval >= 0 ? parsedInterval : 60000);
      const validateAttr = body.dataset.statusValidateGithub;
      this.validateGitHub = typeof validateGitHub === 'boolean'
        ? validateGitHub
        : (validateAttr ? TRUE_VALUES.has(String(validateAttr).toLowerCase()) : false);

      this.targets = Array.from(document.querySelectorAll('[data-status-key]'));
      this.presenceTargets = Array.from(document.querySelectorAll('[data-presence-key]'));
      this.presenceElements = this.collectPresenceElements(this.presenceTargets);

      this.timer = null;
      this.active = false;
      this.lastSummary = null;
      this.webcomm = null;
      this.webcommAttached = false;
      this.webcommRetryTimer = null;
      this.handlerDisposers = [];
      this.preferences = (typeof window !== 'undefined' ? window.__terminalPreferences : null) || null;

      this.presence = new StatusPresenceController({
        elementsMap: this.presenceElements,
        preferences: this.preferences
      });

      this.handlePreferencesEvent = this.handlePreferencesEvent.bind(this);

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('terminal-preferences:updated', this.handlePreferencesEvent);
      }
    }

    collectPresenceElements(elements) {
      const map = new Map();
      elements.forEach((element) => {
        const key = element.dataset.presenceKey;
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(element);
      });
      return map;
    }

    hasTargets() {
      return this.targets.length > 0;
    }

    hasPresenceTargets() {
      return this.presenceTargets.length > 0;
    }

    start() {
      if (!(this.hasTargets() || this.hasPresenceTargets()) || this.active) {
        return this;
      }
      this.active = true;
      this.maybeAttachWebComm();
      this.refresh();
      if (this.refreshMs > 0) {
        this.timer = window.setInterval(() => this.refresh(), this.refreshMs);
      }
      return this;
    }

    stop() {
      if (this.timer) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
      this.active = false;
      this.releaseHandlers();
      if (this.webcommRetryTimer) {
        window.clearTimeout(this.webcommRetryTimer);
        this.webcommRetryTimer = null;
      }
    }

    async refresh() {
      if (!(this.hasTargets() || this.hasPresenceTargets())) {
        return;
      }

      if (this.webcommAttached && this.webcomm?.isConnected?.()) {
        this.requestSummaryRefresh(this.validateGitHub);
        return;
      }

      try {
        const url = new URL(this.endpoint, window.location.origin);
        if (this.validateGitHub) {
          url.searchParams.set('validate', '1');
        }
        const response = await fetch(url.toString(), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Status fetch failed (${response.status})`);
        }
        const summary = await response.json();
        this.lastSummary = summary;
        this.apply(summary?.statuses || {});
      } catch (error) {
        console.warn('[StatusClient] refresh failed:', error);
        this.applyError(error.message || 'Status unavailable');
      }
    }

    requestSummaryRefresh(validate = this.validateGitHub) {
      if (!this.webcommAttached || !this.webcomm || typeof this.webcomm.send !== 'function') {
        return;
      }
      try {
        this.webcomm.send(JSON.stringify({ type: 'status-refresh', validate: Boolean(validate) }));
      } catch (error) {
        console.warn('[StatusClient] Failed to request status refresh over WebSocket:', error);
      }
    }

    maybeAttachWebComm() {
      if (this.webcommAttached || typeof window === 'undefined') {
        return;
      }

      const candidate = window.webcomm;
      if (!candidate || typeof candidate.registerHandler !== 'function') {
        if (!this.webcommRetryTimer) {
          this.webcommRetryTimer = window.setTimeout(() => {
            this.webcommRetryTimer = null;
            this.maybeAttachWebComm();
          }, 750);
        }
        return;
      }

      this.webcomm = candidate;
      this.webcommAttached = true;
      this.bindWebCommHandlers();
      if (this.webcomm?.isConnected?.()) {
        this.requestSummaryRefresh(this.validateGitHub);
      }
    }

    bindWebCommHandlers() {
      if (!this.webcomm || typeof this.webcomm.registerHandler !== 'function') {
        return;
      }

      this.releaseHandlers();

      this.handlerDisposers.push(this.webcomm.registerHandler('status-summary', (message) => {
        this.handleStatusSummary(message);
      }));

      this.handlerDisposers.push(this.webcomm.registerHandler('connection', (message) => {
        this.handleConnection(message);
      }));

      this.handlerDisposers.push(this.webcomm.registerHandler('research-status', () => {
        this.presence.markTelemetryActive('status');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('research-progress', () => {
        this.presence.markTelemetryActive('progress');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('research-thought', () => {
        this.presence.markTelemetryActive('thought');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('research-complete', () => {
        this.presence.markTelemetryActive('complete');
      }));

      this.handlerDisposers.push(this.webcomm.registerHandler('output', () => {
        this.presence.markLogActive('output');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('error', () => {
        this.presence.markLogActive('error');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('system-message', () => {
        this.presence.markLogActive('system');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('log-event', () => {
        this.presence.markLogActive('log-event');
      }));
    }

    releaseHandlers() {
      while (this.handlerDisposers.length) {
        const disposer = this.handlerDisposers.pop();
        try {
          disposer?.();
        } catch (error) {
          console.warn('[StatusClient] Failed to release handler:', error);
        }
      }
    }

    handleStatusSummary(message) {
      if (message?.error) {
        this.applyError(message.error);
        return;
      }

      const summary = message?.data || message?.summary || message;
      if (!summary || typeof summary !== 'object') {
        return;
      }
      if (summary.statuses) {
        this.lastSummary = summary;
        this.apply(summary.statuses);
      }
    }

    handleConnection(message) {
      const connected = Boolean(message?.connected);
      if (!connected) {
        const reason = message?.reason || 'Disconnected';
        this.applyError(reason);
        this.presence.handleDisconnect(reason);
        return;
      }

      this.presence.handleReconnect();
      this.requestSummaryRefresh(this.validateGitHub);
    }

    handlePreferencesEvent(event) {
      if (!event) return;
      const preferences = event.detail?.preferences || event.detail || null;
      this.preferences = preferences;
      this.presence.applyPreferences(preferences);
    }

    apply(statusMap) {
      this.targets.forEach((element) => {
        const key = element.dataset.statusKey;
        const info = statusMap[key];
        updateStatusElement(element, info);
      });
    }

    applyError(message) {
      this.targets.forEach((element) => {
        updateStatusElement(element, {
          state: 'error',
          message,
          label: element.dataset.statusLabel || element.dataset.statusKey || 'Status'
        });
      });
    }
  }

  global.StatusClient = StatusClient;
})(typeof window !== 'undefined' ? window : globalThis);
