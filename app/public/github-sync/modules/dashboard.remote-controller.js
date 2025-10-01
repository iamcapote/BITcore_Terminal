/**
 * Why: Separate remote browser interactions from the dashboard controller for clarity and reuse.
 * What: Manages remote listing state, handles navigation actions, and delegates API triggers back to the dashboard.
 * How: Wraps RemoteBrowserView callbacks, maintains selection/path state, and exposes helpers for the controller.
 */

import { RemoteBrowserView } from './dashboard.remote-view.js';

export class DashboardRemoteController {
  constructor({ elements = {}, runAction, logger = console } = {}) {
    this.elements = elements;
    this.runAction = typeof runAction === 'function' ? runAction : () => Promise.resolve();
    this.logger = logger;

    this.listing = null;
    this.selectionPath = null;

    this.view = new RemoteBrowserView({
      listElement: elements.remoteList,
      emptyElement: elements.remoteEmpty,
      pathElement: elements.remotePath,
      browserElement: elements.remoteBrowser,
      onNavigate: (path) => this.handleNavigate(path),
      onFetch: (path) => this.handleFetch(path),
      onRefresh: () => this.handleRefresh(),
      onUp: () => this.handleUp()
    });
  }

  init() {
    this.view.init();
    this.view.render(null);
  }

  destroy() {
    this.view.destroy();
  }

  applyListing(listing, payload = {}) {
    this.listing = listing || null;
    const pathOverride = typeof payload.path === 'string' ? payload.path : undefined;
    this.view.render(this.listing, {
      selectionPath: this.selectionPath,
      pathOverride
    });
  }

  reapplyListing() {
    this.applyListing(this.listing || null);
  }

  clearSelection() {
    this.selectionPath = null;
    this.view.setSelection(null);
  }

  setSelection(path) {
    this.selectionPath = path ? String(path) : null;
    this.view.setSelection(this.selectionPath);
  }

  getCurrentPath() {
    if (typeof this.listing?.path === 'string') {
      return this.listing.path;
    }
    return this.elements.pathInput?.value?.trim() ?? '';
  }

  updatePathInput(path) {
    if (this.elements.pathInput) {
      this.elements.pathInput.value = path ?? '';
    }
  }

  handleNavigate(path) {
    const normalized = typeof path === 'string' ? path.trim() : '';
    this.clearSelection();
    this.updatePathInput(normalized);
    this.runAction('list', { path: normalized }).catch((error) => {
      this.logger.warn('[DashboardRemoteController] list action failed', error);
    });
  }

  handleFetch(path) {
    const normalized = typeof path === 'string' ? path.trim() : '';
    if (!normalized) {
      return;
    }
    this.selectionPath = normalized;
    this.view.setSelection(normalized);
    this.updatePathInput(normalized);
    this.runAction('fetch', { path: normalized }).catch((error) => {
      this.logger.warn('[DashboardRemoteController] fetch action failed', error);
    });
  }

  handleRefresh() {
    const currentPath = this.getCurrentPath();
    this.updatePathInput(currentPath || '');
    this.runAction('list', { path: currentPath || '', keepSelection: true }).catch((error) => {
      this.logger.warn('[DashboardRemoteController] refresh action failed', error);
    });
  }

  handleUp() {
    const currentPath = this.getCurrentPath();
    if (!currentPath) {
      return;
    }
    const sanitized = currentPath.replace(/\\/g, '/');
    const segments = sanitized.split('/').filter(Boolean);
    if (segments.length === 0) {
      this.handleNavigate('');
      return;
    }
    segments.pop();
    const parentPath = segments.join('/');
    this.handleNavigate(parentPath);
  }
}
