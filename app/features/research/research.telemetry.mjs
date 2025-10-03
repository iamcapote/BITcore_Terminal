/**
 * Research Telemetry Channel
 *
 * Contract
 * Inputs:
 *   - send(type, payload): function used to push events to the transport (e.g., WebSocket safeSend)
 *   - bufferSize?: maximum number of events to retain for replay (default 120)
 *   - statusThrottleMs?: minimum milliseconds between successive status/progress events (default 350)
 * Outputs:
 *   - emitStatus(payload): publishes a `research-status` event
 *   - emitThought(payload): publishes a `research-thought` event
 *   - emitProgress(payload): publishes a `research-progress` event
 *   - emitComplete(payload): publishes a `research-complete` event
 *   - emitMemoryContext(payload): publishes a `research-memory` event
 *   - emitSuggestions(payload): publishes a `research-suggestions` event
 *   - replay(targetSend?): replays buffered events over the supplied sender (or the active sender)
 *   - updateSender(newSend): swaps the underlying transport function without dropping history
 *   - clearHistory(): empties the buffered events (useful when starting a new research run)
 *   - getHistory(): returns a cloned array of buffered events for inspection/testing
 * Error modes:
 *   - Throws if bufferSize is not a positive integer.
 *   - send failures are caught and logged; they do not throw.
 * Performance:
 *   - time: O(1) per event; memory bounded by bufferSize (~50-120 events by default).
 * Side effects:
 *   - Sends structured telemetry events to the provided sender.
 *
 * The telemetry channel is responsible for providing typed, replayable events so the
 * web client can render resilient progress indicators after reconnects.
 */

import crypto from 'crypto';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('research.telemetry');

const DEFAULT_BUFFER_SIZE = 120;
const DEFAULT_STATUS_THROTTLE_MS = 350;
const MAX_MEMORY_RECORDS = 6;
const MAX_SUGGESTIONS = 6;

export function createResearchTelemetry({
  send,
  bufferSize = DEFAULT_BUFFER_SIZE,
  statusThrottleMs = DEFAULT_STATUS_THROTTLE_MS
} = {}) {
  if (!Number.isInteger(bufferSize) || bufferSize <= 0) {
    throw new Error('ResearchTelemetry bufferSize must be a positive integer.');
  }

  let sender = typeof send === 'function' ? send : null;
  const history = [];
  let lastStatusAt = 0;
  let lastProgressAt = 0;

  const pushEvent = (type, payload = {}, { throttleKey = null } = {}) => {
    const now = Date.now();

    if (throttleKey === 'status') {
      if (now - lastStatusAt < statusThrottleMs) return null;
      lastStatusAt = now;
    }
    if (throttleKey === 'progress') {
      if (now - lastProgressAt < statusThrottleMs) return null;
      lastProgressAt = now;
    }

    const event = Object.freeze({
      id: generateEventId(now),
      type,
      data: payload,
      timestamp: now
    });

    history.push(event);
    if (history.length > bufferSize) {
      history.shift();
    }

    if (sender) {
      try {
        sender(type, { ...payload, timestamp: now, eventId: event.id });
      } catch (transportError) {
        moduleLogger.error('Failed to send telemetry event.', {
          eventType: type,
          message: transportError?.message || String(transportError),
          stack: transportError?.stack || null
        });
      }
    }

    return event;
  };

  return {
    emitStatus(status = {}) {
      return pushEvent('research-status', normalizeStatus(status), { throttleKey: 'status' });
    },
    emitThought(thought = {}) {
      return pushEvent('research-thought', normalizeThought(thought));
    },
    emitProgress(progress = {}) {
      return pushEvent('research-progress', normalizeProgress(progress), { throttleKey: 'progress' });
    },
    emitComplete(summary = {}) {
      return pushEvent('research-complete', normalizeComplete(summary));
    },
    emitMemoryContext(context = {}) {
      return pushEvent('research-memory', normalizeMemoryContext(context));
    },
    emitSuggestions(payload = {}) {
      return pushEvent('research-suggestions', normalizeSuggestions(payload));
    },
    replay(targetSend = sender) {
      if (typeof targetSend !== 'function') return;
      for (const event of history) {
        try {
          targetSend(event.type, { ...event.data, timestamp: event.timestamp, eventId: event.id });
        } catch (replayError) {
          moduleLogger.error('Failed to replay telemetry event.', {
            eventType: event.type,
            message: replayError?.message || String(replayError),
            stack: replayError?.stack || null
          });
          break;
        }
      }
    },
    updateSender(newSender) {
      sender = typeof newSender === 'function' ? newSender : null;
    },
    clearHistory() {
      history.length = 0;
      lastStatusAt = 0;
      lastProgressAt = 0;
    },
    getHistory() {
      return history.map((event) => ({
        id: event.id,
        type: event.type,
        data: { ...event.data },
        timestamp: event.timestamp
      }));
    }
  };
}

