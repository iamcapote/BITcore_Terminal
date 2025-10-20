/**
 * Why: Validate log store filtering, search, and streaming state so the UI mirrors CLI expectations.
 * What: Exercises level toggling, query filtering, append operations, and stat helpers for deterministic behavior.
 * How: Manipulates the Zustand store directly, capturing snapshots and verifying derived outputs.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  filterLogs,
  getFilteredLogs,
  getLogStats,
  getLogsSnapshot,
  type LogEntry,
  type LogLevel,
  useLogsViewerStore
} from './logsViewerStore';

afterEach(() => {
  useLogsViewerStore.getState().reset();
});

describe('logsViewerStore', () => {
  it('seeds sorted demo entries', () => {
    const snapshot = getLogsSnapshot();
    expect(snapshot.entries.length).toBeGreaterThan(0);
    expect(snapshot.entries[0].timestamp).toBeGreaterThan(snapshot.entries.at(-1)?.timestamp ?? 0);
    expect(snapshot.activeLevels.has('info')).toBe(true);
    expect(snapshot.activeLevels.has('debug')).toBe(false);
  });

  it('toggles levels and filters results', () => {
    useLogsViewerStore.getState().toggleLevel('warn');
    useLogsViewerStore.getState().toggleLevel('error');
    const filtered = getFilteredLogs();
    expect(filtered.every((entry) => entry.level === 'info' || entry.level === 'debug')).toBe(true);
  });

  it('filters by search query', () => {
    useLogsViewerStore.getState().setSearchQuery('github');
    const filtered = getFilteredLogs();
    expect(filtered.length).toBe(1);
    expect(filtered[0].source).toBe('github.sync');
  });

  it('appends entries and keeps order', () => {
    const entry: LogEntry = {
      id: 'log-new',
      level: 'info',
      message: 'Streaming log entry appended.',
      source: 'test.runner',
      timestamp: Date.now()
    };

    useLogsViewerStore.getState().appendEntry(entry);
    const snapshot = getLogsSnapshot();
    expect(snapshot.entries[0].id).toBe('log-new');
  });

  it('computes stats per level', () => {
    const stats = getLogStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byLevel.info).toBeGreaterThan(0);
    expect(Object.keys(stats.byLevel)).toContain('warn');
  });

  it('supports manual filtering helper', () => {
    const snapshot = getLogsSnapshot();
    const customLevels = new Set<LogLevel>(['error']);
    const filtered = filterLogs(snapshot.entries, customLevels, '');
    expect(filtered.length).toBe(1);
    expect(filtered[0].level).toBe('error');
  });

  it('tracks streaming state', () => {
    useLogsViewerStore.getState().setStreaming(true);
    expect(getLogsSnapshot().streaming).toBe(true);
  });
});
