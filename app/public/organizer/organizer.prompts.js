/**
 * Organizer Prompts Module
 * Why: Manage prompt fetching, filtering, rendering, and clipboard interactions for the organizer dashboard.
 * What: Attaches functions for loading prompts, handling search/filter actions, and updating summary chips.
 * How: Uses shared organizer state, element cache, and utility helpers registered on window.
 */
(function initializeOrganizerPrompts(global) {
  if (!global) {
    return;
  }

  const state = global.organizerState;
  const els = global.organizerEls;
  const utils = global.organizerUtils;

  if (!state || !els || !utils) {
    return;
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
      if (els.promptsStatus) {
        els.promptsStatus.textContent = 'Loading prompts…';
      }
      utils.appendEmptyState(els.promptList, 'Loading prompts…');
      return;
    }

    if (state.promptsError) {
      if (els.promptsStatus) {
        els.promptsStatus.textContent = state.promptsError;
      }
      utils.appendEmptyState(els.promptList, state.promptsError);
      return;
    }

    if (!state.prompts.length) {
      const message = state.promptSearch
        ? 'No prompts matched your filter.'
        : 'No prompts saved yet. Use /prompts save to add one.';
      if (els.promptsStatus) {
        els.promptsStatus.textContent = message;
      }
      utils.appendEmptyState(els.promptList, 'No prompts available.');
      return;
    }

    if (els.promptsStatus) {
      els.promptsStatus.textContent = `${state.prompts.length} prompt${state.prompts.length === 1 ? '' : 's'} ready.`;
    }

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
      meta.textContent = updated ? `Updated ${utils.formatRelativeTime(updated)}` : `v${record.version ?? 1}`;
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
        body.textContent = utils.truncate(record.body, 320);
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
    if (els.promptCount) {
      els.promptCount.textContent = total.toString();
    }
    if (state.promptsLoading) {
      if (els.promptSummary) {
        els.promptSummary.textContent = 'Loading prompts…';
      }
      return;
    }
    if (state.promptsError) {
      if (els.promptSummary) {
        els.promptSummary.textContent = state.promptsError;
      }
      return;
    }
    if (!total) {
      if (els.promptSummary) {
        els.promptSummary.textContent = 'No prompts saved yet.';
      }
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
    if (els.promptSummary) {
      els.promptSummary.textContent = lines.join(' • ');
    }
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
      await utils.copyToClipboard(record.body);
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

  global.organizerPrompts = {
    loadPrompts,
    renderPromptList,
    renderPromptSummary,
    handlePromptSearch,
    handlePromptListClick
  };
})(typeof window !== 'undefined' ? window : undefined);
