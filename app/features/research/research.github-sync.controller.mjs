/**
 * Thin controller that adapts GitHubResearchSyncService responses for
 * higher level consumers (HTTP, CLI, WebSocket).
 */

import { createGitHubResearchSyncService, GitHubResearchSyncService } from './research.github-sync.service.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class GitHubResearchSyncController {
  constructor({ service, logger = noopLogger } = {}) {
    this.service = service instanceof GitHubResearchSyncService ? service : (service || createGitHubResearchSyncService());
    this.logger = logger ?? noopLogger;
  }

  async verify() {
    return this.service.verify();
  }

  async listEntries(options = {}) {
    const listing = await this.service.pullDirectory(options);
    return Object.freeze({
      path: listing.path,
      ref: listing.ref,
      entries: listing.entries
    });
  }

  async fetchFile(options = {}) {
    return this.service.pullFile(options);
  }

  async pushBatch(options = {}) {
    const { files, message, branch } = options;
    const summaries = await this.service.pushFiles({ files, message, branch });
    return Object.freeze({ ok: true, summaries });
  }

  async uploadFile(options = {}) {
    const { path, content, message, branch } = options;
    const summary = await this.service.uploadFile({ path, content, message, branch });
    return Object.freeze({
      ok: true,
      summary
    });
  }
}

let singletonController = null;

export function getGitHubResearchSyncController(overrides = {}) {
  if (overrides.forceNew) {
    return new GitHubResearchSyncController(overrides);
  }
  if (!singletonController) {
    singletonController = new GitHubResearchSyncController(overrides);
  }
  return singletonController;
}

export function resetGitHubResearchSyncController() {
  singletonController = null;
}
