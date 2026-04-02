/**
 * Swarm Routes
 * Why: Expose a stable mock-first swarm API for Nova and CLI parity.
 * What: Provides overview, capabilities, and delegation endpoints under /api/ai/swarm.
 * How: Routes call the swarm controller and normalize validation/feature errors.
 */

import express from 'express';
import { getSwarmController, resetSwarmController } from './swarm.controller.mjs';

function isValidationError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('ValidationError');
}

function isNotFoundError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('NotFound');
}

export function setupAgentSwarmRoutes(app, options = {}) {
  const {
    basePath = '/api/ai/swarm',
    enabled = true,
    controller = getSwarmController(),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[SwarmRoutes] HTTP endpoints disabled via configuration.');
    return;
  }

  const router = express.Router();

  router.get('/overview', async (_req, res) => {
    try {
      const snapshot = await controller.getOverview();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[SwarmRoutes] GET /overview failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load swarm overview.' });
    }
  });

  router.get('/runs', async (_req, res) => {
    try {
      const snapshot = await controller.getRuns();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[SwarmRoutes] GET /runs failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load swarm runs.' });
    }
  });

  router.get('/clarification', async (_req, res) => {
    try {
      const snapshot = await controller.getClarification();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[SwarmRoutes] GET /clarification failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load clarification state.' });
    }
  });

  router.get('/graph', async (_req, res) => {
    try {
      const snapshot = await controller.getGraph();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[SwarmRoutes] GET /graph failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load swarm graph state.' });
    }
  });

  router.get('/capabilities', async (_req, res) => {
    try {
      const snapshot = await controller.getCapabilities();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[SwarmRoutes] GET /capabilities failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load swarm capabilities.' });
    }
  });

  router.patch('/capabilities', async (req, res) => {
    try {
      const snapshot = await controller.patchCapabilities(req.body || {});
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[SwarmRoutes] PATCH /capabilities failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to update swarm capabilities.' });
    }
  });

  router.patch('/clarification', async (req, res) => {
    try {
      const snapshot = await controller.patchClarification(req.body || {});
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[SwarmRoutes] PATCH /clarification failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to update clarification settings.' });
    }
  });

  router.post('/clarification/respond', async (req, res) => {
    try {
      const snapshot = await controller.respondClarification(req.body || {});
      res.status(202).json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[SwarmRoutes] POST /clarification/respond failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to process clarification response.' });
    }
  });

  router.patch('/graph', async (req, res) => {
    try {
      const snapshot = await controller.patchGraph(req.body || {});
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[SwarmRoutes] PATCH /graph failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to update graph state.' });
    }
  });

  router.post('/graph/message', async (req, res) => {
    try {
      const snapshot = await controller.appendGraphMessage(req.body || {});
      res.status(202).json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[SwarmRoutes] POST /graph/message failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to append graph message.' });
    }
  });

  router.post('/delegate', async (req, res) => {
    try {
      const record = await controller.delegate(req.body || {});
      res.status(202).json(record);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[SwarmRoutes] POST /delegate failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to queue swarm delegation.' });
    }
  });

  /* ── Checkpoint routes (Pass 12 / Deerflow interrupt-resume) ── */

  router.get('/checkpoint', async (_req, res) => {
    try {
      const snapshot = await controller.listCheckpoints();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[SwarmRoutes] GET /checkpoint failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to list checkpoints.' });
    }
  });

  router.get('/checkpoint/:workflowId', async (req, res) => {
    try {
      const snapshot = await controller.getCheckpoint(req.params.workflowId);
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
      if (isNotFoundError(error)) { res.status(404).json({ error: error.message }); return; }
      logger.warn?.('[SwarmRoutes] GET /checkpoint/:id failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load checkpoint.' });
    }
  });

  router.put('/checkpoint/:workflowId', async (req, res) => {
    try {
      const snapshot = await controller.saveCheckpoint(req.params.workflowId, req.body || {});
      res.status(201).json(snapshot);
    } catch (error) {
      if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
      logger.warn?.('[SwarmRoutes] PUT /checkpoint/:id failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to save checkpoint.' });
    }
  });

  router.post('/checkpoint/:workflowId/resume', async (req, res) => {
    try {
      const snapshot = await controller.resumeCheckpoint(req.params.workflowId, req.body || {});
      res.status(202).json(snapshot);
    } catch (error) {
      if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
      if (isNotFoundError(error)) { res.status(404).json({ error: error.message }); return; }
      logger.warn?.('[SwarmRoutes] POST /checkpoint/:id/resume failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to resume checkpoint.' });
    }
  });

  router.delete('/checkpoint/:workflowId', async (req, res) => {
    try {
      const result = await controller.abandonCheckpoint(req.params.workflowId);
      res.json(result);
    } catch (error) {
      if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
      if (isNotFoundError(error)) { res.status(404).json({ error: error.message }); return; }
      logger.warn?.('[SwarmRoutes] DELETE /checkpoint/:id failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to abandon checkpoint.' });
    }
  });

  app.use(basePath, router);
}

export function resetAgentSwarmRoutes() {
  resetSwarmController();
}
