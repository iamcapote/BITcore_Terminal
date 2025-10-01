/**
 * Express routes for GitHub research activity feed.
 *
 * Contract
 * Inputs:
 *   - GET /api/research/github-activity/snapshot?limit=&levels=&since=&search=&sample=
 *   - GET /api/research/github-activity/stats?since=
 * Outputs:
 *   - Snapshot: { ok, data: ActivityEntry[], meta: { total, limit, levels, since, sample } }
 *   - Stats: { ok, data: { total, levels, firstTimestamp, lastTimestamp }, meta: { since } }
 * Error modes:
 *   - 401 when user is unauthenticated.
 *   - 400 when query parameters are invalid (limit/sample range, level names, search length).
 * Performance:
 *   - Snapshot limited to <= 200 entries, sample throttles load.
 * Side effects:
 *   - None (reads from in-memory channel only).
 */

import express from 'express';
import crypto from 'crypto';
import { userManager } from '../auth/user-manager.mjs';
import {
  getGitHubActivitySnapshot,
  getGitHubActivityStats
} from './github-activity.channel.mjs';

const MAX_LIMIT = 200;
const MIN_LIMIT = 1;
const MAX_SAMPLE = 10;
const MAX_SEARCH_LENGTH = 200;
const ALLOWED_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function ensureAuthenticated(req, res, next) {
  try {
    const authenticated = typeof userManager.isAuthenticated === 'function'
      ? userManager.isAuthenticated()
      : true;

    if (!authenticated) {
      return res.status(401).json({ ok: false, error: 'Authentication required.' });
    }

    req.currentUser = typeof userManager.getCurrentUser === 'function'
      ? userManager.getCurrentUser()
      : null;

    return next();
  } catch (error) {
    return next(error);
  }
}

function resolveCorrelationId(req) {
  const headerValue = typeof req.headers['x-correlation-id'] === 'string'
    ? req.headers['x-correlation-id'].trim()
    : null;
  if (headerValue) {
    return headerValue;
  }
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseLimit(value) {
  if (value == null) {
    return 40;
  }
  const parsed = Number.parseInt(Array.isArray(value) ? value[value.length - 1] : value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_LIMIT) {
    throw new RangeError(`Query parameter "limit" must be an integer >= ${MIN_LIMIT}.`);
  }
  if (parsed > MAX_LIMIT) {
    throw new RangeError(`Query parameter "limit" must be <= ${MAX_LIMIT}.`);
  }
  return parsed;
}

function parseSample(value) {
  if (value == null) {
    return 1;
  }
  const parsed = Number.parseInt(Array.isArray(value) ? value[value.length - 1] : value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new RangeError('Query parameter "sample" must be an integer >= 1.');
  }
  if (parsed > MAX_SAMPLE) {
    throw new RangeError(`Query parameter "sample" must be <= ${MAX_SAMPLE}.`);
  }
  return parsed;
}

function parseLevels(value) {
  if (value == null) {
    return undefined;
  }
  const values = Array.isArray(value)
    ? value.flatMap((entry) => String(entry).split(','))
    : String(value).split(',');

  const normalized = new Set();
  for (const raw of values) {
    const candidate = raw.trim().toLowerCase();
    if (!candidate) {
      continue;
    }
    if (!ALLOWED_LEVELS.has(candidate)) {
      throw new RangeError(`Unsupported level "${raw}". Allowed levels: ${Array.from(ALLOWED_LEVELS).join(', ')}.`);
    }
    normalized.add(candidate);
  }

  if (normalized.size === 0) {
    return undefined;
  }

  return Array.from(normalized.values());
}

function parseSince(value) {
  if (value == null) {
    return undefined;
  }
  const last = Array.isArray(value) ? value[value.length - 1] : value;
  const numeric = Number(last);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const parsed = Date.parse(String(last));
  if (!Number.isFinite(parsed)) {
    throw new RangeError('Query parameter "since" must be a numeric timestamp or ISO-8601 string.');
  }
  return parsed;
}

function parseSearch(value) {
  if (value == null) {
    return undefined;
  }
  const last = Array.isArray(value) ? value[value.length - 1] : value;
  const trimmed = String(last).trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_SEARCH_LENGTH) {
    throw new RangeError(`Query parameter "search" must be <= ${MAX_SEARCH_LENGTH} characters.`);
  }
  return trimmed;
}

function buildErrorResponse(res, error, correlationId, logger) {
  const status = error instanceof RangeError ? 400 : 500;
  if (status >= 500) {
    logger?.error?.(`[GithubActivityRoutes] ${error.message}`);
  }
  return res.status(status).json({
    ok: false,
    error: error.message,
    correlationId
  });
}

export function setupGithubActivityRoutes(app, { basePath = '/api/research', logger = console } = {}) {
  const router = express.Router();

  router.use(ensureAuthenticated);

  router.get('/github-activity/snapshot', (req, res) => {
    const correlationId = resolveCorrelationId(req);
    res.set('x-correlation-id', correlationId);
    try {
      const limit = parseLimit(req.query.limit);
      const sample = parseSample(req.query.sample);
      const levels = parseLevels(req.query.levels);
      const since = parseSince(req.query.since);
      const search = parseSearch(req.query.search);

      const snapshot = getGitHubActivitySnapshot({ limit, sample, levels, since, search });
      return res.json({
        ok: true,
        data: snapshot,
        meta: {
          total: snapshot.length,
          limit,
          sample,
          levels: levels ?? null,
          since: since ?? null,
          search: search ?? null
        },
        correlationId
      });
    } catch (error) {
      return buildErrorResponse(res, error, correlationId, logger);
    }
  });

  router.get('/github-activity/stats', (req, res) => {
    const correlationId = resolveCorrelationId(req);
    res.set('x-correlation-id', correlationId);
    try {
      const since = parseSince(req.query.since);
      const stats = getGitHubActivityStats({ since });
      return res.json({
        ok: true,
        data: stats,
        meta: {
          since: since ?? null
        },
        correlationId
      });
    } catch (error) {
      return buildErrorResponse(res, error, correlationId, logger);
    }
  });

  app.use(basePath, router);
}
