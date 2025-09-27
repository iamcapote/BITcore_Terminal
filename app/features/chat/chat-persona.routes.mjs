/**
 * Chat Persona HTTP Routes
 *
 * Exposes REST endpoints under /api/chat/personas for listing, retrieving, and updating
 * the active chat persona used by the terminal. These routes mirror the persona controls
 * available via the /chat persona CLI subcommands so that the Web UI can stay in sync.
 */

import express from 'express';
import { getChatPersonaController } from './index.mjs';
import { validatePersonaUpdateRequest } from './chat-persona.schema.mjs';
import { userManager } from '../auth/user-manager.mjs';

function handleError(res, logger, error) {
  const message = error?.message || 'Unknown error';
  const status = message.startsWith('ValidationError') || error instanceof RangeError ? 400 : 500;
  logger.warn?.('[ChatPersonaRoutes] Request failed.', { message });
  res.status(status).json({ error: message });
}

function resolveActor(logger) {
  try {
    const actor = userManager.getCurrentUser?.();
    if (!actor) {
      logger?.warn?.('[ChatPersonaRoutes] No authenticated user available.');
    }
    return actor || null;
  } catch (error) {
    logger?.error?.('[ChatPersonaRoutes] Failed to resolve current user.', { error: error.message });
    return null;
  }
}

function requireActor(logger) {
  return (req, res, next) => {
    const actor = resolveActor(logger);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required to manage personas.' });
    }
    req.currentUser = actor;
    next();
  };
}

export function setupChatPersonaRoutes(app, { basePath = '/api/chat/personas', logger = console } = {}) {
  if (!app || typeof app.use !== 'function') {
    throw new TypeError('setupChatPersonaRoutes requires an Express app instance.');
  }

  const controller = getChatPersonaController();
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const snapshot = await controller.list({ includeDefault: true });
      res.json({
        personas: snapshot.personas,
        default: snapshot.default,
        updatedAt: snapshot.updatedAt,
      });
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.get('/default', async (req, res) => {
    try {
      const state = await controller.getDefault();
      res.json(state);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.post('/default', requireActor(logger), async (req, res) => {
    try {
      if (!req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type application/json required.' });
      }

      const { slug } = validatePersonaUpdateRequest(req.body || {});
      const result = await controller.setDefault(slug, { actor: req.currentUser });
      res.json(result);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  router.post('/reset', requireActor(logger), async (req, res) => {
    try {
      const result = await controller.reset({ actor: req.currentUser });
      res.json(result);
    } catch (error) {
      handleError(res, logger, error);
    }
  });

  app.use(basePath, router);
}

export default { setupChatPersonaRoutes };
