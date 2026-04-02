/**
 * Files Routes
 * Why: Expose filesystem explorer primitives to Nova and CLI-adjacent operator flows.
 * What: Provides list/read/preview/search endpoints under /api/files.
 * How: Delegates to FilesController and maps validation/not-found errors to stable HTTP statuses.
 */

import express from 'express';
import { getFilesController, resetFilesController } from './files.controller.mjs';
import { getWorkspaceGitController, resetWorkspaceGitController } from './workspace-git.controller.mjs';

function isValidationError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('ValidationError');
}

function isNotFoundError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('NotFoundError');
}

export function setupFileRoutes(app, options = {}) {
  const {
    basePath = '/api/files',
    enabled = true,
    controller = getFilesController(options),
    gitController = getWorkspaceGitController(options),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[FilesRoutes] HTTP endpoints disabled via configuration.');
    return;
  }

  const router = express.Router();

  router.get('/list', async (req, res) => {
    try {
      const path = typeof req.query.path === 'string' ? req.query.path : '.';
      const snapshot = await controller.listDirectory(path);
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /list failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to list directory.' });
    }
  });

  router.get('/tree', async (req, res) => {
    try {
      const path = typeof req.query.path === 'string' ? req.query.path : '.';
      const depth = req.query.depth;
      const snapshot = await controller.getTree(path, { depth });
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /tree failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load tree.' });
    }
  });

  router.get('/read', async (req, res) => {
    try {
      const path = typeof req.query.path === 'string' ? req.query.path : '';
      const maxBytes = req.query.maxBytes;
      const snapshot = await controller.readFile(path, { maxBytes });
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /read failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to read file.' });
    }
  });

  router.get('/preview', async (req, res) => {
    try {
      const path = typeof req.query.path === 'string' ? req.query.path : '';
      const snapshot = await controller.previewFile(path);
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /preview failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to preview file.' });
    }
  });

  router.post('/search', async (req, res) => {
    try {
      const payload = req.body || {};
      const query = typeof payload.query === 'string' ? payload.query : '';
      const path = typeof payload.path === 'string' ? payload.path : '.';
      const limit = payload.limit;
      const snapshot = await controller.search(query, { path, limit });
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] POST /search failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to search files.' });
    }
  });

  router.get('/git/status', async (_req, res) => {
    try {
      const snapshot = await gitController.getStatus();
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /git/status failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load git status.' });
    }
  });

  router.get('/git/branches', async (_req, res) => {
    try {
      const snapshot = await gitController.listBranches();
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /git/branches failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load branches.' });
    }
  });

  router.post('/git/branches', async (req, res) => {
    try {
      const payload = req.body || {};
      const name = typeof payload.name === 'string' ? payload.name : '';
      const from = typeof payload.from === 'string' && payload.from.trim() ? payload.from : null;
      const snapshot = await gitController.createBranch(name, from);
      res.status(201).json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] POST /git/branches failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to create branch.' });
    }
  });

  router.post('/git/checkout', async (req, res) => {
    try {
      const payload = req.body || {};
      const branch = typeof payload.branch === 'string' ? payload.branch : '';
      const snapshot = await gitController.checkoutBranch(branch);
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] POST /git/checkout failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to checkout branch.' });
    }
  });

  router.get('/git/history', async (req, res) => {
    try {
      const filePath = typeof req.query.path === 'string' ? req.query.path : '';
      const limit = req.query.limit;
      const snapshot = await gitController.getFileHistory(filePath, { limit });
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] GET /git/history failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load file history.' });
    }
  });

  router.post('/git/revert', async (req, res) => {
    try {
      const payload = req.body || {};
      const filePath = typeof payload.path === 'string' ? payload.path : '';
      const snapshot = await gitController.revertFile(filePath);
      res.json(snapshot);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[FilesRoutes] POST /git/revert failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to revert file.' });
    }
  });

  app.use(basePath, router);
}

export function resetFileRoutes() {
  resetFilesController();
  resetWorkspaceGitController();
}
