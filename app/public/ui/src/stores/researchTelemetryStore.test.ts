/**
 * Why: Prove the telemetry store clamps progress, normalizes stages, and preserves bounded token samples.
 * What: Exercises start, progress, stage, completion, failure, and token recording actions directly against the Zustand state.
 * How: Calls store methods, inspects snapshots, and ensures invariants such as capped arrays and progress clamping hold.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  getResearchTelemetrySnapshot,
  getStageOrder,
  useResearchTelemetryStore
} from './researchTelemetryStore';

afterEach(() => {
  useResearchTelemetryStore.getState().reset();
});

describe('useResearchTelemetryStore', () => {
  it('starts a session with optional overrides', () => {
    useResearchTelemetryStore.getState().start({ depth: 3, breadth: 2 });
    const snapshot = getResearchTelemetrySnapshot();

    expect(snapshot.status).toBe('running');
    expect(snapshot.depth).toBe(3);
    expect(snapshot.breadth).toBe(2);
    expect(snapshot.progress).toBe(0);
  });

  it('clamps progress between 0 and 100', () => {
    useResearchTelemetryStore.getState().updateProgress(150);
    expect(getResearchTelemetrySnapshot().progress).toBe(100);

    useResearchTelemetryStore.getState().updateProgress(-20);
    expect(getResearchTelemetrySnapshot().progress).toBe(0);
  });

  it('transition to complete updates status and stage', () => {
    useResearchTelemetryStore.getState().complete('done');
    const snapshot = getResearchTelemetrySnapshot();
    expect(snapshot.status).toBe('complete');
    expect(snapshot.stage).toBe('complete');
    expect(snapshot.progress).toBe(100);
    expect(snapshot.message).toBe('done');
  });

  it('records token usage samples with a bounded history', () => {
    for (let index = 0; index < 25; index += 1) {
      useResearchTelemetryStore.getState().recordTokenUsage({
        timestamp: index,
        totalTokens: index * 10,
        promptTokens: index,
        completionTokens: index * 2
      });
    }

    const snapshot = getResearchTelemetrySnapshot();
    expect(snapshot.tokenUsage).toHaveLength(20);
    expect(snapshot.tokenUsage[0].timestamp).toBe(5);
    expect(snapshot.tokenUsage.at(-1)?.totalTokens).toBe(240);
  });

  it('fails a session with error status and message', () => {
    useResearchTelemetryStore.getState().fail('throttled');
    const snapshot = getResearchTelemetrySnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.message).toBe('throttled');
  });

  it('exposes the canonical stage order', () => {
    expect(getStageOrder()).toEqual(['planning', 'executing', 'synthesizing', 'complete']);
  });
});
