const state = {
  scheduler: null,
  missions: [],
  missionsLoading: false,
  missionsError: null,
  prompts: [],
  promptsLoading: false,
  promptsError: null,
  promptSearch: '',
  promptDebounceId: null
};

const els = {};

const relativeTimeFormatter = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  : null;

function $(id) {
  return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', () => {
  Object.assign(els, {
    schedulerStatusText: $('scheduler-status-text'),
    schedulerInterval: $('scheduler-interval'),
    schedulerLastTick: $('scheduler-last-tick'),
    schedulerActiveRuns: $('scheduler-active-runs'),
    schedulerStart: $('scheduler-start'),
    schedulerStop: $('scheduler-stop'),
    schedulerTick: $('scheduler-tick'),
    missionCount: $('mission-count'),
    missionSummary: $('mission-summary'),
    missionsStatus: $('missions-status'),
    missionList: $('mission-list'),
    missionsRefresh: $('missions-refresh'),
    promptCount: $('prompt-count'),
    promptSummary: $('prompt-summary'),
    promptsStatus: $('prompts-status'),
    promptList: $('prompt-list'),
    promptSearch: $('prompt-search'),
    promptsRefresh: $('prompts-refresh')
  });

  els.schedulerStart?.addEventListener('click', () => runSchedulerAction('/api/missions/start', 'Scheduler started.'));
  els.schedulerStop?.addEventListener('click', () => runSchedulerAction('/api/missions/stop', 'Scheduler stopped.'));
  els.schedulerTick?.addEventListener('click', () => runSchedulerAction('/api/missions/tick', 'Manual tick triggered.'));
  els.missionsRefresh?.addEventListener('click', () => loadMissions(true));
  els.promptsRefresh?.addEventListener('click', () => loadPrompts(true));
  els.promptSearch?.addEventListener('input', handlePromptSearch);
  els.missionList?.addEventListener('click', handleMissionListClick);
  els.promptList?.addEventListener('click', handlePromptListClick);

  loadSchedulerState();
  loadMissions();
  loadPrompts();
});

async function runSchedulerAction(endpoint, successMessage) {
  disableSchedulerControls(true);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const details = await readError(response);
      throw new Error(details || `${response.status} ${response.statusText}`);
    }
    announceSchedulerMessage(successMessage, 'success');
  } catch (error) {
    announceSchedulerMessage(error.message || 'Scheduler action failed.', 'error');
  } finally {
    disableSchedulerControls(false);
    await loadSchedulerState();
    await loadMissions();
  }
}

async function loadSchedulerState() {
  try {
    const response = await fetch('/api/missions/state');
    if (!response.ok) {
      throw new Error(`Failed to load scheduler state (${response.status})`);
    }
    const payload = await response.json();
    state.scheduler = payload;
    renderSchedulerState();
  } catch (error) {
    state.scheduler = null;
    announceSchedulerMessage(error.message, 'error');
    renderSchedulerState();
  }
}

function renderSchedulerState() {
  const scheduler = state.scheduler;
  const enabled = scheduler?.featureEnabled !== false;
  const schedulerEnabled = enabled && scheduler?.schedulerEnabled !== false;
  const running = Boolean(scheduler?.state?.running);

  const intervalMs = scheduler?.state?.intervalMs;
  els.schedulerInterval.textContent = Number.isFinite(intervalMs)
    ? `${Math.round(intervalMs / 1000)}s`
    : '—';

  const lastTick = scheduler?.state?.lastTickCompletedAt || scheduler?.state?.lastTickStartedAt;
  els.schedulerLastTick.textContent = lastTick ? formatRelativeTime(lastTick) : '—';
  els.schedulerActiveRuns.textContent = Number.isFinite(scheduler?.state?.activeRuns)
    ? `${scheduler.state.activeRuns}`
    : '0';

  if (!enabled) {
    announceSchedulerMessage('Mission scheduler is disabled by configuration.', 'warn');
  } else if (!schedulerEnabled) {
    announceSchedulerMessage('Scheduler HTTP controls disabled via feature flag.', 'warn');
  } else if (running) {
    announceSchedulerMessage('Scheduler is running.', 'success');
  } else {
    announceSchedulerMessage('Scheduler is stopped.', 'info');
  }

  const controlsDisabled = !enabled || !schedulerEnabled;
  els.schedulerStart.disabled = controlsDisabled || running;
  els.schedulerStop.disabled = controlsDisabled || !running;
  els.schedulerTick.disabled = controlsDisabled;
}

function disableSchedulerControls(disabled) {
  [els.schedulerStart, els.schedulerStop, els.schedulerTick].forEach((button) => {
    if (button) button.disabled = disabled;
  });
}

