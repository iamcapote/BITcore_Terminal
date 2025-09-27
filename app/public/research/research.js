const MAX_THOUGHTS = 7;
const MAX_RECENT_REPORTS = 10;
const MAX_SUGGESTIONS = 6;
const FALLBACK_SUMMARY = 'No research has completed yet. Launch a mission from the terminal to populate this dashboard.';

const telemetryState = {
  connection: { connected: false, reason: 'Not connected' },
  stage: 'Idle',
  message: 'Waiting for telemetry…',
  detail: null,
  progress: {
    percent: 0,
    completed: 0,
    total: 0,
    depth: null,
    breadth: null
  },
  thoughts: [],
  memory: {
    stats: null,
    records: [],
    uniqueLayers: new Set(),
    uniqueTags: new Set()
  },
  reports: [],
  completedRuns: 0,
  latestSummary: FALLBACK_SUMMARY,
  latestFilename: null,
  suggestions: {
    source: 'memory',
    generatedAt: null,
    items: []
  }
};

const promptState = {
  items: [],
  loading: false,
  error: null,
  searchTerm: '',
  limit: 60,
  debounceId: null
};

const githubState = {
  verifying: false,
  verified: false,
  error: null,
  repo: null,
  branch: null,
  basePath: null,
  currentPath: '',
  entries: [],
  selected: null,
  editorActive: false,
  pendingSave: false,
  loadingDirectory: false,
  loadingMessage: 'Loading…',
  audit: []
};

const els = {};

function captureElements() {
  Object.assign(els, {
    connection: document.getElementById('telemetry-connection'),
    stage: document.getElementById('telemetry-stage'),
    message: document.getElementById('telemetry-message'),
    detail: document.getElementById('telemetry-detail'),
    progressFill: document.getElementById('telemetry-progress-fill'),
    progressPercent: document.getElementById('telemetry-progress-percent'),
    progressCount: document.getElementById('telemetry-progress-count'),
    depth: document.getElementById('telemetry-depth'),
    breadth: document.getElementById('telemetry-breadth'),
    thoughts: document.getElementById('telemetry-thoughts'),
    memorySummary: document.getElementById('telemetry-memory-summary'),
    memoryList: document.getElementById('telemetry-memory-records'),
    suggestionsMeta: document.getElementById('telemetry-suggestions-meta'),
    suggestionsList: document.getElementById('telemetry-suggestions-list'),
    promptList: document.getElementById('prompt-selector-list'),
    promptSearch: document.getElementById('prompt-search-input'),
    promptRefreshBtn: document.getElementById('prompt-refresh-btn'),
    promptStatus: document.getElementById('prompt-status'),
    promptLibraryLink: document.getElementById('prompt-library-link'),
    summaryText: document.getElementById('telemetry-summary-text'),
    summaryMeta: document.getElementById('telemetry-summary-meta'),
    summaryFilename: document.getElementById('telemetry-summary-filename'),
    statsDocs: document.getElementById('stat-docs'),
    statsCategories: document.getElementById('stat-categories'),
    statsTags: document.getElementById('stat-tags'),
    recentReports: document.getElementById('recent-report-feed'),
    githubTree: document.getElementById('research-tree-all'),
    githubCategory: document.getElementById('research-tree-category'),
    githubTags: document.getElementById('research-tree-tags'),
    githubStatus: document.getElementById('github-sync-status'),
    githubPath: document.getElementById('github-path'),
    githubActivity: document.getElementById('github-activity-log'),
    githubRefresh: document.getElementById('github-refresh'),
    githubRoot: document.getElementById('github-root'),
    documentViewer: document.getElementById('document-viewer'),
    documentTitle: document.getElementById('markdown-title'),
    documentCategories: document.getElementById('document-categories'),
    documentTags: document.getElementById('document-tags'),
    documentContent: document.getElementById('markdown-content'),
    documentEdit: document.getElementById('document-edit'),
    documentSave: document.getElementById('document-save'),
    documentClose: document.getElementById('document-close')
  });
}

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

function renderStatus() {
  if (!els.stage || !els.message) return;
  els.stage.textContent = telemetryState.stage;
  els.message.textContent = telemetryState.message;
  if (els.detail) {
    if (telemetryState.detail) {
      els.detail.textContent = telemetryState.detail;
      els.detail.classList.remove('hidden');
    } else {
      els.detail.textContent = '';
      els.detail.classList.add('hidden');
    }
  }
}

function renderProgress() {
  if (!els.progressFill) return;
  const { percent, completed, total, depth, breadth } = telemetryState.progress;
  els.progressFill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
  els.progressPercent.textContent = Number.isFinite(percent) ? `${percent}%` : '0%';
  els.progressCount.textContent = `${completed}/${total}`;
  els.depth.textContent = depth !== null ? `Depth: ${depth}` : 'Depth: —';
  els.breadth.textContent = breadth !== null ? `Breadth: ${breadth}` : 'Breadth: —';
}

