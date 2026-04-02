/**
 * Computer Runtime Routes
 * Why: Provide web parity for machine runtime controls modeled after Agent Zero execution settings.
 * What: Exposes GET/PATCH runtime endpoints under /api/tools/computer/runtime.
 * How: Delegates to controller methods and maps validation errors to HTTP 400.
 */

import express from 'express';
import { getComputerController, resetComputerController } from './computer.controller.mjs';

function isValidationError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('ValidationError');
}

export function setupComputerRoutes(app, options = {}) {
  const {
    basePath = '/api/tools/computer',
    enabled = true,
    controller = getComputerController(),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[ComputerRoutes] HTTP endpoints disabled via configuration.');
    return;
  }

  const router = express.Router();

  router.get('/runtime', async (_req, res) => {
    try {
      const snapshot = await controller.getRuntime();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[ComputerRoutes] GET /runtime failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load computer runtime.' });
    }
  });

  router.patch('/runtime', async (req, res) => {
    try {
      const snapshot = await controller.patchRuntime(req.body || {});
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[ComputerRoutes] PATCH /runtime failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to update computer runtime.' });
    }
  });

  app.use(basePath, router);
}

export function resetComputerRoutes() {
  resetComputerController();
}
