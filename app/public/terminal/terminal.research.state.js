/**
 * Terminal Research State Extensions
 * Why: Centralize research telemetry state and helper utilities.
 * What: Adds lifecycle initializers, reset helpers, and shared formatters.
 * How: Extends the Terminal prototype with state scaffolding consumed by other research modules.
 */
(function extendTerminalResearchState(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.research.state] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;

  Object.assign(Terminal.prototype, {
    initializeResearchTelemetryState() {
      this.researchTelemetryLimits = {
        thoughts: 8,
        memoryRecords: 6,
        suggestions: 6,
      };

      this.researchTelemetryContainer = null;
      this.researchTelemetryStageElement = null;
      this.researchTelemetryStatusElement = null;
      this.researchTelemetryProgressElement = null;
      this.researchTelemetryDepthElement = null;
      this.researchTelemetryBreadthElement = null;
      this.researchTelemetryThoughtsElement = null;
      this.researchTelemetryMemoryElement = null;
      this.researchTelemetrySuggestionsElement = null;

      this.researchTelemetryThoughts = [];
      this.researchTelemetryMemoryItems = [];
      this.researchTelemetryMemorySummary = null;
      this.researchTelemetrySuggestions = [];
      this.researchTelemetrySuggestionsMeta = { source: 'memory', generatedAt: null };
      this.researchTelemetryState = {
        stage: 'Idle',
        message: 'Waiting for telemetry…',
        detail: null,
        percent: 0,
        completed: 0,
        total: 0,
        depth: null,
        breadth: null,
      };

      this.lastResearchProgressEventId = null;
      this.lastResearchStatusEventId = null;
      this.lastResearchMemoryEventId = null;
      this.lastResearchSuggestionsEventId = null;
    },

    captureResearchTelemetryElements() {
      this.researchTelemetryContainer = document.getElementById('research-telemetry');
      this.researchTelemetryStageElement = document.getElementById('research-telemetry-stage');
      this.researchTelemetryStatusElement = document.getElementById('research-telemetry-status');
      this.researchTelemetryProgressElement = document.getElementById('research-telemetry-progress');
      this.researchTelemetryDepthElement = document.getElementById('research-telemetry-depth');
      this.researchTelemetryBreadthElement = document.getElementById('research-telemetry-breadth');
      this.researchTelemetryThoughtsElement = document.getElementById('research-telemetry-thoughts');
      this.researchTelemetryMemoryElement = document.getElementById('research-telemetry-memory');
      this.researchTelemetrySuggestionsElement = document.getElementById('research-telemetry-suggestions');
    },

    initializeResearchTelemetryUI() {
      if (typeof this.renderResearchTelemetry === 'function') {
        this.renderResearchTelemetry();
      }
    },

    resetResearchTelemetry() {
      this.researchTelemetryState = {
        stage: 'Idle',
        message: 'Waiting for telemetry…',
        detail: null,
        percent: 0,
        completed: 0,
        total: 0,
        depth: null,
        breadth: null,
      };
      this.researchTelemetryThoughts = [];
      this.researchTelemetryMemoryItems = [];
      this.researchTelemetryMemorySummary = null;
      this.researchTelemetrySuggestions = [];
      this.researchTelemetrySuggestionsMeta = { source: 'memory', generatedAt: null };
      this.lastResearchProgressEventId = null;
      this.lastResearchStatusEventId = null;
      this.lastResearchMemoryEventId = null;
      this.lastResearchSuggestionsEventId = null;

      if (typeof this.renderResearchTelemetry === 'function') {
        this.renderResearchTelemetry();
      }
    },

    formatResearchStage(stage) {
      if (!stage) {
        return 'Running';
      }
      return String(stage)
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Running';
    },

    coalesceDefined(...values) {
      for (const value of values) {
        if (value !== undefined && value !== null) {
          return value;
        }
      }
      return undefined;
    },

    coerceCount(value) {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        return 0;
      }
      return Math.round(num);
    },

    coerceSuggestionScore(score) {
      const num = Number(score);
      if (!Number.isFinite(num)) {
        return null;
      }
      const clamped = Math.max(0, Math.min(1, num));
      return Number.isNaN(clamped) ? null : clamped;
    },

    formatMemoryScore(score) {
      if (score === null || score === undefined) {
        return null;
      }
      const pct = Math.round(score * 100);
      return Number.isFinite(pct) ? `${pct}% match` : null;
    },

    formatSuggestionScore(score) {
      if (score === null || score === undefined) {
        return null;
      }
      const pct = Math.round(score * 100);
      return Number.isFinite(pct) ? `Match: ${pct}%` : null;
    },

    formatSuggestionSource(source) {
      if (!source) {
        return 'memory';
      }
      const label = String(source).trim();
      return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : 'memory';
    },

    formatSuggestionTimestamp(timestamp) {
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      const now = Date.now();
      const diffMs = Math.max(0, now - date.getTime());
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'moments ago';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay}d ago`;
      return date.toLocaleString();
    },
  });
})(window);
