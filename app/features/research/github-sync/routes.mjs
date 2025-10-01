/**
 * Express routes for GitHub research sync workflows.
 *
 * Guard → Do → Verify flow:
 *   - Guard: enforce authentication + schema validation on incoming payloads.
 *   - Do: delegate to GitHubResearchSyncController for all side effects.
 *   - Verify: normalize response envelope, propagate correlationId, surface activity telemetry.
 */

import express from 'express';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import { userManager } from '../../auth/user-manager.mjs';
import { getGitHubResearchSyncController } from '../research.github-sync.controller.mjs';

const ACTIONS = new Map([
  ['verify', { requires: [], handler: (controller) => controller.verify() }],
  ['list', {
    requires: [],
    handler: (controller, payload) => controller.listEntries({ path: payload.path ?? '', ref: payload.ref })
  }],
  ['file', {
    requires: ['path'],
    handler: (controller, payload) => controller.fetchFile({ path: payload.path, ref: payload.ref })
  }],
  ['push', {
    requires: ['files'],
    handler: (controller, payload) => controller.pushBatch({
      files: payload.files,
      message: payload.message,
      branch: payload.branch
    })
  }],
  ['upload', {
    requires: ['path', 'content'],
    handler: (controller, payload) => controller.uploadFile({
      path: payload.path,
      content: payload.content,
      message: payload.message,
      branch: payload.branch
    })
  }]
]);

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function normalizeString(value, { trim = true, emptyAsNull = true } = {}) {
  if (value == null) return null;
  const str = String(value);
  if (trim) {
    const trimmed = str.trim();
    if (!trimmed && emptyAsNull) {
      return null;
    }
    return trimmed;
  }
  if (!str && emptyAsNull) {
    return null;
  }
  return str;
}

function coerceBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeString(value);
  if (!normalized) return fallback;
  if (TRUE_VALUES.has(normalized.toLowerCase())) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized.toLowerCase())) {
    return false;
  }
  return fallback;
}

function sanitizeBranch(branch) {
  const value = normalizeString(branch);
  if (!value) return null;
  if (!/^[A-Za-z0-9._\-/]{1,120}$/.test(value)) {
    throw new RangeError('Branch names may only include alphanumeric characters, dot, underscore, hyphen, or slash and be <= 120 chars.');
  }
  return value;
}

function sanitizeMessage(message) {
  const value = normalizeString(message, { trim: true, emptyAsNull: true });
  if (!value) return null;
  if (value.length > 500) {
    throw new RangeError('Commit message must be 500 characters or fewer.');
  }
  return value;
}

function sanitizePath(path) {
  const value = normalizeString(path, { trim: true, emptyAsNull: false });
  if (!value) {
    throw new RangeError('Path is required and cannot be empty.');
  }
  if (value.startsWith('/') || value.includes('..')) {
    throw new RangeError('Paths must be repository-relative without leading slashes or ".." segments.');
  }
  return value;
}

function sanitizeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new RangeError('Files array must include at least one entry.');
  }
  return files.map((file, index) => {
    const path = sanitizePath(file?.path ?? file?.name ?? `file-${index + 1}`);
    const rawContent = file?.content;
    if (typeof rawContent !== 'string') {
      throw new RangeError(`File '${path}' content must be a UTF-8 string.`);
    }
    const encoding = normalizeString(file?.encoding) ?? 'utf8';
    if (encoding !== 'utf8' && encoding !== 'base64') {
      throw new RangeError(`Unsupported encoding '${encoding}' for file '${path}'.`);
    }
    const content = encoding === 'base64'
      ? Buffer.from(rawContent, 'base64').toString('utf8')
      : rawContent;
    return Object.freeze({ path, content, encoding: 'utf8' });
  });
}