function generateEventId(timestamp) {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStatus(input = {}) {
  const {
    stage = 'unknown',
    message = '',
    detail,
    meta,
    progress
  } = input;

  return {
    stage,
    message,
    detail: detail ?? null,
    progress: progress ?? null,
    meta: meta ?? {}
  };
}

function normalizeThought(input = {}) {
  if (typeof input === 'string') {
    return { text: input };
  }
  const { text = '', source, stage, meta } = input;
  return {
    text,
    source: source ?? null,
    stage: stage ?? null,
    meta: meta ?? {}
  };
}

function normalizeProgress(input = {}) {
  const completed = coalesceNumber(input.completedQueries ?? input.completed, 0);
  const total = coalesceNumber(input.totalQueries ?? input.total, 0);
  const currentDepth = coalesceNumber(input.currentDepth, null);
  const totalDepth = coalesceNumber(input.totalDepth, null);
  const currentBreadth = coalesceNumber(input.currentBreadth, null);
  const totalBreadth = coalesceNumber(input.totalBreadth, null);
  const percentComplete = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : null;

  return {
    completed,
    total,
    status: input.status ?? null,
    message: input.currentAction ?? input.message ?? null,
    currentDepth,
    totalDepth,
    currentBreadth,
    totalBreadth,
    percentComplete
  };
}

function normalizeMemoryContext(input = {}) {
  const query = typeof input.query === 'string' ? truncateString(input.query, 280) : null;
  const stats = normalizeMemoryStats(input.stats);
  const records = Array.isArray(input.records)
    ? input.records.map(normalizeMemoryRecord).filter(Boolean).slice(0, MAX_MEMORY_RECORDS)
    : [];

  return {
    query,
    stats,
    records
  };
}

function normalizeSuggestions(input = {}) {
  const source = typeof input.source === 'string' && input.source.trim()
    ? input.source.trim().toLowerCase()
    : 'memory';
  const generatedAt = Number.isFinite(input.generatedAt) ? input.generatedAt : Date.now();

  const suggestions = Array.isArray(input)
    ? input
    : (Array.isArray(input.suggestions) ? input.suggestions : []);

  const normalized = suggestions
    .map(normalizeSuggestionEntry)
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS);

  return {
    source,
    generatedAt,
    suggestions: normalized
  };
}

function normalizeSuggestionEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const prompt = typeof entry.prompt === 'string' && entry.prompt.trim()
    ? truncateString(entry.prompt, 240)
    : null;
  if (!prompt) {
    return null;
  }

  const focus = typeof entry.focus === 'string' && entry.focus.trim()
    ? truncateString(entry.focus, 120)
    : null;

  const layer = typeof entry.layer === 'string' && entry.layer.trim()
    ? entry.layer.trim()
    : null;

  const memoryId = entry.memoryId ? String(entry.memoryId).slice(0, 80) : null;
  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const score = normalizeScore(entry.score);

  return {
    prompt,
    focus,
    layer,
    memoryId,
    tags,
    score
  };
}

function normalizeMemoryStats(stats) {
  if (!stats || typeof stats !== 'object') {
    return null;
  }
  return {
    stored: coalesceCount(stats.stored),
    retrieved: coalesceCount(stats.retrieved),
    validated: coalesceCount(stats.validated),
    summarized: coalesceCount(stats.summarized),
    ephemeralCount: coalesceCount(stats.ephemeralCount),
    validatedCount: coalesceCount(stats.validatedCount)
  };
}

function normalizeMemoryRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const previewSource = typeof record.preview === 'string' && record.preview.trim()
    ? record.preview
    : (typeof record.content === 'string' ? record.content : null);

  if (!previewSource) {
    return null;
  }

  const tags = Array.isArray(record.tags)
    ? record.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const score = normalizeScore(record.score);
  const timestamp = normalizeTimestamp(record.timestamp);
  const source = typeof record.source === 'string' && record.source.trim()
    ? truncateString(record.source, 120)
    : null;

  return {
    id: record.id ? String(record.id).slice(0, 80) : null,
    layer: record.layer ? String(record.layer) : null,
    preview: truncateString(previewSource, 260),
    tags,
    source,
    score,
    timestamp
  };
}

function normalizeComplete(input = {}) {
  const {
    success = true,
    durationMs,
    learnings = 0,
    sources = 0,
    suggestedFilename = null,
    error = null,
    summary = null,
    meta = {}
  } = input;

  return {
    success,
    durationMs: coalesceNumber(durationMs, null),
    learnings,
    sources,
    suggestedFilename,
    error,
    summary,
    meta
  };
}

function coalesceNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function coalesceCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.round(num);
}

function normalizeScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(1, num));
  return Number.isNaN(clamped) ? null : clamped;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function truncateString(text, maxLength) {
  if (typeof text !== 'string') {
    return '';
  }
  const trimmed = text.trim();
  if (!maxLength || trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}