async function loadMissions(force = false) {
  if (state.missionsLoading && !force) {
    return;
  }
  state.missionsLoading = true;
  state.missionsError = null;
  renderMissionList();

  try {
    const response = await fetch('/api/missions');
    if (!response.ok) {
      throw new Error(`Failed to load missions (${response.status})`);
    }
    const payload = await response.json();
    state.missions = Array.isArray(payload?.missions) ? payload.missions : [];
    state.missionsError = null;
  } catch (error) {
    state.missions = [];
    state.missionsError = error.message;
  } finally {
    state.missionsLoading = false;
    renderMissionList();
    renderMissionSummary();
  }
}

function renderMissionList() {
  if (!els.missionList) return;

  els.missionList.innerHTML = '';

  if (state.missionsLoading) {
    els.missionsStatus.textContent = 'Loading missions…';
    appendEmptyState(els.missionList, 'Loading missions…');
    return;
  }

  if (state.missionsError) {
    els.missionsStatus.textContent = state.missionsError;
    appendEmptyState(els.missionList, state.missionsError);
    return;
  }

  if (!state.missions.length) {
    els.missionsStatus.textContent = 'No missions configured yet. Use the CLI to add missions from templates.';
    appendEmptyState(els.missionList, 'No missions configured.');
    return;
  }

  els.missionsStatus.textContent = `${state.missions.length} mission${state.missions.length === 1 ? '' : 's'} loaded.`;

  state.missions
    .slice()
    .sort((a, b) => (a.priority ?? 0) === (b.priority ?? 0)
      ? (Date.parse(a.nextRunAt || 0) || 0) - (Date.parse(b.nextRunAt || 0) || 0)
      : (b.priority ?? 0) - (a.priority ?? 0))
    .forEach((mission) => {
      const item = document.createElement('li');
      item.className = 'organizer-mission';
      item.dataset.id = mission.id;

      const header = document.createElement('div');
      header.className = 'organizer-mission-header';

      const title = document.createElement('h3');
      title.textContent = mission.name || mission.id;
      header.appendChild(title);

      const status = document.createElement('span');
      status.className = 'organizer-status';
      status.dataset.status = mission.status || 'unknown';
      status.textContent = formatStatus(mission.status);
      header.appendChild(status);
      item.appendChild(header);

      if (mission.description) {
        const description = document.createElement('p');
        description.className = 'organizer-mission-description';
        description.textContent = mission.description;
        item.appendChild(description);
      }

      const metaList = document.createElement('ul');
      metaList.className = 'organizer-mission-meta';

      metaList.appendChild(createMetaItem('Next Run', mission.nextRunAt ? formatRelativeTime(mission.nextRunAt) : 'Not scheduled'));
      metaList.appendChild(createMetaItem('Priority', Number.isFinite(mission.priority) ? mission.priority : '0'));
      metaList.appendChild(createMetaItem('Schedule', describeSchedule(mission.schedule)));
      if (mission.lastRunAt) {
        metaList.appendChild(createMetaItem('Last Run', formatRelativeTime(mission.lastRunAt)));
      }
      if (mission.lastRunError) {
        metaList.appendChild(createMetaItem('Last Error', mission.lastRunError));
      }
      item.appendChild(metaList);

      if (Array.isArray(mission.tags) && mission.tags.length) {
        const tagRow = document.createElement('div');
        tagRow.className = 'organizer-tag-row';
        mission.tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'organizer-tag';
          chip.textContent = tag;
          tagRow.appendChild(chip);
        });
        item.appendChild(tagRow);
      }

      const footer = document.createElement('div');
      footer.className = 'organizer-mission-footer';

      const runButton = document.createElement('button');
      runButton.type = 'button';
      runButton.className = 'memory-secondary-btn organizer-run-btn';
      runButton.dataset.action = 'run-mission';
      runButton.dataset.id = mission.id;
      runButton.textContent = 'Run Now';
      if (mission.status === 'running') {
        runButton.disabled = true;
        runButton.textContent = 'Running…';
      } else if (mission.enable === false || mission.status === 'disabled') {
        runButton.disabled = true;
        runButton.textContent = 'Disabled';
      }
      footer.appendChild(runButton);

      item.appendChild(footer);
      els.missionList.appendChild(item);
    });
}

function createMetaItem(label, value) {
  const entry = document.createElement('li');
  const term = document.createElement('span');
  term.className = 'organizer-meta-label';
  term.textContent = label;
  const val = document.createElement('span');
  val.className = 'organizer-meta-value';
  val.textContent = value;
  entry.append(term, val);
  return entry;
}

