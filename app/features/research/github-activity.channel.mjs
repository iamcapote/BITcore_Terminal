/**
 * Contract
 * Inputs:
 *   - recordGitHubActivity({ action: string, message: string, level?: 'info'|'warn'|'error'|'debug', meta?: object, timestamp?: number|string|Date })
 *   - subscribeGitHubActivity(listener): listener receives immutable activity entries.
 *   - getGitHubActivitySnapshot({ limit?: number, levels?: string|string[], since?: number|string, search?: string, sample?: number }): returns a recent list of entries.
 * Outputs:
 *   - Normalized activity entry { id, sequence, level, message, timestamp, source: 'github-activity', meta }.
 * Error modes:
 *   - Skips recording when message is empty; never throws on logger failures.
 * Performance:
 *   - O(1) record/subscribe; bounded memory via channel buffer (default 200 entries).
 * Side effects:
 *   - Emits structured logs via outputManager for blended admin visibility.
 */

import { createLogChannel } from '../../utils/log-channel.mjs';
import { outputManager } from '../../utils/research.output-manager.mjs';

const BUFFER_SIZE = 200;
const KNOWN_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

const githubActivityChannel = createLogChannel({ bufferSize: BUFFER_SIZE });

function normalizeLevel(candidate) {
  const value = typeof candidate === 'string' ? candidate.trim().toLowerCase() : '';
  if (KNOWN_LEVELS.has(value)) {
    return value;
  }
  return 'info';
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const clone = { ...meta };
  if (clone.token) {
    clone.token = '[redacted]';
  }
  if (clone.error instanceof Error) {
    clone.error = { message: clone.error.message, status: clone.error.status ?? null };
  }
  return clone;
}

function logToOutputManager(level, message) {
  const text = `[GitHubResearch] ${message}`;
  try {
    switch (level) {
      case 'error':
        outputManager.error?.(text);
        break;
      case 'warn':
        outputManager.warn?.(text);
        break;
      case 'debug':
        outputManager.debug?.(text);
        break;
      default:
        outputManager.log?.(text);
        break;
    }
  } catch (error) {
    // Intentionally swallow logging failures; analytics should not break runtime.
    console.warn('[GitHubActivity] Failed to log to outputManager:', error.message);
  }
}

export function recordGitHubActivity({ action = 'unknown', message, level = 'info', meta, timestamp } = {}) {
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage) {
    return null;
  }

  const normalizedLevel = normalizeLevel(level);
  const normalizedMeta = sanitizeMeta(meta ? { action, ...meta } : { action });

  const entry = githubActivityChannel.push({
    level: normalizedLevel,
    message: trimmedMessage,
    source: 'github-activity',
    timestamp,
    meta: normalizedMeta
  });

  if (entry) {
    logToOutputManager(normalizedLevel, trimmedMessage);
  }

  return entry;
}

export function subscribeGitHubActivity(listener) {
  return githubActivityChannel.subscribe(listener);
}

export function getGitHubActivitySnapshot({ limit = 40, levels, since, search, sample } = {}) {
  const normalizedLevels = Array.isArray(levels)
    ? levels
    : (typeof levels === 'string' ? levels : undefined);

  const options = {
    limit,
    levels: normalizedLevels,
    since,
    search,
    sample
  };

  const snapshot = githubActivityChannel.getSnapshot(options);
  return Object.freeze(snapshot);
}

export function clearGitHubActivityFeed() {
  try {
    githubActivityChannel.clear?.();
  } catch (error) {
    console.warn('[GitHubActivity] Failed to clear channel:', error.message);
  }
}

export function getGitHubActivityStats(options) {
  return githubActivityChannel.getStats?.(options) ?? { total: 0, levels: {} };
}
