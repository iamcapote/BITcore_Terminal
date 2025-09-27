/**
 * Terminal Memory Telemetry
 * Why: Track memory pipeline events and surface them in the terminal UI.
 * What: Stores a rolling log of memory activity and renders status badges.
 * How: Extends the Terminal prototype with lightweight state helpers and handlers.
 */
(function extendTerminalMemoryTelemetry(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.memory.telemetry] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;
  const MAX_EVENTS = 6;
  const STATUS_RESET_MS = 4_000;

  const normalizeEventEntry = (entry) => {
    if (!entry) {
      return null;
    }

    if (typeof entry === 'string') {
      return {
        text: entry.trim(),
        level: 'info',
        timestamp: Date.now(),
      };
    }

    if (typeof entry === 'object') {
      const text = entry.text || entry.message || entry.detail || '';
      if (!text) {
        return null;
      }
      return {
        text: String(text).trim(),
        level: entry.level || entry.severity || entry.type || 'info',
        timestamp: Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now(),
      };
    }

    return null;
  };

  Object.assign(Terminal.prototype, {
    initializeMemoryTelemetryState() {
      this.memoryTelemetryContainer = null;
      this.memoryTelemetryStatusElement = null;
      this.memoryTelemetryFeed = null;
      this.memoryTelemetryStatus = 'Idle';
      this.memoryTelemetryEvents = [];
      this.memoryTelemetryStatusTimeoutId = null;
    },

    captureMemoryTelemetryElements() {
      this.memoryTelemetryContainer = document.getElementById('memory-telemetry');
      this.memoryTelemetryStatusElement = document.getElementById('memory-telemetry-status');
      this.memoryTelemetryFeed = document.getElementById('memory-telemetry-feed');
    },

    initializeMemoryTelemetryUI() {
      this.renderMemoryTelemetry();
    },

    renderMemoryTelemetry() {
      if (this.memoryTelemetryStatusElement) {
        this.memoryTelemetryStatusElement.textContent = this.memoryTelemetryStatus || 'Idle';
      }

      if (!this.memoryTelemetryFeed) {
        return;
      }

      const fragment = document.createDocumentFragment();

      if (!Array.isArray(this.memoryTelemetryEvents) || this.memoryTelemetryEvents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'memory-telemetry-empty';
        empty.textContent = 'No memory events yet.';
        fragment.appendChild(empty);
        this.memoryTelemetryFeed.replaceChildren(fragment);
        return;
      }

      this.memoryTelemetryEvents.forEach((event) => {
        if (!event || !event.text) {
          return;
        }
        const item = document.createElement('div');
        item.className = `memory-telemetry-event memory-telemetry-${event.level || 'info'}`;

        const textEl = document.createElement('span');
        textEl.className = 'memory-telemetry-text';
        textEl.textContent = event.text;
        item.appendChild(textEl);

        const timestamp = Number.isFinite(event.timestamp) ? new Date(event.timestamp) : null;
        if (timestamp) {
          const timeEl = document.createElement('time');
          timeEl.className = 'memory-telemetry-time';
          timeEl.dateTime = timestamp.toISOString();
          timeEl.textContent = timestamp.toLocaleTimeString();
          item.appendChild(timeEl);
        }

        fragment.appendChild(item);
      });

      this.memoryTelemetryFeed.replaceChildren(fragment);
    },

    handleMemoryTelemetry(message = {}) {
      const payload = message.data ?? message.payload ?? message;
      if (!payload) {
        return;
      }

      const status = payload.status || payload.state;
      if (status) {
        this.memoryTelemetryStatus = String(status).trim();
        window.clearTimeout(this.memoryTelemetryStatusTimeoutId);
        this.memoryTelemetryStatusTimeoutId = window.setTimeout(() => {
          this.memoryTelemetryStatus = 'Idle';
          this.renderMemoryTelemetry();
        }, STATUS_RESET_MS);
      }

      const entries = [];
      if (Array.isArray(payload.events)) {
        entries.push(...payload.events);
      }
      if (payload.event) {
        entries.push(payload.event);
      }
      if (!entries.length && (payload.message || payload.detail)) {
        entries.push(payload);
      }

      entries
        .map((entry) => normalizeEventEntry(entry))
        .filter(Boolean)
        .forEach((entry) => {
          this.memoryTelemetryEvents.unshift(entry);
        });

      if (this.memoryTelemetryEvents.length > MAX_EVENTS) {
        this.memoryTelemetryEvents.length = MAX_EVENTS;
      }

      this.renderMemoryTelemetry();
    },
  });
})(window);
