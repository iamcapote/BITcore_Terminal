/**
 * Mission feature entrypoint.
 *
 * Exposes helpers to obtain the shared MissionController instance used by
 * CLI and future HTTP/WebSocket layers while ensuring services are wired
 * consistently.
 */

import config from '../../config/index.mjs';
import { MissionController } from './mission.controller.mjs';
import { MissionRepository } from './mission.repository.mjs';
import { MissionService } from './mission.service.mjs';
import { MissionTemplatesRepository } from './mission.templates.repository.mjs';
import { createMissionScheduler } from './mission.scheduler.mjs';
import { createMissionTelemetry } from './mission.telemetry.mjs';
import { MissionSchedulerStateRepository } from './mission.scheduler-state.repository.mjs';
import { MissionGitHubSyncController } from './mission.github-sync.controller.mjs';
import { createMissionGitHubSyncService } from './github-sync.service.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

let singletonController = null;
let singletonScheduler = null;
let singletonTemplatesRepository = null;
let singletonSchedulerStateRepository = null;
let singletonGitHubSyncController = null;

function getMissionConfig() {
  return config?.missions || {
    enabled: true,
    schedulerEnabled: true,
    httpEnabled: true,
    telemetryEnabled: true,
    pollingIntervalMs: undefined
  };
}

function buildDefaultController(overrides = {}) {
  const logger = overrides.logger || noopLogger;
  const repository = overrides.repository || new MissionRepository({ logger });
  const service = overrides.service || new MissionService({ repository, logger });
  return new MissionController({ service, logger });
}

export function getMissionController(overrides = {}) {
  if (overrides.forceNew) {
    return buildDefaultController(overrides);
  }
  if (!singletonController) {
    singletonController = buildDefaultController(overrides);
  }
  return singletonController;
}

export function resetMissionController() {
  singletonController = null;
}

function buildDefaultScheduler(overrides = {}) {
  const { forceNew, controller, telemetry, logger = noopLogger, stateRepository, ...rest } = overrides;
  const resolvedController = controller || getMissionController();
  const resolvedTelemetry = telemetry || createMissionTelemetry({ logger });
  const missionConfig = getMissionConfig();
  const intervalMs = rest.intervalMs ?? missionConfig.pollingIntervalMs;
  return createMissionScheduler({
    controller: resolvedController,
    telemetry: resolvedTelemetry,
    logger,
    intervalMs,
    stateRepository: stateRepository || getMissionSchedulerStateRepository(),
    ...rest
  });
}

export function getMissionScheduler(overrides = {}) {
  if (overrides.forceNew) {
    return buildDefaultScheduler(overrides);
  }
  if (!singletonScheduler) {
    singletonScheduler = buildDefaultScheduler(overrides);
  }
  return singletonScheduler;
}

export function resetMissionScheduler() {
  if (singletonScheduler) {
    singletonScheduler.stop?.();
  }
  singletonScheduler = null;
}

function buildSchedulerStateRepository(overrides = {}) {
  const { forceNew, ...rest } = overrides;
  return new MissionSchedulerStateRepository(rest);
}

export function getMissionSchedulerStateRepository(overrides = {}) {
  if (overrides.forceNew) {
    return buildSchedulerStateRepository(overrides);
  }
  if (!singletonSchedulerStateRepository) {
    singletonSchedulerStateRepository = buildSchedulerStateRepository(overrides);
  }
  return singletonSchedulerStateRepository;
}

export function resetMissionSchedulerStateRepository() {
  singletonSchedulerStateRepository = null;
}

function buildTemplatesRepository(overrides = {}) {
  const { forceNew, ...rest } = overrides;
  return new MissionTemplatesRepository(rest);
}

export function getMissionTemplatesRepository(overrides = {}) {
  if (overrides.forceNew) {
    return buildTemplatesRepository(overrides);
  }
  if (!singletonTemplatesRepository) {
    singletonTemplatesRepository = buildTemplatesRepository(overrides);
  }
  return singletonTemplatesRepository;
}

export function resetMissionTemplatesRepository() {
  singletonTemplatesRepository = null;
}

function buildMissionGitHubSyncController(overrides = {}) {
  const missionConfig = getMissionConfig();
  const defaults = {
    repoPath: overrides.repoPath || missionConfig.github?.repoPath,
    filePath: overrides.filePath || missionConfig.github?.filePath,
    branch: overrides.branch || missionConfig.github?.defaultBranch,
    remote: overrides.remote || missionConfig.github?.remote,
    commitMessage: overrides.commitMessage || missionConfig.github?.commitMessage,
    strategy: overrides.strategy || missionConfig.github?.strategy
  };
  const service = overrides.service || createMissionGitHubSyncService({
    defaults,
    logger: overrides.logger || noopLogger
  });
  return new MissionGitHubSyncController({
    service,
    defaults,
    logger: overrides.logger || noopLogger
  });
}

export function getMissionGitHubSyncController(overrides = {}) {
  if (overrides.forceNew) {
    return buildMissionGitHubSyncController(overrides);
  }
  if (!singletonGitHubSyncController) {
    singletonGitHubSyncController = buildMissionGitHubSyncController(overrides);
  }
  return singletonGitHubSyncController;
}

export function resetMissionGitHubSyncController() {
  singletonGitHubSyncController = null;
}

export {
  MissionController,
  MissionService,
  MissionRepository,
  MissionTemplatesRepository,
  createMissionTelemetry,
  MissionSchedulerStateRepository,
  getMissionConfig,
  MissionGitHubSyncController,
  createMissionGitHubSyncService
};
