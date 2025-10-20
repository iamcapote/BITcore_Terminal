/**
 * Why: Centralize memory commit history and sync telemetry so UI surfaces can reflect consolidation health.
 * What: Stores timeline events for commits, sync pushes, and consolidation jobs, exposing helpers to append entries and summarize state.
 * How: Uses a Zustand store seeded with representative demo data, cloning immutable snapshots and deriving sync health metrics.
 */

import { create } from 'zustand';

const BASE_TIME = Date.parse('2025-10-19T17:30:00Z');

export type MemoryTimelineKind = 'commit' | 'sync' | 'consolidation';
export type MemoryTimelineStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

export interface MemoryTimelineEntry {
  id: string;
  kind: MemoryTimelineKind;
  title: string;
  description: string;
  status: MemoryTimelineStatus;
  timestamp: number;
  repo?: string;
  branch?: string;
  commitSha?: string;
  target?: string;
  tags?: string[];
}

const INITIAL_EVENTS: ReadonlyArray<MemoryTimelineEntry> = [
  {
    id: 'sync-active',
    kind: 'sync',
    title: 'GitHub sync in progress',
    description: 'Pushing notebook deltas to bitcore-memory (main).',
    status: 'in-progress',
    timestamp: BASE_TIME,
    target: 'GitHub',
    repo: 'iamcapote/bitcore-memory',
    branch: 'main',
    commitSha: '4d9f2a1'
  },
  {
    id: 'commit-telemetry-recap',
    kind: 'commit',
    title: 'Commit: Research telemetry recap',
    description: 'Recorded FR-201 synthesis with 3 notes and 1 attachment.',
    status: 'completed',
    timestamp: BASE_TIME - 2 * 60 * 1000,
    repo: 'iamcapote/bitcore-memory',
    branch: 'main',
    commitSha: 'af13c67',
    tags: ['research', 'telemetry']
  },
  {
    id: 'consolidation-vector',
    kind: 'consolidation',
    title: 'Vector consolidation scheduled',
    description: 'Batching 4 embeddings for Venice context alignment.',
    status: 'pending',
    timestamp: BASE_TIME - 6 * 60 * 1000,
    target: 'Vector cache',
    tags: ['vector', 'scheduler']
  },
  {
    id: 'sync-prior',
    kind: 'sync',
    title: 'GitHub sync complete',
    description: 'Mirror repo up to date after mission export.',
    status: 'completed',
    timestamp: BASE_TIME - 12 * 60 * 1000,
    target: 'GitHub',
    repo: 'iamcapote/bitcore-memory',
    branch: 'main',
    commitSha: 'b71d9ef'
  },
  {
    id: 'commit-scheduler-recap',
    kind: 'commit',
    title: 'Commit: Mission scheduler recap',
    description: 'Indexed scheduler planning output with 5 notes.',
    status: 'completed',
    timestamp: BASE_TIME - 22 * 60 * 1000,
    repo: 'iamcapote/bitcore-memory',
    branch: 'main',
    commitSha: 'ce502ab',
    tags: ['missions']
  }
];

function cloneEvent(event: MemoryTimelineEntry): MemoryTimelineEntry {
  return {
    ...event,
    tags: event.tags ? [...event.tags] : undefined
  };
}

function sortEvents(events: MemoryTimelineEntry[]): MemoryTimelineEntry[] {
  return [...events].sort((a, b) => b.timestamp - a.timestamp);
}

function createInitialEvents(): MemoryTimelineEntry[] {
  return sortEvents(INITIAL_EVENTS.map(cloneEvent));
}

export interface MemoryTimelineState {
  events: MemoryTimelineEntry[];
}

export interface MemoryTimelineActions {
  appendEvent: (event: MemoryTimelineEntry) => void;
  updateEvent: (id: string, patch: Partial<Omit<MemoryTimelineEntry, 'id'>>) => void;
  reset: () => void;
}

export type MemoryTimelineStore = MemoryTimelineState & MemoryTimelineActions;

export const useMemoryTimelineStore = create<MemoryTimelineStore>((set) => ({
  events: createInitialEvents(),
  appendEvent: (event) =>
    set((state) => {
      const nextEvents = sortEvents([cloneEvent(event), ...state.events.map(cloneEvent)]);
      return { events: nextEvents };
    }),
  updateEvent: (id, patch) =>
    set((state) => ({
      events: state.events.map((event) => {
        if (event.id !== id) {
          return cloneEvent(event);
        }
        return cloneEvent({ ...event, ...patch });
      })
    })),
  reset: () => set(() => ({ events: createInitialEvents() }))
}));

export function getMemoryTimelineSnapshot(): MemoryTimelineState {
  const { events } = useMemoryTimelineStore.getState();
  return { events: events.map(cloneEvent) };
}

export type MemorySyncStatus = 'healthy' | 'syncing' | 'stale' | 'degraded';

export interface MemorySyncSummary {
  status: MemorySyncStatus;
  totalEvents: number;
  totalCommits: number;
  pendingUploads: number;
  inFlightUploads: number;
  failedUploads: number;
  unsyncedCommits: number;
  lastSyncedAt: number | null;
}

export function summarizeMemorySync(events: MemoryTimelineEntry[]): MemorySyncSummary {
  const commits = events.filter((event) => event.kind === 'commit');
  const syncs = events.filter((event) => event.kind === 'sync');

  const pendingUploads = syncs.filter((event) => event.status === 'pending').length;
  const inFlightUploads = syncs.filter((event) => event.status === 'in-progress').length;
  const failedUploads = syncs.filter((event) => event.status === 'failed').length;
  const lastCompletedSync = syncs.find((event) => event.status === 'completed') ?? null;
  const lastSyncedAt = lastCompletedSync?.timestamp ?? null;

  let unsyncedCommits = commits.length;
  if (lastSyncedAt) {
    unsyncedCommits = commits.filter((event) => event.timestamp > lastSyncedAt).length;
  }

  let status: MemorySyncStatus = 'healthy';
  if (failedUploads > 0) {
    status = 'degraded';
  } else if (inFlightUploads > 0) {
    status = 'syncing';
  } else if (unsyncedCommits > 0 || pendingUploads > 0) {
    status = 'stale';
  }

  return {
    status,
    totalEvents: events.length,
    totalCommits: commits.length,
    pendingUploads,
    inFlightUploads,
    failedUploads,
    unsyncedCommits,
    lastSyncedAt
  };
}
