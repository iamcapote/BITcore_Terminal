import { GitHubSyncAPI } from './api.js';
import { StagingManager } from './staging.js';
import { ActivityFeedController } from './activity-feed.js';
import { ACTION_MAP, ACTION_LABEL } from './dashboard.constants.js';
import { ensureWebComm } from './dashboard.utils.js';
import { DashboardResultView } from './dashboard.result-view.js';
import { DashboardRemoteController } from './dashboard.remote-controller.js';
import { DashboardStagingController } from './dashboard.staging-controller.js';

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

    this.resultView = new DashboardResultView({
      containerElement: this.elements.resultContainer,
      statusElement: this.elements.resultStatus,
      metaElement: this.elements.resultMeta,
      outputElement: this.elements.resultOutput
    });

    this.remoteController = new DashboardRemoteController({
      elements: {
        remoteList: this.elements.remoteList,
        remoteEmpty: this.elements.remoteEmpty,
        remotePath: this.elements.remotePath,
        remoteBrowser: this.elements.remoteBrowser,
        pathInput: this.elements.path
      },
      runAction: (actionKey, overrides) => this.runAction(actionKey, overrides),
      logger: console
    });

    this.stagingController = new DashboardStagingController({
      staging: this.staging,
      elements: {
        stagingRoot: this.elements.stagingRoot,
        stagingList: this.elements.stagingList,
        stagingEditor: this.elements.stagingEditor,
        stagingPath: this.elements.stagingPath,
        stagingOrigin: this.elements.stagingOrigin,
        stagingDirty: this.elements.stagingDirty,
        stagingUpdated: this.elements.stagingUpdated,
        stagingRemoveButton: this.elements.stagingRemoveButton
      },
      api: this.api,
      resultView: this.resultView,
      buildPayload: (actionKey, overrides) => this.buildPayload(actionKey, overrides),
      remoteController: this.remoteController,
      logger: console
    });

    this.actionButtons = new Map();
    this.pendingAction = null;
  }

  init() {
    this.bindForm();
    this.bindActionButtons();
    this.stagingController.init();
    this.remoteController.init();
    this.resultView.setStatus('Idle — awaiting action.', 'idle');
    this.initActivityFeed();
    this.ensureWebSocket();
  }

  destroy() {
    this.stagingController.destroy();
    this.remoteController.destroy();
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
      button.addEventListener('click', () => this.runAction(actionKey));
    });
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

  async runAction(actionKey, overrides = {}) {
    if (this.pendingAction) {
      return;
    }

    const action = ACTION_MAP[actionKey];
    const label = ACTION_LABEL[actionKey] || actionKey;
    const button = this.actionButtons.get(actionKey);

    try {
      const payload = this.buildPayload(actionKey, overrides);
      if (actionKey === 'list' && !overrides.keepSelection) {
        this.remoteController.clearSelection();
      }
      this.setPending(actionKey, true, button, label);
      const response = await this.api.githubSync(payload);
      this.resultView.renderSuccess({ actionKey, label, payload, response });
      this.afterAction(actionKey, response, payload);
    } catch (error) {
      this.resultView.renderError({ actionKey, label, error });
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
      this.resultView.setStatus(`Running ${label}`, 'pending');
    }
  }

  afterAction(actionKey, response, payload = {}) {
    switch (actionKey) {
      case 'list':
        this.remoteController.applyListing(response?.data ?? null, payload);
        break;
      case 'fetch':
        this.stagingController.stageFetchedFile(response?.data);
        this.remoteController.reapplyListing();
        break;
      case 'upload':
        this.stagingController.markActiveClean(response?.data?.summary ?? response?.data);
        break;
      case 'push':
        this.stagingController.markAllDirtyClean(response?.data?.summaries ?? response?.data);
        break;
      default:
        break;
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
