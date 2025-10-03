/**
 * Why: Provide a unified CLI/Web surface for managing persisted research artefacts via GitHub storage.
 * What: Offers list/get/save/delete helpers that wrap the GitHub research sync controller while respecting
 *       single-user session caches and CLI result snapshots.
 * How: Normalises repo paths, reuses cached research markdown, and emits structured output or download events
 *       depending on the execution surface (CLI vs WebSocket).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { userManager } from '../features/auth/user-manager.mjs';
import { getGitHubResearchSyncController } from '../features/research/research.github-sync.controller.mjs';
import { getCliResearchResult, clearCliResearchResult } from './research/state.mjs';
import { persistSessionFromRef } from '../infrastructure/session/session.store.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
import { ensureDir } from '../utils/research.ensure-dir.mjs';
import { safeSend } from '../utils/websocket.utils.mjs';

const moduleLogger = createModuleLogger('commands.storage.cli', { emitToStdStreams: false });
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DEFAULT_PREFIX = 'research-result';

function createEmitter(handler, level) {
  const fn = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (message, meta = null) => {
    moduleLogger[level](message, meta);
    if (fn) {
      fn(message);
      return;
    }
    stream.write(`${message}\n`);
  };
}

function toBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (TRUE_VALUES.has(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || DEFAULT_PREFIX;
}

function resolveFallbackMetadata(snapshot = {}) {
  return {
    query: snapshot.query || null,
    summary: snapshot.summary || null,
    generatedAt: snapshot.generatedAt || null,
    filename: snapshot.filename || null
  };
}

function buildDefaultRepoPath(source = {}) {
  if (source.filename) {
    return sanitizeRepoPath(source.filename);
  }
  const basis = source.query || source.summary || DEFAULT_PREFIX;
  const slug = slugify(basis);
  const timestamp = new Date(source.generatedAt || Date.now())
    .toISOString()
    .replace(/[:]/g, '-')
    .replace(/\..*/, '');
  return sanitizeRepoPath(`research/${slug}-${timestamp}.md`);
}

function sanitizeRepoPath(candidate, fallback) {
  const basis = (candidate && String(candidate).trim()) || fallback;
  if (!basis) {
    throw new Error('A target filename is required for storage operations.');
  }
  const cleaned = basis
    .replace(/[\\]+/g, '/')
    .replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..')) {
    throw new Error('Storage paths must be relative and cannot include ".." segments.');
  }
  return cleaned;
}

function resolveCliOutputPath(target) {
  if (!target) return null;
  if (path.isAbsolute(target)) {
    return target;
  }
  if (target.includes(path.sep) || target.includes('/')) {
    return path.resolve(process.cwd(), target);
  }
  const storageDir = userManager.storageDir
    || process.env.BITCORE_STORAGE_DIR
    || path.join(os.homedir(), '.bitcore-terminal');
  const downloadDir = path.join(storageDir, 'downloads');
  return path.join(downloadDir, target);
}

function formatListing(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return ['(empty directory)'];
  }
  return entries.map((entry) => {
    const icon = entry.type === 'dir' ? '📁' : '📄';
    const size = typeof entry.size === 'number' ? ` (${entry.size} bytes)` : '';
    return `${icon} ${entry.path || entry.name || '(unknown)'}${size}`;
  });
}

function ensureAuthenticated(user) {
  if (!user || user.role === 'public') {
    throw new Error('Storage commands are restricted to authenticated operators.');
  }
}

async function clearSessionResult(session) {
  if (!session) return;
  session.currentResearchResult = null;
  session.currentResearchFilename = null;
  delete session.currentResearchQuery;
  try {
    await persistSessionFromRef(session, {
      currentResearchSummary: null,
      currentResearchQuery: null,
    });
  } catch (error) {
    moduleLogger.warn('Failed to persist session snapshot after clearing storage result.', {
      message: error?.message || String(error),
    });
  }
}

function resolveCachedResult({ isWebSocket, session }) {
  if (isWebSocket) {
    const content = session?.currentResearchResult;
    if (!content || !content.trim()) {
      throw new Error('No research result is available in the current session. Run /research and select Keep first.');
    }
    return {
      content,
      filename: session.currentResearchFilename || null,
      query: session.currentResearchQuery || null,
      generatedAt: new Date().toISOString(),
      summary: null
    };
  }

  const snapshot = getCliResearchResult();
  if (!snapshot || !snapshot.content) {
    throw new Error('No cached research result found. Run /research to generate one before saving to storage.');
  }
  return snapshot;
}

function buildCommitMessage(flagsMessage, metadata) {
  if (flagsMessage) {
    return String(flagsMessage);
  }
  if (metadata?.query) {
    return `Research results for query: ${metadata.query}`;
  }
  if (metadata?.summary) {
    return `Research results update: ${metadata.summary.slice(0, 80)}`;
  }
  return 'Research results update';
}

export function getStorageHelpText() {
  return [
    '/storage list [path] [--ref=branchOrSha] [--json]              List stored research artefacts in GitHub.',
    '/storage get <path> [--ref=...] [--out=local.md] [--overwrite] Retrieve an artefact (prints or downloads when running on the Web terminal).',
    '/storage save <path> [--message="Commit msg"] [--branch=name] [--keep]  Upload the cached research result using the provided filename.',
    '/storage delete <path> [--message="Commit msg"] [--branch=name]         Remove an artefact from GitHub storage.'
  ].join('\n');
}

