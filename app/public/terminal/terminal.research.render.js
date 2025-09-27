/**
 * Terminal Research Render Extensions
 * Why: Render research telemetry states into the dedicated dashboard UI.
 * What: Adds rendering helpers for progress, thoughts, memory, and suggestions.
 * How: Provides DOM update utilities consumed by research telemetry handlers.
 */
(function extendTerminalResearchRender(global) {
  if (!global.Terminal || typeof global.Terminal !== 'function') {
    console.error('[terminal.research.render] Terminal constructor missing on window.');
    return;
  }

  const { Terminal } = global;

  const ensureElements = (terminal) => {
    if (!terminal.researchTelemetryContainer && typeof terminal.captureResearchTelemetryElements === 'function') {
      terminal.captureResearchTelemetryElements();
    }
    return Boolean(terminal.researchTelemetryContainer);
  };

  const textContent = (value, fallback = '') => {
    if (value === undefined || value === null) {
      return fallback;
    }
    return String(value);
  };

  Object.assign(Terminal.prototype, {
    renderResearchTelemetry() {
      if (!ensureElements(this)) {
        return;
      }

      const state = this.researchTelemetryState || {};

      if (this.researchTelemetryStageElement) {
        const formattedStage = typeof this.formatResearchStage === 'function'
          ? this.formatResearchStage(state.stage)
          : textContent(state.stage || 'Running');
        this.researchTelemetryStageElement.textContent = formattedStage;
      }

      if (this.researchTelemetryStatusElement) {
        const parts = [];
        if (state.message) parts.push(state.message);
        if (state.detail) parts.push(state.detail);
        this.researchTelemetryStatusElement.textContent = parts.length
          ? parts.join(' — ')
          : 'Waiting for telemetry…';
      }

      if (this.researchTelemetryProgressElement) {
        const percent = Number.isFinite(state.percent) ? state.percent : null;
        const completed = Number.isFinite(state.completed) ? state.completed : null;
        const total = Number.isFinite(state.total) ? state.total : null;
        const pieces = [];
        if (percent !== null) pieces.push(`${percent}%`);
        if (completed !== null && total !== null) pieces.push(`${completed}/${total}`);
        this.researchTelemetryProgressElement.textContent = pieces.length
          ? `Progress: ${pieces.join(' • ')}`
          : 'Progress: —';
      }

      if (this.researchTelemetryDepthElement) {
        const depth = this.coalesceDefined
          ? this.coalesceDefined(state.depth, state.currentDepth, null)
          : (state.depth ?? state.currentDepth ?? null);
        this.researchTelemetryDepthElement.textContent = depth !== null
          ? `Depth: ${depth}`
          : 'Depth: —';
      }

      if (this.researchTelemetryBreadthElement) {
        const breadth = this.coalesceDefined
          ? this.coalesceDefined(state.breadth, state.currentBreadth, null)
          : (state.breadth ?? state.currentBreadth ?? null);
        this.researchTelemetryBreadthElement.textContent = breadth !== null
          ? `Breadth: ${breadth}`
          : 'Breadth: —';
      }

      this.renderResearchTelemetryMemory();
      this.renderResearchTelemetrySuggestions();
      this.renderResearchTelemetryThoughts();
    },

    renderResearchTelemetryThoughts() {
      if (!ensureElements(this) || !this.researchTelemetryThoughtsElement) {
        return;
      }

      const container = this.researchTelemetryThoughtsElement;
      const thoughts = Array.isArray(this.researchTelemetryThoughts)
        ? this.researchTelemetryThoughts
        : [];

      if (!thoughts.length) {
        container.classList.add('empty');
        container.textContent = 'No telemetry thoughts yet.';
        return;
      }

      container.classList.remove('empty');
      const fragment = document.createDocumentFragment();

      thoughts.forEach((thought) => {
        if (!thought || !thought.text) return;
        const entry = document.createElement('div');
        entry.className = 'research-telemetry-thought';

        const timestamp = Number.isFinite(thought.timestamp) ? thought.timestamp : Date.now();
        const readableTime = typeof this.formatSuggestionTimestamp === 'function'
          ? this.formatSuggestionTimestamp(timestamp)
          : new Date(timestamp).toLocaleTimeString();
        const timeEl = document.createElement('time');
        timeEl.dateTime = new Date(timestamp).toISOString();
        timeEl.textContent = readableTime;
        entry.appendChild(timeEl);

        const textEl = document.createElement('span');
        textEl.textContent = thought.text;
        entry.appendChild(textEl);

        if (thought.stage || thought.source) {
          const meta = document.createElement('small');
          meta.className = 'research-telemetry-thought-meta';
          const parts = [];
          if (thought.stage) parts.push(this.formatResearchStage ? this.formatResearchStage(thought.stage) : thought.stage);
          if (thought.source) parts.push(thought.source);
          meta.textContent = parts.join(' • ');
          entry.appendChild(meta);
        }

        fragment.appendChild(entry);
      });

      container.replaceChildren(fragment);
    },

    renderResearchTelemetryMemory() {
      if (!ensureElements(this) || !this.researchTelemetryMemoryElement) {
        return;
      }

      const container = this.researchTelemetryMemoryElement;
      const summary = this.researchTelemetryMemorySummary || {};
      const items = Array.isArray(this.researchTelemetryMemoryItems)
        ? this.researchTelemetryMemoryItems
        : [];

      const fragment = document.createDocumentFragment();

      if (summary && (summary.query || summary.statsText)) {
        const summaryEl = document.createElement('div');
        summaryEl.className = 'research-telemetry-memory-summary';
        if (summary.query) {
          const queryEl = document.createElement('strong');
          queryEl.textContent = `Query: ${summary.query}`;
          summaryEl.appendChild(queryEl);
        }
        if (summary.statsText) {
          const statsEl = document.createElement('span');
          statsEl.textContent = summary.statsText;
          summaryEl.appendChild(statsEl);
        }
        fragment.appendChild(summaryEl);
      }

      if (!items.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'research-telemetry-memory-empty';
        emptyEl.textContent = 'No memory context received yet.';
        fragment.appendChild(emptyEl);
        container.replaceChildren(fragment);
        return;
      }

      const listEl = document.createElement('div');
      listEl.className = 'research-telemetry-memory-list';

      items.forEach((record) => {
        if (!record || !record.preview) return;
        const itemEl = document.createElement('div');
        itemEl.className = 'research-telemetry-memory-item';

        const headerEl = document.createElement('div');
        headerEl.className = 'research-telemetry-memory-item-header';
        if (record.layer) {
          const layerEl = document.createElement('span');
          layerEl.className = 'research-telemetry-memory-item-layer';
          layerEl.textContent = record.layer;
          headerEl.appendChild(layerEl);
        }
        if (record.score !== null && record.score !== undefined) {
          const scoreEl = document.createElement('span');
          scoreEl.className = 'research-telemetry-memory-item-score';
          const scoreText = typeof this.formatMemoryScore === 'function'
            ? this.formatMemoryScore(record.score)
            : `${Math.round(Number(record.score) * 100)}% match`;
          scoreEl.textContent = scoreText;
          headerEl.appendChild(scoreEl);
        }
        itemEl.appendChild(headerEl);

        const previewEl = document.createElement('div');
        previewEl.className = 'research-telemetry-memory-item-preview';
        previewEl.textContent = record.preview;
        itemEl.appendChild(previewEl);

        if (record.source || record.timestamp) {
          const sourceEl = document.createElement('div');
          sourceEl.className = 'research-telemetry-memory-item-source';
          const parts = [];
          if (record.source) parts.push(record.source);
          if (record.timestamp) {
            const ts = typeof this.formatSuggestionTimestamp === 'function'
              ? this.formatSuggestionTimestamp(record.timestamp)
              : new Date(record.timestamp).toLocaleString();
            if (ts) parts.push(ts);
          }
          sourceEl.textContent = parts.join(' • ');
          itemEl.appendChild(sourceEl);
        }

        if (record.tags && record.tags.length) {
          const tagsEl = document.createElement('div');
          tagsEl.className = 'research-telemetry-memory-item-tags';
          record.tags.forEach((tag) => {
            const tagEl = document.createElement('span');
            tagEl.textContent = tag;
            tagsEl.appendChild(tagEl);
          });
          itemEl.appendChild(tagsEl);
        }

        listEl.appendChild(itemEl);
      });

      fragment.appendChild(listEl);
      container.replaceChildren(fragment);
    },

    renderResearchTelemetrySuggestions() {
      if (!ensureElements(this) || !this.researchTelemetrySuggestionsElement) {
        return;
      }

      const container = this.researchTelemetrySuggestionsElement;
      const meta = this.researchTelemetrySuggestionsMeta || {};
      const suggestions = Array.isArray(this.researchTelemetrySuggestions)
        ? this.researchTelemetrySuggestions
        : [];

      const fragment = document.createDocumentFragment();

      const headerEl = document.createElement('div');
      headerEl.className = 'research-telemetry-suggestions-header';
      const sourceLabel = typeof this.formatSuggestionSource === 'function'
        ? this.formatSuggestionSource(meta.source)
        : (meta.source || 'Memory');
      const generatedLabel = meta.generatedAt
        ? (typeof this.formatSuggestionTimestamp === 'function'
          ? this.formatSuggestionTimestamp(meta.generatedAt)
          : new Date(meta.generatedAt).toLocaleTimeString())
        : null;
      const headerParts = [`Suggestions (${suggestions.length})`, `Source: ${sourceLabel}`];
      if (generatedLabel) headerParts.push(generatedLabel);
      headerEl.textContent = headerParts.join(' • ');
      fragment.appendChild(headerEl);

      if (!suggestions.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'research-telemetry-suggestions-empty';
        emptyEl.textContent = 'No suggestions generated yet.';
        fragment.appendChild(emptyEl);
        container.replaceChildren(fragment);
        return;
      }

      const listEl = document.createElement('div');
      listEl.className = 'research-telemetry-suggestions-list';

      suggestions.forEach((entry) => {
        if (!entry || !entry.prompt) return;
        const itemEl = document.createElement('div');
        itemEl.className = 'research-telemetry-suggestion-item';

        const promptEl = document.createElement('div');
        promptEl.className = 'research-telemetry-suggestion-prompt';
        promptEl.textContent = entry.prompt;
        itemEl.appendChild(promptEl);

        const metaParts = [];
        if (entry.focus) metaParts.push(`Focus: ${entry.focus}`);
        if (entry.score !== null && entry.score !== undefined) {
          const scoreText = typeof this.formatSuggestionScore === 'function'
            ? this.formatSuggestionScore(entry.score)
            : `Score: ${Math.round(Number(entry.score) * 100)}%`;
          if (scoreText) metaParts.push(scoreText);
        }
        if (entry.tags && entry.tags.length) {
          metaParts.push(`Tags: ${entry.tags.join(', ')}`);
        }
        if (metaParts.length) {
          const metaEl = document.createElement('div');
          metaEl.className = 'research-telemetry-suggestion-meta';
          metaEl.textContent = metaParts.join(' • ');
          itemEl.appendChild(metaEl);
        }

        if (entry.memoryId || entry.layer) {
          const memoryEl = document.createElement('div');
          memoryEl.className = 'research-telemetry-suggestion-memory';
          const pieces = [];
          if (entry.memoryId) pieces.push(`Memory ${entry.memoryId}`);
          if (entry.layer) pieces.push(`Layer: ${entry.layer}`);
          memoryEl.textContent = pieces.join(' • ');
          itemEl.appendChild(memoryEl);
        }

        listEl.appendChild(itemEl);
      });

      fragment.appendChild(listEl);
      container.replaceChildren(fragment);
    },

    addResearchTelemetryThought(thought) {
      if (!thought || !thought.text) {
        return;
      }
      if (!Array.isArray(this.researchTelemetryThoughts)) {
        this.researchTelemetryThoughts = [];
      }
      this.researchTelemetryThoughts.unshift({
        text: thought.text.trim(),
        stage: thought.stage || null,
        source: thought.source || null,
        timestamp: Number.isFinite(thought.timestamp) ? thought.timestamp : Date.now(),
      });
      const limit = this.researchTelemetryLimits?.thoughts ?? 8;
      if (this.researchTelemetryThoughts.length > limit) {
        this.researchTelemetryThoughts.length = limit;
      }
      this.renderResearchTelemetryThoughts();
    },

    updateResearchMemoryContext(payload) {
      const normalized = this.normalizeResearchMemoryPayload(payload);
      this.researchTelemetryMemorySummary = normalized.summary;
      this.researchTelemetryMemoryItems = normalized.records;
      this.renderResearchTelemetryMemory();
    },

    updateResearchSuggestions(payload) {
      const normalized = this.normalizeResearchSuggestionsPayload(payload);
      this.researchTelemetrySuggestionsMeta = normalized.meta;
      this.researchTelemetrySuggestions = normalized.suggestions;
      this.renderResearchTelemetrySuggestions();
    },

    normalizeResearchMemoryPayload(payload = {}) {
      const query = typeof payload.query === 'string' && payload.query.trim()
        ? payload.query.trim()
        : null;
      const stats = payload.stats && typeof payload.stats === 'object'
        ? {
            stored: this.coerceCount ? this.coerceCount(payload.stats.stored) : Number(payload.stats.stored) || 0,
            retrieved: this.coerceCount ? this.coerceCount(payload.stats.retrieved) : Number(payload.stats.retrieved) || 0,
            validated: this.coerceCount ? this.coerceCount(payload.stats.validated) : Number(payload.stats.validated) || 0,
          }
        : null;
      const statsParts = [];
      if (stats) {
        if (stats.retrieved) statsParts.push(`Retrieved ${stats.retrieved}`);
        if (stats.validated) statsParts.push(`Validated ${stats.validated}`);
        if (stats.stored) statsParts.push(`Stored ${stats.stored}`);
      }

      const records = Array.isArray(payload.records)
        ? payload.records
            .map((record) => this.normalizeResearchMemoryRecord(record))
            .filter(Boolean)
        : [];
      const limit = this.researchTelemetryLimits?.memoryRecords ?? 6;
      if (records.length > limit) {
        records.length = limit;
      }

      return {
        summary: {
          query,
          stats,
          statsText: statsParts.join(' • ') || null,
        },
        records,
      };
    },

    normalizeResearchMemoryRecord(record = {}) {
      const previewSource = typeof record.preview === 'string' && record.preview.trim()
        ? record.preview.trim()
        : (typeof record.content === 'string' && record.content.trim() ? record.content.trim() : null);
      if (!previewSource) {
        return null;
      }

      const tags = Array.isArray(record.tags)
        ? record.tags
            .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
            .filter(Boolean)
            .slice(0, 5)
        : [];

      const score = Number.isFinite(record.score)
        ? Number(record.score)
        : (Number.isFinite(Number(record.score)) ? Number(record.score) : null);
      const timestamp = Number.isFinite(record.timestamp)
        ? Number(record.timestamp)
        : (Number.isFinite(Date.parse(record.timestamp)) ? Date.parse(record.timestamp) : null);

      return {
        id: record.id ? String(record.id).slice(0, 80) : null,
        layer: record.layer ? String(record.layer) : 'Memory',
        preview: previewSource.length > 260 ? `${previewSource.slice(0, 259)}…` : previewSource,
        tags,
        source: record.source ? String(record.source) : null,
        score,
        timestamp,
      };
    },

    normalizeResearchSuggestionsPayload(payload = {}) {
      const meta = {
        source: typeof payload.source === 'string' && payload.source.trim()
          ? payload.source.trim().toLowerCase()
          : 'memory',
        generatedAt: Number.isFinite(payload.generatedAt)
          ? Number(payload.generatedAt)
          : Date.now(),
      };

      const rawSuggestions = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload.suggestions) ? payload.suggestions : []);

      const limit = this.researchTelemetryLimits?.suggestions ?? 6;
      const suggestions = rawSuggestions
        .map((entry) => this.normalizeResearchSuggestion(entry))
        .filter(Boolean)
        .slice(0, limit);

      return { meta, suggestions };
    },

    normalizeResearchSuggestion(entry = {}) {
      const prompt = typeof entry.prompt === 'string' && entry.prompt.trim()
        ? entry.prompt.trim()
        : null;
      if (!prompt) {
        return null;
      }

      const focus = typeof entry.focus === 'string' && entry.focus.trim()
        ? entry.focus.trim()
        : null;
      const layer = typeof entry.layer === 'string' && entry.layer.trim()
        ? entry.layer.trim()
        : (entry.layer !== undefined && entry.layer !== null ? String(entry.layer) : null);
      const memoryId = entry.memoryId !== undefined && entry.memoryId !== null
        ? String(entry.memoryId).slice(0, 80)
        : null;
      const tags = Array.isArray(entry.tags)
        ? entry.tags
            .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
            .filter(Boolean)
            .slice(0, 5)
        : [];
      const score = this.coerceSuggestionScore
        ? this.coerceSuggestionScore(entry.score)
        : (Number.isFinite(entry.score) ? Number(entry.score) : null);

      return {
        prompt,
        focus,
        layer,
        memoryId,
        tags,
        score,
      };
    },
  });
})(window);
