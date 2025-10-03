/**
 * Logs CLI command
 *
 * Why: Provide terminal access to recent structured logs without requiring the web dashboard.
 * What: Supports `/logs tail|stats|settings|retention|purge` to mirror the web surface for log inspection and administration.
 * How: Reads from the shared in-memory logChannel buffer, applies validation, and formats records for CLI or WebSocket output.
 */

import { logChannel, availableLogLevels, normalizeLogLevel, MIN_BUFFER_SIZE, MAX_BUFFER_SIZE } from '../utils/log-channel.mjs';
import { handleCliError } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.logs.cli', { emitToStdStreams: false });

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DEFAULT_FOLLOW_DURATION_MS = 30000;
const MAX_FOLLOW_DURATION_MS = 10 * 60 * 1000;

function stringifyMessage(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[unserializable payload]';
    }
  }
  return String(value);
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = stringifyMessage(value);
    const metaIsObject = meta && typeof meta === 'object';
    const normalizedMeta = metaIsObject ? { ...meta } : meta;
    const skipLog = Boolean(metaIsObject && meta.skipLog === true);

    if (metaIsObject && normalizedMeta && 'skipLog' in normalizedMeta) {
      delete normalizedMeta.skipLog;
    }

    if (!skipLog) {
      const payloadMeta = normalizedMeta || (typeof value === 'object' && value !== null ? { payload: value } : null);
      moduleLogger[level](message, payloadMeta);
    }
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

function parseDurationMs(value, fallback = DEFAULT_FOLLOW_DURATION_MS) {
  if (value == null) {
    return fallback;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized.endsWith('ms')) {
    const parsed = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
  if (normalized.endsWith('s')) {
    const parsed = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : fallback;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, MAX_FOLLOW_DURATION_MS);
}

function parseMaxEntries(value, fallback = Number.POSITIVE_INFINITY) {
  if (value == null) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseSample(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(parsed, 50);
}

function parseLevels(value) {
  if (!value) {
    return null;
  }
  const entries = Array.isArray(value) ? value : String(value).split(',');
  return entries
    .map((entry) => normalizeLogLevel(entry))
    .filter(Boolean);
}

function parseSince(value) {
  if (!value) return null;
  if (Number.isFinite(value)) return Number(value);
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) return parsed;
  const dateParsed = Date.parse(String(value));
  return Number.isFinite(dateParsed) ? dateParsed : null;
}

function sendWsAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    const ack = { type: 'output', data: '', keepDisabled: false };
    wsOutput(ack);
  }
}

function formatLogEntry(entry) {
  const timestamp = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase().padEnd(5, ' ');
  return `${timestamp} ${level} ${entry.message}`;
}

function createEntryFilter({ levels, searchTerm, sample }) {
  const levelSet = Array.isArray(levels) && levels.length ? new Set(levels) : null;
  const normalizedSearch = searchTerm ? String(searchTerm).toLowerCase() : '';
  const normalizedSample = Number.isFinite(sample) && sample > 1 ? sample : 1;

  return (entry) => {
    if (!entry) return false;
    if (levelSet && levelSet.size && !levelSet.has(entry.level)) {
      return false;
    }
    if (normalizedSample > 1 && Number.isFinite(entry.sequence) && entry.sequence % normalizedSample !== 0) {
      return false;
    }
    if (normalizedSearch) {
      const message = typeof entry.message === 'string' ? entry.message.toLowerCase() : '';
      if (!message.includes(normalizedSearch)) {
        return false;
      }
    }
    return true;
  };
}

