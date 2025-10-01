/**
 * Research Prompt Selector Module
 * Why: Provide a responsive prompt picker that mirrors the terminal's quick-start experience.
 * What: Handles search, pagination, status messaging, and clipboard interactions for saved prompts.
 * How: Binds DOM listeners once, fetches prompt data via the REST API, and re-renders the list on demand.
 */
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
