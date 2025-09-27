/**
 * Express routes exposing system status summaries.
 */

import express from 'express';
import { getStatusController } from './index.mjs';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

export function setupStatusRoutes(app, options = {}) {
  const {
    basePath = '/api/status',
    controller = getStatusController(options),
    logger = console
  } = options;

  const router = express.Router();

  router.get('/summary', async (req, res) => {
    try {
      const validateGitHub = parseBoolean(req.query.validate);
      const summary = await controller.summary({ validateGitHub });
      res.json(summary);
    } catch (error) {
      logger?.error?.(`[StatusRoutes] Failed to build summary: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.use(basePath, router);
}