async function streamLogFollow({
  buffer,
  filterFn,
  limit,
  durationMs,
  maxEntries,
  jsonOutput,
  outputFn
}) {
  const maxCap = Number.isFinite(maxEntries) ? maxEntries : Number.POSITIVE_INFINITY;
  let newCount = 0;
  let resolved = false;

  return new Promise((resolve) => {
    let timer = null;

    const cleanup = (reason) => {
      if (resolved) {
        return;
      }
      resolved = true;
      if (timer) {
        clearTimeout(timer);
      }
      unsubscribe();
      moduleLogger.info('Logs tail follow session ended.', {
        resultCount: buffer.length,
        newEntries: newCount,
        reason,
        jsonOutput
      });
      resolve({ reason, newCount });
    };

    const unsubscribe = logChannel.subscribe((entry) => {
      if (!filterFn(entry)) {
        return;
      }
      buffer.push(entry);
      if (buffer.length > limit) {
        buffer.splice(0, buffer.length - limit);
      }
      newCount += 1;
      if (!jsonOutput) {
        outputFn(formatLogEntry(entry));
      }
      if (newCount >= maxCap) {
        cleanup('max');
      }
    });

    timer = durationMs > 0
      ? setTimeout(() => cleanup('timeout'), durationMs)
      : setTimeout(() => cleanup('timeout'), DEFAULT_FOLLOW_DURATION_MS);
  });
}

export function getLogsHelpText() {
  return [
    '/logs tail [--limit=200] [--levels=info,error] [--sample=1] [--search="term"] [--follow] [--duration=30s] [--max=50] [--json]  Show and optionally stream recent log entries.',
    '/logs stats [--since=<timestamp|ISO>]  Summarize log counts by level.',
    '/logs settings [--json]  Display current buffer size and supported levels.',
    '/logs retention <size>  Update the in-memory buffer size (50-5000).',
    '/logs purge  Clear the buffered log entries.'
  ].join('\n');
}