function validatePayload(body = {}) {
  const action = normalizeString(body.action, { trim: true, emptyAsNull: false })?.toLowerCase();
  if (!action) {
    throw new RangeError('Payload requires an "action" string.');
  }

  const actionDef = ACTIONS.get(action);
  if (!actionDef) {
    throw new RangeError(`Unsupported action "${action}".`);
  }

  const base = {
    action,
    repoHint: normalizeString(body.repo),
    ref: normalizeString(body.ref),
    path: null,
    branch: sanitizeBranch(body.branch),
    message: sanitizeMessage(body.message),
    dryRun: coerceBoolean(body.dryRun, false)
  };

  switch (action) {
    case 'list': {
      const rawPath = body.path == null ? '' : String(body.path);
      base.path = rawPath.trim() ? sanitizePath(rawPath) : '';
      break;
    }
    case 'file': {
      if (!body.path) {
        throw new RangeError('Fetching a file requires "path".');
      }
      base.path = sanitizePath(body.path);
      break;
    }
    case 'push': {
      base.files = sanitizeFiles(body.files);
      break;
    }
    case 'upload': {
      if (!body.path) {
        throw new RangeError('Upload requires "path".');
      }
      const content = typeof body.content === 'string' ? body.content : null;
      if (content == null) {
        throw new RangeError('Upload requires string "content".');
      }
      base.path = sanitizePath(body.path);
      base.content = content;
      break;
    }
    default: {
      if (body.path != null) {
        const candidate = String(body.path);
        base.path = candidate.trim() ? sanitizePath(candidate) : null;
      }
    }
  }

  for (const requirement of actionDef.requires) {
    if (requirement === 'files' && !Array.isArray(base.files)) {
      throw new RangeError('Files array is required for this action.');
    }
    if (requirement === 'path' && !base.path) {
      throw new RangeError('Path is required for this action.');
    }
    if (requirement === 'content' && typeof base.content !== 'string') {
      throw new RangeError('Content is required for this action.');
    }
  }

  return base;
}

function ensureAuthenticated(req, res, next) {
  try {
    const authenticated = typeof userManager.isAuthenticated === 'function'
      ? userManager.isAuthenticated()
      : true;

    if (!authenticated) {
      return res.status(401).json({ ok: false, error: 'Authentication required.' });
    }

    const currentUser = typeof userManager.getCurrentUser === 'function'
      ? userManager.getCurrentUser()
      : null;

    req.currentUser = currentUser;
    return next();
  } catch (error) {
    return next(error);
  }
}

function resolveCorrelationId(req) {
  const headerValue = normalizeString(req.headers['x-correlation-id'], { trim: true, emptyAsNull: true });
  if (headerValue) {
    return headerValue;
  }
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function setupGithubSyncRoutes(app, { basePath = '/api/research', logger = console } = {}) {
  const router = express.Router();

  router.use(ensureAuthenticated);

  router.post('/github-sync', async (req, res) => {
    const correlationId = resolveCorrelationId(req);
    res.set('x-correlation-id', correlationId);
    let payload;
    try {
      payload = validatePayload(req.body || {});
      const actionDef = ACTIONS.get(payload.action);

      const controller = getGitHubResearchSyncController({
        forceNew: true,
        activityContext: {
          correlationId,
          actor: req.currentUser?.username || 'http'
        }
      });

      const result = await actionDef.handler(controller, payload);

      return res.json({
        ok: true,
        success: true,
        action: payload.action,
        correlationId,
        data: result,
        meta: {
          repoHint: payload.repoHint ?? null,
          ref: payload.ref ?? null,
          branch: payload.branch ?? null,
          dryRun: payload.dryRun
        }
      });
    } catch (error) {
      const status = error?.status
        || (error instanceof RangeError ? 422 : 500);
      const message = error?.message || 'Unknown error';

      logger?.warn?.(`[GitHubSyncRoutes] ${payload?.action || 'unknown'} failed: ${message}`);

      return res.status(status).json({
        ok: false,
        success: false,
        error: message,
        correlationId,
        details: error?.details ?? null
      });
    }
  });

  app.use(basePath, router);
}
