/**
 * Why: Expose HTTP routes for inspecting and tuning the in-memory log buffer so web clients stay in parity with CLI tooling.
 * What: Registers admin-gated endpoints for fetching recent logs, reading channel settings, adjusting retention, and purging the buffer.
 * How: Validates callers through the single-user manager, delegates storage work to the shared logChannel, and emits structured JSON with guarded inputs.
 */

import { userManager } from '../auth/user-manager.mjs';
import {
  logChannel,
  MIN_BUFFER_SIZE,
  MAX_BUFFER_SIZE,
  availableLogLevels
} from '../../utils/log-channel.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const ROUTE_BASE = '/api/logs';

function parsePositiveInteger(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function resolveLevels(value) {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
}

function requireAdmin(req, res, logger) {
  try {
    const user = userManager.getCurrentUser?.();
    if (user && user.role === 'admin') {
      return user;
    }
    logger.warn('Rejected logs route access for non-admin user.', {
      username: user?.username ?? null,
      path: req.path
    });
    res.status(403).json({ error: 'Logs API requires admin privileges.' });
    return null;
  } catch (error) {
    logger.error('Failed to resolve current user for logs route.', {
      message: error?.message || String(error),
      path: req.path
    });
    res.status(500).json({ error: 'Unable to resolve user context.' });
    return null;
  }
}

export function setupLogRoutes(app, { logger: providedLogger } = {}) {
  const logger = providedLogger ?? createModuleLogger('features.logs.routes');

  app.get(`${ROUTE_BASE}/recent`, (req, res) => {
    if (!requireAdmin(req, res, logger)) {
      return;
    }

    const limit = parsePositiveInteger(req.query.limit, 100);
    const sample = parsePositiveInteger(req.query.sample);
    const since = parsePositiveInteger(req.query.since);
    const levels = resolveLevels(req.query.levels);

    const logs = logChannel.getSnapshot({
      limit,
      since,
      sample,
      levels
    });

    res.json({ logs });
  });

  app.get(`${ROUTE_BASE}/settings`, (req, res) => {
    if (!requireAdmin(req, res, logger)) {
      return;
    }

    res.json({
      bufferSize: logChannel.getBufferSize(),
      minBufferSize: MIN_BUFFER_SIZE,
      maxBufferSize: MAX_BUFFER_SIZE,
      availableLevels: availableLogLevels()
    });
  });

  app.post(`${ROUTE_BASE}/retention`, (req, res) => {
    if (!requireAdmin(req, res, logger)) {
      return;
    }

    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json.' });
      return;
    }

    const { bufferSize } = req.body ?? {};
    const parsed = Number.parseInt(bufferSize, 10);

    if (!Number.isFinite(parsed)) {
      res.status(400).json({ error: 'bufferSize must be a finite integer.' });
      return;
    }

    if (parsed < MIN_BUFFER_SIZE || parsed > MAX_BUFFER_SIZE) {
      res.status(422).json({
        error: `bufferSize must be between ${MIN_BUFFER_SIZE} and ${MAX_BUFFER_SIZE}.`
      });
      return;
    }

    const { bufferSize: appliedSize } = logChannel.configure({ bufferSize: parsed });
    logger.info('Adjusted log buffer retention via API.', { bufferSize: appliedSize });
    res.json({ bufferSize: appliedSize });
  });

  app.delete(ROUTE_BASE, (req, res) => {
    if (!requireAdmin(req, res, logger)) {
      return;
    }

    logChannel.clear();
    logger.info('Cleared log buffer via API.', { route: ROUTE_BASE });
    res.json({ cleared: true });
  });
}
