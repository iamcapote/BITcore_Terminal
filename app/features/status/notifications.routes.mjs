/**
 * Why: Expose the backend notification center to Nova and CLI with full CRUD parity.
 * What: REST endpoints for listing, enqueuing, dismissing, and clearing notifications.
 * How: Routes delegate to notification-center.service; validation and NotFound errors mapped to stable HTTP codes.
 *
 * Endpoints
 *   GET    /api/notifications             — list active queue and history (filter: severity, category, dismissed)
 *   POST   /api/notifications             — enqueue a new notification
 *   PATCH  /api/notifications/:id/dismiss — dismiss one notification
 *   POST   /api/notifications/dismiss-all — dismiss all active notifications
 *   DELETE /api/notifications/history     — clear notification history
 */

import express from 'express';
import { getNotificationCenterService, resetNotificationCenterService } from '../../infrastructure/notification-center.service.mjs';

function isValidationError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('ValidationError');
}

function isNotFoundError(error) {
  return typeof error?.message === 'string' && error.message.startsWith('NotFound');
}

export function setupNotificationRoutes(app, options = {}) {
  const {
    basePath = '/api/notifications',
    enabled = true,
    service = getNotificationCenterService(),
    logger = console,
  } = options;

  if (!enabled) {
    logger.info?.('[NotificationRoutes] Disabled via configuration.');
    return;
  }

  const router = express.Router();

  /* ── GET / — list ──────────────────────────────────────────── */
  router.get('/', (req, res) => {
    try {
      const filter = {};
      if (req.query.severity) filter.severity = String(req.query.severity);
      if (req.query.category) filter.category = String(req.query.category);
      if (req.query.dismissed === 'false') filter.dismissed = false;
      const snapshot = service.list(filter);
      res.json(snapshot);
    } catch (error) {
      logger.warn?.('[NotificationRoutes] GET / failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to list notifications.' });
    }
  });

  /* ── POST / — enqueue ──────────────────────────────────────── */
  router.post('/', (req, res) => {
    try {
      const record = service.enqueue(req.body || {});
      res.status(201).json(record);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.warn?.('[NotificationRoutes] POST / failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to enqueue notification.' });
    }
  });

  /* ── PATCH /:id/dismiss — dismiss one ─────────────────────── */
  router.patch('/:id/dismiss', (req, res) => {
    try {
      const result = service.dismiss(req.params.id);
      res.json(result);
    } catch (error) {
      if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
      if (isNotFoundError(error)) { res.status(404).json({ error: error.message }); return; }
      logger.warn?.('[NotificationRoutes] PATCH /:id/dismiss failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to dismiss notification.' });
    }
  });

  /* ── POST /dismiss-all — dismiss all ──────────────────────── */
  router.post('/dismiss-all', (_req, res) => {
    try {
      const result = service.dismissAll();
      res.json(result);
    } catch (error) {
      logger.warn?.('[NotificationRoutes] POST /dismiss-all failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to dismiss all notifications.' });
    }
  });

  /* ── DELETE /history — clear history ─────────────────────── */
  router.delete('/history', (_req, res) => {
    try {
      const result = service.clearHistory();
      res.json(result);
    } catch (error) {
      logger.warn?.('[NotificationRoutes] DELETE /history failed.', { message: error?.message });
      res.status(500).json({ error: 'Failed to clear notification history.' });
    }
  });

  app.use(basePath, router);
}

export function resetNotificationRoutes() {
  resetNotificationCenterService();
}
