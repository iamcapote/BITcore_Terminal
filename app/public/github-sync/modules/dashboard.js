import { GitHubSyncAPI, GitHubSyncError } from './api.js';
import { StagingManager } from './staging.js';
import { ActivityFeedController } from './activity-feed.js';
import { ACTION_MAP, ACTION_LABEL } from './dashboard.constants.js';
import { ensureWebComm } from './dashboard.utils.js';
import { RemoteBrowserView } from './dashboard.remote-view.js';
import { StagingPanelView } from './dashboard.staging-view.js';

class GitHubSyncDashboard {
  constructor(root) {
    this.root = root;
    this.api = new GitHubSyncAPI();
    this.staging = new StagingManager({ logger: console });
    this.webcomm = ensureWebComm();
    this.activityController = null;

    this.elements = {
      form: root.querySelector('[data-sync-form]'),
      repo: root.querySelector('[data-sync-field="repo"]'),
      branch: root.querySelector('[data-sync-field="branch"]'),
      path: root.querySelector('[data-sync-field="path"]'),
      message: root.querySelector('[data-sync-field="message"]'),
      resultContainer: root.querySelector('[data-sync-result]'),
      resultStatus: root.querySelector('[data-sync-status]'),
      resultMeta: root.querySelector('[data-sync-meta]'),
      resultOutput: root.querySelector('[data-sync-output]'),
      activityRoot: root.querySelector('[data-activity-root]'),
      remoteBrowser: root.querySelector('[data-remote-browser]'),
      remoteList: root.querySelector('[data-remote-list]'),
      remoteEmpty: root.querySelector('[data-remote-empty]'),
      remotePath: root.querySelector('[data-remote-path]'),
      stagingRoot: root.querySelector('[data-staging-root]'),
      stagingList: root.querySelector('[data-staging-list]'),
      stagingEditor: root.querySelector('[data-staging-editor]'),
      stagingPath: root.querySelector('[data-staging-path]'),
      stagingOrigin: root.querySelector('[data-staging-origin]'),
      stagingDirty: root.querySelector('[data-staging-dirty]'),
      stagingUpdated: root.querySelector('[data-staging-updated]'),
      stagingRemoveButton: root.querySelector('[data-staging-remove]')
    };

    this.remoteView = new RemoteBrowserView({
      listElement: this.elements.remoteList,
      emptyElement: this.elements.remoteEmpty,
      pathElement: this.elements.remotePath,
      browserElement: this.elements.remoteBrowser,
      onNavigate: (path) => this.handleRemoteNavigate(path),
      onFetch: (path) => this.handleRemoteFetch(path),
      onRefresh: () => this.handleRemoteRefresh(),
      onUp: () => this.handleRemoteUp()
    });

    this.stagingView = new StagingPanelView({
      root: this.elements.stagingRoot,
      listElement: this.elements.stagingList,
      editorElement: this.elements.stagingEditor,
      pathInput: this.elements.stagingPath,
      originLabel: this.elements.stagingOrigin,
      dirtyLabel: this.elements.stagingDirty,
      updatedLabel: this.elements.stagingUpdated,
      removeButton: this.elements.stagingRemoveButton,
      onToolbarAction: (action) => this.handleStagingToolbar(action),
      onEditorInput: (value) => this.handleEditorInput(value),
      onSelect: (path) => this.staging.setActive(path)
    });

    this.actionButtons = new Map();
    this.stagingDisposers = [];
    this.pendingAction = null;
    this.remoteListing = null;
    this.remoteSelectionPath = null;
  }

  init() {
    this.bindForm();
    this.bindActionButtons();
    this.stagingView.init();
    this.remoteView.init();
    this.attachStagingListeners();
    this.refreshStagingPanel();
    this.setStatus('Idle — awaiting action.', 'idle');
    this.remoteView.render(this.remoteListing);
    this.initActivityFeed();
    this.ensureWebSocket();
  }

  destroy() {
    this.stagingDisposers.forEach((dispose) => {
      try {
        dispose?.();
      } catch (error) {
        console.warn('[GitHubSyncDashboard] staging dispose failed', error);
      }
    });
    this.stagingDisposers = [];
    this.stagingView.destroy();
    this.remoteView.destroy();
    if (this.activityController && typeof this.activityController.destroy === 'function') {
      this.activityController.destroy();
    }
  }

  bindForm() {
    if (this.elements.form) {
      this.elements.form.addEventListener('submit', (event) => event.preventDefault());
    }
  }

