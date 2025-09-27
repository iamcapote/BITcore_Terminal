/**
 * Terminal Research Handlers
 * Why: Process research telemetry events and keep UI state in sync.
 * What: Adds WebSocket handler implementations for research events.
 * How: Normalizes payloads, updates shared state, and delegates rendering.
 */
(function extendTerminalResearchHandlers(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.research.handlers] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;

  const extractPayload = (message) => {
    if (!message) return null;
    if (message.data !== undefined) return message.data;
    if (message.payload !== undefined) return message.payload;
    return message;
  };

  const eventIdFor = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    return payload.eventId || payload.id || null;
  };

  const seenEvent = (terminal, key, payload) => {
    const eventId = eventIdFor(payload);
    if (!eventId) return false;
    if (terminal[key] === eventId) {
      return true;
    }
    terminal[key] = eventId;
    return false;
  };

  const toCount = (terminal, value) => {
    if (typeof terminal.coerceCount === 'function') {
      return terminal.coerceCount(value);
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return 0;
    }
    return Math.round(num);
  };

  const toPercent = (value, completed, total) => {
    if (Number.isFinite(value)) {
      const clamped = Math.max(0, Math.min(100, Math.round(value)));
      return Number.isNaN(clamped) ? null : clamped;
    }
    if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
      return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
    }
    return null;
  };

  const toTimestamp = (value) => {
    if (Number.isFinite(value)) {
      return Number(value);
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return Date.now();
  };

  const buildProgressLabel = ({ percent, completed, total, message, stage }) => {
    const parts = [];
    if (percent !== null && percent !== undefined) parts.push(`${percent}%`);
    if (Number.isFinite(completed) && Number.isFinite(total)) parts.push(`${completed}/${total}`);
    if (message) parts.push(message);
    else if (stage) parts.push(stage);
    return parts.length ? parts.join(' • ') : 'Research in progress…';
  };

  Object.assign(Terminal.prototype, {
    handleResearchStart(message) {
      const payload = extractPayload(message) || {};
      if (typeof this.resetResearchTelemetry === 'function') {
        this.resetResearchTelemetry();
      }

      this.researchTelemetryState = {
        ...(this.researchTelemetryState || {}),
        stage: payload.stage || 'Starting',
        message: payload.message || 'Initializing research…',
        detail: payload.detail || null,
        percent: 0,
        completed: 0,
        total: 0,
        depth: null,
        breadth: null,
      };

      if (typeof this.renderResearchTelemetry === 'function') {
        this.renderResearchTelemetry();
      }

      if (typeof this.appendOutput === 'function') {
        this.appendOutput('Research run started…');
      }
      if (typeof this.showProgressBar === 'function') {
        this.showProgressBar();
      }
      if (typeof this.updateProgressBar === 'function') {
        this.updateProgressBar('Research: initializing…');
      }
      if (typeof this.disableInput === 'function' && !this.pendingPromptResolve && !this.pendingPasswordResolve) {
        this.disableInput();
      }
    },

    handleResearchProgress(message) {
      const payload = extractPayload(message);
      if (!payload || typeof payload !== 'object') {
        return;
      }

      if (seenEvent(this, 'lastResearchProgressEventId', payload)) {
        return;
      }

      const completed = toCount(this, payload.completed ?? payload.completedQueries);
      const total = toCount(this, payload.total ?? payload.totalQueries);
      const percent = toPercent(payload.percent ?? payload.percentComplete, completed, total);
      const depth = payload.currentDepth ?? payload.totalDepth ?? null;
      const breadth = payload.currentBreadth ?? payload.totalBreadth ?? null;

      this.researchTelemetryState = {
        ...(this.researchTelemetryState || {}),
        stage: payload.status || this.researchTelemetryState?.stage || 'Running',
        message: payload.message || this.researchTelemetryState?.message || 'Processing…',
        detail: payload.detail ?? this.researchTelemetryState?.detail ?? null,
        percent: percent ?? this.researchTelemetryState?.percent ?? 0,
        completed,
        total,
        depth: depth ?? this.researchTelemetryState?.depth ?? null,
        breadth: breadth ?? this.researchTelemetryState?.breadth ?? null,
      };

      if (typeof this.renderResearchTelemetry === 'function') {
        this.renderResearchTelemetry();
      }

      if (typeof this.showProgressBar === 'function') {
        this.showProgressBar();
      }
      if (typeof this.updateProgressBar === 'function') {
        this.updateProgressBar(
          buildProgressLabel({
            percent,
            completed,
            total,
            message: payload.message,
            stage: payload.status,
          })
        );
      }
    },

    handleResearchStatus(message) {
      const payload = extractPayload(message);
      if (!payload || typeof payload !== 'object') {
        return;
      }
      if (seenEvent(this, 'lastResearchStatusEventId', payload)) {
        return;
      }

      const progress = payload.progress && typeof payload.progress === 'object' ? payload.progress : {};
      const completed = progress.completed ?? progress.completedQueries;
      const total = progress.total ?? progress.totalQueries;
      const percent = progress.percent ?? progress.percentComplete;

      this.researchTelemetryState = {
        ...(this.researchTelemetryState || {}),
        stage: payload.stage || this.researchTelemetryState?.stage || 'Running',
        message: payload.message || this.researchTelemetryState?.message || 'Processing…',
        detail: payload.detail ?? payload.meta?.detail ?? this.researchTelemetryState?.detail ?? null,
        percent: toPercent(percent, completed, total) ?? this.researchTelemetryState?.percent ?? 0,
        completed: completed !== undefined ? toCount(this, completed) : this.researchTelemetryState?.completed ?? 0,
        total: total !== undefined ? toCount(this, total) : this.researchTelemetryState?.total ?? 0,
        depth: this.coalesceDefined
          ? this.coalesceDefined(progress.currentDepth, progress.totalDepth, this.researchTelemetryState?.depth, null)
          : (progress.currentDepth ?? this.researchTelemetryState?.depth ?? null),
        breadth: this.coalesceDefined
          ? this.coalesceDefined(progress.currentBreadth, progress.totalBreadth, this.researchTelemetryState?.breadth, null)
          : (progress.currentBreadth ?? this.researchTelemetryState?.breadth ?? null),
      };

      if (typeof this.renderResearchTelemetry === 'function') {
        this.renderResearchTelemetry();
      }

      if (typeof this.updateProgressBar === 'function') {
        this.updateProgressBar(
          buildProgressLabel({
            percent: this.researchTelemetryState.percent,
            completed: this.researchTelemetryState.completed,
            total: this.researchTelemetryState.total,
            message: payload.message,
            stage: payload.stage,
          })
        );
      }
    },

    handleResearchThought(message) {
      const payload = extractPayload(message);
      if (!payload) {
        return;
      }

      const entries = Array.isArray(payload) ? payload : [payload];
      entries.forEach((entry) => {
        if (!entry) return;
        const text = typeof entry === 'string'
          ? entry.trim()
          : (entry.text || entry.message || '').trim();
        if (!text) return;
        this.addResearchTelemetryThought?.({
          text,
          stage: entry.stage || entry.phase || null,
          source: entry.source || null,
          timestamp: toTimestamp(entry.timestamp ?? entry.time ?? Date.now()),
        });
      });
    },

    handleResearchMemory(message) {
      const payload = extractPayload(message);
      if (!payload || typeof payload !== 'object') {
        return;
      }
      if (seenEvent(this, 'lastResearchMemoryEventId', payload)) {
        return;
      }
      if (typeof this.updateResearchMemoryContext === 'function') {
        this.updateResearchMemoryContext(payload);
      }
    },

    handleResearchSuggestions(message) {
      const payload = extractPayload(message);
      if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
        return;
      }
      if (seenEvent(this, 'lastResearchSuggestionsEventId', payload)) {
        return;
      }
      if (typeof this.updateResearchSuggestions === 'function') {
        this.updateResearchSuggestions(payload);
      }
    },

    handleResearchCompleteTelemetry(message) {
      const payload = extractPayload(message) || {};

      const success = payload.success !== false;
      const summaryText = payload.summary || (success ? 'Research complete.' : 'Research failed.');
      const stage = success ? 'Complete' : 'Failed';

      this.researchTelemetryState = {
        ...(this.researchTelemetryState || {}),
        stage,
        message: summaryText,
        detail: payload.error || payload.meta?.detail || null,
        percent: 100,
      };

      if (typeof this.renderResearchTelemetry === 'function') {
        this.renderResearchTelemetry();
      }

      if (typeof this.hideProgressBar === 'function') {
        this.hideProgressBar();
      }
    },

    handleResearchResultReady(message) {
      const payload = extractPayload(message) || {};
      if (typeof this.hideProgressBar === 'function') {
        this.hideProgressBar();
      }

      const summary = payload.summary || payload.message;
      if (summary && typeof this.appendOutput === 'function') {
        this.appendOutput('\n--- Research Summary ---');
        this.appendOutput(summary);
        this.appendOutput('-------------------------');
      }

      const promptText = payload.prompt || 'Choose action: [Download] | [Upload] | [Keep]';
      const context = payload.context || 'post_research_action';
      if (typeof this.promptForInput === 'function') {
        this.promptForInput(promptText, context).catch(() => {});
      }
    },

    handleResearchComplete(message) {
      const payload = extractPayload(message) || {};

      if (typeof this.hideProgressBar === 'function') {
        this.hideProgressBar();
      }

      if (payload.error && typeof this.appendOutput === 'function') {
        this.appendOutput(`Research failed: ${payload.error}`);
      } else if (payload.summary && typeof this.appendOutput === 'function') {
        if (!this.pendingPromptResolve && (this.currentPromptContext !== 'post_research_action')) {
          this.appendOutput('Research complete.');
          this.appendOutput('--- Research Summary ---');
          this.appendOutput(payload.summary);
          this.appendOutput('----------------------');
        }
      } else if (typeof this.appendOutput === 'function') {
        this.appendOutput('Research complete.');
      }

      if (!this.pendingPasswordResolve && !this.pendingPromptResolve && typeof this.setMode === 'function') {
        this.setMode('command', '> ');
      }
    },
  });
})(window);
