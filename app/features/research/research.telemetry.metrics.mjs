/**
 * Why: Share telemetry channel management and usage metrics between CLI and WebSocket research surfaces.
 * What: Ensures telemetry instances exist per operator, wires senders on reconnect, and exposes token usage snapshots for status surfaces.
 * How: Wraps the session telemetry registry with helpers that create channels, update transports, and clone aggregate token counters.
 */

import { createResearchTelemetry } from './research.telemetry.mjs';
import { getTelemetryChannel, setTelemetryChannel, telemetryRegistry } from './websocket/session-registry.mjs';

const DEFAULT_OPERATOR_KEY = 'operator';

export function ensureResearchTelemetryChannel({ key, send, replay = false } = {}) {
  const resolvedKey = typeof key === 'string' && key.trim() ? key.trim() : DEFAULT_OPERATOR_KEY;
  const existing = getTelemetryChannel(resolvedKey);

  if (!existing) {
    const channel = createResearchTelemetry({ send });
    setTelemetryChannel(resolvedKey, channel);
    return { channel, isNew: true, key: resolvedKey };
  }

  if (typeof send === 'function') {
    existing.updateSender(send);
    if (replay) {
      existing.replay(send);
    }
  }

  return { channel: existing, isNew: false, key: resolvedKey };
}

export function snapshotTokenUsageTotals() {
  const perOperator = {};
  let aggregatePrompt = 0;
  let aggregateCompletion = 0;
  let aggregateTotal = 0;
  let aggregateEvents = 0;
  let latestTimestamp = null;

  telemetryRegistry.forEach((channel, operatorKey) => {
    if (!channel || typeof channel.getTokenUsageTotals !== 'function') {
      return;
    }
    const totals = channel.getTokenUsageTotals();
    if (!totals) {
      return;
    }
    perOperator[operatorKey] = totals;
    aggregatePrompt += Number.isFinite(totals.promptTokens) ? totals.promptTokens : 0;
    aggregateCompletion += Number.isFinite(totals.completionTokens) ? totals.completionTokens : 0;
    aggregateTotal += Number.isFinite(totals.totalTokens) ? totals.totalTokens : 0;
    aggregateEvents += Number.isFinite(totals.events) ? totals.events : 0;

    const timestamp = totals.updatedAt ? Date.parse(totals.updatedAt) : NaN;
    if (Number.isFinite(timestamp)) {
      latestTimestamp = latestTimestamp && Number.isFinite(latestTimestamp)
        ? Math.max(latestTimestamp, timestamp)
        : timestamp;
    }
  });

  const aggregate = {
    promptTokens: aggregatePrompt,
    completionTokens: aggregateCompletion,
    totalTokens: aggregateTotal,
    events: aggregateEvents,
    operators: Object.keys(perOperator).length,
    updatedAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null
  };

  return Object.freeze({
    aggregate,
    perOperator: Object.freeze({ ...perOperator })
  });
}

export function resetTokenUsageTotals(key) {
  const resolvedKey = typeof key === 'string' && key.trim() ? key.trim() : DEFAULT_OPERATOR_KEY;
  const channel = getTelemetryChannel(resolvedKey);
  if (channel && typeof channel.resetTokenUsageTotals === 'function') {
    channel.resetTokenUsageTotals();
  }
}
