/**
 * Log Channel
 *
 * Contract
 * Inputs:
 *   - push(entry): accepts { level, message, timestamp?, source?, meta? }
 *   - subscribe(listener, options): listener receives normalized entry objects
 *   - getSnapshot(options): returns a filtered, sampled array of entries
 *   - getStats(options?): returns aggregate counts by level and time span
 * Outputs:
 *   - Normalized log entries with { id, sequence, level, message, timestamp, source, meta }
 * Error modes:
 *   - Throws on invalid bufferSize/sample arguments
 * Performance:
 *   - time: O(1) push, O(n) snapshot filtering; memory bounded by bufferSize (default 500)
 * Side effects:
 *   - None besides in-memory storage
 */

import crypto from 'crypto';

const DEFAULT_BUFFER_SIZE = 500;
const MIN_BUFFER_SIZE = 50;
const MAX_BUFFER_SIZE = 5000;
const DEFAULT_SAMPLE = 1;
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function normalizeLevel(level) {
  const value = typeof level === 'string' ? level.trim().toLowerCase() : '';
  if (VALID_LEVELS.has(value)) {
    return value;
  }
  if (value === 'warning') {
    return 'warn';
  }
  return 'info';
}

function normalizeTimestamp(value) {
  if (Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function normalizeMessage(message) {
  if (message == null) {
    return '';
  }
  if (typeof message === 'string') {
    return message;
  }
  if (typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch (error) {
      return '[unserializable message]';
    }
  }
  return String(message);
}

function coercePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function cloneMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  if (Array.isArray(meta)) {
    return meta.map((item) => (typeof item === 'object' ? { ...item } : item));
  }
  return { ...meta };
}

export function createLogChannel({ bufferSize = DEFAULT_BUFFER_SIZE } = {}) {
  let configuredSize = coercePositiveInteger(bufferSize, DEFAULT_BUFFER_SIZE);
  if (!Number.isFinite(configuredSize) || configuredSize <= 0) {
    throw new Error('LogChannel bufferSize must be a positive integer.');
  }

  const entries = [];
  const listeners = new Set();
  let sequence = 0;

  const api = {
    push(entry = {}) {
      const message = normalizeMessage(entry.message);
      if (!message) {
        return null;
      }
      const timestamp = normalizeTimestamp(entry.timestamp);
      const normalized = Object.freeze({
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
        sequence: ++sequence,
        level: normalizeLevel(entry.level),
        message,
        timestamp,
        source: entry.source ? String(entry.source) : 'server',
        meta: cloneMeta(entry.meta)
      });

      entries.push(normalized);
      if (entries.length > configuredSize) {
        entries.shift();
      }

      if (listeners.size > 0) {
        for (const listener of listeners) {
          try {
            listener(normalized);
          } catch (listenerError) {
            // eslint-disable-next-line no-console
            console.warn('[LogChannel] listener failure', listenerError);
          }
        }
      }

      return normalized;
    },

    getSnapshot({
  limit = configuredSize,
      levels,
      search,
      since,
      sample = DEFAULT_SAMPLE
    } = {}) {
  const normalizedLimit = Math.min(coercePositiveInteger(limit, configuredSize), configuredSize);
      const normalizedSample = coercePositiveInteger(sample, DEFAULT_SAMPLE);
      const levelFilter = Array.isArray(levels)
        ? new Set(levels.map((level) => normalizeLevel(level)))
        : (typeof levels === 'string' && levels
          ? new Set(levels.split(',').map((level) => normalizeLevel(level)))
          : null);

      const sinceValue = since != null ? normalizeTimestamp(since) : null;
      const searchValue = typeof search === 'string' && search.trim() ? search.trim().toLowerCase() : null;

      let filtered = entries;
      if (levelFilter && levelFilter.size) {
        filtered = filtered.filter((entry) => levelFilter.has(entry.level));
      }
      if (sinceValue != null) {
        filtered = filtered.filter((entry) => entry.timestamp >= sinceValue);
      }
      if (searchValue) {
        filtered = filtered.filter((entry) => entry.message.toLowerCase().includes(searchValue));
      }

      if (normalizedSample > 1) {
        filtered = filtered.filter((entry) => entry.sequence % normalizedSample === 0);
      }

      if (filtered.length > normalizedLimit) {
        filtered = filtered.slice(filtered.length - normalizedLimit);
      }

      return filtered.map((entry) => ({
        id: entry.id,
        sequence: entry.sequence,
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp,
        source: entry.source,
        meta: entry.meta ? JSON.parse(JSON.stringify(entry.meta)) : null
      }));
    },

    getStats({ since } = {}) {
      const counts = { debug: 0, info: 0, warn: 0, error: 0 };
      const sinceValue = since != null ? normalizeTimestamp(since) : null;
      let total = 0;
      let first = null;
      let last = null;

      for (const entry of entries) {
        if (sinceValue != null && entry.timestamp < sinceValue) {
          continue;
        }
        counts[entry.level] = (counts[entry.level] || 0) + 1;
        total += 1;
        if (first == null || entry.timestamp < first) {
          first = entry.timestamp;
        }
        if (last == null || entry.timestamp > last) {
          last = entry.timestamp;
        }
      }

      return {
        total,
        levels: counts,
        firstTimestamp: first,
        lastTimestamp: last
      };
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear() {
      entries.length = 0;
      sequence = 0;
    },

    configure({ bufferSize: nextSize } = {}) {
      const parsed = Number.parseInt(nextSize, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new TypeError('LogChannel bufferSize must be a positive integer.');
      }
      const clamped = Math.max(MIN_BUFFER_SIZE, Math.min(parsed, MAX_BUFFER_SIZE));
      configuredSize = clamped;
      while (entries.length > configuredSize) {
        entries.shift();
      }
      return { bufferSize: configuredSize };
    },

    getBufferSize() {
      return configuredSize;
    }
  };

  return Object.freeze(api);
}

export const logChannel = createLogChannel();

export function normalizeLogLevel(level) {
  return normalizeLevel(level);
}

export function availableLogLevels() {
  return Array.from(VALID_LEVELS.values());
}
