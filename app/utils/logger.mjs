/**
 * Contract
 * Inputs:
 *   - createModuleLogger(source, options?): source identifier and optional { emitToStdStreams?, baseMeta? }.
 *   - Logger methods debug|info|warn|error(message, meta?) accept Error|string|object payloads plus optional metadata.
 * Outputs:
 *   - Structured entries persisted via logChannel.push({ level, message, source, meta }).
 *   - Optional mirrored writes to stdout/stderr when emitToStdStreams is true.
 * Error modes:
 *   - Silently drops falsy/empty messages.
 *   - Serialisation safeguards convert circular or non-serializable meta values into safe stand-ins.
 * Performance:
 *   - O(1) normalisation per log call; memory bounded by logChannel buffer.
 * Why: Provide structured, module-scoped logging without relying on console side effects.
 * What: Formats messages, normalizes levels, enriches metadata, and pushes entries into the shared log channel.
 * How: Offers factory helpers to create immutable loggers that write to logChannel and optional streams.
 */

import { logChannel } from './log-channel.mjs';

const VALID_LEVELS = ['debug', 'info', 'warn', 'error'];
const LEVEL_SET = new Set(VALID_LEVELS);

function normalizeLevel(level) {
  const value = typeof level === 'string' ? level.trim().toLowerCase() : '';
  if (LEVEL_SET.has(value)) {
    return value;
  }
  if (value === 'warning') {
    return 'warn';
  }
  return 'info';
}

function formatMessage(raw) {
  if (raw instanceof Error) {
    return raw.stack || `${raw.name}: ${raw.message}` || raw.name || 'Error';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  if (raw == null) {
    return '';
  }
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw);
    } catch (error) {
      return '[unserializable object]';
    }
  }
  if (typeof raw === 'bigint') {
    return raw.toString();
  }
  return String(raw);
}

function cloneMeta(value, seen = new WeakSet()) {
  if (value == null) {
    return null;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (typeof value === 'function') {
    return { type: 'function', name: value.name || 'anonymous' };
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => cloneMeta(item, seen));
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = cloneMeta(entry, seen);
  }
  seen.delete(value);
  return result;
}

function defaultStreamWriter(level, source, message) {
  const isError = level === 'error' || level === 'warn';
  const stream = isError ? process.stderr : process.stdout;
  const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
  const sourceTag = source ? `[${source}] ` : '';
  stream.write(`${prefix}${sourceTag}${message}\n`);
}

function pushEntry({ level, source, message, meta, writeToStream }) {
  if (!message) {
    return null;
  }
  const entry = logChannel.push({
    level,
    message,
    source: source || 'server',
    meta: meta || null
  });
  if (writeToStream) {
    writeToStream(level, source, message, meta);
  }
  return entry;
}

export function createModuleLogger(source, {
  emitToStdStreams = true,
  baseMeta = null
} = {}) {
  const sanitizedSource = typeof source === 'string' && source.trim() ? source.trim() : 'server';
  const writeToStream = emitToStdStreams ? (level, localSource, message) => {
    defaultStreamWriter(level, localSource, message);
  } : null;

  function log(level, rawMessage, meta) {
    const normalizedLevel = normalizeLevel(level);
    if (normalizedLevel === 'debug' && process.env.DEBUG_MODE !== 'true') {
      return null;
    }
    const message = formatMessage(rawMessage);
    const mergedMeta = baseMeta || meta ? {
      ...(baseMeta ? cloneMeta(baseMeta) : {}),
      ...(meta ? cloneMeta(meta) : {})
    } : null;
    return pushEntry({
      level: normalizedLevel,
      source: sanitizedSource,
      message,
      meta: mergedMeta,
      writeToStream
    });
  }

  return Object.freeze({
    debug(message, meta) {
      return log('debug', message, meta);
    },
    info(message, meta) {
      return log('info', message, meta);
    },
    warn(message, meta) {
      return log('warn', message, meta);
    },
    error(message, meta) {
      return log('error', message, meta);
    },
    child(label, childOptions = {}) {
      const nextSource = label ? `${sanitizedSource}:${label}` : sanitizedSource;
      return createModuleLogger(nextSource, {
        emitToStdStreams: childOptions.emitToStdStreams ?? emitToStdStreams,
        baseMeta: childOptions.baseMeta || baseMeta
      });
    },
    withMeta(meta) {
      const merged = baseMeta || meta ? {
        ...(baseMeta ? cloneMeta(baseMeta) : {}),
        ...(meta ? cloneMeta(meta) : {})
      } : null;
      return createModuleLogger(sanitizedSource, {
        emitToStdStreams,
        baseMeta: merged
      });
    }
  });
}

export function normalizeLogLevel(level) {
  return normalizeLevel(level);
}

export function formatLogMessage(message) {
  return formatMessage(message);
}

export function normalizeLogMeta(meta) {
  return cloneMeta(meta);
}
