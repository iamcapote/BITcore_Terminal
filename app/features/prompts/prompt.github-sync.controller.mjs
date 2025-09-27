/**
 * PromptGitHubSyncController mediates between CLI/HTTP adapters and the
 * PromptGitHubSyncService, applying configuration defaults and logging actions
 * so operators receive consistent messaging across surfaces.
 */

import { PromptGitHubSyncService } from './prompt.github-sync.service.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class PromptGitHubSyncController {
  constructor({ service, defaults = {}, logger = noopLogger } = {}) {
    this.defaults = Object.freeze({ ...defaults });
    this.logger = logger ?? noopLogger;
    this.service = service || new PromptGitHubSyncService({ defaults: this.defaults, logger: this.logger });
  }

  get config() {
    return this.service.defaultsConfig;
  }

  async status(overrides = {}) {
    const options = this.#mergeOverrides(overrides, { allowMissingDirectory: false });
    const result = await this.service.status(options);
    this.logger.debug?.('[PromptGitHubSyncController] status', { status: result.status });
    return result;
  }

  async pull(overrides = {}) {
    const options = this.#mergeOverrides(overrides);
    const result = await this.service.pull(options);
    this.logger.info?.('[PromptGitHubSyncController] pull', { status: result.status });
    return result;
  }

  async push(overrides = {}) {
    const options = this.#mergeOverrides(overrides);
    const result = await this.service.push(options);
    this.logger.info?.('[PromptGitHubSyncController] push', { status: result.status });
    return result;
  }

  async sync(overrides = {}) {
    const options = this.#mergeOverrides(overrides);
    const result = await this.service.sync(options);
    this.logger.info?.('[PromptGitHubSyncController] sync', { status: result.status });
    return result;
  }

  #mergeOverrides(overrides = {}, { allowMissingDirectory = false } = {}) {
    const merged = {
      repoPath: overrides.repoPath ?? this.defaults.repoPath,
      directory: overrides.directory ?? this.defaults.directory,
      branch: overrides.branch ?? this.defaults.branch,
      remote: overrides.remote ?? this.defaults.remote,
      commitMessage: overrides.commitMessage ?? this.defaults.commitMessage
    };

    if (!merged.repoPath) {
      throw new Error('Prompt GitHub sync requires repoPath to be configured.');
    }
    if (!allowMissingDirectory && !merged.directory) {
      throw new Error('Prompt GitHub sync requires a directory setting.');
    }

    return merged;
  }
}

export function createPromptGitHubSyncController(options = {}) {
  return new PromptGitHubSyncController(options);
}