function renderThoughts() {
  if (!els.thoughts) return;
  els.thoughts.innerHTML = '';

  if (!telemetryState.thoughts.length) {
    const empty = document.createElement('li');
    empty.className = 'telemetry-empty';
    empty.textContent = 'No thoughts received yet.';
    els.thoughts.appendChild(empty);
    return;
  }

  telemetryState.thoughts.forEach((thought) => {
    const item = document.createElement('li');
    item.className = 'telemetry-thought';

    const stage = document.createElement('span');
    stage.className = 'telemetry-thought-stage';
    stage.textContent = thought.stage ? `[${thought.stage}]` : '[thought]';

    const text = document.createElement('span');
    text.className = 'telemetry-thought-text';
    text.textContent = thought.text;

    item.append(stage, text);
    els.thoughts.appendChild(item);
  });
}

function renderMemory() {
  if (!els.memorySummary || !els.memoryList) return;

  const { stats, records } = telemetryState.memory;
  if (stats) {
    const parts = [];
    if (Number.isFinite(stats.stored)) parts.push(`Stored: ${stats.stored}`);
    if (Number.isFinite(stats.retrieved)) parts.push(`Retrieved: ${stats.retrieved}`);
    if (Number.isFinite(stats.summarized)) parts.push(`Summaries: ${stats.summarized}`);
    if (Number.isFinite(stats.validated)) parts.push(`Validated: ${stats.validated}`);
    els.memorySummary.textContent = parts.length ? parts.join(' • ') : 'Memory stats available.';
  } else {
    els.memorySummary.textContent = 'No memory context yet.';
  }

  els.memoryList.innerHTML = '';
  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'telemetry-empty';
    empty.textContent = 'Awaiting memory samples linked to this research run.';
    els.memoryList.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'memory-record-card';

    const header = document.createElement('header');
    header.className = 'memory-record-header';

    const layer = document.createElement('span');
    layer.className = 'memory-layer-chip';
    layer.textContent = record.layer || 'memory';

    header.appendChild(layer);

    if (record.score !== null) {
      const score = document.createElement('span');
      score.className = 'memory-score';
      score.textContent = `Score: ${(record.score * 100).toFixed(0)}%`;
      header.appendChild(score);
    }

    if (record.timestamp) {
      const timestamp = document.createElement('time');
      timestamp.className = 'memory-timestamp';
      timestamp.dateTime = new Date(record.timestamp).toISOString();
      timestamp.textContent = formatRelativeTime(record.timestamp);
      header.appendChild(timestamp);
    }

    const preview = document.createElement('p');
    preview.className = 'memory-record-preview';
    preview.textContent = record.preview;

    const tags = document.createElement('div');
    tags.className = 'memory-record-tags';
    if (record.tags.length) {
      record.tags.forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'memory-tag-chip';
        chip.textContent = tag;
        tags.appendChild(chip);
      });
    }

    const footer = document.createElement('footer');
    footer.className = 'memory-record-footer';
    if (record.source) {
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'memory-source';
      link.textContent = record.source;
      link.title = record.source;
      link.addEventListener('click', (event) => {
        event.preventDefault();
      });
      footer.appendChild(link);
    }
    if (record.id) {
      const id = document.createElement('span');
      id.className = 'memory-record-id';
      id.textContent = record.id;
      footer.appendChild(id);
    }

    card.append(header, preview);
    if (record.tags.length) card.appendChild(tags);
    if (footer.childNodes.length) card.appendChild(footer);
    els.memoryList.appendChild(card);
  });
}

function renderSuggestions() {
  if (!els.suggestionsList || !els.suggestionsMeta) return;

  const items = Array.isArray(telemetryState.suggestions.items)
    ? telemetryState.suggestions.items
    : [];
  const sourceLabel = formatSuggestionSource(telemetryState.suggestions.source);
  const generatedAt = telemetryState.suggestions.generatedAt;

  const metaParts = [];
  if (sourceLabel) metaParts.push(`Source: ${sourceLabel}`);
  if (Number.isFinite(generatedAt)) metaParts.push(`Updated ${formatRelativeTime(generatedAt)}`);

  if (metaParts.length) {
    els.suggestionsMeta.textContent = metaParts.join(' • ');
  } else {
    els.suggestionsMeta.textContent = 'Suggestions will appear once memory intelligence is available.';
  }

  els.suggestionsList.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'telemetry-empty';
    empty.textContent = 'Waiting for memory to surface relevant follow-up prompts.';
    els.suggestionsList.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const entry = document.createElement('li');
    entry.className = 'telemetry-suggestion';
    entry.dataset.index = index.toString();

    const prompt = document.createElement('p');
    prompt.className = 'telemetry-suggestion-prompt';
    prompt.textContent = item.prompt;
    entry.appendChild(prompt);

    const metaBits = [];
    if (item.focus) metaBits.push(`Focus: ${item.focus}`);
    if (item.layer) metaBits.push(`Layer: ${item.layer}`);
    if (typeof item.score === 'number' && Number.isFinite(item.score)) {
      metaBits.push(`Match ${Math.round(item.score * 100)}%`);
    }
    if (metaBits.length) {
      const meta = document.createElement('div');
      meta.className = 'telemetry-suggestion-meta';
      meta.textContent = metaBits.join(' • ');
      entry.appendChild(meta);
    }

    if (item.tags && item.tags.length) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'telemetry-suggestion-tags';
      item.tags.forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'telemetry-suggestion-tag';
        chip.textContent = tag;
        tagsContainer.appendChild(chip);
      });
      entry.appendChild(tagsContainer);
    }

    const footer = document.createElement('div');
    footer.className = 'telemetry-suggestion-footer';

    if (item.memoryId) {
      const id = document.createElement('span');
      id.className = 'telemetry-suggestion-id';
      id.textContent = item.memoryId;
      footer.appendChild(id);
    }

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'telemetry-suggestion-action';
    copyButton.dataset.action = 'copy';
    copyButton.dataset.index = index.toString();
    copyButton.dataset.restoreLabel = 'Copy prompt';
    copyButton.textContent = 'Copy prompt';
    footer.appendChild(copyButton);

    entry.appendChild(footer);
    els.suggestionsList.appendChild(entry);
  });
}