export async function executeStorage(options = {}) {
  const {
    positionalArgs = [],
    flags = {},
    isWebSocket = false,
    session,
    output,
    error,
    currentUser,
    webSocketClient
  } = options;

  const args = Array.isArray(positionalArgs) ? [...positionalArgs] : [];
  const subcommand = (flags.action ?? args.shift() ?? '').toString().trim().toLowerCase() || 'list';
  const emit = createEmitter(output, 'info');
  const emitError = createEmitter(error ?? output, 'error');

  let user;
  try {
    user = currentUser || (await userManager.getUserData());
    ensureAuthenticated(user);
  } catch (authError) {
    emitError(authError.message || 'Unable to authenticate user for storage command.');
    return { success: false, error: authError.message || 'Authentication required', handled: true };
  }

  const controller = getGitHubResearchSyncController();
  moduleLogger.info('Executing /storage command.', {
    subcommand,
    isWebSocket,
    hasSession: Boolean(session)
  });

  try {
    switch (subcommand) {
      case 'list':
      case 'ls': {
        const pathArg = flags.path ?? flags.target ?? args.shift() ?? '';
        const ref = flags.ref ?? flags.sha ?? null;
        const asJson = toBoolean(flags.json, false);
        const listing = await controller.listEntries({ path: pathArg, ref });
        if (asJson) {
          emit(JSON.stringify(listing, null, 2));
        } else {
          emit(`Path: ${listing.path || 'research'} @ ${listing.ref || 'default branch'}`);
          formatListing(listing.entries).forEach((line) => emit(line));
        }
        return { success: true, entries: listing.entries, path: listing.path, ref: listing.ref };
      }

      case 'get':
      case 'fetch': {
        const candidate = flags.path ?? flags.target ?? args.shift();
        if (!candidate) {
          throw new Error('Specify the repository path to retrieve, e.g. research/latest-report.md');
        }
        const repoPath = sanitizeRepoPath(candidate);
        const ref = flags.ref ?? null;
        const file = await controller.fetchFile({ path: repoPath, ref });
        const outPath = flags.out ?? flags.output ?? null;
        const overwrite = toBoolean(flags.overwrite, false);

        if (isWebSocket) {
          if (!webSocketClient) {
            throw new Error('Unable to stream download without an active WebSocket client.');
          }
          safeSend(webSocketClient, {
            type: 'download_file',
            filename: file.path,
            content: file.content
          });
          emit(`Triggered download for ${file.path}.`);
        } else if (outPath) {
          const target = resolveCliOutputPath(outPath);
          await ensureDir(path.dirname(target));
          if (!overwrite) {
            try {
              await fs.access(target);
              throw new Error(`File already exists: ${target}. Pass --overwrite to replace it.`);
            } catch (accessError) {
              if (accessError.code !== 'ENOENT') {
                throw accessError;
              }
            }
          }
          await fs.writeFile(target, file.content, 'utf8');
          emit(`Saved ${file.path} to ${target}.`);
        } else {
          emit(`--- ${file.path} ---`);
          emit(file.content);
          emit('--- End Content ---');
        }

        return { success: true, file };
      }

      case 'save':
      case 'upload': {
        const keep = toBoolean(flags.keep, false);
        const branch = flags.branch ?? null;
        const flagsMessage = flags.message ?? null;
        const candidate = flags.path ?? flags.filename ?? args.shift();
        const cached = resolveCachedResult({ isWebSocket, session });
        const metadata = resolveFallbackMetadata(cached);
        const repoPath = sanitizeRepoPath(candidate, buildDefaultRepoPath(metadata));
        const commitMessage = buildCommitMessage(flagsMessage, metadata);

        const { summary } = await controller.uploadFile({
          path: repoPath,
          content: cached.content,
          message: commitMessage,
          branch
        });

        emit(`Stored research result at ${summary.path}.`);
        if (summary.commitUrl) {
          emit(`Commit: ${summary.commitUrl}`);
        }
        if (summary.fileUrl) {
          emit(`File: ${summary.fileUrl}`);
        }

        if (!keep) {
          if (isWebSocket) {
            await clearSessionResult(session);
          } else {
            clearCliResearchResult();
          }
        }

        return { success: true, summary };
      }

      case 'delete':
      case 'rm':
      case 'remove': {
        const candidate = flags.path ?? flags.target ?? args.shift();
        if (!candidate) {
          throw new Error('Specify the repository path to delete, e.g. research/latest-report.md');
        }
        const repoPath = sanitizeRepoPath(candidate);
        const branch = flags.branch ?? null;
        const message = flags.message ?? null;
        const result = await controller.deleteFile({ path: repoPath, branch, message });
        emit(`Deleted ${result.summary?.path ?? repoPath}.`);
        if (result.summary?.commitUrl) {
          emit(`Commit: ${result.summary.commitUrl}`);
        }
        return { success: true, summary: result.summary };
      }

      default:
        emitError(`Unknown storage action "${subcommand}". Run /help to review supported options.`);
        return { success: false, error: 'Unknown action', handled: true };
    }
  } catch (commandError) {
    moduleLogger.error('Storage command failed.', {
      subcommand,
      error: commandError.message,
      stack: commandError.stack || null
    });
    emitError(`Storage error: ${commandError.message}`);
    if (isWebSocket && commandError.message.toLowerCase().includes('password')) {
  await clearSessionResult(session);
    }
    return { success: false, error: commandError.message, handled: true };
  }
}
