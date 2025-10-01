/**
 * Research Preferences HTTP Routes
 * Why: Allow clients to persist default research depth/breadth/public visibility settings.
 * What: Exposes GET/PATCH/POST reset endpoints under `/api/preferences/research`.
 * How: Delegates to controller for validation and persistence, returning normalized snapshots.
 */

import express from 'express';
import {
  getResearchPreferencesController,
  resetResearchPreferencesController,
  getDefaultResearchPreferences,
} from './index.mjs';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function handleError(res, logger, error) {
  const message = error?.message || 'Unknown error';
  const status = message.startsWith('ValidationError') ? 400 : 500;
  logger.warn?.('[ResearchPreferencesRoutes] Request failed.', { message });
  res.status(status).json({ error: message });
}

export function setupResearchPreferencesRoutes(app, options = {}) {
  const {
    basePath = '/api/preferences/research',
    controller = getResearchPreferencesController(),
    logger = console,
    enabled = parseBoolean(process.env.RESEARCH_PREFERENCES_HTTP_ENABLED ?? true, true),
  } = options;

  if (!enabled) {
    logger.info?.('[ResearchPreferencesRoutes] HTTP endpoints disabled via feature flag.');
    return;
  }

  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const refresh = parseBoolean(req.query?.refresh, false);
      const preferences = await controller.get({ refresh });
      res.json(preferences);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.get('/defaults', async (req, res) => {
    try {
      const defaults = await controller.defaults?.();
      res.json(defaults ?? getDefaultResearchPreferences());
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.patch('/', async (req, res) => {
    try {
      if (
        !req.body ||
        typeof req.body !== 'object' ||
        Array.isArray(req.body) ||
        Object.keys(req.body).length === 0
      ) {
        return res
          .status(400)
          .json({ error: 'ValidationError: Research preference updates must be a non-empty object.' });
      }
      const preferences = await controller.update(req.body);
      res.json(preferences);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.post('/reset', async (req, res) => {
    try {
      const preferences = await controller.reset();
      res.json(preferences);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  app.use(basePath, router);
}

export function resetResearchPreferencesRoutes() {
  resetResearchPreferencesController();
}

export default { setupResearchPreferencesRoutes };