  bindActionButtons() {
    if (!this.elements.form) {
      return;
    }
    const buttons = this.elements.form.querySelectorAll('[data-sync-action]');
    buttons.forEach((button) => {
      const actionKey = button.getAttribute('data-sync-action');
      if (!actionKey || !ACTION_MAP[actionKey]) {
        return;
      }
      this.actionButtons.set(actionKey, button);
      button.addEventListener('click', () => this.handleAction(actionKey));
    });
  }

  attachStagingListeners() {
    const offChange = this.staging.on('change', () => this.refreshStagingPanel());
    const offActive = this.staging.on('active-change', () => this.refreshStagingPanel());
    this.stagingDisposers.push(offChange, offActive);
  }

  ensureWebSocket() {
    if (this.webcomm && typeof this.webcomm.connect === 'function') {
      this.webcomm.connect().catch((error) => {
        console.warn('[GitHubSyncDashboard] WebSocket connection failed:', error);
      });
    }
  }

  initActivityFeed() {
    if (!this.elements.activityRoot) {
      return;
    }
    this.activityController = new ActivityFeedController({
      root: this.elements.activityRoot,
      api: this.api,
      webcomm: this.webcomm,
      logger: console
    });
    this.activityController.init();
  }

  async handleAction(actionKey, overrides = {}) {
    if (this.pendingAction) {
      return;
    }

    const action = ACTION_MAP[actionKey];
    const label = ACTION_LABEL[actionKey] || actionKey;
    const button = this.actionButtons.get(actionKey);

    try {
      const payload = this.buildPayload(actionKey, overrides);
      if (actionKey === 'list' && !overrides.keepSelection) {
        this.remoteSelectionPath = null;
      }
      this.setPending(actionKey, true, button, label);
      const response = await this.api.githubSync(payload);
      this.renderSuccess(actionKey, payload, response);
      this.afterAction(actionKey, response, payload);
    } catch (error) {
      this.renderError(actionKey, error);
    } finally {
      this.setPending(actionKey, false, button, label);
    }
  }

  buildPayload(actionKey, overrides = {}) {
    const action = ACTION_MAP[actionKey];
    if (!action) {
      throw new Error(`Unsupported action: ${actionKey}`);
    }

    const repo = overrides.repo ?? this.elements.repo?.value?.trim() ?? '';
    const branch = overrides.branch ?? this.elements.branch?.value?.trim() ?? '';
    const message = overrides.message ?? this.elements.message?.value?.trim() ?? '';
    const pathInputValue = overrides.path ?? this.elements.path?.value?.trim() ?? '';

    const payload = { action };
    if (repo) {
      payload.repo = repo;
    }
    if (branch) {
      payload.branch = branch;
      payload.ref = branch;
    }
    if (message && (action === 'push' || action === 'upload')) {
      payload.message = message;
    }

    switch (action) {
      case 'verify':
        break;
      case 'list':
        payload.path = pathInputValue || '';
        break;
      case 'file': {
        const path = overrides.path ?? pathInputValue;
        if (!path) {
          throw new Error('Fetch requires a target path.');
        }
        payload.path = path;
        break;
      }
      case 'upload': {
        const file = overrides.file ?? this.staging.getActive();
        if (!file) {
          throw new Error('Stage a file before uploading.');
        }
        payload.path = file.path;
        payload.content = file.content;
        break;
      }
      case 'push': {
        const files = overrides.files ?? this.staging.dirtyEntries();
        if (!Array.isArray(files) || files.length === 0) {
          throw new Error('Stage at least one dirty file before pushing.');
        }
        payload.files = files.map(({ path, content }) => ({ path, content }));
        break;
      }
      default:
        throw new Error(`Unhandled action: ${action}`);
    }

    return payload;
  }

  setPending(actionKey, pending, button, label) {
    this.pendingAction = pending ? actionKey : null;
    if (button) {
      button.disabled = pending;
      if (pending) {
        button.dataset.loading = 'true';
        button.setAttribute('aria-busy', 'true');
        button.textContent = `${label}…`;
      } else {
        button.dataset.loading = 'false';
        button.removeAttribute('aria-busy');
        button.textContent = ACTION_LABEL[actionKey] || label;
      }
    }
    if (pending) {
      this.setStatus(`Running ${label}`, 'pending');
    }
  }

  setStatus(message, state = 'idle') {
    if (!this.elements.resultStatus) {
      return;
    }
    this.elements.resultStatus.textContent = message;
    if (this.elements.resultContainer) {
      this.elements.resultContainer.dataset.state = state;
    }
  }