function initializePromptSelectors() {
  if (!els.promptList) return;

  if (els.promptList && !els.promptList.dataset.bound) {
    els.promptList.addEventListener('click', handlePromptSelectorClick);
    els.promptList.dataset.bound = 'true';
  }

  if (els.promptSearch && !els.promptSearch.dataset.bound) {
    els.promptSearch.addEventListener('input', handlePromptSearchInput);
    els.promptSearch.dataset.bound = 'true';
  }

  if (els.promptRefreshBtn && !els.promptRefreshBtn.dataset.bound) {
    els.promptRefreshBtn.addEventListener('click', () => {
      loadPromptSelectors({ announce: true, force: true });
    });
    els.promptRefreshBtn.dataset.bound = 'true';
  }

  loadPromptSelectors({ announce: true });
}

function handlePromptSearchInput(event) {
  const value = event?.currentTarget?.value ?? '';
  promptState.searchTerm = value.trim();
  if (promptState.debounceId) {
    window.clearTimeout(promptState.debounceId);
  }
  promptState.debounceId = window.setTimeout(() => {
    loadPromptSelectors({ announce: false });
  }, 240);
}

async function loadPromptSelectors({ announce = false, force = false } = {}) {
  if (!els.promptList) return;

  if (promptState.loading && !force) return;

  promptState.loading = true;
  promptState.error = null;
  renderPromptSelectorList();
  if (announce) {
    setPromptStatus('Loading prompts…', 'info');
  }

  try {
    const params = new URLSearchParams({ includeBody: 'true', limit: String(promptState.limit) });
    if (promptState.searchTerm) {
      params.set('query', promptState.searchTerm);
    }

    const response = await fetch(`/api/prompts/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to load prompts (${response.status})`);
    }

    const records = await response.json();
    promptState.items = Array.isArray(records) ? records : [];
    promptState.error = null;

    if (announce) {
      const count = promptState.items.length;
      const summary = count
        ? `${count} prompt${count === 1 ? '' : 's'} ready.`
        : 'No prompts saved yet.';
      setPromptStatus(summary, count ? 'success' : 'warn');
    } else if (!promptState.items.length) {
      setPromptStatus('No prompts matched your filters.', 'warn');
    } else {
      setPromptStatus('', 'hidden');
    }
  } catch (error) {
    promptState.items = [];
    promptState.error = error.message || 'Failed to load prompts.';
    setPromptStatus(promptState.error, 'error');
  } finally {
    promptState.loading = false;
    renderPromptSelectorList();
  }
}

function renderPromptSelectorList() {
  if (!els.promptList) return;

  els.promptList.innerHTML = '';

  const appendMessage = (message) => {
    const entry = document.createElement('li');
    entry.className = 'prompt-empty-state';
    entry.textContent = message;
    els.promptList.appendChild(entry);
  };

  if (promptState.loading) {
    appendMessage('Loading prompts…');
    return;
  }

  if (promptState.error) {
    appendMessage(promptState.error);
    return;
  }

  if (!promptState.items.length) {
    appendMessage(promptState.searchTerm
      ? 'No prompts matched your filter.'
      : 'No prompts saved yet. Create one in the prompt library.');
    return;
  }

  promptState.items.forEach((record, index) => {
    const card = document.createElement('li');
    card.className = 'prompt-card';
    if (record.id) {
      card.dataset.id = record.id;
    }

    const header = document.createElement('div');
    header.className = 'prompt-card-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'prompt-card-title';

    const title = document.createElement('h3');
    title.textContent = record.title || record.name || record.id || 'Untitled prompt';
    titleGroup.appendChild(title);

    const metaDetails = [];
    if (record.id) metaDetails.push(`#${record.id}`);
    const version = Number.isFinite(record.version) ? record.version : Number.isFinite(record.meta?.version) ? record.meta.version : null;
    if (version !== null) metaDetails.push(`v${version}`);
    const updatedTimestamp = coerceTimestamp(record.updatedAt ?? record.updated_at ?? record.updated ?? record.modifiedAt ?? record.modified_at);
    const createdTimestamp = coerceTimestamp(record.createdAt ?? record.created_at ?? record.created);
    const referenceTime = updatedTimestamp || createdTimestamp;
    if (referenceTime) {
      metaDetails.push(`Updated ${formatRelativeTime(referenceTime)}`);
    }
    if (!metaDetails.length && record.category) {
      metaDetails.push(record.category);
    }

    if (metaDetails.length) {
      const meta = document.createElement('span');
      meta.className = 'prompt-card-meta';
      meta.textContent = metaDetails.join(' • ');
      titleGroup.appendChild(meta);
    }

    header.appendChild(titleGroup);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'prompt-card-copy-btn';
    copyButton.dataset.action = 'copy';
    copyButton.dataset.index = index.toString();
    copyButton.dataset.restoreLabel = 'Copy prompt';
    copyButton.textContent = 'Copy prompt';
    header.appendChild(copyButton);

    card.appendChild(header);

    if (record.description) {
      const description = document.createElement('p');
      description.className = 'prompt-card-description';
      description.textContent = record.description;
      card.appendChild(description);
    }

    if (record.body) {
      const body = document.createElement('div');
      body.className = 'prompt-card-body';
      body.textContent = truncateText(record.body, 520);
      card.appendChild(body);
    }

    if (Array.isArray(record.tags) && record.tags.length) {
      const tagsWrapper = document.createElement('div');
      tagsWrapper.className = 'prompt-card-tags';
      record.tags.forEach((tag) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'prompt-card-tag';
        chip.dataset.action = 'filter-tag';
        chip.dataset.value = tag;
        chip.textContent = tag;
        tagsWrapper.appendChild(chip);
      });
      card.appendChild(tagsWrapper);
    }

    els.promptList.appendChild(card);
  });
}

function handlePromptSelectorClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  if (action === 'copy') {
    const index = Number.parseInt(target.dataset.index, 10);
    if (!Number.isInteger(index)) return;
    const record = promptState.items[index];
    if (!record || !record.body) return;
    copyTextToClipboard(record.body, target, {
      restoreLabel: target.dataset.restoreLabel || target.textContent || 'Copy',
      successLabel: 'Copied!',
      failureLabel: 'Copy failed'
    }).catch((error) => {
      console.error('Failed to copy prompt body.', error);
    });
    return;
  }

  if (action === 'filter-tag') {
    const value = target.dataset.value;
    if (!value) return;
    promptState.searchTerm = value;
    if (els.promptSearch) {
      els.promptSearch.value = value;
    }
    loadPromptSelectors({ announce: true, force: true });
  }
}

function setPromptStatus(message, tone = 'info') {
  if (!els.promptStatus) return;
  const normalizedTone = tone || 'info';
  const isHidden = normalizedTone === 'hidden' || !message;
  els.promptStatus.textContent = isHidden ? '' : message;
  els.promptStatus.dataset.tone = normalizedTone;
  const toneClass = isHidden ? 'prompt-status-hidden' : `prompt-status-${normalizedTone}`;
  els.promptStatus.className = `prompt-status-banner ${toneClass}`;
}

function handleSuggestionClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.dataset.action !== 'copy') return;

  const index = Number.parseInt(trigger.dataset.index, 10);
  if (!Number.isInteger(index)) return;

  const suggestion = telemetryState.suggestions.items?.[index];
  if (!suggestion || !suggestion.prompt) return;

  copyTextToClipboard(suggestion.prompt, trigger, {
    restoreLabel: trigger.dataset.restoreLabel || trigger.textContent || 'Copy prompt',
    successLabel: 'Copied!',
    failureLabel: 'Copy failed'
  }).catch((error) => {
    console.error('Failed to copy memory suggestion.', error);
  });
}

async function copyTextToClipboard(text, button, {
  restoreLabel,
  successLabel = 'Copied!',
  failureLabel = 'Copy failed',
  durationMs = 1400
} = {}) {
  if (typeof text !== 'string' || !text.trim()) return;

  const originalLabel = restoreLabel ?? button?.dataset?.restoreLabel ?? button?.textContent;
  const finalText = text.trim();

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(finalText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = finalText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (button) {
      button.disabled = true;
      button.textContent = successLabel;
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel || restoreLabel || 'Copy';
      }, durationMs);
    }
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = failureLabel;
      window.setTimeout(() => {
        button.textContent = originalLabel || restoreLabel || 'Copy';
      }, durationMs + 200);
    }
    throw error;
  }
}

function renderSummary() {
  if (!els.summaryText) return;
  els.summaryText.textContent = telemetryState.latestSummary || FALLBACK_SUMMARY;
  if (els.summaryFilename) {
    els.summaryFilename.textContent = telemetryState.latestFilename ? telemetryState.latestFilename : '—';
  }
  if (els.summaryMeta) {
    els.summaryMeta.textContent = `Reports completed: ${telemetryState.completedRuns}`;
  }
}

function renderStats() {
  if (!els.statsDocs) return;
  els.statsDocs.textContent = telemetryState.completedRuns;
  const layerCount = telemetryState.memory.uniqueLayers instanceof Set
    ? telemetryState.memory.uniqueLayers.size
    : Array.isArray(telemetryState.memory.uniqueLayers)
      ? telemetryState.memory.uniqueLayers.length
      : 0;
  const tagCount = telemetryState.memory.uniqueTags instanceof Set
    ? telemetryState.memory.uniqueTags.size
    : Array.isArray(telemetryState.memory.uniqueTags)
      ? telemetryState.memory.uniqueTags.length
      : 0;
  els.statsCategories.textContent = layerCount;
  els.statsTags.textContent = tagCount;
}