export async function executeLogs(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput, 'info');
  const errorFn = createEmitter(wsError, 'error');

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || (positionalArgs.shift()?.toLowerCase()) || 'tail';
  const flags = options.flags || {};

  moduleLogger.info('Executing logs command.', {
    subcommand,
    hasWebSocketOutput: typeof wsOutput === 'function',
    hasWebSocketError: typeof wsError === 'function'
  });

  try {
    switch (subcommand) {
      case 'tail': {
        const limit = parseLimit(flags.limit ?? options.limit ?? 200, 200);
        const sample = parseSample(flags.sample ?? options.sample ?? 1);
        const levels = parseLevels(flags.levels ?? flags.level ?? options.levels);
        const search = flags.search ?? options.search ?? positionalArgs.join(' ');
        const jsonOutput = toBoolean(flags.json ?? options.json, false);

        const follow = toBoolean(flags.follow ?? options.follow, false);
        const durationMs = follow
          ? parseDurationMs(flags.duration ?? options.duration, DEFAULT_FOLLOW_DURATION_MS)
          : 0;
        const maxEntries = follow ? parseMaxEntries(flags.max ?? options.max) : Number.POSITIVE_INFINITY;
        const searchTerm = typeof search === 'string' ? search.trim().toLowerCase() : '';
        const filterFn = createEntryFilter({ levels, searchTerm, sample });

        moduleLogger.info('Logs tail parameters resolved.', {
          limit,
          sample,
          levels,
          searchTerm,
          jsonOutput,
          follow,
          durationMs,
          maxEntries: Number.isFinite(maxEntries) ? maxEntries : null
        });

        const snapshot = logChannel.getSnapshot({
          limit,
          levels,
          search,
          sample
        });

        const buffer = [...snapshot];

        if (!follow) {
          if (jsonOutput) {
            outputFn(JSON.stringify(buffer, null, 2));
          } else if (!buffer.length) {
            outputFn('No log entries matched the filters.');
          } else {
            buffer.forEach((entry) => outputFn(formatLogEntry(entry)));
          }
          sendWsAck(wsOutput);
          moduleLogger.info('Logs tail completed without follow.', {
            resultCount: buffer.length,
            jsonOutput
          });
          return { success: true, logs: buffer };
        }

        if (!jsonOutput) {
          if (!buffer.length) {
            outputFn('No log entries matched the filters. Waiting for new entries…');
          } else {
            buffer.forEach((entry) => outputFn(formatLogEntry(entry)));
          }
        }

        moduleLogger.info('Logs tail follow session started.', {
          initialCount: buffer.length,
          limit,
          durationMs,
          maxEntries: Number.isFinite(maxEntries) ? maxEntries : null
        });

        const { newCount, reason } = await streamLogFollow({
          buffer,
          filterFn,
          limit,
          durationMs,
          maxEntries,
          jsonOutput,
          outputFn
        });

        if (jsonOutput) {
          outputFn(JSON.stringify(buffer, null, 2));
        }

        sendWsAck(wsOutput);
        moduleLogger.info('Logs tail follow completed.', {
          resultCount: buffer.length,
          newEntries: newCount,
          reason,
          jsonOutput
        });
        return { success: true, logs: buffer, followed: true, newEntries: newCount, reason };
      }

      case 'stats': {
        const since = parseSince(flags.since ?? options.since ?? positionalArgs.shift());
        const stats = logChannel.getStats({ since });
        const lines = [
          '--- Log Statistics ---',
          `Total: ${stats.total}`,
          `Info: ${stats.levels.info}`,
          `Warn: ${stats.levels.warn}`,
          `Error: ${stats.levels.error}`,
          `Debug: ${stats.levels.debug}`
        ];
        if (stats.firstTimestamp) {
          lines.push(`First: ${new Date(stats.firstTimestamp).toISOString()}`);
        }
        if (stats.lastTimestamp) {
          lines.push(`Last: ${new Date(stats.lastTimestamp).toISOString()}`);
        }
        lines.forEach((line) => outputFn(line));
        sendWsAck(wsOutput);
        moduleLogger.info('Logs statistics emitted.', {
          since,
          totals: stats.total,
          levels: stats.levels
        });
        return { success: true, stats };
      }

      case 'settings': {
        const jsonOutput = toBoolean(flags.json ?? options.json, false);
        const settings = {
          bufferSize: logChannel.getBufferSize(),
          availableLevels: availableLogLevels()
        };
        if (jsonOutput) {
          outputFn(JSON.stringify(settings, null, 2));
        } else {
          outputFn('--- Log Settings ---');
          outputFn(`Buffer Size: ${settings.bufferSize}`);
          outputFn(`Available Levels: ${settings.availableLevels.join(', ')}`);
        }
        sendWsAck(wsOutput);
        moduleLogger.info('Logs settings reported.', settings);
        return { success: true, settings };
      }

      case 'retention': {
        const sizeArg = flags.bufferSize ?? flags.size ?? positionalArgs.shift();
        const parsed = Number.parseInt(sizeArg, 10);
        if (!Number.isFinite(parsed)) {
          const message = 'bufferSize must be a finite integer.';
          moduleLogger.warn('Invalid retention size received (non-finite).', { sizeArg });
          errorFn(message, { code: 'invalid_retention_size', sizeArg });
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        if (parsed < MIN_BUFFER_SIZE || parsed > MAX_BUFFER_SIZE) {
          const message = `bufferSize must be between ${MIN_BUFFER_SIZE} and ${MAX_BUFFER_SIZE}.`;
          moduleLogger.warn('Retention size outside bounds.', { requested: parsed });
          errorFn(message, { code: 'retention_out_of_range', requested: parsed });
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        const { bufferSize } = logChannel.configure({ bufferSize: parsed });
        outputFn(`Log buffer size set to ${bufferSize}.`);
        sendWsAck(wsOutput);
        moduleLogger.info('Log buffer size updated.', { bufferSize });
        return { success: true, bufferSize };
      }

      case 'purge':
      case 'clear': {
        moduleLogger.warn('Log buffer clear requested via CLI.');
        logChannel.clear();
        outputFn('Log buffer cleared.', { skipLog: true });
        sendWsAck(wsOutput);
        return { success: true, cleared: true };
      }

      default: {
        const error = new Error(`Unknown /logs subcommand: ${subcommand}`);
        moduleLogger.warn('Unknown logs subcommand.', { subcommand });
        errorFn(error.message, { code: 'unknown_logs_subcommand', subcommand });
        sendWsAck(wsOutput);
        return { success: false, error: error.message, handled: true };
      }
    }
  } catch (error) {
    moduleLogger.error('Logs command failed.', {
      subcommand,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    const result = handleCliError(error, 'logs', { subcommand }, errorFn);
    sendWsAck(wsOutput);
    return result;
  }
}

export default executeLogs;
