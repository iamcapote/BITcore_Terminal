/**
 * Research Dashboard Telemetry Lifecycle
 * Why: Maintain the real-time telemetry state as WebSocket events arrive from the research engine.
 * What: Normalizes inbound payloads, mutates telemetry state, and triggers the corresponding renderers.
 * How: Exposes pure update functions that rely on shared state and rendering helpers defined in companion modules.
 */
function updateConnection(message) {
  telemetryState.connection = { connected: !!message.connected, reason: message.reason || '' };
  if (!els.connection) return;
  els.connection.textContent = message.connected ? 'Connected' : 'Disconnected';
  els.connection.classList.toggle('connected', !!message.connected);
  els.connection.classList.toggle('disconnected', !message.connected);
  els.connection.title = message.reason || '';
}

function updateStatus(payload) {
  telemetryState.stage = formatStage(payload.stage);
  telemetryState.message = payload.message || 'Working…';
  telemetryState.detail = payload.detail || null;

  if (payload.meta) {
    const depth = Number.isFinite(payload.meta.depth) ? payload.meta.depth : null;
    const breadth = Number.isFinite(payload.meta.breadth) ? payload.meta.breadth : null;
    if (depth !== null) telemetryState.progress.depth = depth;
    if (breadth !== null) telemetryState.progress.breadth = breadth;
  }

  renderStatus();
}

function updateProgress(payload) {
  const completed = Number.isFinite(payload.completed) ? payload.completed : telemetryState.progress.completed;
  const total = Number.isFinite(payload.total) ? payload.total : telemetryState.progress.total;
  let percent = payload.percentComplete;

  if (!Number.isFinite(percent) && Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
    percent = Math.min(100, Math.round((completed / total) * 100));
  }

  telemetryState.progress = {
    percent: Number.isFinite(percent) ? percent : 0,
    completed: Number.isFinite(completed) ? completed : 0,
    total: Number.isFinite(total) ? total : 0,
    depth: Number.isFinite(payload.currentDepth) ? payload.currentDepth : telemetryState.progress.depth,
    breadth: Number.isFinite(payload.currentBreadth) ? payload.currentBreadth : telemetryState.progress.breadth
  };

  renderProgress();
}

function appendThought(payload) {
  const entry = normalizeThought(payload);
  if (!entry) return;

  telemetryState.thoughts.unshift(entry);
  if (telemetryState.thoughts.length > MAX_THOUGHTS) {
    telemetryState.thoughts.length = MAX_THOUGHTS;
  }

  renderThoughts();
}

function updateMemoryContext(payload) {
  const stats = payload.stats && typeof payload.stats === 'object' ? payload.stats : null;
  const records = Array.isArray(payload.records) ? payload.records : [];
  const normalisedRecords = records
    .map(normalizeMemoryRecord)
    .filter(Boolean);

  const uniqueLayers = new Set();
  const uniqueTags = new Set();

  normalisedRecords.forEach((record) => {
    if (record.layer) uniqueLayers.add(record.layer);
    record.tags.forEach((tag) => uniqueTags.add(tag));
  });

  telemetryState.memory.stats = stats;
  telemetryState.memory.records = normalisedRecords;
  telemetryState.memory.uniqueLayers = uniqueLayers;
  telemetryState.memory.uniqueTags = uniqueTags;

  renderMemory();
  renderStats();
}

function updateSuggestions(payload) {
  const normalized = normalizeSuggestionsPayload(payload);
  telemetryState.suggestions = normalized;
  renderSuggestions();
}

function normalizeSuggestionsPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      source: 'memory',
      generatedAt: Date.now(),
      items: payload.map(normalizeSuggestionEntry).filter(Boolean).slice(0, MAX_SUGGESTIONS)
    };
  }

  const data = payload && typeof payload === 'object' ? payload : {};
  const suggestionsInput = Array.isArray(data.suggestions)
    ? data.suggestions
    : Array.isArray(data.items)
      ? data.items
      : [];

  const source = typeof data.source === 'string' && data.source.trim()
    ? data.source.trim().toLowerCase()
    : 'memory';

  const generatedAtCandidate = data.generatedAt ?? data.timestamp ?? Date.now();
  const generatedAt = coerceTimestamp(generatedAtCandidate) ?? Date.now();

  return {
    source,
    generatedAt,
    items: suggestionsInput.map(normalizeSuggestionEntry).filter(Boolean).slice(0, MAX_SUGGESTIONS)
  };
}

function normalizeSuggestionEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};

  const promptSource = firstTruthyString([entry.prompt, entry.original, metadata.prompt]);
  if (!promptSource) {
    return null;
  }
  const prompt = truncateText(promptSource, 240);

  const focusSource = firstTruthyString([entry.focus, metadata.focus]);
  const focus = focusSource ? truncateText(focusSource, 160) : null;

  const layerSource = firstTruthyString([entry.layer, metadata.layer]);
  const layer = layerSource ? layerSource.trim().slice(0, 60) : null;

  const memoryIdSource = entry.memoryId ?? metadata.memoryId ?? metadata.id ?? null;
  const memoryId = memoryIdSource ? String(memoryIdSource).slice(0, 80) : null;

  const tagsSource = Array.isArray(entry.tags)
    ? entry.tags
    : Array.isArray(metadata.tags)
      ? metadata.tags
      : [];
  const tags = tagsSource
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean)
    .slice(0, 4);

  const score = clampScore(entry.score ?? metadata.score);

  return {
    prompt,
    focus,
    layer,
    memoryId,
    tags,
    score
  };
}

function handleResearchComplete(payload) {
  if (payload.success !== false) {
    telemetryState.completedRuns += 1;
    telemetryState.latestSummary = payload.summary?.trim() || 'Research completed. Awaiting summary from provider.';
    telemetryState.latestFilename = payload.suggestedFilename || null;

    telemetryState.reports.unshift({
      id: `report-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      summary: telemetryState.latestSummary,
      filename: telemetryState.latestFilename,
      durationMs: Number.isFinite(payload.durationMs) ? payload.durationMs : null,
      sources: Number.isFinite(payload.sources) ? payload.sources : null,
      learnings: Number.isFinite(payload.learnings) ? payload.learnings : null,
      success: payload.success !== false,
      error: payload.error || null
    });

    if (telemetryState.reports.length > MAX_RECENT_REPORTS) {
      telemetryState.reports.length = MAX_RECENT_REPORTS;
    }
  } else if (payload.error) {
    telemetryState.latestSummary = `Research failed: ${payload.error}`;
    telemetryState.latestFilename = null;
  }

  renderSummary();
  renderStats();
  renderRecentReports();
}

function resetForNewRun() {
  telemetryState.stage = 'Starting';
  telemetryState.message = 'Initializing research engine…';
  telemetryState.detail = null;
  telemetryState.progress = { percent: 0, completed: 0, total: 0, depth: null, breadth: null };
  telemetryState.thoughts = [];
  telemetryState.memory.stats = null;
  telemetryState.memory.records = [];
  telemetryState.memory.uniqueLayers = new Set();
  telemetryState.memory.uniqueTags = new Set();
  telemetryState.suggestions = {
    source: 'memory',
    generatedAt: null,
    items: []
  };

  renderStatus();
  renderProgress();
  renderThoughts();
  renderMemory();
  renderSuggestions();
  renderStats();
}
