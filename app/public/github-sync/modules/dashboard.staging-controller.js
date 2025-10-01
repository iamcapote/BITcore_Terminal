/**
 * Why: Encapsulate staging panel interactions so dashboard orchestration stays lean and testable.
 * What: Wires the staging view to the staging manager, runs toolbar actions, and exposes helpers for action aftermath.
 * How: Owns StagingPanelView lifecycle, delegates API calls for refreshes, and keeps view metadata in sync with staging state.
 */

import { ACTION_LABEL } from './dashboard.constants.js';
import { StagingPanelView } from './dashboard.staging-view.js';

export class DashboardStagingController {
  constructor({
    staging,
    elements = {},
    api,
    resultView,
    buildPayload,
    remoteController,
    logger = console
  } = {}) {
    this.staging = staging;
    this.api = api;
    this.resultView = resultView;
    this.buildPayload = typeof buildPayload === 'function' ? buildPayload : () => ({});
    this.remoteController = remoteController;
    this.logger = logger;

    this.view = new StagingPanelView({
      root: elements.stagingRoot,
      listElement: elements.stagingList,
      editorElement: elements.stagingEditor,
      pathInput: elements.stagingPath,
      originLabel: elements.stagingOrigin,
      dirtyLabel: elements.stagingDirty,
      updatedLabel: elements.stagingUpdated,
      removeButton: elements.stagingRemoveButton,
      onToolbarAction: (action) => this.handleToolbarAction(action),
      onEditorInput: (value) => this.handleEditorInput(value),
      onSelect: (path) => this.staging.setActive(path)
    });

    this.disposers = [];
  }

  init() {
    this.view.init();
    this.attachListeners();
    this.refreshPanel();
  }

  destroy() {
    while (this.disposers.length) {
      const dispose = this.disposers.pop();
      try {
        dispose?.();
      } catch (error) {
        this.logger.warn('[DashboardStagingController] dispose failed', error);
      }
    }
    this.view.destroy();
  }

  attachListeners() {
    const offChange = this.staging.on('change', () => this.refreshPanel());
    const offActive = this.staging.on('active-change', () => this.refreshPanel());
    this.disposers.push(offChange, offActive);
  }

  handleToolbarAction(action) {
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

  handleEditorInput(value) {
    const active = this.staging.getActive();
    if (!active) {
      return;
    }
    try {
      this.staging.updateContent(active.path, value);
    } catch (error) {
      this.logger.warn('[DashboardStagingController] failed to update staged content', error);
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
      this.refreshPanel();
      this.remoteController?.updatePathInput(trimmed);
      this.remoteController?.setSelection(trimmed);
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
      this.resultView.renderSuccess({
        actionKey: 'fetch',
        label: ACTION_LABEL.fetch || 'fetch',
        payload,
        response
      });
      this.stageFetchedFile(response?.data);
      this.remoteController?.setSelection(active.path);
      this.remoteController?.reapplyListing();
    } catch (error) {
      this.resultView.renderError({
        actionKey: 'fetch',
        label: ACTION_LABEL.fetch || 'fetch',
        error
      });
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
      this.refreshPanel();
      this.remoteController?.updatePathInput(file.path);
      this.remoteController?.setSelection(file.path);
    } catch (error) {
      this.logger.warn('[DashboardStagingController] failed to stage fetched file', error);
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
      this.refreshPanel();
    } catch (error) {
      this.logger.warn('[DashboardStagingController] failed to refresh staged file after upload', error);
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
        this.logger.warn('[DashboardStagingController] failed to mark file clean', error);
      }
    });
    if (active?.path) {
      this.staging.setActive(active.path);
    }
    this.refreshPanel();
  }

  refreshPanel() {
    const active = this.staging.getActive();
    const files = this.staging.toArray().map((file) => ({
      ...file,
      dirty: this.staging.isDirty(file.path)
    }));

    this.view.renderList(files, active?.path ?? null);
    this.view.renderActive(active);
    this.view.updateMeta({
      origin: active?.origin ?? null,
      dirty: active ? this.staging.isDirty(active.path) : false,
      updatedAt: active?.updatedAt ?? null
    });
    this.view.setButtonsState({ hasActive: Boolean(active) });
  }
}
