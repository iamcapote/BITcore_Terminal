/**
 * GitHub Activity WebComm Channel
 *
 * Contract
 * Inputs:
 *   - send(type: string, payload: object): transport function used to push messages to clients.
 *   - snapshotLimit?: number (default 80) maximum number of entries to emit during replay.
 *   - logger?: { debug?, info?, warn?, error? }
 * Outputs:
 *   - attach(options?): begins streaming activity events and emits an initial snapshot.
 *   - detach(): stops streaming and releases listeners.
 *   - updateSender(send): swaps transport without losing state.
 *   - handleRequest(request): processes client-initiated commands (snapshot/stats/export).
 *   - getState(): returns readonly state snapshot ({ lastSequence, attached }).
 * Error modes:
 *   - Throws TypeError when send is missing.
 *   - handleRequest returns structured error objects instead of throwing for invalid commands.
 * Performance:
 *   - O(1) per live event; snapshot bounded by snapshotLimit (<200 default).
 * Side effects:
 *   - Relies on github-activity.channel for in-memory buffering; no external IO.
 */

import { freezeDeep } from '../../utils/object.freeze.mjs';
import {
  getGitHubActivitySnapshot,
  getGitHubActivityStats,
  subscribeGitHubActivity
} from './github-activity.channel.mjs';

const DEFAULT_SNAPSHOT_LIMIT = 80;
const MAX_SNAPSHOT_LIMIT = 200;

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function clampLimit(limit) {
  const numeric = Number.parseInt(limit, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_SNAPSHOT_LIMIT;
  }
  return Math.min(Math.max(1, numeric), MAX_SNAPSHOT_LIMIT);
}

function normalizeFilters(request = {}) {
  const filters = {};
  if (request.levels != null) {
    const rawLevels = Array.isArray(request.levels)
      ? request.levels
      : String(request.levels).split(',');
    filters.levels = rawLevels
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean);
    if (filters.levels.length === 0) {
      delete filters.levels;
    }
  }
  if (request.search != null) {
    const value = String(request.search).trim();
    if (value) {
      filters.search = value;
    }
  }
  if (request.since != null) {
    const since = Number(request.since);
    if (Number.isFinite(since) && since > 0) {
      filters.since = since;
    }
  }
  if (request.sample != null) {
    const sample = Number.parseInt(request.sample, 10);
    if (Number.isFinite(sample) && sample >= 1 && sample <= 10) {
      filters.sample = sample;
    }
  }
  return filters;
}

function createStateSnapshot(state) {
  return freezeDeep({
    attached: state.attached,
    lastSequence: state.lastSequence,
    lastSnapshotMeta: state.lastSnapshotMeta
      ? { ...state.lastSnapshotMeta }
      : null
  });
}

export function createGitHubActivityWebComm({ send, snapshotLimit = DEFAULT_SNAPSHOT_LIMIT, logger = noopLogger } = {}) {
  if (typeof send !== 'function') {
    throw new TypeError('GitHubActivityWebComm requires a send function.');
  }

  let transport = send;
  let unsubscribe = null;
  let disposed = false;
  const listeners = new Set();
  const state = {
    attached: false,
    lastSequence: 0,
    lastSnapshotMeta: null
  };

  function safeSend(type, payload) {
    if (disposed || typeof transport !== 'function') {
      return;
    }
    try {
      transport(type, payload);
    } catch (error) {
      logger?.warn?.('[GitHubActivityWebComm] Failed to send payload', error);
    }
  }

  function handleLiveEntry(entry) {
    if (!entry || disposed) {
      return;
    }
    state.lastSequence = Math.max(state.lastSequence, entry.sequence || 0);
    safeSend('github-activity:event', { entry });
    for (const listener of listeners) {
      try {
        listener(entry);
      } catch (error) {
        logger?.warn?.('[GitHubActivityWebComm] listener failed', error);
      }
    }
  }

  function emitSnapshot(options = {}) {
    const limit = clampLimit(options.limit ?? snapshotLimit);
    const filters = normalizeFilters(options);
    const snapshot = getGitHubActivitySnapshot({ limit, ...filters });
    const lastEntry = snapshot.length ? snapshot[snapshot.length - 1] : null;
    state.lastSequence = Math.max(state.lastSequence, lastEntry?.sequence || 0);
    state.lastSnapshotMeta = {
      limit,
      count: snapshot.length,
      filters
    };
    safeSend('github-activity:snapshot', {
      entries: snapshot,
      meta: { limit, count: snapshot.length, filters }
    });
    return snapshot;
  }

  function emitStats(options = {}) {
    const filters = normalizeFilters(options);
    const stats = getGitHubActivityStats({ since: filters.since });
    safeSend('github-activity:stats', {
      stats,
      meta: { filters }
    });
    return stats;
  }

  function attach(options = {}) {
    if (disposed) {
      throw new Error('GitHubActivityWebComm has been disposed.');
    }
    if (state.attached) {
      return state;
    }
    emitSnapshot(options);
    unsubscribe = subscribeGitHubActivity(handleLiveEntry);
    state.attached = true;
    return state;
  }

  function detach() {
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        logger?.warn?.('[GitHubActivityWebComm] Failed to unsubscribe', error);
      }
    }
    unsubscribe = null;
    state.attached = false;
  }

  function updateSender(nextSend) {
    transport = typeof nextSend === 'function' ? nextSend : null;
  }

  function handleRequest(request = {}) {
    const command = typeof request.command === 'string'
      ? request.command.trim().toLowerCase()
      : 'snapshot';

    switch (command) {
      case 'snapshot': {
        const snapshot = emitSnapshot(request);
        return { ok: true, count: snapshot.length };
      }
      case 'stats': {
        const stats = emitStats(request);
        return { ok: true, stats };
      }
      case 'replay': {
        const sinceSequence = Number.isFinite(request.sinceSequence)
          ? request.sinceSequence
          : state.lastSequence - snapshotLimit;
        const snapshot = getGitHubActivitySnapshot({ limit: snapshotLimit, since: request.since ?? null });
        const filtered = snapshot.filter((entry) => (entry.sequence || 0) > sinceSequence);
        safeSend('github-activity:replay', {
          entries: filtered,
          meta: {
            requestedSince: sinceSequence,
            count: filtered.length
          }
        });
        if (filtered.length) {
          state.lastSequence = Math.max(state.lastSequence, filtered[filtered.length - 1]?.sequence || 0);
        }
        return { ok: true, count: filtered.length };
      }
      case 'export': {
        const snapshot = getGitHubActivitySnapshot({ limit: clampLimit(request.limit ?? 200) });
        safeSend('github-activity:export-ready', {
          entries: snapshot,
          meta: { count: snapshot.length }
        });
        return { ok: true, count: snapshot.length };
      }
      default:
        return { ok: false, error: `Unsupported command '${command}'.` };
    }
  }

  function dispose() {
    if (disposed) return;
    detach();
    listeners.clear();
    disposed = true;
  }

  function onEntry(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return createStateSnapshot(state);
  }

  return freezeDeep({
    attach,
    detach,
    dispose,
    updateSender,
    handleRequest,
    emitSnapshot,
    emitStats,
    onEntry,
    getState
  });
}

export default createGitHubActivityWebComm;
