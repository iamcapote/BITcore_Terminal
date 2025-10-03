/**
 * Why: Provide a single wiring point for GitHub-backed research sync utilities, including the scheduled request poller used by CLI and server.
 * What: Exposes accessors for the research sync configuration, a singleton research request scheduler, and helpers to reset or override dependencies for testing.
 * How: Reads normalized config from `app/config`, composes the request fetcher and scheduler, and hides implementation details behind small factory functions.
 */

import config from '../../../config/index.mjs';
import { fetchResearchRequests } from './request.fetcher.mjs';
import { createResearchRequestScheduler } from './request.scheduler.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const DEFAULT_MAX_REQUESTS_PER_TICK = 10;

let singletonScheduler = null;

function buildSchedulerConfig() {
  const scheduler = config?.research?.scheduler || {};
  const maxRequests = Number.isFinite(scheduler.maxRequestsPerTick) && scheduler.maxRequestsPerTick > 0
    ? Math.trunc(scheduler.maxRequestsPerTick)
    : DEFAULT_MAX_REQUESTS_PER_TICK;

  return Object.freeze({
    enabled: Boolean(scheduler.enabled),
    cron: scheduler.cron || '*/15 * * * *',
    timezone: scheduler.timezone || null,
    runOnStart: scheduler.runOnStart !== false,
    maxRequestsPerTick: maxRequests
  });
}

function buildGitHubConfig() {
  const github = config?.research?.github || {};
  return Object.freeze({
    requestsPath: github.requestsPath || 'requests',
    processedPath: github.processedPath || null
  });
}

export function getResearchSyncConfig() {
  return Object.freeze({
    scheduler: buildSchedulerConfig(),
    github: buildGitHubConfig()
  });
}

export function getResearchSchedulerConfig() {
  return buildSchedulerConfig();
}

export function getResearchGithubConfig() {
  return buildGitHubConfig();
}

function buildResearchRequestScheduler(overrides = {}) {
  const featureConfig = getResearchSyncConfig();
  const schedulerConfig = featureConfig.scheduler;
  const githubConfig = featureConfig.github;
  const logger = overrides.logger || (typeof console !== 'undefined' ? console : noopLogger);
  const controller = overrides.controller;

  const fetcher = overrides.fetcher || (async (fetchOptions = {}) => {
    const limit = Number.isFinite(fetchOptions?.limit) && fetchOptions.limit > 0
      ? Math.trunc(fetchOptions.limit)
      : schedulerConfig.maxRequestsPerTick;

    return fetchResearchRequests({
      controller,
      directory: overrides.directory || githubConfig.requestsPath,
      limit,
      logger
    });
  });

  const schedulerOptions = {
    cronExpression: overrides.cronExpression || schedulerConfig.cron,
    timezone: overrides.timezone ?? schedulerConfig.timezone,
    fetcher,
    handler: overrides.handler,
    logger,
    runOnStart: overrides.runOnStart ?? schedulerConfig.runOnStart,
    maxRequestsPerTick: overrides.maxRequestsPerTick ?? schedulerConfig.maxRequestsPerTick
  };

  if (overrides.schedule) {
    schedulerOptions.schedule = overrides.schedule;
  }
  if (overrides.validate) {
    schedulerOptions.validate = overrides.validate;
  }

  return createResearchRequestScheduler(schedulerOptions);
}

export function getResearchRequestScheduler(overrides = {}) {
  if (overrides.forceNew) {
    return buildResearchRequestScheduler(overrides);
  }
  if (!singletonScheduler) {
    singletonScheduler = buildResearchRequestScheduler(overrides);
  }
  return singletonScheduler;
}

export function resetResearchRequestScheduler() {
  if (singletonScheduler) {
    singletonScheduler.stop?.();
  }
  singletonScheduler = null;
}