function renderRecentReports() {
  if (!els.recentReports) return;
  els.recentReports.innerHTML = '';

  if (!telemetryState.reports.length) {
    const info = document.createElement('div');
    info.className = 'telemetry-empty';
    info.textContent = 'Research completions streamed here once runs finish in the terminal.';
    els.recentReports.appendChild(info);
    return;
  }

  const fragment = document.createDocumentFragment();
  telemetryState.reports.forEach((report, index) => {
    const card = document.createElement('article');
    card.className = 'research-report-card';
    card.dataset.index = index.toString();

    const heading = document.createElement('header');
    heading.className = 'research-report-header';

    const title = document.createElement('h3');
    title.textContent = report.filename || 'Untitled Research Summary';
    heading.appendChild(title);

    if (report.timestamp) {
      const time = document.createElement('time');
      time.dateTime = new Date(report.timestamp).toISOString();
      time.textContent = formatAbsoluteTime(report.timestamp);
      heading.appendChild(time);
    }

    const summary = document.createElement('p');
    summary.className = 'research-report-summary';
    summary.textContent = report.summary;

    const meta = document.createElement('div');
    meta.className = 'research-report-meta';
    const metaParts = [];
    if (report.durationMs !== null) metaParts.push(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
    if (report.learnings !== null) metaParts.push(`Learnings: ${report.learnings}`);
    if (report.sources !== null) metaParts.push(`Sources: ${report.sources}`);
    meta.textContent = metaParts.join(' • ') || 'Awaiting detailed metrics.';

    card.append(heading, summary, meta);

    if (report.error) {
      const errorBanner = document.createElement('div');
      errorBanner.className = 'research-report-error';
      errorBanner.textContent = report.error;
      card.appendChild(errorBanner);
    }

    fragment.appendChild(card);
  });

  els.recentReports.appendChild(fragment);
}

function renderGitHubStatus(text, state = 'pending') {
  if (!els.githubStatus) return;
  els.githubStatus.textContent = text;
  els.githubStatus.classList.remove('connected', 'disconnected');
  if (state === 'connected') {
    els.githubStatus.classList.add('connected');
  } else if (state === 'error') {
    els.githubStatus.classList.add('disconnected');
  }
}

function renderGitHubPath() {
  if (!els.githubPath) return;
  const display = githubState.currentPath ? `/${githubState.currentPath}` : '/';
  els.githubPath.textContent = display;
}

function logGitHubActivity(message, level = 'info') {
  const entry = { message, level, timestamp: Date.now() };
  githubState.audit.unshift(entry);
  if (githubState.audit.length > 8) {
    githubState.audit.length = 8;
  }
  renderGitHubActivity();
}

function renderGitHubActivity() {
  if (!els.githubActivity) return;
  els.githubActivity.innerHTML = '';

  if (!githubState.audit.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'telemetry-empty';
    placeholder.textContent = 'GitHub operations will appear here.';
    els.githubActivity.appendChild(placeholder);
    return;
  }

  const fragment = document.createDocumentFragment();
  githubState.audit.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'github-activity-entry';

    const level = document.createElement('span');
    level.className = `github-activity-level level-${entry.level}`;
    level.textContent = entry.level.toUpperCase();

    const message = document.createElement('span');
    message.className = 'github-activity-message';
    message.textContent = entry.message;

    const time = document.createElement('time');
    time.className = 'github-activity-time';
    time.dateTime = new Date(entry.timestamp).toISOString();
    time.textContent = formatRelativeTime(entry.timestamp);

    item.append(level, message, time);
    fragment.appendChild(item);
  });

  els.githubActivity.appendChild(fragment);
}

function ensureBasePath(fullPath) {
  const candidate = typeof fullPath === 'string' ? fullPath : '';
  if (!githubState.basePath) {
    const segment = candidate.includes('/') ? candidate.split('/')[0] : candidate;
    githubState.basePath = segment || 'research';
  }
  return githubState.basePath;
}

function stripBasePath(pathLike) {
  if (!pathLike) return '';
  const base = ensureBasePath(pathLike);
  if (pathLike === base) return '';
  const prefix = `${base}/`;
  if (pathLike.startsWith(prefix)) {
    return pathLike.slice(prefix.length);
  }
  return pathLike;
}

