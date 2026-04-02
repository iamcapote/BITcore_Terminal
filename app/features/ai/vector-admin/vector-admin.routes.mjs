/**
 * Vector Admin Routes
 * Why: Expose a stable mock-first API for vector store administration parity across CLI and Nova.
 * What: Provides overview, accepted MIME list, and document process endpoints under /api/ai/vectors.
 * How: Routes delegate to vector admin controller with validation-aware error mapping.
 */

import express from 'express';
import { getVectorAdminController, resetVectorAdminController } from './vector-admin.controller.mjs';

function isValidationError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('ValidationError');
}

export function setupVectorAdminRoutes(app, options = {}) {
  const {
    basePath = '/api/ai/vectors',
    enabled = true,
    controller = getVectorAdminController(),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[VectorAdminRoutes] HTTP endpoints disabled via configuration.');
    return;
  }

  const router = express.Router();

  router.get('/overview', async (req, res) => {
    try {
      const snapshot = await controller.getOverview(req.query || {});
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[VectorAdminRoutes] GET /overview failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load vector overview.' });
    }
  });

  router.get('/accepts', async (_req, res) => {
    try {
      const payload = await controller.getAcceptedMimes();
      res.json(payload);
    } catch (error) {
      logger.warn?.('[VectorAdminRoutes] GET /accepts failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load accepted mime list.' });
    }
  });

  router.post('/process', async (req, res) => {
    try {
      const result = await controller.processDocument(req.body || {});
      res.status(result.success ? 200 : 422).json(result);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[VectorAdminRoutes] POST /process failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to process vector document.' });
    }
  });

  app.use(basePath, router);
}

export function resetVectorAdminRoutes() {
  resetVectorAdminController();
}
