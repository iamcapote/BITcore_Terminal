/**
 * Why: Deliver parity for exporting research artefacts so operators can persist markdown from either CLI or Web sessions.
 * What: Reads the most recent research result from session/CLI caches, serialises it to disk or emits a WebSocket download event,
 *       and offers keep/overwrite toggles for repeat workflows.
 * How: Validates authentication, normalises filenames, writes to the single-user storage directory for CLI runs, and
 *       reuses the WebSocket download channel for browser clients.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { userManager } from '../features/auth/user-manager.mjs';
import { ensureDir } from '../utils/research.ensure-dir.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
import { safeSend } from '../utils/websocket.utils.mjs';
import { getCliResearchResult, clearCliResearchResult } from './research/state.mjs';
import { persistSessionFromRef } from '../infrastructure/session/session.store.mjs';

const moduleLogger = createModuleLogger('commands.export.cli', { emitToStdStreams: false });
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DEFAULT_PREFIX = 'research-export';

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

function sanitizePathSegments(candidate, fallback) {
  const normalized = (candidate || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const safeSegments = normalized.filter((segment) => segment !== '.' && segment !== '..');
  if (!safeSegments.length) {
    return fallback;
  }
  return safeSegments.join('/');
}

function appendMarkdownExtension(filename) {
  if (!filename) {
    return `${DEFAULT_PREFIX}.md`;
  }
  if (/\.md$/i.test(filename)) {
    return filename;
  }
  return `${filename}.md`;
}

function buildDefaultFilename(snapshot) {
  if (snapshot?.filename) {
    return path.basename(snapshot.filename);
  }
  const basis = snapshot?.query || snapshot?.summary || DEFAULT_PREFIX;
  const slug = (basis
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')) || DEFAULT_PREFIX;
  const timestamp = new Date(snapshot?.generatedAt || Date.now())
    .toISOString()
    .replace(/[:]/g, '-')
    .replace(/\..*/, '');
  return `${slug}-${timestamp}.md`;
}

function resolveCliPath(filename) {
  if (!filename) {
    return null;
  }
  if (path.isAbsolute(filename)) {
    return filename;
  }
  if (filename.includes(path.sep) || filename.includes('/')) {
    return path.resolve(process.cwd(), filename);
  }
  const storageDir = userManager.storageDir
    || process.env.BITCORE_STORAGE_DIR
    || path.join(os.homedir(), '.bitcore-terminal');
  const researchDir = path.join(storageDir, 'research');
  return path.join(researchDir, filename);
}

function ensureMarkdownFilename(candidate, snapshot) {
  const fallback = buildDefaultFilename(snapshot);
  const sanitized = sanitizePathSegments(candidate, fallback);
  return appendMarkdownExtension(sanitized);
}

export function getExportHelpText() {
  return `/export [filename] [--keep] [--overwrite] - Download the latest research result (CLI writes to disk, Web triggers file download).`;
}

export async function executeExport(options = {}) {
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

  const emit = createEmitter(output, 'info');
  const emitError = createEmitter(error ?? output, 'error');

  const user = currentUser || (await userManager.getUserData());
  if (!user || user.role === 'public') {
    emitError('Export is restricted to authenticated operators.');
    return { success: false, error: 'Permission denied', handled: true, keepDisabled: false };
  }

  const keep = toBoolean(flags.keep, false);
  const overwrite = toBoolean(flags.overwrite, false);
  const requestedName = positionalArgs[0] ?? flags.filename ?? flags.file ?? null;

  if (isWebSocket) {
    if (!session) {
      emitError('No active session found for export.');
      return { success: false, error: 'Missing session', handled: true, keepDisabled: false };
    }
    const content = session.currentResearchResult;
    if (!content || !content.trim()) {
      emitError('No research result is available to export. Run /research and keep the result first.');
      return { success: false, error: 'No research result', handled: true, keepDisabled: false };
    }
    if (!webSocketClient) {
      emitError('Unable to stream download without an active WebSocket client.');
      return { success: false, error: 'Missing WebSocket client', handled: true, keepDisabled: false };
    }

    const filename = ensureMarkdownFilename(
      requestedName || session.currentResearchFilename,
      {
        query: session.currentResearchQuery || null,
        generatedAt: new Date().toISOString()
      }
    );

    safeSend(webSocketClient, {
      type: 'download_file',
      filename,
      content
    });
    emit(`Triggered download for ${filename}.`);

    if (!keep) {
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      session.currentResearchSummary = null;
      session.currentResearchQuery = null;
    }

    try {
      await persistSessionFromRef(session);
    } catch (persistError) {
      moduleLogger.warn('Failed to persist session snapshot after export.', {
        message: persistError?.message || String(persistError),
      });
    }

    return { success: true, keepDisabled: false };
  }

  const snapshot = getCliResearchResult();
  if (!snapshot || !snapshot.content) {
    emitError('No research result is cached for export. Run /research first.');
    return { success: false, error: 'No research result', handled: true };
  }

  const rawCandidate = requestedName ?? snapshot.filename;
  const useAbsolutePath = rawCandidate ? path.isAbsolute(rawCandidate) : false;
  const filename = useAbsolutePath
    ? appendMarkdownExtension(rawCandidate)
    : ensureMarkdownFilename(rawCandidate, snapshot);
  const targetPath = useAbsolutePath ? path.resolve(filename) : resolveCliPath(filename);

  try {
    await ensureDir(path.dirname(targetPath));
    if (!overwrite) {
      try {
        await fs.access(targetPath);
        emitError(`File already exists: ${targetPath}. Use --overwrite to replace it.`);
        return { success: false, error: 'File exists', handled: true };
      } catch (accessError) {
        if (accessError.code !== 'ENOENT') {
          throw accessError;
        }
      }
    }

    await fs.writeFile(targetPath, snapshot.content, 'utf8');
    emit(`Exported research result to ${targetPath}.`);

    if (!keep) {
      clearCliResearchResult();
    }

    return { success: true, path: targetPath };
  } catch (writeError) {
    emitError(`Failed to export research result: ${writeError.message}`);
    moduleLogger.error('Export command failed.', {
      message: writeError.message,
      stack: writeError.stack || null,
      path: targetPath
    });
    return { success: false, error: writeError.message, handled: true };
  }
}
