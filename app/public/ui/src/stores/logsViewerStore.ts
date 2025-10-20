/**
 * Why: Centralize simulated log tail data and controls so the GUI can mirror CLI log streaming behavior.
 * What: Maintains log entries, level filters, search query, and streaming status with helpers for filtered views and stats.
 * How: Seeds demo entries, exposes Zustand actions for filtering/appends, and derives immutable snapshots for consumers and tests.
 */

import { create } from 'zustand';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface LogsViewerState {
  entries: LogEntry[];
  activeLevels: Set<LogLevel>;
  searchQuery: string;
  streaming: boolean;
}

export interface LogsViewerActions {
  toggleLevel: (level: LogLevel) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  appendEntry: (entry: LogEntry) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
}

export type LogsViewerStore = LogsViewerState & LogsViewerActions;

const BASE_TIME = Date.parse('2025-10-19T17:55:00Z');

const INITIAL_LOGS: ReadonlyArray<LogEntry> = [
  {
    id: 'log-001',
    level: 'info',
    message: 'Bootstrapped BITcore UI preview server.',
    source: 'ui.bootstrap',
    timestamp: BASE_TIME - 60_000
  },
  {
    id: 'log-002',
    level: 'warn',
    message: 'Venice token nearing rate-limit threshold (80%).',
    source: 'ai.venice.limiter',
    timestamp: BASE_TIME - 45_000,
    context: { limit: 60, used: 48 }
  },
  {
    id: 'log-003',
    level: 'info',
    message: 'Mission scheduler heartbeat acknowledged.',
    source: 'missions.scheduler',
    timestamp: BASE_TIME - 25_000
  },
  {
    id: 'log-004',
    level: 'error',
    message: 'GitHub sync failed: credentials expired.',
    source: 'github.sync',
    timestamp: BASE_TIME - 15_000
  },
  {
    id: 'log-005',
    level: 'debug',
    message: 'Research pipeline context size: 14.2KB.',
    source: 'research.engine',
    timestamp: BASE_TIME - 12_000,
    context: { tokens: 3560 }
  },
  {
    id: 'log-006',
    level: 'info',
    message: 'Research telemetry broadcast to websocket clients.',
    source: 'research.telemetry',
    timestamp: BASE_TIME - 6_000
  }
];

const DEFAULT_ACTIVE_LEVELS: ReadonlyArray<LogLevel> = ['info', 'warn', 'error'];

function cloneEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    context: entry.context ? { ...entry.context } : undefined
  };
}

function cloneEntries(entries: LogEntry[]): LogEntry[] {
  return entries.map(cloneEntry);
}

function sortEntries(entries: LogEntry[]): LogEntry[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp);
}

function createInitialState(): LogsViewerState {
  return {
    entries: sortEntries(INITIAL_LOGS.map(cloneEntry)),
    activeLevels: new Set(DEFAULT_ACTIVE_LEVELS),
    searchQuery: '',
    streaming: false
  };
}

export const useLogsViewerStore = create<LogsViewerStore>((set) => ({
  ...createInitialState(),
  toggleLevel: (level) =>
    set((state) => {
      const next = new Set(state.activeLevels);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return { activeLevels: next };
    }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearFilters: () => set({ activeLevels: new Set(DEFAULT_ACTIVE_LEVELS), searchQuery: '' }),
  appendEntry: (entry) =>
    set((state) => ({
      entries: sortEntries([cloneEntry(entry), ...cloneEntries(state.entries)])
    })),
  setStreaming: (streaming) => set({ streaming }),
  reset: () => set(() => createInitialState())
}));

export function getLogsSnapshot(): LogsViewerState {
  const { entries, activeLevels, searchQuery, streaming } = useLogsViewerStore.getState();
  return {
    entries: cloneEntries(entries),
    activeLevels: new Set(activeLevels),
    searchQuery,
    streaming
  };
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
}

function matchesFilters(entry: LogEntry, activeLevels: Set<LogLevel>, searchQuery: string): boolean {
  if (activeLevels.size > 0 && !activeLevels.has(entry.level)) {
    return false;
  }

  if (!searchQuery) {
    return true;
  }

  const normalized = searchQuery.toLowerCase();
  return (
    entry.message.toLowerCase().includes(normalized) ||
    entry.source.toLowerCase().includes(normalized)
  );
}

export function filterLogs(entries: LogEntry[], activeLevels: Set<LogLevel>, searchQuery: string): LogEntry[] {
  return sortEntries(entries.filter((entry) => matchesFilters(entry, activeLevels, searchQuery.trim())));
}

export function getFilteredLogs(): LogEntry[] {
  const { entries, activeLevels, searchQuery } = useLogsViewerStore.getState();
  return filterLogs(entries, activeLevels, searchQuery);
}

export function getLogStats(entries: LogEntry[] = useLogsViewerStore.getState().entries): LogStats {
  const stats: LogStats = {
    total: entries.length,
    byLevel: {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    }
  };

  for (const entry of entries) {
    stats.byLevel[entry.level] += 1;
  }

  return stats;
}
