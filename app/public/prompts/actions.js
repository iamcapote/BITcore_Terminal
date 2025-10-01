/**
 * Prompt Library Actions
 * Why: Orchestrate UI interactions, state mutations, and API calls for the prompt dashboard.
 * What: Provides high-level handlers (load, save, delete, sync) consumed by the bootstrapper.
 * How: Composes promptEls, promptState, promptRender, and promptApi utilities.
 */
(function registerPromptActions(global) {
  if (!global || global.promptActions) {
    return;
  }

  const state = global.promptState;
  const render = global.promptRender;
  const api = global.promptApi;
  const els = global.promptEls;

  if (!state || !render || !api || !els) {
    console.error('Prompt actions setup failed: missing dependencies.');
    return;
  }

  function setQuery(value) {
    state.currentQuery = value.trim();
  }

  function scheduleSummaryReload() {
    if (state.searchDebounce) {
      global.clearTimeout(state.searchDebounce);
    }

    state.searchDebounce = global.setTimeout(() => {
      loadSummaries();
    }, 250);
  }

  async function loadSummaries() {
    if (!els.list) {
      return;
    }

    render.showListPlaceholder('Loading prompts…');

    try {
      const summaries = await api.fetchSummaries(state.currentQuery);
      render.renderSummaryList(summaries, {
        onSelect: loadPrompt,
        selectedId: state.currentPromptId
      });

      if (!Array.isArray(summaries) || !summaries.length) {
        return;
      }

      const hasCurrent = state.currentPromptId
        ? summaries.some((item) => item.id === state.currentPromptId)
        : false;

      if (!hasCurrent) {
        await loadPrompt(summaries[0].id);
      } else {
        render.highlightSummary(state.currentPromptId);
      }
    } catch (error) {
      render.showListPlaceholder(error.message || 'Failed to load prompts.');
    }
  }

  async function loadPrompt(id) {
    if (!id) {
      return;
    }

    try {
      const record = await api.fetchPrompt(id);
      state.currentPromptId = record.id;
      render.populateForm(record);
      render.highlightSummary(record.id);
    } catch (error) {
      render.setStatus(error.message || `Failed to load prompt ${id}.`, 'error');
    }
  }

  function resetForm() {
    state.currentPromptId = null;
    render.resetForm();
    render.highlightSummary(null);
    render.setStatus('Ready to create a new prompt.', 'info');
  }

  function extractPayload() {
    const title = els.titleInput?.value.trim() || '';
    const body = els.bodyInput?.value.trim() || '';

    if (!title || !body) {
      throw new Error('Title and body are required.');
    }

    const payload = { title, body };

    const id = els.idInput?.value.trim();
    if (id) {
      payload.id = id;
    }

    const description = els.descriptionInput?.value.trim();
    if (description) {
      payload.description = description;
    }

    const tagsValue = els.tagsInput?.value || '';
    const tags = tagsValue
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length) {
      payload.tags = tags;
    }

    const metadataRaw = els.metadataInput?.value.trim();
    if (metadataRaw) {
      try {
        payload.metadata = JSON.parse(metadataRaw);
      } catch (error) {
        const err = new Error('Metadata must be valid JSON.');
        err.cause = error;
        throw err;
      }
    }

    return payload;
  }

  async function handleSubmit(event) {
    event?.preventDefault();

    let payload;
    try {
      payload = extractPayload();
    } catch (error) {
      render.setStatus(error.message, 'error');
      return;
    }

    try {
      render.setStatus('Saving prompt…', 'info');
      const record = await api.savePrompt(payload);
      state.currentPromptId = record.id;
      render.populateForm(record);
      render.highlightSummary(record.id);
      await loadSummaries();
      render.setStatus('Prompt saved successfully.', 'success');
      await loadGitHubStatus({ silent: true });
    } catch (error) {
      render.setStatus(error.message || 'Failed to save prompt.', 'error');
    }
  }

  async function handleDelete() {
    if (!state.currentPromptId) {
      return;
    }

    const confirmed = global.confirm(`Delete prompt "${state.currentPromptId}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.deletePrompt(state.currentPromptId);
      render.setStatus('Prompt deleted.', 'success');
      resetForm();
      await loadSummaries();
      await loadGitHubStatus({ silent: true });
    } catch (error) {
      render.setStatus(error.message || 'Failed to delete prompt.', 'error');
    }
  }

  async function loadGitHubStatus({ silent = false } = {}) {
    if (!els.githubStatus) {
      return;
    }

    if (!silent) {
      render.setGitHubStatus('Checking GitHub status…', 'info');
    }

    try {
      const status = await api.fetchGitHubStatus();

      if (status.disabled) {
        render.setGitHubStatus(status.message, 'warn');
        render.setGitHubButtonsDisabled(true);
        return;
      }

      const tone = status.status === 'ok' ? 'success' : status.status === 'warn' ? 'warn' : 'error';
      render.setGitHubStatus(`${status.status.toUpperCase()}: ${status.message}`, tone);
      render.setGitHubButtonsDisabled(false);
    } catch (error) {
      render.setGitHubStatus(error.message || 'Unable to load GitHub status.', 'error');
      render.setGitHubButtonsDisabled(true);
    }
  }

  async function runGitHubAction(action) {
    if (!action) {
      return;
    }

    render.setGitHubButtonsDisabled(true);
    render.setGitHubStatus(`Running ${action}…`, 'info');

    try {
      const payload = await api.runGitHubAction(action);
      const tone = payload.status === 'ok' ? 'success' : payload.status === 'warn' ? 'warn' : 'info';
      render.setGitHubStatus(payload.message || `GitHub ${action} completed.`, tone);

      if (payload.status === 'ok') {
        await loadSummaries();
      }
    } catch (error) {
      render.setGitHubStatus(error.message || `GitHub ${action} failed.`, 'error');
    } finally {
      await loadGitHubStatus({ silent: true });
      render.setGitHubButtonsDisabled(false);
    }
  }

  function handleSearchInput(value) {
    setQuery(value || '');
    scheduleSummaryReload();
  }

  async function init() {
    await loadSummaries();
    await loadGitHubStatus({ silent: true });
  }

  global.promptActions = {
    init,
    loadSummaries,
    loadPrompt,
    resetForm,
    handleSubmit,
    handleDelete,
    loadGitHubStatus,
    runGitHubAction,
    handleSearchInput
  };
})(typeof window !== 'undefined' ? window : undefined);
