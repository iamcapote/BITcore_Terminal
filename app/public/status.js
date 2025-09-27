(function() {
  const STATE_CLASSES = [
    'status-active',
    'status-warning',
    'status-error',
    'status-missing',
    'status-checking',
    'status-unknown'
  ];

  const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

  const PRESENCE_CONFIG = Object.freeze({
    telemetry: Object.freeze({
      label: 'Telemetry Feed',
      preferencePath: 'widgets.telemetryIndicator',
      idleMessage: 'Awaiting telemetry…',
      activeMessage: 'Telemetry streaming',
      decayMs: 45000
    }),
    logs: Object.freeze({
      label: 'Log Stream',
      preferencePath: 'widgets.logIndicator',
      idleMessage: 'No recent logs',
      activeMessage: 'Log activity detected',
      decayMs: 30000
    })
  });

  function parseBooleanLike(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value == null) return fallback;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  function getNestedPreference(preferences, path, fallback = true) {
    if (!preferences || !path) return fallback;
    const segments = path.split('.');
    let current = preferences;
    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return fallback;
      }
      current = current[segment];
    }
    return parseBooleanLike(current, fallback);
  }

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
        : (validateAttr ? TRUE_VALUES.has(validateAttr.toLowerCase()) : false);

      this.targets = Array.from(document.querySelectorAll('[data-status-key]'));
      this.presenceTargets = Array.from(document.querySelectorAll('[data-presence-key]'));
      this.presenceElements = new Map();
      this.presenceTargets.forEach((element) => {
        const key = element.dataset.presenceKey;
        if (!key) return;
        if (!this.presenceElements.has(key)) {
          this.presenceElements.set(key, []);
        }
        this.presenceElements.get(key).push(element);
      });

      this.timer = null;
      this.active = false;
      this.lastSummary = null;
      this.webcomm = null;
      this.webcommAttached = false;
      this.webcommRetryTimer = null;
      this.handlerDisposers = [];
      this.presenceDecayTimers = new Map();
      this.presenceState = new Map();
      this.preferences = (typeof window !== 'undefined' ? window.__terminalPreferences : null) || null;

      this.handlePreferencesEvent = this.handlePreferencesEvent.bind(this);

      this.initPresenceState();
      this.applyPresencePreferences(this.preferences);

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('terminal-preferences:updated', this.handlePreferencesEvent);
      }
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
      this.clearPresenceDecayTimers();
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
      if (this.webcommAttached) {
        return;
      }

      if (typeof window === 'undefined') {
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
        this.markTelemetryActive('status');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('research-progress', () => {
        this.markTelemetryActive('progress');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('research-thought', () => {
        this.markTelemetryActive('thought');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('research-complete', () => {
        this.markTelemetryActive('complete');
      }));

      this.handlerDisposers.push(this.webcomm.registerHandler('output', () => {
        this.markLogActive('output');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('error', () => {
        this.markLogActive('error');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('system-message', () => {
        this.markLogActive('system');
      }));
      this.handlerDisposers.push(this.webcomm.registerHandler('log-event', () => {
        this.markLogActive('log-event');
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
        this.updatePresenceState('telemetry', {
          state: 'error',
          message: reason
        });
        this.updatePresenceState('logs', {
          state: 'error',
          message: reason
        });
        return;
      }

      this.updatePresenceState('telemetry', {
        state: 'warning',
        message: PRESENCE_CONFIG.telemetry.idleMessage,
        lastActive: null
      });
      this.updatePresenceState('logs', {
        state: 'warning',
        message: PRESENCE_CONFIG.logs.idleMessage,
        lastActive: null
      });
      this.requestSummaryRefresh(this.validateGitHub);
    }

    handlePreferencesEvent(event) {
      if (!event) return;
      const preferences = event.detail?.preferences || event.detail || null;
      this.preferences = preferences;
      this.applyPresencePreferences(preferences);
    }

    initPresenceState() {
      Object.entries(PRESENCE_CONFIG).forEach(([key, config]) => {
        this.presenceState.set(key, {
          enabled: true,
          state: 'warning',
          message: config.idleMessage,
          lastActive: null,
          meta: { source: 'idle' }
        });
        this.applyPresenceToDom(key);
      });
    }

    applyPresencePreferences(preferences) {
      Object.entries(PRESENCE_CONFIG).forEach(([key, config]) => {
        const enabled = getNestedPreference(preferences, config.preferencePath, true);
        this.updatePresenceState(key, { enabled: Boolean(enabled) });
      });
    }

    updatePresenceState(key, updates = {}) {
      if (!PRESENCE_CONFIG[key]) {
        return;
      }
      const current = this.presenceState.get(key) || {};
      const next = {
        ...current,
        ...updates
      };

      if (updates.enabled === false) {
        this.clearPresenceDecayTimer(key);
      }

      this.presenceState.set(key, next);
      this.applyPresenceToDom(key);
    }

    applyPresenceToDom(key) {
      const elements = this.presenceElements.get(key);
      if (!elements || elements.length === 0) {
        return;
      }

      const config = PRESENCE_CONFIG[key];
      const state = this.presenceState.get(key) || {};
      const enabled = state.enabled !== false;
      const status = enabled ? (state.state || 'unknown') : 'missing';
      const message = enabled ? (state.message || config.idleMessage) : 'Hidden';

      elements.forEach((element) => {
        element.classList.toggle('is-hidden', !enabled);
        this.updateElement(element, {
          state: status,
          label: element.dataset.statusLabel || config.label,
          message,
          meta: state.meta || null
        });
      });
    }

    clearPresenceDecayTimers() {
      for (const key of this.presenceDecayTimers.keys()) {
        this.clearPresenceDecayTimer(key);
      }
    }

    clearPresenceDecayTimer(key) {
      const timerId = this.presenceDecayTimers.get(key);
      if (timerId) {
        window.clearTimeout(timerId);
      }
      this.presenceDecayTimers.delete(key);
    }

    schedulePresenceDecay(key) {
      const config = PRESENCE_CONFIG[key];
      if (!config) return;
      if (this.presenceState.get(key)?.enabled === false) return;

      this.clearPresenceDecayTimer(key);
      const delay = Number.isFinite(config.decayMs) ? config.decayMs : 45000;
      const timerId = window.setTimeout(() => {
        if (this.presenceState.get(key)?.enabled === false) {
          this.clearPresenceDecayTimer(key);
          return;
        }
        this.updatePresenceState(key, {
          state: 'warning',
          message: config.idleMessage,
          meta: { source: 'idle' },
          lastActive: null
        });
        this.clearPresenceDecayTimer(key);
      }, delay);
      this.presenceDecayTimers.set(key, timerId);
    }

    markTelemetryActive(source) {
      if (this.presenceState.get('telemetry')?.enabled === false) {
        return;
      }
      this.updatePresenceState('telemetry', {
        state: 'active',
        message: PRESENCE_CONFIG.telemetry.activeMessage,
        lastActive: Date.now(),
        meta: { source }
      });
      this.schedulePresenceDecay('telemetry');
    }

    markLogActive(source) {
      if (this.presenceState.get('logs')?.enabled === false) {
        return;
      }
      this.updatePresenceState('logs', {
        state: 'active',
        message: PRESENCE_CONFIG.logs.activeMessage,
        lastActive: Date.now(),
        meta: { source }
      });
      this.schedulePresenceDecay('logs');
    }

    apply(statusMap) {
      this.targets.forEach((element) => {
        const key = element.dataset.statusKey;
        const info = statusMap[key];
        this.updateElement(element, info);
      });
    }

    applyError(message) {
      this.targets.forEach((element) => {
        this.updateElement(element, {
          state: 'error',
          message,
          label: element.dataset.statusLabel || element.dataset.statusKey || 'Status'
        });
      });
    }

    updateElement(element, info, { fallbackLabel } = {}) {
      const state = info?.state || 'unknown';
      STATE_CLASSES.forEach((cls) => element.classList.remove(cls));
      element.classList.add(`status-${state}`);
      element.dataset.state = state;

      const labelElement = element.querySelector('[data-status-role="label"]');
      const fallback = fallbackLabel || element.dataset.statusLabel || element.dataset.statusKey || 'Status';
      if (labelElement) {
        labelElement.textContent = info?.label || fallback;
      }

      const messageElement = element.querySelector('[data-status-role="message"]');
      if (messageElement) {
        messageElement.textContent = info?.message || 'Unknown';
      }

      const metaSummary = this.formatMetaSummary(element.dataset.statusKey || element.dataset.presenceKey, info?.meta);
      let metaElement = element.querySelector('[data-status-role="meta"]');
      if (!metaElement) {
        metaElement = document.createElement('span');
        metaElement.className = 'status-chip-meta';
        metaElement.dataset.statusRole = 'meta';
        element.appendChild(metaElement);
      }
      if (metaSummary) {
        metaElement.textContent = metaSummary;
        metaElement.classList.remove('is-hidden');
      } else {
        metaElement.textContent = '';
        metaElement.classList.add('is-hidden');
      }

      const tooltipParts = [info?.message || fallback];
      if (metaSummary) {
        tooltipParts.push(metaSummary);
      }
      element.title = tooltipParts.filter(Boolean).join(' • ');
    }

    formatMetaSummary(key, meta) {
      if (!meta || typeof meta !== 'object') {
        return '';
      }

      switch (key) {
        case 'venice':
        case 'brave': {
          if (!meta.configured) {
            return 'Not configured';
          }
          const sources = [];
          if (meta.userScoped) sources.push('user key');
          if (meta.envScoped) sources.push('env var');
          return sources.length ? `Sources: ${sources.join(' + ')}` : 'Configured';
        }
        case 'github': {
          const parts = [];
          if (meta.repository) parts.push(meta.repository);
          if (meta.branch) parts.push(`branch ${meta.branch}`);
          if (meta.hasToken) parts.push('token set');
          if (meta.verified) parts.push('verified');
          if (!parts.length) {
            return meta.hasConfig ? 'Configured' : 'Repository missing';
          }
          return parts.join(' · ');
        }
        case 'memory': {
          if (meta.error) {
            return `Error: ${meta.error}`;
          }
          if (meta.mode === 'github') {
            return meta.githubVerified ? 'GitHub sync (verified)' : 'GitHub sync pending verification';
          }
          if (meta.mode === 'local-fallback') {
            return 'Local fallback (GitHub unavailable)';
          }
          if (meta.mode === 'local') {
            return 'Local mode';
          }
          return meta.githubConfigured ? 'GitHub configured' : '';
        }
        default: {
          const entries = Object.entries(meta)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
          return entries.join(' · ');
        }
      }
    }
  }

  let singletonClient = null;

  function ensureClient() {
    if (!singletonClient) {
      singletonClient = new StatusClient();
    }
    return singletonClient;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const client = ensureClient();
    if (client.hasTargets() || client.hasPresenceTargets()) {
      client.start();
    }
  });

  window.refreshStatusIndicators = function refreshStatusIndicators() {
    const client = ensureClient();
    if (client.hasTargets() || client.hasPresenceTargets()) {
      client.refresh();
    }
  };
})();
