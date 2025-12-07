/**
 * Why: Centralize research telemetry normalization so reducers and providers can stay lean and reuse consistent guards.
 * What: Helper functions that coerce raw WebComm payloads into typed slices and ensure bounds on metrics and history.
 * How: Validate strings, numbers, and timestamps; build GitHub aggregates; expose UUID helpers for dedupe.
 */

import {
  type GithubAggregateState,
  type GithubEntryState,
  type GithubState,
  type MemoryRecordState,
  type MemoryStatsState,
  type Nullable,
  type ResearchSuggestionEntry,
  type UnknownRecord,
} from "./researchTypes";

export function formatStage(stage: unknown): string {
  if (typeof stage !== "string" || !stage.trim()) {
    return "Unknown";
  }
  return stage
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolvePercent(payload: UnknownRecord): number {
  const direct = coercePositiveInt(payload.percent ?? payload.percentComplete);
  if (typeof direct === "number") {
    return clampPercent(direct);
  }
  const completed = coercePositiveInt(payload.completed ?? payload.completedQueries);
  const total = coercePositiveInt(payload.total ?? payload.totalQueries);
  if (typeof completed === "number" && typeof total === "number" && total > 0) {
    return clampPercent(Math.round((completed / total) * 100));
  }
  return 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function coercePositiveInt(value: unknown): Nullable<number> {
  if (value === null || value === undefined) {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }
  return Math.round(numberValue);
}

export function normalizeTimestamp(value: unknown): Nullable<number> {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function normalizeSuggestionEntry(
  entry: UnknownRecord,
  fallbackId: string,
  source: string,
  generatedAt: Nullable<number>,
): Nullable<ResearchSuggestionEntry> {
  const prompt = typeof entry.prompt === "string" && entry.prompt.trim()
    ? entry.prompt.trim()
    : null;
  if (!prompt) {
    return null;
  }
  const focus = typeof entry.focus === "string" && entry.focus.trim()
    ? entry.focus.trim()
    : null;
  const layer = typeof entry.layer === "string" && entry.layer.trim()
    ? entry.layer.trim()
    : null;
  const memoryId = typeof entry.memoryId === "string" && entry.memoryId.trim()
    ? entry.memoryId.trim()
    : null;
  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean)
    : [];
  const score = typeof entry.score === "number" && Number.isFinite(entry.score)
    ? entry.score
    : null;

  return {
    id: fallbackId,
    prompt,
    focus,
    layer,
    tags,
    score,
    memoryId,
    source,
    generatedAt,
  };
}

export function normalizeMemoryStats(payload: unknown): Nullable<MemoryStatsState> {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const stats = payload as UnknownRecord;
  return {
    stored: coercePositiveInt(stats.stored) ?? 0,
    retrieved: coercePositiveInt(stats.retrieved) ?? 0,
    validated: coercePositiveInt(stats.validated ?? stats.validatedCount) ?? 0,
    summarized: coercePositiveInt(stats.summarized) ?? 0,
    ephemeralCount: coercePositiveInt(stats.ephemeralCount) ?? 0,
    validatedCount: coercePositiveInt(stats.validatedCount) ?? coercePositiveInt(stats.validated) ?? 0,
  };
}

export function normalizeMemoryRecord(entry: UnknownRecord): Nullable<MemoryRecordState> {
  const preview = typeof entry.preview === "string" && entry.preview.trim()
    ? entry.preview.trim()
    : (typeof entry.content === "string" && entry.content.trim() ? entry.content.trim() : null);
  if (!preview) {
    return null;
  }
  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null;
  const layer = typeof entry.layer === "string" && entry.layer.trim() ? entry.layer.trim() : null;
  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean)
    : [];
  const source = typeof entry.source === "string" && entry.source.trim() ? entry.source.trim() : null;
  const score = typeof entry.score === "number" && Number.isFinite(entry.score) ? entry.score : null;
  const timestamp = normalizeTimestamp(entry.timestamp);

  return {
    id,
    layer,
    preview,
    tags,
    source,
    score,
    timestamp,
  };
}

export function normalizeGithubEntry(entry: UnknownRecord): Nullable<GithubEntryState> {
  if (!entry) {
    return null;
  }
  const message = typeof entry.message === "string" && entry.message.trim() ? entry.message.trim() : null;
  if (!message) {
    return null;
  }
  const timestamp = normalizeTimestamp(entry.timestamp) ?? Date.now();
  const id = typeof entry.id === "string" && entry.id.trim()
    ? entry.id.trim()
    : `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  const sequence = coercePositiveInt(entry.sequence) ?? 0;
  const level = typeof entry.level === "string" && entry.level.trim()
    ? entry.level.trim().toLowerCase()
    : "info";
  const meta = entry.meta && typeof entry.meta === "object" ? { ...(entry.meta as UnknownRecord) } : null;
  const action = typeof entry.action === "string" && entry.action.trim()
    ? entry.action.trim()
    : (typeof meta?.action === "string" && meta.action.trim() ? meta.action.trim() : null);

  return {
    id,
    sequence,
    level,
    message,
    timestamp,
    action,
    meta,
  };
}

export function buildGithubState(entries: readonly GithubEntryState[], previous: GithubAggregateState): GithubState {
  if (!entries.length) {
    return {
      entries,
      aggregate: previous,
    };
  }
  const total = entries.length;
  let errors = 0;
  let warnings = 0;
  let lastMessage: Nullable<string> = previous.lastMessage;
  let lastAction: Nullable<string> = previous.lastAction;
  let lastTimestamp: Nullable<number> = previous.lastTimestamp;

  for (const entry of entries) {
    if (entry.level === "error") {
      errors += 1;
    } else if (entry.level === "warn") {
      warnings += 1;
    }
    if (!lastTimestamp || entry.timestamp > lastTimestamp) {
      lastTimestamp = entry.timestamp;
      lastMessage = entry.message;
      lastAction = entry.action ?? lastAction;
    }
  }

  return {
    entries,
    aggregate: {
      total,
      errors,
      warnings,
      lastMessage,
      lastAction,
      lastTimestamp,
    },
  };
}

export function mergeGithubStats(stats: UnknownRecord, previous: GithubAggregateState): GithubAggregateState {
  if (!stats || typeof stats !== "object") {
    return previous;
  }
  const levels = stats.levels && typeof stats.levels === "object" ? (stats.levels as UnknownRecord) : {};
  const errors = coercePositiveInt(levels.error) ?? previous.errors;
  const warnings = coercePositiveInt(levels.warn ?? levels.warning) ?? previous.warnings;
  const total = coercePositiveInt(stats.total) ?? previous.total;
  return {
    total,
    errors,
    warnings,
    lastMessage: previous.lastMessage,
    lastAction: previous.lastAction,
    lastTimestamp: previous.lastTimestamp,
  };
}

export function createEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isDuplicateThought(
  registry: { readonly seen: Set<string>; readonly order: string[] },
  eventId: string,
  maxSize: number,
): boolean {
  if (registry.seen.has(eventId)) {
    return true;
  }
  registry.seen.add(eventId);
  registry.order.push(eventId);
  if (registry.order.length > maxSize) {
    const oldest = registry.order.shift();
    if (oldest) {
      registry.seen.delete(oldest);
    }
  }
  return false;
}

export function resetThoughtRegistry(registry: { readonly seen: Set<string>; readonly order: string[] }): void {
  registry.seen.clear();
  registry.order.length = 0;
}