function renderGitHubEntries() {
  if (!els.githubTree) return;
  els.githubTree.innerHTML = '';

  if (githubState.loadingDirectory || githubState.verifying) {
    const loading = document.createElement('div');
    loading.className = 'telemetry-empty';
    loading.textContent = githubState.loadingMessage || 'Loading…';
    els.githubTree.appendChild(loading);
    return;
  }

  if (githubState.error) {
    const error = document.createElement('div');
    error.className = 'telemetry-empty';
    error.textContent = githubState.error.message || 'Unable to load repository data.';
    els.githubTree.appendChild(error);
    return;
  }

  if (!githubState.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'telemetry-empty';
    empty.textContent = 'No files found in this directory.';
    els.githubTree.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'research-tree';

  const sorted = [...githubState.entries].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  sorted.forEach((entry) => {
    const item = document.createElement('li');
    item.className = `research-tree-item ${entry.type}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'research-tree-button';
    button.textContent = entry.type === 'dir' ? `${entry.name}/` : entry.name;
    button.addEventListener('click', () => handleGitHubEntry(entry));

    item.appendChild(button);

    if (entry.type === 'file' && Number.isFinite(entry.size)) {
      const size = document.createElement('span');
      size.className = 'research-tree-meta';
      const kb = Math.max(1, Math.round(entry.size / 1024));
      size.textContent = `${kb} KB`;
      item.appendChild(size);
    }

    list.appendChild(item);
  });

  els.githubTree.appendChild(list);
}

function renderGitHubCategoryView() {
  if (!els.githubCategory) return;
  els.githubCategory.innerHTML = '';

  if (githubState.currentPath) {
    const info = document.createElement('div');
    info.className = 'telemetry-empty';
    info.textContent = 'Categories are available from the root directory.';
    els.githubCategory.appendChild(info);
    return;
  }

  const directories = githubState.entries.filter((entry) => entry.type === 'dir');
  if (!directories.length) {
    const info = document.createElement('div');
    info.className = 'telemetry-empty';
    info.textContent = 'No categories detected yet.';
    els.githubCategory.appendChild(info);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'research-category-list';
  directories.forEach((dir) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'research-tree-button';
    button.textContent = dir.name;
    button.addEventListener('click', () => handleGitHubEntry(dir));
    item.appendChild(button);
    list.appendChild(item);
  });
  els.githubCategory.appendChild(list);
}

function renderGitHubTagsView() {
  if (!els.githubTags) return;
  els.githubTags.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'telemetry-empty';
  info.textContent = 'Tag insights will appear once documents include metadata.';
  els.githubTags.appendChild(info);
}

function handleGitHubEntry(entry) {
  if (!entry) return;
  if (entry.type === 'dir') {
    loadGitHubDirectory(entry.relativePath);
  } else {
    loadGitHubFile(entry.relativePath);
  }
}

async function verifyGitHubConnection() {
  githubState.verifying = true;
  renderGitHubStatus('Verifying…');
  try {
    const response = await fetch('/api/research/github/verify', { credentials: 'include' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'GitHub verification failed');
    }
    const data = await response.json();
    githubState.verified = true;
    githubState.repo = data.repository || null;
    githubState.branch = data.branch || null;
    githubState.error = null;
    renderGitHubStatus('Connected', 'connected');
    logGitHubActivity(`Verified ${data.config.owner}/${data.config.repo} on branch ${data.config.branch}`);
  } catch (error) {
    githubState.verified = false;
    githubState.error = error;
    renderGitHubStatus(error.message || 'GitHub unavailable', 'error');
    logGitHubActivity(`Verification failed: ${error.message}`, 'error');
    throw error;
  } finally {
    githubState.verifying = false;
  }
}

async function loadGitHubDirectory(path = '') {
  githubState.loadingDirectory = true;
  githubState.loadingMessage = path ? `Loading ${path}…` : 'Loading directory…';
  renderGitHubEntries();

  const params = new URLSearchParams();
  if (path) params.set('path', path);

  try {
    const response = await fetch(`/api/research/github/files?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to load directory');
    }

    const data = await response.json();
    ensureBasePath(data.path || path || '');
    githubState.currentPath = stripBasePath(data.path || '');
    githubState.entries = (data.entries || []).map((entry) => ({
      ...entry,
      relativePath: stripBasePath(entry.path || entry.name || ''),
      name: entry.name || entry.path?.split('/').pop() || 'untitled'
    }));
    githubState.error = null;

    renderGitHubEntries();
    renderGitHubPath();
    renderGitHubCategoryView();
    renderGitHubTagsView();
    logGitHubActivity(`Loaded ${githubState.currentPath || '/'} directory`);
  } catch (error) {
    githubState.error = error;
    renderGitHubEntries();
    renderGitHubStatus(error.message || 'GitHub unavailable', 'error');
    logGitHubActivity(`Directory load failed: ${error.message}`, 'error');
  } finally {
    githubState.loadingDirectory = false;
  }
}

async function loadGitHubFile(path) {
  if (!path) return;
  renderGitHubStatus('Loading file…');
  logGitHubActivity(`Fetching ${path}`);

  const params = new URLSearchParams({ path });
  try {
    const response = await fetch(`/api/research/github/file?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to load file');
    }

    const file = await response.json();
    const relativePath = stripBasePath(file.path || path);
    const name = relativePath.split('/').pop() || relativePath;
    githubState.selected = {
      path: relativePath,
      name,
      sha: file.sha || null,
      size: file.size || null,
      ref: file.ref || null,
      content: file.content || ''
    };
    githubState.error = null;

    renderDocumentViewer(githubState.selected);
    renderGitHubStatus('Connected', 'connected');
    logGitHubActivity(`Loaded ${relativePath}`);
  } catch (error) {
    githubState.error = error;
    renderGitHubStatus(error.message || 'GitHub unavailable', 'error');
    logGitHubActivity(`File load failed: ${error.message}`, 'error');
  }
}

function renderDocumentViewer(file) {
  if (!file) return;
  if (els.documentViewer) {
    els.documentViewer.classList.remove('hidden');
  }
  if (els.documentTitle) {
    els.documentTitle.textContent = file.name || 'Document';
  }
  if (els.documentCategories) {
    const segments = file.path ? file.path.split('/').slice(0, -1) : [];
    els.documentCategories.textContent = segments.length ? segments.join(' / ') : '—';
  }
  if (els.documentTags) {
    els.documentTags.textContent = 'Tags metadata unavailable';
  }
  exitEditMode();
  if (els.documentContent) {
    els.documentContent.textContent = file.content || '';
  }
  if (els.documentSave) {
    els.documentSave.disabled = false;
    els.documentSave.textContent = 'Save to GitHub';
  }
}

function enterEditMode() {
  if (!githubState.selected || !els.documentContent) {
    logGitHubActivity('Select a document before editing.', 'warn');
    return;
  }
  if (githubState.editorActive) return;

  const textarea = document.createElement('textarea');
  textarea.id = 'document-editor';
  textarea.className = 'document-editor';
  textarea.value = githubState.selected.content || '';
  els.documentContent.innerHTML = '';
  els.documentContent.appendChild(textarea);
  textarea.focus();

  githubState.editorActive = true;
  if (els.documentSave) {
    els.documentSave.disabled = false;
    els.documentSave.textContent = 'Save changes';
  }
  logGitHubActivity(`Editing ${githubState.selected.name}`);
}

function exitEditMode() {
  if (!els.documentContent) return;
  githubState.editorActive = false;
  const fallback = 'Select a document from the file explorer to view its contents.';
  els.documentContent.textContent = githubState.selected?.content || fallback;
  if (els.documentSave) {
    els.documentSave.textContent = 'Save to GitHub';
    els.documentSave.disabled = !githubState.selected;
  }
}

function getEditorContent() {
  if (githubState.editorActive) {
    const textarea = document.getElementById('document-editor');
    return textarea ? textarea.value : githubState.selected?.content || '';
  }
  return githubState.selected?.content || '';
}

async function saveCurrentDocument() {
  if (!githubState.selected) {
    logGitHubActivity('Select a document before saving.', 'warn');
    return;
  }
  if (githubState.pendingSave) {
    return;
  }

  const content = getEditorContent();
  if (!githubState.editorActive && content === githubState.selected.content) {
    logGitHubActivity('No changes detected; nothing to save.');
    return;
  }

  githubState.pendingSave = true;
  renderGitHubStatus('Saving…');
  if (els.documentSave) {
    els.documentSave.disabled = true;
    els.documentSave.textContent = 'Saving…';
  }
  logGitHubActivity(`Saving ${githubState.selected.name}…`);

  const payload = {
    files: [
      {
        path: githubState.selected.path,
        content
      }
    ],
    message: `Update ${githubState.selected.name}`
  };
  if (githubState.branch?.name) {
    payload.branch = githubState.branch.name;
  }

  try {
    const response = await fetch('/api/research/github/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Save failed');
    }
    const result = await response.json();
    githubState.selected.content = content;
    exitEditMode();
    if (els.documentSave) {
      els.documentSave.disabled = false;
      els.documentSave.textContent = 'Save to GitHub';
    }
    renderGitHubStatus('Connected', 'connected');
    logGitHubActivity(`Saved ${githubState.selected.name}`);
    const summary = result?.summaries?.[0];
    if (summary?.commitSha) {
      logGitHubActivity(`Commit ${summary.commitSha.slice(0, 7)} recorded`, 'info');
    }
  } catch (error) {
    renderGitHubStatus(error.message || 'Save failed', 'error');
    logGitHubActivity(`Save failed: ${error.message}`, 'error');
  } finally {
    githubState.pendingSave = false;
    if (els.documentSave) {
      els.documentSave.disabled = false;
      els.documentSave.textContent = 'Save to GitHub';
    }
  }
}

function closeDocumentViewer() {
  githubState.selected = null;
  githubState.editorActive = false;
  if (els.documentViewer) {
    els.documentViewer.classList.add('hidden');
  }
  exitEditMode();
}

function initializeGitHubDashboard() {
  renderGitHubStatus('Checking GitHub…');
  renderGitHubActivity();
  renderGitHubEntries();
  renderGitHubCategoryView();
  renderGitHubTagsView();
  renderGitHubPath();
  if (els.documentSave) {
    els.documentSave.disabled = true;
  }

  if (els.githubRefresh) {
    els.githubRefresh.addEventListener('click', () => {
      loadGitHubDirectory(githubState.currentPath);
    });
  }
  if (els.githubRoot) {
    els.githubRoot.addEventListener('click', () => {
      loadGitHubDirectory('');
    });
  }

  verifyGitHubConnection()
    .then(() => loadGitHubDirectory(''))
    .catch(() => {
      renderGitHubEntries();
    });
}

function normalizeThought(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return { text: payload, stage: 'telemetry' };
  }
  const text = payload.text || payload.message || '';
  if (!text.trim()) return null;
  return {
    text: text.trim(),
    stage: payload.stage || payload.source || 'telemetry'
  };
}

function normalizeMemoryRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const preview = typeof record.preview === 'string' && record.preview.trim()
    ? record.preview.trim()
    : typeof record.content === 'string'
      ? record.content.trim()
      : '';
  if (!preview) return null;

  const tags = Array.isArray(record.tags)
    ? record.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
    : [];

  return {
    id: record.id ? String(record.id).slice(0, 36) : null,
    layer: record.layer ? String(record.layer) : null,
    preview,
    tags,
    source: record.source || null,
    score: typeof record.score === 'number' ? Math.min(1, Math.max(0, record.score)) : null,
    timestamp: record.timestamp || null
  };
}

function formatStage(stage) {
  if (!stage) return 'In Progress';
  return stage
    .toString()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelativeTime(timestamp) {
  try {
    const now = Date.now();
    const diff = now - Number(timestamp);
    if (!Number.isFinite(diff)) return '';
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  } catch (error) {
    return '';
  }
}

function formatAbsoluteTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (error) {
    return '';
  }
}

function firstTruthyString(candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function truncateText(text, maxLength = 200) {
  if (typeof text !== 'string') {
    return '';
  }
  const trimmed = text.trim();
  if (!maxLength || trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(1, numeric));
  return Number.isNaN(clamped) ? null : clamped;
}

function coerceTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatSuggestionSource(source) {
  if (!source) return 'Memory';
  const normalized = source.toString().trim();
  if (!normalized) return 'Memory';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function handleReportSelection(event) {
  const card = event.target.closest('.research-report-card');
  if (!card) return;
  const index = Number.parseInt(card.dataset.index, 10);
  if (!Number.isInteger(index)) return;
  const report = telemetryState.reports[index];
  if (!report) return;

  if (els.documentViewer) {
    els.documentViewer.classList.remove('hidden');
  }
  if (els.documentTitle) {
    els.documentTitle.textContent = report.filename || 'Recent Research Summary';
  }
  if (els.documentCategories) {
    const duration = report.durationMs !== null ? `${(report.durationMs / 1000).toFixed(1)}s` : '—';
    els.documentCategories.textContent = `Duration • ${duration}`;
  }
  if (els.documentTags) {
    const tags = [];
    if (report.learnings !== null) tags.push(`${report.learnings} learnings`);
    if (report.sources !== null) tags.push(`${report.sources} sources`);
    els.documentTags.textContent = tags.length ? tags.join(' • ') : 'No metrics recorded yet.';
  }
  if (els.documentContent) {
    els.documentContent.textContent = report.summary;
  }
}

function wireTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
      contents.forEach((section) => {
        section.classList.toggle('active', section.id === target);
      });
    });
  });
}

function ensureWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/api/research/ws`;

  if (!window.webcomm) {
    window.webcomm = new WebComm(wsUrl);
  } else if (window.webcomm.url !== wsUrl) {
    window.webcomm.url = wsUrl;
  }
}

function connectWebSocket() {
  if (!window.webcomm) return;
  window.webcomm.registerHandler('connection', updateConnection);
  window.webcomm.registerHandler('research-status', (message) => {
    if (message?.data) updateStatus(message.data);
  });
  window.webcomm.registerHandler('research-progress', (message) => {
    if (message?.data) updateProgress(message.data);
  });
  window.webcomm.registerHandler('research-thought', (message) => {
    const payload = message?.data;
    if (!payload) return;
    if (Array.isArray(payload)) payload.forEach(appendThought);
    else appendThought(payload);
  });
  window.webcomm.registerHandler('research-memory', (message) => {
    if (message?.data) updateMemoryContext(message.data);
  });
  window.webcomm.registerHandler('research-suggestions', (message) => {
    if (message?.data) updateSuggestions(message.data);
  });
  window.webcomm.registerHandler('research-complete', (message) => {
    if (message?.data) handleResearchComplete(message.data);
  });
  window.webcomm.registerHandler('research_start', () => {
    resetForNewRun();
  });

  if (!window.webcomm.isConnected() && !window.webcomm.isConnecting) {
    window.webcomm.connect().catch((error) => {
      console.error('Failed to establish WebSocket connection', error);
    });
  }
}

function boot() {
  captureElements();
  wireTabs();
  renderStatus();
  renderProgress();
  renderThoughts();
  renderMemory();
  renderSuggestions();
  renderSummary();
  renderStats();
  renderRecentReports();

  ensureWebSocket();
  connectWebSocket();

  if (els.recentReports) {
    els.recentReports.addEventListener('click', handleReportSelection);
  }

  if (els.suggestionsList) {
    els.suggestionsList.addEventListener('click', handleSuggestionClick);
  }

  initializeGitHubDashboard();

  initializePromptSelectors();

  if (els.documentEdit) {
    els.documentEdit.addEventListener('click', () => enterEditMode());
  }
  if (els.documentSave) {
    els.documentSave.addEventListener('click', () => saveCurrentDocument());
  }
  if (els.documentClose) {
    els.documentClose.addEventListener('click', () => closeDocumentViewer());
  }
}

document.addEventListener('DOMContentLoaded', boot);
