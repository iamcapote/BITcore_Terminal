/**
 * Prompt HTTP routes.
 *
 * Exposes REST-style endpoints for listing, retrieving, searching, and mutating
 * prompt definitions. These routes mirror the CLI surface so operators can
 * manage prompt definitions from the web dashboard with feature parity.
 */

import express from 'express';
import { getPromptController, getPromptGitHubSyncController, getPromptConfig } from './index.mjs';

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTags(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function actorFromRequest(req) {
  return req.user?.username || req.currentUser?.username || req.session?.currentUser?.username || 'http';
}

function handleError(res, logger, error) {
  const message = error?.message || 'Unknown error';
  const status = error?.statusCode || error?.status || (message.toLowerCase().includes('not found') ? 404 : 400);
  logger?.warn?.('[PromptRoutes] error', { message, status });
  res.status(status).json({ error: message });
}

function parseGitHubOverrides(input = {}) {
  const overrides = {};
  if (input.repoPath || input.repo) {
    overrides.repoPath = input.repoPath ?? input.repo;
  }
  if (input.directory || input.dir) {
    overrides.directory = input.directory ?? input.dir;
  }
  if (input.branch) {
    overrides.branch = input.branch;
  }
  if (input.remote) {
    overrides.remote = input.remote;
  }
  if (input.commitMessage || input['commit-message']) {
    overrides.commitMessage = input.commitMessage ?? input['commit-message'];
  }
  return overrides;
}

export function setupPromptRoutes(app, options = {}) {
  const promptConfig = options.promptConfig || getPromptConfig();
  const {
    basePath = '/api/prompts',
    controller = getPromptController(),
    enabled = options.enabled ?? isTruthy(promptConfig?.httpEnabled ?? true),
    logger = console
  } = options;

  if (!enabled) {
    logger?.info?.('[PromptRoutes] HTTP endpoints disabled via feature flag.');
    return;
  }

  const router = express.Router();
  const githubEnabled = options.githubEnabled ?? Boolean(promptConfig.github?.enabled);
  const githubController = githubEnabled ? (options.githubController || getPromptGitHubSyncController()) : null;

  if (!githubEnabled) {
    logger?.info?.('[PromptRoutes] GitHub sync endpoints disabled.');
  }

  router.get('/', async (req, res) => {
    try {
      const tags = parseTags(req.query?.tags);
      const limit = toInteger(req.query?.limit, undefined);
      const summaries = await controller.list({ tags, limit });
      res.json(summaries);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.get('/search', async (req, res) => {
    try {
      const tags = parseTags(req.query?.tags);
      const limit = toInteger(req.query?.limit, undefined);
      const includeBody = req.query?.includeBody !== undefined
        ? isTruthy(req.query.includeBody)
        : true;
      const results = await controller.search({
        query: req.query?.query ?? '',
        tags,
        limit,
        includeBody
      });
      res.json(results);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.head('/:id', async (req, res) => {
    try {
      const exists = await controller.exists(req.params.id);
      res.status(exists ? 200 : 404).end();
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const record = await controller.get(req.params.id);
      res.json(record);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.post('/', async (req, res) => {
    try {
      const payload = req.body || {};
      const actor = actorFromRequest(req);
      const record = await controller.save(payload, { actor });
      res.status(201).json(record);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const actor = actorFromRequest(req);
      await controller.remove(req.params.id, { actor });
      res.status(204).end();
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  if (githubController) {
    router.get('/github/status', async (req, res) => {
      try {
        const overrides = parseGitHubOverrides(req.query);
        const result = await githubController.status(overrides);
        res.json(result);
      } catch (error) {
        handleError(res, logger, error);
      }
    });

    router.post('/github/pull', async (req, res) => {
      try {
        const overrides = parseGitHubOverrides({ ...req.body, ...req.query });
        const result = await githubController.pull(overrides);
        res.json(result);
      } catch (error) {
        handleError(res, logger, error);
      }
    });

    router.post('/github/push', async (req, res) => {
      try {
        const overrides = parseGitHubOverrides({ ...req.body, ...req.query });
        const result = await githubController.push(overrides);
        res.json(result);
      } catch (error) {
        handleError(res, logger, error);
      }
    });

    router.post('/github/sync', async (req, res) => {
      try {
        const overrides = parseGitHubOverrides({ ...req.body, ...req.query });
        const result = await githubController.sync(overrides);
        res.json(result);
      } catch (error) {
        handleError(res, logger, error);
      }
    });
  }

  app.use(basePath, router);
}

export default { setupPromptRoutes };
