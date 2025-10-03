/**
 * Why: Surface GitHub-backed research requests so schedulers and operators can pull structured work items.
 * What: Lists request files from the configured research repository, decodes their payloads, and returns normalized tasks.
 * How: Uses the GitHub research sync controller to list and fetch files, parses JSON/plaintext requests, applies filters, and freezes results for safe sharing.
 * Contract
 *   Inputs:
 *     - options?: {
 *         controller?: GitHubResearchSyncControllerLike;
 *         directory?: string;
 *         limit?: number;
 *         logger?: LoggerLike;
 *         parser?: (file, ctx) => ParsedResearchRequest | null;
 *         filter?: (parsed, file) => boolean;
 *       }
 *   Outputs:
 *     - { directory: string; ref: string | null; count: number; requests: FrozenResearchRequest[] }
 *   Error modes:
 *     - Propagates controller errors (network/auth). Skips malformed files after logging.
 *   Performance:
 *     - Fetch: O(n) over files (n limited via `limit`). Each file fetched once. Memory footprint small (<200 KB per request).
 *   Side effects:
 *     - GitHub API read calls via controller; logs parsing issues via provided logger.
 */

import path from 'node:path';
import { getGitHubResearchSyncController } from '../research.github-sync.controller.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const DEFAULT_DIRECTORY = 'requests';
const DEFAULT_VISIBILITY = 'private';
const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;
const PENDING_STATUSES = new Set(['pending', 'new', 'open']);

function normalizeDirectory(candidate) {
  if (!candidate || typeof candidate !== 'string') {
    return DEFAULT_DIRECTORY;
  }
  const trimmed = candidate.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed.length ? trimmed : DEFAULT_DIRECTORY;
}

function coerceNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveRequestId(filePath) {
  const baseName = path.basename(filePath || '').replace(/\.[^.]+$/, '');
  return baseName || `request-${Date.now()}`;
}

function freezeRequest(file, parsed) {
  const request = {
    id: parsed.id || deriveRequestId(file.path),
    query: parsed.query,
    depth: coerceNumber(parsed.depth),
    breadth: coerceNumber(parsed.breadth),
    visibility: typeof parsed.visibility === 'string'
      ? parsed.visibility.trim().toLowerCase()
      : DEFAULT_VISIBILITY,
    status: typeof parsed.status === 'string'
      ? parsed.status.trim().toLowerCase()
      : (parsed.status === false ? 'closed' : 'pending'),
    priority: coerceNumber(parsed.priority),
    createdAt: parsed.createdAt || null,
    metadata: parsed.metadata && typeof parsed.metadata === 'object'
      ? Object.freeze({ ...parsed.metadata })
      : null,
    raw: parsed.raw ?? file.content ?? '',
    source: Object.freeze({
      path: file.path,
      sha: file.sha ?? null,
      ref: file.ref ?? null
    })
  };

  return Object.freeze(request);
}

export function defaultResearchRequestFilter(parsed) {
  if (!parsed || typeof parsed.query !== 'string' || !parsed.query.trim()) {
    return false;
  }
  if (!parsed.status) {
    return true;
  }
  const status = String(parsed.status).trim().toLowerCase();
  return PENDING_STATUSES.has(status);
}

export function defaultResearchRequestParser(file, context = {}) {
  const ext = path.extname(file?.path || '').toLowerCase();
  const content = typeof file?.content === 'string' ? file.content : '';
  const raw = content;

  if (ext === '.json' || content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content || '{}');
      if (typeof parsed.query !== 'string' || !parsed.query.trim()) {
        throw new Error('Missing "query" field');
      }
      return {
        id: parsed.id || deriveRequestId(file.path),
        query: parsed.query.trim(),
        depth: parsed.depth,
        breadth: parsed.breadth,
        visibility: parsed.visibility,
        status: parsed.status,
        priority: parsed.priority,
        createdAt: parsed.createdAt,
        metadata: parsed.metadata,
        raw
      };
    } catch (error) {
      context?.logger?.warn?.(`Failed to parse JSON request ${file?.path || 'unknown'}: ${error.message}`);
      throw error;
    }
  }

  // Treat plaintext body as query-only request.
  const query = content.trim();
  if (!query) {
    throw new Error(`Request ${file?.path || 'unknown'} is empty.`);
  }
  return {
    id: deriveRequestId(file.path),
    query,
    raw,
    status: 'pending'
  };
}

export async function fetchResearchRequests(options = {}) {
  const {
    controller = getGitHubResearchSyncController(),
    directory = DEFAULT_DIRECTORY,
    limit = DEFAULT_LIMIT,
    logger = noopLogger,
    parser = defaultResearchRequestParser,
    filter = defaultResearchRequestFilter
  } = options;

  if (!controller || typeof controller.listEntries !== 'function' || typeof controller.fetchFile !== 'function') {
    throw new TypeError('fetchResearchRequests requires a GitHubResearchSyncController-like instance.');
  }

  const normalizedDirectory = normalizeDirectory(directory);
  const listing = await controller.listEntries({ path: normalizedDirectory });
  const entries = Array.isArray(listing?.entries) ? listing.entries : [];
  const fileEntries = entries.filter(entry => entry?.type === 'file');

  const boundedLimit = Number.isFinite(limit) && limit > 0
    ? Math.min(Math.trunc(limit), fileEntries.length)
    : fileEntries.length;

  const requests = [];
  for (const entry of fileEntries.slice(0, boundedLimit)) {
    try {
      const file = await controller.fetchFile({ path: entry.path });
      const parsed = parser(file, { logger, directory: normalizedDirectory });
      if (parsed && (!filter || filter(parsed, file))) {
        requests.push(freezeRequest(file, parsed));
      }
    } catch (error) {
      logger?.warn?.(`[ResearchRequestFetcher] Skipped '${entry?.path || 'unknown'}': ${error.message}`);
    }
  }

  return Object.freeze({
    directory: normalizedDirectory,
    ref: listing?.ref ?? null,
    count: requests.length,
    requests: Object.freeze(requests)
  });
}

export const __testables__ = Object.freeze({
  normalizeDirectory,
  deriveRequestId,
  freezeRequest
});
