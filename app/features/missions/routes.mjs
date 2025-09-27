/**
 * Express routes for the mission subsystem.
 *
 * Provides REST-style adapters for listing missions, triggering scheduler
 * actions, and running individual missions from the web UI. Feature flags
 * control availability of both the core mission functionality and the HTTP
 * surface area.
 */

import express from 'express';
import {
  getMissionController,
  getMissionScheduler,
  getMissionConfig,
  getMissionTemplatesRepository
} from './index.mjs';

const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'on']);

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE.has(String(value).trim().toLowerCase());
}

function normalizeFilter(query = {}) {
  const filter = {};
  if (query.status) {
    filter.status = query.status;
  }
  if (query.tag) {
    filter.tag = query.tag;
  }
  if (query['include-disabled'] !== undefined) {
    filter.includeDisabled = isTruthy(query['include-disabled']);
  }
  return filter;
}

function errorResponse(res, logger, error, status = 500) {
  const message = error?.message || 'Unknown error';
  logger.error?.(`[MissionRoutes] ${message}`);
  res.status(status).json({ error: message });
}

function respondValidationError(res, message = 'Mission payload must be a JSON object.') {
  res.status(400).json({ error: message });
}

function mapMissionErrorStatus(error) {
  if (!error) return 500;
  if (error instanceof TypeError || error instanceof RangeError) {
    return 400;
  }
  const message = String(error.message || '').toLowerCase();
  if (message.includes('not found')) {
    return 404;
  }
  if (message.includes('invalid') || message.includes('must')) {
    return 400;
  }
  return 500;
}

function handleMissionError(res, logger, error) {
  const status = mapMissionErrorStatus(error);
  return errorResponse(res, logger, error, status);
}

export function setupMissionRoutes(app, options = {}) {
  const missionConfig = options.missionConfig || getMissionConfig();
  const logger = options.logger || noopLogger;
  if (!missionConfig.enabled || !missionConfig.httpEnabled) {
    logger.info?.('[MissionRoutes] HTTP endpoints disabled via feature flag.');
    return;
  }

  const basePath = options.basePath || '/api/missions';
  const controller = options.controller || getMissionController();
  const scheduler = options.scheduler || getMissionScheduler();
  const templatesRepository = options.templatesRepository || getMissionTemplatesRepository();
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const filter = normalizeFilter(req.query);
      const missions = await controller.list(filter);
      res.json({ missions });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.get('/state', async (req, res) => {
    try {
      const state = typeof scheduler.getState === 'function'
        ? scheduler.getState()
        : { running: scheduler.isRunning?.() ?? false };
      res.json({
        featureEnabled: missionConfig.enabled,
        schedulerEnabled: missionConfig.schedulerEnabled,
        telemetryEnabled: missionConfig.telemetryEnabled,
        state
      });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.get('/templates', async (req, res) => {
    try {
      const templates = await templatesRepository.listTemplates();
      res.json({ templates });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.get('/templates/:slug', async (req, res) => {
    try {
      const template = await templatesRepository.getTemplate(req.params.slug);
      if (!template) {
        return res.status(404).json({ error: `Template '${req.params.slug}' not found.` });
      }
      res.json({ template });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.put('/templates/:slug', async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Template payload must be a JSON object.' });
    }
    try {
      const existing = await templatesRepository.getTemplate(req.params.slug);
      const template = await templatesRepository.saveTemplate({ slug: req.params.slug, ...req.body });
      res.status(existing ? 200 : 201).json({ template });
    } catch (error) {
      const status = mapMissionErrorStatus(error);
      errorResponse(res, logger, error, status);
    }
  });

  router.get('/:missionId', async (req, res) => {
    try {
      const mission = await controller.get(req.params.missionId);
      if (!mission) {
        return res.status(404).json({ error: `Mission '${req.params.missionId}' not found.` });
      }
      res.json({ mission });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.delete('/templates/:slug', async (req, res) => {
    try {
      await templatesRepository.deleteTemplate(req.params.slug);
      res.json({ success: true });
    } catch (error) {
      const status = mapMissionErrorStatus(error);
      errorResponse(res, logger, error, status);
    }
  });

  router.post('/', async (req, res) => {
    if (!isPlainObject(req.body)) {
      return respondValidationError(res);
    }
    try {
      const mission = await controller.create(req.body);
      res.status(201).json({ mission });
    } catch (error) {
      handleMissionError(res, logger, error);
    }
  });

  router.patch('/:missionId', async (req, res) => {
    if (!isPlainObject(req.body)) {
      return respondValidationError(res);
    }
    try {
      const updated = await controller.update(req.params.missionId, req.body);
      res.json({ mission: updated });
    } catch (error) {
      handleMissionError(res, logger, error);
    }
  });

  router.delete('/:missionId', async (req, res) => {
    try {
      const removed = await controller.remove(req.params.missionId);
      res.json({ mission: removed });
    } catch (error) {
      handleMissionError(res, logger, error);
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const missionId = req.body?.missionId || req.body?.id;
      if (!missionId) {
        return res.status(400).json({ error: "Body must include 'missionId'." });
      }
      const mission = await controller.get(missionId);
      if (!mission) {
        return res.status(404).json({ error: `Mission '${missionId}' not found.` });
      }
      const result = await scheduler.runMission(mission, { forced: true });
      res.json({ result });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.post('/tick', async (req, res) => {
    if (!missionConfig.schedulerEnabled) {
      return res.status(403).json({ error: 'Scheduler tick is disabled by feature flag.' });
    }
    try {
      await scheduler.trigger();
      res.json({ success: true });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.post('/start', async (req, res) => {
    if (!missionConfig.schedulerEnabled) {
      return res.status(403).json({ error: 'Mission scheduler start blocked by feature flag.' });
    }
    try {
      scheduler.start();
      res.json({ success: true });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  router.post('/stop', async (req, res) => {
    if (!missionConfig.schedulerEnabled) {
      return res.status(403).json({ error: 'Mission scheduler stop blocked by feature flag.' });
    }
    try {
      scheduler.stop();
      res.json({ success: true });
    } catch (error) {
      errorResponse(res, logger, error);
    }
  });

  app.use(basePath, router);
}

export default { setupMissionRoutes };
