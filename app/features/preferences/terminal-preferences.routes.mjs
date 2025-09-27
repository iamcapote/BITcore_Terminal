/**
 * Terminal Preferences HTTP Routes
 * Why: Allow web and CLI clients to retrieve and persist operator terminal preferences.
 * What: Exposes GET/PATCH endpoints plus a reset helper under `/api/preferences/terminal`.
 * How: Delegates to the controller while handling validation, JSON parsing, and logging.
 */

import express from 'express';
import {
  getTerminalPreferencesController,
  resetTerminalPreferencesController,
} from './index.mjs';

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function handleError(res, logger, error) {
  const message = error?.message || 'Unknown error';
  const status = message.startsWith('ValidationError') ? 400 : 500;
  logger.warn?.('[TerminalPreferencesRoutes] Request failed.', { message });
  res.status(status).json({ error: message });
}

export function setupTerminalPreferencesRoutes(app, options = {}) {
  const {
    basePath = '/api/preferences/terminal',
    controller = getTerminalPreferencesController(),
    logger = console,
    enabled = parseBoolean(process.env.TERMINAL_PREFERENCES_HTTP_ENABLED ?? true, true),
  } = options;

  if (!enabled) {
    logger.info?.('[TerminalPreferencesRoutes] HTTP endpoints disabled via feature flag.');
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
          .json({ error: 'ValidationError: Terminal preference updates must be a non-empty object.' });
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

export function resetTerminalPreferencesRoutes() {
  resetTerminalPreferencesController();
}

export default { setupTerminalPreferencesRoutes };