  renderSuccess(actionKey, payload, response) {
    const label = ACTION_LABEL[actionKey] || actionKey;
    this.setStatus(`${label} succeeded`, 'success');

    if (this.elements.resultMeta) {
      const metadata = [];
      if (response?.correlationId) {
        metadata.push(`Correlation: ${response.correlationId}`);
      }
      if (payload?.branch) {
        metadata.push(`Branch: ${payload.branch}`);
      }
      if (payload?.path) {
        metadata.push(`Path: ${payload.path}`);
      }
      if (actionKey === 'list' && Array.isArray(response?.data?.entries)) {
        metadata.push(`Entries: ${response.data.entries.length}`);
      }
      this.elements.resultMeta.textContent = metadata.join(' · ');
    }

    if (this.elements.resultOutput) {
      const view = {
        action: response?.action ?? payload?.action ?? ACTION_MAP[actionKey],
        ok: response?.ok ?? true,
        data: response?.data ?? null,
        meta: response?.meta ?? null
      };
      this.elements.resultOutput.textContent = JSON.stringify(view, null, 2);
    }
  }

  renderError(actionKey, error) {
    const label = ACTION_LABEL[actionKey] || actionKey;
    const message = error instanceof GitHubSyncError
      ? error.message
      : (error?.message || 'Unknown error');
    this.setStatus(`${label} failed: ${message}`, 'error');

    if (this.elements.resultMeta) {
      const metadata = [];
      if (error instanceof GitHubSyncError) {
        if (error.status) {
          metadata.push(`HTTP ${error.status}`);
        }
        if (error.correlationId) {
          metadata.push(`Correlation: ${error.correlationId}`);
        }
      }
      this.elements.resultMeta.textContent = metadata.join(' · ');
    }

    if (this.elements.resultOutput) {
      const payload = {
        message,
        details: error instanceof GitHubSyncError ? error.details ?? null : null
      };
      this.elements.resultOutput.textContent = JSON.stringify(payload, null, 2);
    }
  }

  afterAction(actionKey, response, payload = {}) {
    switch (actionKey) {
      case 'list':
        this.applyRemoteListing(response?.data ?? null, payload);
        break;
      case 'fetch':
        this.stageFetchedFile(response?.data);
        if (this.remoteListing) {
          this.applyRemoteListing(this.remoteListing);
        }
        break;
      case 'upload':
        this.markActiveClean(response?.data?.summary ?? response?.data);
        break;
      case 'push':
        this.markAllDirtyClean(response?.data?.summaries ?? response?.data);
        break;
      default:
        break;
    }
  }

  applyRemoteListing(listing, payload = {}) {
    this.remoteListing = listing || null;
    this.remoteView.render(this.remoteListing, {
      selectionPath: this.remoteSelectionPath,
      pathOverride: payload.path
    });
  }

  stageFetchedFile(file) {
    if (!file || !file.path) {
      return;
    }
    try {
      this.staging.stageFile({
        path: file.path,
        content: file.content ?? '',
        origin: 'remote',
        sha: file.sha ?? null,
        ref: file.ref ?? null
      });
      this.staging.setActive(file.path);
      if (this.elements.path) {
        this.elements.path.value = file.path;
      }
      this.remoteSelectionPath = file.path;
      this.remoteView.setSelection(this.remoteSelectionPath);
    } catch (error) {
      console.warn('[GitHubSyncDashboard] Failed to stage fetched file:', error);
    }
  }

  markActiveClean(summary) {
    const active = this.staging.getActive();
    if (!active) {
      return;
    }
    try {
      this.staging.stageFile({
        path: active.path,
        content: active.content,
        origin: 'remote',
        sha: summary?.fileSha ?? null,
        ref: summary?.branch ?? null
      });
      this.staging.setActive(active.path);
    } catch (error) {
      console.warn('[GitHubSyncDashboard] Failed to refresh staged file after upload:', error);
    }
  }

  markAllDirtyClean(summaries) {
    const active = this.staging.getActive();
    const dirty = this.staging.dirtyEntries();
    if (!dirty.length) {
      return;
    }
    const summaryByPath = new Map();
    if (Array.isArray(summaries)) {
      summaries.forEach((item) => {
        if (item?.path) {
          summaryByPath.set(item.path, item);
        }
      });
    }
    dirty.forEach((file) => {
      const summary = summaryByPath.get(file.path);
      try {
        this.staging.stageFile({
          path: file.path,
          content: file.content,
          origin: 'remote',
          sha: summary?.fileSha ?? null,
          ref: summary?.branch ?? null
        });
      } catch (error) {
        console.warn('[GitHubSyncDashboard] Failed to mark file clean:', error);
      }
    });
    if (active?.path) {
      this.staging.setActive(active.path);
    }
  }

