/**
 * Why: Encapsulate dashboard status rendering so the controller can delegate UI updates.
 * What: Wraps result status, metadata, and payload output rendering with helper methods.
 * How: Receives DOM nodes at construction and exposes setStatus/success/error methods used by the dashboard.
 */

import { GitHubSyncError } from './api.js';
import { ACTION_MAP, ACTION_LABEL } from './dashboard.constants.js';

export class DashboardResultView {
  constructor({
    containerElement,
    statusElement,
    metaElement,
    outputElement
  } = {}) {
    this.container = containerElement || null;
    this.statusElement = statusElement || null;
    this.metaElement = metaElement || null;
    this.outputElement = outputElement || null;
  }

  setStatus(message, state = 'idle') {
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
    if (this.container) {
      this.container.dataset.state = state;
    }
  }

  renderSuccess({ actionKey, label, payload, response }) {
    const resolvedLabel = label || ACTION_LABEL[actionKey] || actionKey;
    this.setStatus(`${resolvedLabel} succeeded`, 'success');
    this.renderMeta({ actionKey, payload, response });
    this.renderOutput({ actionKey, payload, response });
  }

  renderError({ actionKey, label, error }) {
    const resolvedLabel = label || ACTION_LABEL[actionKey] || actionKey;
    const message = error instanceof GitHubSyncError
      ? error.message
      : (error?.message || 'Unknown error');

    this.setStatus(`${resolvedLabel} failed: ${message}`, 'error');
    this.renderErrorMeta(error);
    this.renderErrorOutput({ message, error });
  }

  renderMeta({ payload, response }) {
    if (!this.metaElement) {
      return;
    }
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
    if (Array.isArray(response?.data?.entries)) {
      metadata.push(`Entries: ${response.data.entries.length}`);
    }
    this.metaElement.textContent = metadata.join(' · ');
  }

  renderOutput({ actionKey, payload, response }) {
    if (!this.outputElement) {
      return;
    }
    const action = response?.action || payload?.action || ACTION_MAP[actionKey];
    const view = {
      action,
      ok: response?.ok ?? true,
      data: response?.data ?? null,
      meta: response?.meta ?? null
    };
    this.outputElement.textContent = JSON.stringify(view, null, 2);
  }

  renderErrorMeta(error) {
    if (!this.metaElement) {
      return;
    }
    const metadata = [];
    if (error instanceof GitHubSyncError) {
      if (error.status) {
        metadata.push(`HTTP ${error.status}`);
      }
      if (error.correlationId) {
        metadata.push(`Correlation: ${error.correlationId}`);
      }
    }
    this.metaElement.textContent = metadata.join(' · ');
  }

  renderErrorOutput({ message, error }) {
    if (!this.outputElement) {
      return;
    }
    const payload = {
      message,
      details: error instanceof GitHubSyncError ? error.details ?? null : null
    };
    this.outputElement.textContent = JSON.stringify(payload, null, 2);
  }
}
