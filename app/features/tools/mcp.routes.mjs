/**
 * MCP Routes
 * Why: Expose MCP registry endpoints for Nova and terminal parity.
 * What: Provides server listing, server tool listing, status toggling, and reconnect actions.
 * How: Routes delegate to the MCP controller and map validation/not-found errors to stable HTTP responses.
 */

import express from 'express';
import { getMcpController, resetMcpController } from './mcp.controller.mjs';

function isValidationError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('ValidationError');
}

function isNotFoundError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('NotFound');
}

export function setupMcpRoutes(app, options = {}) {
  const {
    basePath = '/api/tools/mcp',
    enabled = true,
    controller = getMcpController(),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[McpRoutes] HTTP endpoints disabled via configuration.');
    return;
  }

  const router = express.Router();

  router.get('/servers', async (_req, res) => {
    try {
      const snapshot = await controller.listServers();
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[McpRoutes] GET /servers failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load MCP servers.' });
    }
  });

  router.get('/servers/:serverId/tools', async (req, res) => {
    try {
      const payload = await controller.listTools(req.params.serverId);
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] GET /servers/:serverId/tools failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load MCP tools.' });
    }
  });

  router.get('/servers/:serverId/oauth', async (req, res) => {
    try {
      const payload = await controller.getOAuthState(req.params.serverId);
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] GET /servers/:serverId/oauth failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load MCP OAuth status.' });
    }
  });

  router.post('/servers/:serverId/oauth/initiate', async (req, res) => {
    try {
      const payload = await controller.initiateOAuth(req.params.serverId);
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] POST /servers/:serverId/oauth/initiate failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to initiate MCP OAuth.' });
    }
  });

  router.post('/servers/:serverId/oauth/callback', async (req, res) => {
    try {
      const payload = await controller.completeOAuth(req.params.serverId, req.body || {});
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] POST /servers/:serverId/oauth/callback failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to complete MCP OAuth callback.' });
    }
  });

  router.delete('/servers/:serverId/oauth', async (req, res) => {
    try {
      const payload = await controller.disconnectOAuth(req.params.serverId);
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] DELETE /servers/:serverId/oauth failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to disconnect MCP OAuth.' });
    }
  });

  router.patch('/servers/:serverId', async (req, res) => {
    try {
      const payload = await controller.toggleServer(req.params.serverId, req.body || {});
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] PATCH /servers/:serverId failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to update MCP server.' });
    }
  });

  router.post('/servers/:serverId/reconnect', async (req, res) => {
    try {
      const payload = await controller.reconnectServer(req.params.serverId);
      res.json(payload);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isNotFoundError(error)) {
        res.status(404).json({ error: error.message });
        return;
      }
      logger.warn?.('[McpRoutes] POST /servers/:serverId/reconnect failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to reconnect MCP server.' });
    }
  });

  app.use(basePath, router);
}

export function resetMcpRoutes() {
  resetMcpController();
}
