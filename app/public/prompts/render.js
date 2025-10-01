/**
 * Prompt Library Renderers
 * Why: Provide focused DOM update helpers for list, form, and status surfaces.
 * What: Exposes functions on window.promptRender consumed by higher-level actions.
 * How: Reads from promptEls/promptState and mutates the UI in small, testable slices.
 */
(function registerPromptRender(global) {
  if (!global || global.promptRender) {
    return;
  }

  const documentRef = global.document;

  function getEls() {
    return global.promptEls || {};
  }

  function getState() {
    return global.promptState || {};
  }

  function showListPlaceholder(message) {
    const { list } = getEls();
    if (!list) {
      return;
    }

    list.innerHTML = `<li class="prompt-placeholder">${message}</li>`;
  }

  function renderSummaryList(summaries, { onSelect, selectedId } = {}) {
    const { list } = getEls();
    if (!list) {
      return;
    }

    if (!Array.isArray(summaries) || !summaries.length) {
      showListPlaceholder('No prompts found.');
      return;
    }

    const activeId = selectedId ?? getState().currentPromptId;

    list.innerHTML = '';
    const fragment = documentRef.createDocumentFragment();

    summaries.forEach((summary) => {
      const item = documentRef.createElement('li');
      item.className = 'prompt-list-item';
      item.dataset.id = summary.id;
      if (summary.id === activeId) {
        item.classList.add('active');
      }

      const title = documentRef.createElement('div');
      title.className = 'prompt-list-title';
      title.textContent = summary.title;

      const meta = documentRef.createElement('div');
      meta.className = 'prompt-list-meta';
      const tags = summary.tags?.length ? summary.tags.join(', ') : 'no tags';
      meta.textContent = `${summary.id} • ${tags}`;

      item.append(title, meta);

      if (typeof onSelect === 'function') {
        item.addEventListener('click', () => onSelect(summary.id));
      }

      fragment.appendChild(item);
    });

    list.appendChild(fragment);
  }

  function highlightSummary(id) {
    const { list } = getEls();
    if (!list) {
      return;
    }

    Array.from(list.querySelectorAll('.prompt-list-item')).forEach((item) => {
      item.classList.toggle('active', item.dataset.id === id);
    });
  }

  function resetForm() {
    const { form, deleteButton } = getEls();
    form?.reset();
    deleteButton?.setAttribute('disabled', 'disabled');
  }

  function populateForm(record) {
    if (!record) {
      return;
    }

    const {
      idInput,
      titleInput,
      descriptionInput,
      tagsInput,
      bodyInput,
      metadataInput,
      deleteButton
    } = getEls();

    if (idInput) idInput.value = record.id ?? '';
    if (titleInput) titleInput.value = record.title ?? '';
    if (descriptionInput) descriptionInput.value = record.description ?? '';
    if (tagsInput) {
      tagsInput.value = Array.isArray(record.tags) ? record.tags.join(', ') : '';
    }
    if (bodyInput) bodyInput.value = record.body ?? '';
    if (metadataInput) {
      metadataInput.value = record.metadata && Object.keys(record.metadata || {}).length
        ? JSON.stringify(record.metadata, null, 2)
        : '';
    }

    deleteButton?.removeAttribute('disabled');
    setStatus(`Loaded prompt "${record.id}"${record.version ? ` (v${record.version})` : ''}`, 'success');
  }

  function setStatus(message, tone = 'info') {
    const { status } = getEls();
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = `prompt-status ${tone}`;
  }

  function setGitHubStatus(message, tone = 'info') {
    const { githubStatus } = getEls();
    if (!githubStatus) {
      return;
    }

    githubStatus.textContent = message;
    githubStatus.dataset.state = tone;
  }

  function setGitHubButtonsDisabled(disabled) {
    const { githubPullButton, githubPushButton, githubSyncButton } = getEls();
    [githubPullButton, githubPushButton, githubSyncButton]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  global.promptRender = {
    showListPlaceholder,
    renderSummaryList,
    highlightSummary,
    resetForm,
    populateForm,
    setStatus,
    setGitHubStatus,
    setGitHubButtonsDisabled
  };
})(typeof window !== 'undefined' ? window : undefined);