  handleRemoteNavigate(path) {
    const normalized = typeof path === 'string' ? path.trim() : '';
    this.remoteSelectionPath = null;
    if (this.elements.path) {
      this.elements.path.value = normalized;
    }
    this.handleAction('list', { path: normalized });
  }

  handleRemoteFetch(path) {
    const normalized = typeof path === 'string' ? path.trim() : '';
    if (!normalized) {
      return;
    }
    this.remoteSelectionPath = normalized;
    this.remoteView.setSelection(normalized);
    if (this.elements.path) {
      this.elements.path.value = normalized;
    }
    this.handleAction('fetch', { path: normalized });
  }

  handleRemoteRefresh() {
    const currentPath = typeof this.remoteListing?.path === 'string'
      ? this.remoteListing.path
      : (this.elements.path?.value?.trim() ?? '');
    if (this.elements.path) {
      this.elements.path.value = currentPath || '';
    }
    this.handleAction('list', { path: currentPath || '', keepSelection: true });
  }

  handleRemoteUp() {
    const currentPath = typeof this.remoteListing?.path === 'string'
      ? this.remoteListing.path
      : (this.elements.path?.value?.trim() ?? '');
    if (!currentPath) {
      return;
    }
    const sanitized = currentPath.replace(/\\/g, '/');
    const segments = sanitized.split('/').filter(Boolean);
    if (segments.length === 0) {
      this.handleRemoteNavigate('');
      return;
    }
    segments.pop();
    const parentPath = segments.join('/');
    this.handleRemoteNavigate(parentPath);
  }

  handleStagingToolbar(action) {
    switch (action) {
      case 'stage-blank':
        this.stageBlankFile();
        break;
      case 'refresh-active':
        this.reloadActiveFromRemote();
        break;
      case 'remove-active':
        this.removeActiveFile();
        break;
      case 'clear-all':
        this.clearStaging();
        break;
      default:
        break;
    }
  }

  stageBlankFile() {
    const path = window.prompt('Enter the repository path for the new staged file (e.g., research/new-notes.md)');
    if (!path) {
      return;
    }
    const trimmed = path.trim();
    if (!trimmed) {
      return;
    }
    try {
      this.staging.stageBlank(trimmed, { origin: 'local' });
      this.staging.setActive(trimmed);
      if (this.elements.path) {
        this.elements.path.value = trimmed;
      }
    } catch (error) {
      window.alert(error.message);
    }
  }

  async reloadActiveFromRemote() {
    const active = this.staging.getActive();
    if (!active) {
      return;
    }
    try {
      const payload = this.buildPayload('fetch', { path: active.path });
      const response = await this.api.githubSync(payload);
      this.renderSuccess('fetch', payload, response);
      this.stageFetchedFile(response?.data);
      if (this.remoteListing) {
        this.remoteSelectionPath = active.path;
        this.remoteView.setSelection(active.path);
        this.applyRemoteListing(this.remoteListing);
      }
    } catch (error) {
      this.renderError('fetch', error);
    }
  }

  removeActiveFile() {
    const active = this.staging.getActive();
    if (!active) {
      return;
    }
    this.staging.remove(active.path);
  }

  clearStaging() {
    if (this.staging.toArray().length === 0) {
      return;
    }
    const confirmed = window.confirm('Remove all staged files? This does not affect GitHub until you push.');
    if (!confirmed) {
      return;
    }
    this.staging.clear();
  }

  handleEditorInput(value) {
    const active = this.staging.getActive();
    if (!active) {
      return;
    }
    try {
      this.staging.updateContent(active.path, value);
    } catch (error) {
      console.warn('[GitHubSyncDashboard] Failed to update staged content:', error);
    }
  }

  refreshStagingPanel() {
    const active = this.staging.getActive();
    const files = this.staging.toArray().map((file) => ({
      ...file,
      dirty: this.staging.isDirty(file.path)
    }));

    this.stagingView.renderList(files, active?.path ?? null);
    this.stagingView.renderActive(active);
    this.stagingView.updateMeta({
      origin: active?.origin ?? null,
      dirty: active ? this.staging.isDirty(active.path) : false,
      updatedAt: active?.updatedAt ?? null
    });
    this.stagingView.setButtonsState({ hasActive: Boolean(active) });

    if (active && this.elements.path) {
      this.elements.path.value = active.path;
    }
  }
}

function bootstrap() {
  const root = document.querySelector('[data-github-sync-root]');
  if (!root) {
    return;
  }
  const dashboard = new GitHubSyncDashboard(root);
  dashboard.init();
  window.githubSyncDashboard = dashboard;
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootstrap();
} else {
  document.addEventListener('DOMContentLoaded', bootstrap);
}
