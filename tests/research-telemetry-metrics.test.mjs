/**
 * Why: Validate telemetry registry helpers aggregate token usage across operator channels.
 * What: Exercises channel creation, snapshot cloning, and reset behaviour.
 * How: Creates telemetry channels via the helper, emits usage events, and inspects aggregated snapshots.
 */

import { describe, beforeEach, it, expect } from 'vitest';
import { ensureResearchTelemetryChannel, snapshotTokenUsageTotals, resetTokenUsageTotals } from '../app/features/research/research.telemetry.metrics.mjs';
import { telemetryRegistry } from '../app/features/research/websocket/session-registry.mjs';

describe('research telemetry metrics helpers', () => {
  beforeEach(() => {
    telemetryRegistry.clear();
  });

  it('aggregates per-operator usage and supports resets', () => {
    const { channel } = ensureResearchTelemetryChannel({ key: 'alice' });
    channel.emitTokenUsage({ stage: 'generate-queries', promptTokens: 5, completionTokens: 3 });
    channel.emitTokenUsage({ stage: 'process-results', promptTokens: 1, completion_tokens: 4 });

    const snapshot = snapshotTokenUsageTotals();
  expect(snapshot.aggregate.totalTokens).toBe(13);
  expect(snapshot.aggregate.promptTokens).toBe(6);
    expect(snapshot.perOperator.alice.promptTokens).toBe(6);
    expect(snapshot.perOperator.alice.perStage['generate-queries'].promptTokens).toBe(5);

    resetTokenUsageTotals('alice');
    const resetSnapshot = snapshotTokenUsageTotals();
    expect(resetSnapshot.aggregate.totalTokens).toBe(0);
    expect(Object.keys(resetSnapshot.perOperator.alice.perStage)).toHaveLength(0);
  });
});
