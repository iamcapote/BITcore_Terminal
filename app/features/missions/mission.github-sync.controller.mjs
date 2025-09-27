/**
 * Mission GitHub Sync Controller
 * Bridges CLI/HTTP layers with the MissionGitHubSyncService, enforcing guards
 * and providing normalized option merging with configuration defaults.
 */

import { MissionGitHubSyncService } from './github-sync.service.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class MissionGitHubSyncController {
  constructor({ service, defaults = {}, logger = noopLogger } = {}) {
    this.service = service || new MissionGitHubSyncService({ defaults, logger });
    this.defaults = Object.freeze({ ...defaults });
    this.logger = logger ?? noopLogger;
  }

  get config() {
    return this.service.defaultsConfig;
  }

  async status(overrides = {}) {
    const options = this.#mergeOverrides(overrides, { allowEmptyFile: true });
    return this.service.inspect(options);
  }

  async load(overrides = {}) {
    const options = this.#mergeOverrides(overrides);
    const result = await this.service.load(options);
    this.logger.info?.('[MissionGitHubSyncController] load executed', { status: result.status });
    return result;
  }

  async save(overrides = {}, payload) {
    const options = this.#mergeOverrides(overrides);
    const result = await this.service.save(options, payload);
    this.logger.info?.('[MissionGitHubSyncController] save executed', { status: result.status });
    return result;
  }

  async resolve(overrides = {}, resolution = {}) {
    const options = this.#mergeOverrides({ ...overrides, filePath: resolution.filePath ?? overrides.filePath });
    const result = await this.service.resolve(options, { strategy: resolution.strategy });
    this.logger.info?.('[MissionGitHubSyncController] resolve executed', { status: result.status });
    return result;
  }

  #mergeOverrides(overrides = {}, { allowEmptyFile = false } = {}) {
    const merged = {
      repoPath: overrides.repoPath ?? this.defaults.repoPath,
      filePath: overrides.filePath ?? this.defaults.filePath,
      branch: overrides.branch ?? this.defaults.branch,
      remote: overrides.remote ?? this.defaults.remote,
      commitMessage: overrides.commitMessage ?? this.defaults.commitMessage,
      strategy: overrides.strategy ?? this.defaults.strategy
    };

    if (!merged.repoPath) {
      throw new Error('Mission GitHub sync requires repoPath to be configured.');
    }
    if (!allowEmptyFile && !merged.filePath) {
      throw new Error('Mission GitHub sync requires filePath to be configured.');
    }

    return merged;
  }
}
