/**
 * Model Browser HTTP Routes
 * Why: Serve Venice model metadata for the terminal widget & CLI clients.
 * What: Exposes a GET endpoint returning the catalog snapshot with feature metadata.
 * How: Delegates to the controller, applies feature flags, and normalises errors.
 */

import express from 'express';
import config from '../../../config/index.mjs';
import {
  getModelBrowserController,
  resetModelBrowserController,
} from './model-browser.controller.mjs';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function isFeatureDisabledError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('FeatureDisabled');
}

export function setupModelBrowserRoutes(app, options = {}) {
  const {
    basePath = '/api/models/venice',
    controller = getModelBrowserController(),
    enabled = parseBoolean(
      options.enabled ?? config.terminal?.modelBrowserHttpEnabled ?? true,
      true,
    ),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[ModelBrowserRoutes] HTTP endpoints disabled via feature flag.');
    return;
  }

  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const refresh = parseBoolean(req.query?.refresh, false);
      const snapshot = await controller.getCatalog({ refresh });
      res.json(snapshot);
    } catch (error) {
      if (isFeatureDisabledError(error)) {
        res.status(403).json({ error: error.message });
        return;
      }
      logger.warn?.('[ModelBrowserRoutes] GET failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load model catalog.' });
    }
  });

  app.use(basePath, router);
}

export function resetModelBrowserRoutes() {
  resetModelBrowserController();
}

export default { setupModelBrowserRoutes };
