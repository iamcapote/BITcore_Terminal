/**
 * Contract
 * Inputs:
 *   - action: 'verify' | 'list' | 'pull' | 'fetch' | 'push' | 'upload'
 *   - repo?: Local base directory for reading files when pushing/uploading (defaults process.cwd()).
 *   - files?: (string | { path: string; content?: string })[]
 *   - path?: string (single file path for fetch/upload)
 *   - content?: string (inline upload content)
 *   - message?: string (commit message)
 *   - branch?: string (target branch override)
 * Outputs:
 *   - { success: boolean, message: string, details?: any }
 * Error modes:
 *   - RangeError for validation issues (missing files/path, unsafe relative paths).
 *   - Propagates GitHubResearchSyncController errors with context.
 * Performance:
 *   - File IO limited to enumerated uploads; network latency dominated by GitHub API.
 * Side effects:
 *   - Reads local files when provided, commits content via GitHub REST API, records telemetry.
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { getGitHubResearchSyncController } from '../research.github-sync.controller.mjs';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function normalizeString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeRepoPath(candidate, label = 'file path') {
  const value = normalizeString(candidate);
  if (!value) {
    throw new RangeError(`${label} is required.`);
  }
  if (value.startsWith('/') || value.includes('..')) {
    throw new RangeError(`${label} must be relative to the configured research root (no leading '/' or '..').`);
  }
  return value.replace(/\\/g, '/');
}

function ensureFilesArray(files, label = 'files') {
  if (!Array.isArray(files) || !files.length) {
    throw new RangeError(`${label} must be a non-empty array.`);
  }
  return files;
}

function resolveBaseDirectory(repo) {
  const base = normalizeString(repo) ? path.resolve(String(repo)) : process.cwd();
  return base;
}

function ensureInsideBase(baseDir, filePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(baseDir, filePath);
  if (!resolvedFile.startsWith(resolvedBase)) {
    throw new RangeError(`Path '${filePath}' escapes the repository base directory.`);
  }
  return resolvedFile;
}

async function loadFilePayload(baseDir, fileDescriptor) {
  if (typeof fileDescriptor === 'string') {
    const repoPath = sanitizeRepoPath(fileDescriptor);
    const absolute = ensureInsideBase(baseDir, repoPath);
    const content = await fs.readFile(absolute, 'utf8');
    return { path: repoPath, content };
  }
  if (!fileDescriptor || typeof fileDescriptor.path !== 'string') {
    throw new RangeError('File descriptor requires a string path.');
  }
  const repoPath = sanitizeRepoPath(fileDescriptor.path);
  if (typeof fileDescriptor.content === 'string') {
    return { path: repoPath, content: fileDescriptor.content };
  }
  const absolute = ensureInsideBase(baseDir, repoPath);
  const content = await fs.readFile(absolute, 'utf8');
  return { path: repoPath, content };
}

function buildControllerContext(actor = 'cli', correlationId) {
  const resolvedCorrelationId = correlationId
    || (typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  return {
    actor,
    correlationId: resolvedCorrelationId
  };
}

export async function githubResearchSync(options = {}) {
  const action = normalizeString(options.action)?.toLowerCase() || 'verify';
  const repo = options.repo;
  const baseDir = resolveBaseDirectory(repo);
  const correlationId = options.correlationId
    || (typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const controller = getGitHubResearchSyncController({
    forceNew: true,
    activityContext: buildControllerContext('cli', correlationId)
  });

  switch (action) {
    case 'verify':
    case 'status': {
      const verification = await controller.verify();
      const { config } = verification;
      return {
        success: Boolean(verification?.ok),
        message: `Repository ${config.owner}/${config.repo} @ ${config.branch} verified`,
        details: verification
      };
    }

    case 'list':
    case 'pull':
    case 'ls': {
      const pathArg = normalizeString(options.path ?? options.target ?? options.directory) || '';
      const ref = normalizeString(options.ref);
      const listing = await controller.listEntries({ path: pathArg, ref });
      return {
        success: true,
        message: `Listed ${listing.entries.length} entr${listing.entries.length === 1 ? 'y' : 'ies'} at ${listing.path || '/'}`,
        details: listing
      };
    }

    case 'fetch':
    case 'file':
    case 'show': {
      const repoPath = sanitizeRepoPath(options.path ?? options.target, 'path');
      const ref = normalizeString(options.ref);
      const file = await controller.fetchFile({ path: repoPath, ref });
      return {
        success: true,
        message: `Fetched ${file.path} (${file.size ?? 'unknown'} bytes)`,
        details: file
      };
    }

    case 'push': {
      const fileDescriptors = ensureFilesArray(options.files, 'files');
      const message = normalizeString(options.message) || `Update ${fileDescriptors[0]}`;
      const branch = normalizeString(options.branch);
      const payloads = await Promise.all(fileDescriptors.map((file) => loadFilePayload(baseDir, file)));
      const result = await controller.pushBatch({ files: payloads, message, branch });
      return {
        success: Boolean(result?.ok),
        message: `Pushed ${result?.summaries?.length || 0} file${(result?.summaries?.length || 0) === 1 ? '' : 's'}` + (branch ? ` to ${branch}` : ''),
        details: result
      };
    }

    case 'upload':
    case 'upsert': {
      const repoPath = sanitizeRepoPath(options.path ?? options.target ?? (Array.isArray(options.files) ? options.files[0] : null), 'path');
      let content = typeof options.content === 'string' ? options.content : null;
      if (content == null && Array.isArray(options.files) && options.files.length) {
        const [first] = await Promise.all([loadFilePayload(baseDir, options.files[0])]);
        content = first.content;
      }
      if (content == null) {
        throw new RangeError('Upload requires --content or --files with readable entries.');
      }
      const message = normalizeString(options.message) || `Upload ${repoPath}`;
      const branch = normalizeString(options.branch);
      const result = await controller.uploadFile({ path: repoPath, content, message, branch });
      return {
        success: Boolean(result?.ok),
        message: `Uploaded ${repoPath}` + (branch ? ` to ${branch}` : ''),
        details: result
      };
    }

    default:
      throw new RangeError(`ValidationError: unknown action '${action}'`);
  }
}

export function parseBoolean(value) {
  if (value == null) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}