async function handleMissionListClick(event) {
  const button = event.target.closest('button[data-action="run-mission"]');
  if (!button) return;

  const missionId = button.dataset.id;
  if (!missionId) return;

  button.disabled = true;
  button.textContent = 'Running…';
  try {
    const response = await fetch('/api/missions/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId })
    });
    if (!response.ok) {
      const details = await readError(response);
      throw new Error(details || `Run failed (${response.status})`);
    }
    announceSchedulerMessage(`Mission ${missionId} dispatched.`, 'success');
  } catch (error) {
    announceSchedulerMessage(error.message || 'Failed to run mission.', 'error');
  } finally {
    await loadMissions(true);
  }
}

function renderMissionSummary() {
  const total = state.missions.length;
  const running = state.missions.filter((mission) => mission.status === 'running').length;
  const disabled = state.missions.filter((mission) => mission.status === 'disabled').length;
  const queued = state.missions.filter((mission) => mission.status === 'queued').length;

  els.missionCount.textContent = total.toString();
  if (state.missionsLoading) {
    els.missionSummary.textContent = 'Loading missions…';
    return;
  }
  if (state.missionsError) {
    els.missionSummary.textContent = state.missionsError;
    return;
  }
  if (!total) {
    els.missionSummary.textContent = 'No missions defined. Use /missions create to add one.';
    return;
  }
  const parts = [];
  if (running) parts.push(`${running} running`);
  if (queued) parts.push(`${queued} queued`);
  if (disabled) parts.push(`${disabled} disabled`);
  if (!parts.length) {
    parts.push('All missions idle');
  }
  els.missionSummary.textContent = parts.join(' • ');
}

async function loadPrompts(force = false) {
  if (state.promptsLoading && !force) {
    return;
  }
  state.promptsLoading = true;
  state.promptsError = null;
  renderPromptList();

  try {
    const params = new URLSearchParams({ includeBody: 'true', limit: '80' });
    if (state.promptSearch.trim()) {
      params.set('query', state.promptSearch.trim());
    }
    const response = await fetch(`/api/prompts/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to load prompts (${response.status})`);
    }
    const records = await response.json();
    state.prompts = Array.isArray(records) ? records : [];
    state.promptsError = null;
  } catch (error) {
    state.prompts = [];
    state.promptsError = error.message;
  } finally {
    state.promptsLoading = false;
    renderPromptList();
    renderPromptSummary();
  }
}

function renderPromptList() {
  if (!els.promptList) return;
  els.promptList.innerHTML = '';

  if (state.promptsLoading) {
    els.promptsStatus.textContent = 'Loading prompts…';
    appendEmptyState(els.promptList, 'Loading prompts…');
    return;
  }

  if (state.promptsError) {
    els.promptsStatus.textContent = state.promptsError;
    appendEmptyState(els.promptList, state.promptsError);
    return;
  }

  if (!state.prompts.length) {
    els.promptsStatus.textContent = state.promptSearch ? 'No prompts matched your filter.' : 'No prompts saved yet. Use /prompts save to add one.';
    appendEmptyState(els.promptList, 'No prompts available.');
    return;
  }

  els.promptsStatus.textContent = `${state.prompts.length} prompt${state.prompts.length === 1 ? '' : 's'} ready.`;

  state.prompts.forEach((record, index) => {
    const item = document.createElement('li');
    item.className = 'organizer-prompt';
    item.dataset.index = String(index);

    const header = document.createElement('div');
    header.className = 'organizer-prompt-header';

    const title = document.createElement('h3');
    title.textContent = record.title || record.id || 'Untitled prompt';
    header.appendChild(title);

    const meta = document.createElement('span');
    meta.className = 'organizer-prompt-meta';
    const updated = record.updatedAt || record.updated_at || record.updated;
    meta.textContent = updated ? `Updated ${formatRelativeTime(updated)}` : `v${record.version ?? 1}`;
    header.appendChild(meta);

    item.appendChild(header);

    if (record.description) {
      const description = document.createElement('p');
      description.className = 'organizer-prompt-description';
      description.textContent = record.description;
      item.appendChild(description);
    }

    if (record.body) {
      const body = document.createElement('p');
      body.className = 'organizer-prompt-body';
      body.textContent = truncate(record.body, 320);
      item.appendChild(body);
    }

    if (Array.isArray(record.tags) && record.tags.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'organizer-tag-row';
      record.tags.forEach((tag) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'organizer-tag organizer-tag-button';
        chip.dataset.action = 'filter-tag';
        chip.dataset.value = tag;
        chip.textContent = tag;
        tagRow.appendChild(chip);
      });
      item.appendChild(tagRow);
    }

    const footer = document.createElement('div');
    footer.className = 'organizer-prompt-footer';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'memory-secondary-btn organizer-copy-btn';
    copyBtn.dataset.action = 'copy-prompt';
    copyBtn.dataset.index = String(index);
    copyBtn.dataset.restore = 'Copy prompt';
    copyBtn.textContent = 'Copy prompt';
    footer.appendChild(copyBtn);

    item.appendChild(footer);
    els.promptList.appendChild(item);
  });
}

