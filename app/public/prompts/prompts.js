class PromptLibrary {
  constructor() {
    this.listEl = document.getElementById('prompt-list');
    this.searchInput = document.getElementById('prompt-search');
    this.refreshButton = document.getElementById('prompt-refresh');
    this.newButton = document.getElementById('prompt-new');
    this.deleteButton = document.getElementById('prompt-delete');
    this.form = document.getElementById('prompt-form');
    this.statusEl = document.getElementById('prompt-status');
  this.githubPullButton = document.getElementById('prompt-github-pull');
  this.githubPushButton = document.getElementById('prompt-github-push');
  this.githubSyncButton = document.getElementById('prompt-github-sync');
  this.githubStatusEl = document.getElementById('prompt-github-status');

    this.idInput = document.getElementById('prompt-id');
    this.titleInput = document.getElementById('prompt-title');
    this.descriptionInput = document.getElementById('prompt-description');
    this.tagsInput = document.getElementById('prompt-tags');
    this.bodyInput = document.getElementById('prompt-body');
    this.metadataInput = document.getElementById('prompt-metadata');

    this.currentPromptId = null;
    this.currentQuery = '';
    this.searchDebounce = null;
  }

  init() {
    this.refreshButton?.addEventListener('click', () => this.loadSummaries());
    this.newButton?.addEventListener('click', () => this.resetForm());
    this.deleteButton?.addEventListener('click', () => this.handleDelete());
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));

  this.githubPullButton?.addEventListener('click', () => this.runGitHubAction('pull'));
  this.githubPushButton?.addEventListener('click', () => this.runGitHubAction('push'));
  this.githubSyncButton?.addEventListener('click', () => this.runGitHubAction('sync'));

    this.searchInput?.addEventListener('input', (event) => {
      const value = event.currentTarget.value.trim();
      this.currentQuery = value;
      window.clearTimeout(this.searchDebounce);
      this.searchDebounce = window.setTimeout(() => {
        this.loadSummaries();
      }, 250);
    });

    this.loadSummaries();
    this.loadGitHubStatus({ silent: true });
  }

  async loadSummaries() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '<li class="prompt-placeholder">Loading prompts…</li>';

    const params = new URLSearchParams();
    let endpoint = '/api/prompts';
    if (this.currentQuery) {
      endpoint = '/api/prompts/search';
      params.set('query', this.currentQuery);
      params.set('includeBody', 'false');
    }

    const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load prompts (${response.status})`);
      const summaries = await response.json();
      this.renderSummaryList(summaries);
      if (summaries.length && (!this.currentPromptId || !summaries.find((item) => item.id === this.currentPromptId))) {
        this.loadPrompt(summaries[0].id);
      }
    } catch (error) {
      this.listEl.innerHTML = `<li class="prompt-placeholder">${error.message}</li>`;
    }
  }

  renderSummaryList(summaries) {
    if (!this.listEl) return;
    if (!Array.isArray(summaries) || !summaries.length) {
      this.listEl.innerHTML = '<li class="prompt-placeholder">No prompts found.</li>';
      return;
    }

    this.listEl.innerHTML = '';
    summaries.forEach((summary) => {
      const item = document.createElement('li');
      item.className = 'prompt-list-item';
      item.dataset.id = summary.id;
      if (summary.id === this.currentPromptId) {
        item.classList.add('active');
      }

      const title = document.createElement('div');
      title.className = 'prompt-list-title';
      title.textContent = summary.title;

      const meta = document.createElement('div');
      meta.className = 'prompt-list-meta';
      const tags = summary.tags?.length ? summary.tags.join(', ') : 'no tags';
      meta.textContent = `${summary.id} • ${tags}`;

      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener('click', () => this.loadPrompt(summary.id));
      this.listEl.appendChild(item);
    });
  }

  async loadPrompt(id) {
    if (!id) return;
    try {
      const response = await fetch(`/api/prompts/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(`Failed to load prompt ${id}`);
      const record = await response.json();
      this.populateForm(record);
      this.highlightSelected(id);
      this.currentPromptId = id;
    } catch (error) {
      this.setStatus(error.message, 'error');
    }
  }

  highlightSelected(id) {
    if (!this.listEl) return;
    Array.from(this.listEl.querySelectorAll('.prompt-list-item')).forEach((item) => {
      item.classList.toggle('active', item.dataset.id === id);
    });
  }

  resetForm() {
    this.currentPromptId = null;
    this.form?.reset();
    this.deleteButton?.setAttribute('disabled', 'disabled');
    this.setStatus('Ready to create a new prompt.', 'info');
    this.highlightSelected(null);
  }

  populateForm(record) {
    if (!record) return;
    this.idInput.value = record.id ?? '';
    this.titleInput.value = record.title ?? '';
    this.descriptionInput.value = record.description ?? '';
    this.tagsInput.value = Array.isArray(record.tags) ? record.tags.join(', ') : '';
    this.bodyInput.value = record.body ?? '';
    this.metadataInput.value = record.metadata && Object.keys(record.metadata || {}).length
      ? JSON.stringify(record.metadata, null, 2)
      : '';
    this.deleteButton?.removeAttribute('disabled');
    this.setStatus(`Loaded prompt "${record.id}" (v${record.version})`, 'success');
  }

  async handleSubmit(event) {
    event.preventDefault();
    const title = this.titleInput.value.trim();
    const body = this.bodyInput.value.trim();

    if (!title || !body) {
      this.setStatus('Title and body are required.', 'error');
      return;
    }

    const payload = {
      title,
      body
    };

    const id = this.idInput.value.trim();
    if (id) payload.id = id;

    const description = this.descriptionInput.value.trim();
    if (description) payload.description = description;

    const tags = this.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length) payload.tags = tags;

    const metadataRaw = this.metadataInput.value.trim();
    if (metadataRaw) {
      try {
        payload.metadata = JSON.parse(metadataRaw);
      } catch (error) {
        this.setStatus('Metadata must be valid JSON.', 'error');
        return;
      }
    }

    try {
      this.setStatus('Saving prompt…', 'info');
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to save prompt.');
      }

      const record = await response.json();
      this.populateForm(record);
      this.currentPromptId = record.id;
      await this.loadSummaries();
      this.setStatus('Prompt saved successfully.', 'success');
      await this.loadGitHubStatus({ silent: true });
    } catch (error) {
      this.setStatus(error.message, 'error');
    }
  }

  async handleDelete() {
    if (!this.currentPromptId) return;
    const confirmed = window.confirm(`Delete prompt "${this.currentPromptId}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/prompts/${encodeURIComponent(this.currentPromptId)}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to delete prompt.');
      }
      this.setStatus('Prompt deleted.', 'success');
      this.resetForm();
      await this.loadSummaries();
      await this.loadGitHubStatus({ silent: true });
    } catch (error) {
      this.setStatus(error.message, 'error');
    }
  }

  async loadGitHubStatus({ silent = false } = {}) {
    if (!this.githubStatusEl) return;

    if (!silent) {
      this.setGitHubStatus('Checking GitHub status…', 'info');
    }

    try {
      const response = await fetch('/api/prompts/github/status');
      if (response.status === 404 || response.status === 403) {
        this.setGitHubStatus('GitHub sync disabled.', 'warn');
        this.setGitHubButtonsDisabled(true);
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to load GitHub status (${response.status})`);
      }
      const payload = await response.json();
      const tone = payload.status === 'ok' ? 'success' : 'error';
      this.setGitHubStatus(`${payload.status.toUpperCase()}: ${payload.message}`, tone);
      this.setGitHubButtonsDisabled(false);
    } catch (error) {
      this.setGitHubStatus(error.message || 'Unable to load GitHub status.', 'error');
      this.setGitHubButtonsDisabled(true);
    }
  }

  async runGitHubAction(action) {
    if (!this.githubStatusEl) return;

    this.setGitHubButtonsDisabled(true);
    this.setGitHubStatus(`Running ${action}…`, 'info');

    try {
      const response = await fetch(`/api/prompts/github/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `GitHub ${action} failed.`);
      }

      const tone = payload.status === 'ok' ? 'success' : (payload.status === 'warn' ? 'warn' : 'info');
      this.setGitHubStatus(payload.message || `GitHub ${action} completed.`, tone);

      if (payload.status === 'ok') {
        await this.loadSummaries();
      }
    } catch (error) {
      this.setGitHubStatus(error.message || `GitHub ${action} failed.`, 'error');
    } finally {
      await this.loadGitHubStatus({ silent: true });
      this.setGitHubButtonsDisabled(false);
    }
  }

  setGitHubStatus(message, tone = 'info') {
    if (!this.githubStatusEl) return;
    this.githubStatusEl.textContent = message;
    this.githubStatusEl.dataset.state = tone;
  }

  setGitHubButtonsDisabled(disabled) {
    [this.githubPullButton, this.githubPushButton, this.githubSyncButton]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  setStatus(message, type = 'info') {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.className = `prompt-status ${type}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const library = new PromptLibrary();
  library.init();
});
