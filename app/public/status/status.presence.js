(function initializeStatusPresence(global) {
  const { PRESENCE_CONFIG, getNestedPreference } = global.statusConfig || {};
  const { updateStatusElement } = global.statusDom || {};
  const timerApi = typeof window !== 'undefined' ? window : globalThis;

  class StatusPresenceController {
    constructor({ elementsMap, preferences } = {}) {
      this.elementsMap = elementsMap || new Map();
      this.preferences = preferences || null;
      this.state = new Map();
      this.decayTimers = new Map();

      this.initializeState();
      this.applyPreferences(preferences || null);
    }

    initializeState() {
      Object.entries(PRESENCE_CONFIG).forEach(([key, config]) => {
        this.state.set(key, {
          enabled: true,
          state: 'warning',
          message: config.idleMessage,
          lastActive: null,
          meta: { source: 'idle' }
        });
        this.applyToDom(key);
      });
    }

    applyPreferences(preferences) {
      this.preferences = preferences || null;
      Object.entries(PRESENCE_CONFIG).forEach(([key, config]) => {
        const enabled = getNestedPreference(preferences, config.preferencePath, true);
        this.setState(key, { enabled: Boolean(enabled) });
      });
    }

    destroy() {
      for (const timerId of this.decayTimers.values()) {
        timerApi.clearTimeout(timerId);
      }
      this.decayTimers.clear();
      this.state.clear();
    }

    markTelemetryActive(source) {
      this.markActive('telemetry', source, PRESENCE_CONFIG.telemetry.activeMessage);
    }

    markLogActive(source) {
      this.markActive('logs', source, PRESENCE_CONFIG.logs.activeMessage);
    }

    handleDisconnect(reason) {
      ['telemetry', 'logs'].forEach((key) => {
        this.setState(key, {
          state: 'error',
          message: reason,
          meta: { source: 'disconnect' }
        });
      });
    }

    handleReconnect() {
      Object.entries(PRESENCE_CONFIG).forEach(([key, config]) => {
        this.setState(key, {
          state: 'warning',
          message: config.idleMessage,
          lastActive: null,
          meta: { source: 'idle' }
        });
      });
    }

    setState(key, updates = {}) {
      if (!PRESENCE_CONFIG[key]) {
        return;
      }
      const current = this.state.get(key) || {};
      const next = { ...current, ...updates };

      if (updates.enabled === false) {
        this.clearDecayTimer(key);
      }

      this.state.set(key, next);
      this.applyToDom(key);
    }

    markActive(key, source, message) {
      if (this.state.get(key)?.enabled === false) {
        return;
      }
      this.setState(key, {
        state: 'active',
        message,
        lastActive: Date.now(),
        meta: { source }
      });
      this.scheduleDecay(key);
    }

    scheduleDecay(key) {
      const config = PRESENCE_CONFIG[key];
      if (!config) return;
      if (this.state.get(key)?.enabled === false) return;

      this.clearDecayTimer(key);
  const delay = Number.isFinite(config.decayMs) ? config.decayMs : 45000;
  const timerId = timerApi.setTimeout(() => {
        if (this.state.get(key)?.enabled === false) {
          this.clearDecayTimer(key);
          return;
        }
        this.setState(key, {
          state: 'warning',
          message: config.idleMessage,
          meta: { source: 'idle' },
          lastActive: null
        });
        this.clearDecayTimer(key);
      }, delay);
      this.decayTimers.set(key, timerId);
    }

    clearDecayTimer(key) {
      const timerId = this.decayTimers.get(key);
      if (timerId) {
        timerApi.clearTimeout(timerId);
      }
      this.decayTimers.delete(key);
    }

    applyToDom(key) {
      const elements = this.elementsMap.get(key);
      if (!elements || elements.length === 0) {
        return;
      }

      const config = PRESENCE_CONFIG[key];
      const state = this.state.get(key) || {};
      const enabled = state.enabled !== false;
      const status = enabled ? (state.state || 'unknown') : 'missing';
      const message = enabled ? (state.message || config.idleMessage) : 'Hidden';

      elements.forEach((element) => {
        element.classList.toggle('is-hidden', !enabled);
        updateStatusElement(element, {
          state: status,
          label: element.dataset.statusLabel || config.label,
          message,
          meta: state.meta || null
        });
      });
    }
  }

  global.StatusPresenceController = StatusPresenceController;
})(typeof window !== 'undefined' ? window : globalThis);