function renderPromptSummary() {
  const total = state.prompts.length;
  els.promptCount.textContent = total.toString();
  if (state.promptsLoading) {
    els.promptSummary.textContent = 'Loading prompts…';
    return;
  }
  if (state.promptsError) {
    els.promptSummary.textContent = state.promptsError;
    return;
  }
  if (!total) {
    els.promptSummary.textContent = 'No prompts saved yet.';
    return;
  }
  const uniqueTags = new Set();
  state.prompts.forEach((prompt) => {
    (prompt.tags || []).forEach((tag) => uniqueTags.add(tag));
  });
  const lines = [`${total} prompt${total === 1 ? '' : 's'}`];
  if (uniqueTags.size) {
    lines.push(`${uniqueTags.size} tag${uniqueTags.size === 1 ? '' : 's'}`);
  }
  if (state.promptSearch.trim()) {
    lines.push(`Filter: “${state.promptSearch.trim()}”`);
  }
  els.promptSummary.textContent = lines.join(' • ');
}

function handlePromptSearch(event) {
  const value = event?.target?.value ?? '';
  state.promptSearch = value;
  if (state.promptDebounceId) {
    window.clearTimeout(state.promptDebounceId);
  }
  state.promptDebounceId = window.setTimeout(() => {
    loadPrompts(true);
  }, 220);
}

async function handlePromptListClick(event) {
  const tagButton = event.target.closest('button[data-action="filter-tag"]');
  if (tagButton) {
    const value = tagButton.dataset.value;
    if (value && els.promptSearch) {
      els.promptSearch.value = value;
    }
    state.promptSearch = value || '';
    loadPrompts(true);
    return;
  }

  const copyButton = event.target.closest('button[data-action="copy-prompt"]');
  if (!copyButton) return;

  const index = Number.parseInt(copyButton.dataset.index, 10);
  if (!Number.isInteger(index)) return;

  const record = state.prompts[index];
  if (!record || !record.body) return;

  const original = copyButton.dataset.restore || copyButton.textContent;
  copyButton.disabled = true;
  try {
    await copyToClipboard(record.body);
    copyButton.textContent = 'Copied!';
    window.setTimeout(() => {
      copyButton.disabled = false;
      copyButton.textContent = original || 'Copy prompt';
    }, 1400);
  } catch (error) {
    console.error('Failed to copy prompt body:', error);
    copyButton.textContent = 'Copy failed';
    window.setTimeout(() => {
      copyButton.disabled = false;
      copyButton.textContent = original || 'Copy prompt';
    }, 1600);
  }
}

function announceSchedulerMessage(message, tone = 'info') {
  if (!els.schedulerStatusText) return;
  els.schedulerStatusText.textContent = message;
  els.schedulerStatusText.dataset.tone = tone;
}

function appendEmptyState(container, message) {
  const entry = document.createElement('li');
  entry.className = 'organizer-empty';
  entry.textContent = message;
  container.appendChild(entry);
}

function truncate(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function describeSchedule(schedule) {
  if (!schedule) return 'No schedule';
  if (schedule.type === 'interval' && Number.isFinite(schedule.intervalMinutes)) {
    const minutes = schedule.intervalMinutes;
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return `Every ${hours === 1 ? 'hour' : `${hours} hours`}`;
    }
    return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  if (schedule.type === 'cron' && schedule.cron) {
    return `Cron: ${schedule.cron}`;
  }
  return 'Custom schedule';
}

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRelativeTime(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  if (!relativeTimeFormatter) {
    return date.toLocaleString();
  }
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const pairs = [
    { unit: 'day', value: 86400 },
    { unit: 'hour', value: 3600 },
    { unit: 'minute', value: 60 },
    { unit: 'second', value: 1 }
  ];
  for (const pair of pairs) {
    const amount = diffSec / pair.value;
    if (Math.abs(amount) >= 1 || pair.unit === 'second') {
      return relativeTimeFormatter.format(Math.round(amount), pair.unit);
    }
  }
  return date.toLocaleString();
}

async function readError(response) {
  try {
    const body = await response.json();
    return body?.error || body?.message || null;
  } catch (error) {
    return null;
  }
}

async function copyToClipboard(text) {
  if (typeof text !== 'string') {
    throw new Error('Nothing to copy.');
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const range = selection ? selection.rangeCount > 0 && selection.getRangeAt(0) : null;
  textarea.select();
  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('Copy command was rejected');
    }
  } finally {
    document.body.removeChild(textarea);
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
