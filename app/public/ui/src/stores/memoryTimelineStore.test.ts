/**
 * Why: Ensure the memory timeline store maintains immutable history and accurate sync summaries for dashboards.
 * What: Appends entries, updates statuses, and validates the derived sync health classifier against representative scenarios.
 * How: Interacts with the Zustand store directly and exercises helper utilities without rendering components.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  getMemoryTimelineSnapshot,
  summarizeMemorySync,
  useMemoryTimelineStore
} from './memoryTimelineStore';

afterEach(() => {
  useMemoryTimelineStore.getState().reset();
});

describe('memoryTimelineStore', () => {
  it('seeds sorted demo events', () => {
    const snapshot = getMemoryTimelineSnapshot();
    expect(snapshot.events).toHaveLength(5);
    expect(snapshot.events[0].id).toBe('sync-active');
    expect(snapshot.events[0].timestamp).toBeGreaterThan(snapshot.events.at(-1)?.timestamp ?? 0);
  });

  it('appends events and keeps them ordered by timestamp descending', () => {
    const nextEvent = {
      id: 'commit-latest',
      kind: 'commit' as const,
      title: 'Commit: Demo append',
      description: 'Testing append ordering.',
      status: 'completed' as const,
      timestamp: Date.parse('2025-10-19T18:05:00Z'),
      repo: 'iamcapote/bitcore-memory',
      branch: 'main',
      commitSha: 'fff0001'
    };

    useMemoryTimelineStore.getState().appendEvent(nextEvent);
    const snapshot = getMemoryTimelineSnapshot();
    expect(snapshot.events[0].id).toBe('commit-latest');
  });

  it('updates event fields immutably', () => {
    const before = getMemoryTimelineSnapshot();
    const targetId = before.events[0].id;

    useMemoryTimelineStore.getState().updateEvent(targetId, { status: 'completed' });

    const after = getMemoryTimelineSnapshot();
    expect(after.events.find((event) => event.id === targetId)?.status).toBe('completed');
    expect(before.events.find((event) => event.id === targetId)?.status).toBe('in-progress');
  });
});

describe('summarizeMemorySync', () => {
  it('reports syncing when uploads are in flight', () => {
    const snapshot = getMemoryTimelineSnapshot();
    const summary = summarizeMemorySync(snapshot.events);

    expect(summary.status).toBe('syncing');
    expect(summary.inFlightUploads).toBeGreaterThan(0);
  });

  it('reports stale when commits outpace completed syncs', () => {
    const events = [
      {
        id: 'sync-complete',
        kind: 'sync' as const,
        title: 'Sync complete',
        description: 'Baseline sync finished.',
        status: 'completed' as const,
        timestamp: Date.parse('2025-10-18T17:00:00Z'),
        target: 'GitHub'
      },
      {
        id: 'commit-new',
        kind: 'commit' as const,
        title: 'Commit after sync',
        description: 'New note waiting for upload.',
        status: 'completed' as const,
        timestamp: Date.parse('2025-10-18T18:00:00Z'),
        repo: 'iamcapote/bitcore-memory',
        branch: 'main',
        commitSha: 'abc1234'
      }
    ];

    const summary = summarizeMemorySync(events);
    expect(summary.status).toBe('stale');
    expect(summary.unsyncedCommits).toBe(1);
  });

  it('reports degraded when a sync fails', () => {
    const events = [
      {
        id: 'sync-failed',
        kind: 'sync' as const,
        title: 'Sync failed',
        description: 'Token expired while pushing notes.',
        status: 'failed' as const,
        timestamp: Date.parse('2025-10-18T18:00:00Z'),
        target: 'GitHub'
      }
    ];

    const summary = summarizeMemorySync(events);
    expect(summary.status).toBe('degraded');
    expect(summary.failedUploads).toBe(1);
  });
});
