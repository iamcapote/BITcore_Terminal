/**
 * Prompt feature entrypoint.
 *
 * Wires the prompt repository, service, and controller into a singleton that
 * can be consumed by CLI handlers, HTTP routes, and the forthcoming self
 * organizer dashboard.
 */

import config from '../../config/index.mjs';
import { createPromptController } from './prompt.controller.mjs';
import { createPromptService } from './prompt.service.mjs';
import { PromptRepository } from './prompt.repository.mjs';
import { createPromptGitHubSyncService } from './prompt.github-sync.service.mjs';
import { PromptGitHubSyncController } from './prompt.github-sync.controller.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

let singletonController = null;
let singletonGitHubSyncController = null;

function getPromptConfig() {
  return config?.prompts || {
    enabled: true,
    httpEnabled: true,
    github: {
      enabled: false
    }
  };
}

function buildDefaultController(overrides = {}) {
  const logger = overrides.logger || noopLogger;
  const repository = overrides.repository || new PromptRepository(overrides.repositoryOptions);
  const service = overrides.service || createPromptService({ repository, logger });

  return createPromptController({ service, logger });
}

export function getPromptController(overrides = {}) {
  if (overrides.forceNew) {
    return buildDefaultController(overrides);
  }

  if (!singletonController) {
    singletonController = buildDefaultController(overrides);
  }

  return singletonController;
}

export function resetPromptController() {
  singletonController = null;
}

function buildPromptGitHubSyncController(overrides = {}) {
  const promptConfig = getPromptConfig();
  const defaults = {
    repoPath: overrides.repoPath || promptConfig.github?.repoPath,
    directory: overrides.directory || promptConfig.github?.directory,
    branch: overrides.branch || promptConfig.github?.branch,
    remote: overrides.remote || promptConfig.github?.remote,
    commitMessage: overrides.commitMessage || promptConfig.github?.commitMessage
  };

  const service = overrides.service || createPromptGitHubSyncService({
    defaults,
    logger: overrides.logger || noopLogger
  });

  return new PromptGitHubSyncController({
    service,
    defaults,
    logger: overrides.logger || noopLogger
  });
}

export function getPromptGitHubSyncController(overrides = {}) {
  if (overrides.forceNew) {
    return buildPromptGitHubSyncController(overrides);
  }
  if (!singletonGitHubSyncController) {
    singletonGitHubSyncController = buildPromptGitHubSyncController(overrides);
  }
  return singletonGitHubSyncController;
}

export function resetPromptGitHubSyncController() {
  singletonGitHubSyncController = null;
}

export { PromptRepository, getPromptConfig };
