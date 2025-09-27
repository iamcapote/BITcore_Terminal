/**
 * Express routes for the memory subsystem.
 *
 * Routes default to `/api/memory/*` and delegate to the shared
 * MemoryController instance while applying basic validation and
 * feature-flag driven enablement.
 */

import express from 'express';
import { getMemoryController } from './index.mjs';

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function buildContext(req, githubEnabledFallback) {
  const githubEnabled = githubEnabledFallback ?? isTruthy(
    req.body?.githubEnabled ??
    req.query?.githubEnabled ??
    req.headers['x-memory-github-enabled']
  );

  const user = req.user || req.currentUser || req.session?.currentUser || null;

  return {
    githubEnabled,
    user
  };
}

function handleError(res, logger, error) {
  const message = error?.message || 'Unknown error';
  const status = error?.statusCode || error?.status || (message.includes('Validation') ? 400 : 500);
  logger.error?.(`[MemoryRoutes] ${message}`);
  res.status(status).json({ error: message });
}

export function setupRoutes(app, options = {}) {
  const {
    basePath = '/api/memory',
    controller = getMemoryController(),
    enabled = isTruthy(process.env.MEMORY_HTTP_ENABLED ?? 'true'),
    logger = noopLogger
  } = options;

  if (!enabled) {
    logger.info?.('[MemoryRoutes] HTTP endpoints disabled via feature flag.');
    return;
  }

  const router = express.Router();

  router.post('/store', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.content || typeof body.content !== 'string') {
        return res.status(400).json({ error: 'Memory content is required.' });
      }

      const context = buildContext(req, body.githubEnabled);
      const record = await controller.store(body, context);
      res.json(record);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.post('/recall', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.query || typeof body.query !== 'string') {
        return res.status(400).json({ error: 'Recall query is required.' });
      }

      const context = buildContext(req, body.githubEnabled);
      const memories = await controller.recall(body, context);
      res.json(memories);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.get('/stats', async (req, res) => {
    try {
      const context = buildContext(req, req.query?.githubEnabled);
      const stats = await controller.stats({ ...context, layer: req.query?.layer });
      res.json(stats);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.post('/summarize', async (req, res) => {
    try {
      const body = req.body || {};
      const context = buildContext(req, body.githubEnabled);
      const result = await controller.summarize({ ...context, conversationText: body.conversationText, layer: body.layer });
      res.json(result);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  app.use(basePath, router);
}

export default { setupRoutes };
