/**
 * @license INTERNAL ONLY — Missions HTTP client
 *
 * Contract
 * Inputs:
 *   - REST endpoints under /api/missions (list, state, run, start, stop, tick)
 *   - Optional URL search filters for mission list queries
 * Outputs:
 *   - Normalized mission arrays and scheduler snapshots for Nova surfaces
 * Error modes:
 *   - Throws Error with message from response body when HTTP status is not ok
 *   - Propagates AbortError for cancelled fetch requests
 * Performance:
 *   - Single network round-trip per invocation; JSON payloads expected < 25 KB
 * Side effects:
 *   - None besides outbound HTTP requests with credentials
 *
 * Why: Centralize mission API access so Nova views can depend on typed helpers.
 * What: Wrap list/state retrieval and scheduler actions with normalization guards.
 * How: Issue fetch requests with credentials, parse JSON bodies, freeze results, and surface typed errors.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export type MissionStatus =
  | "idle"
  | "queued"
  | "running"
  | "paused"
  | "disabled"
  | "failed"
  | "completed";

export type MissionSchedule = MissionScheduleInterval | MissionScheduleCron | null;

export interface MissionScheduleInterval {
  readonly type: "interval";
  readonly intervalMinutes: number;
  readonly timezone: string;
}

export interface MissionScheduleCron {
  readonly type: "cron";
  readonly cron: string;
  readonly timezone: string;
}

export interface Mission {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly schedule: MissionSchedule;
  readonly priority: number;
  readonly tags: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: MissionStatus;
  readonly enable: boolean;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly nextRunAt: string | null;
  readonly lastRunAt: string | null;
  readonly lastFinishedAt: string | null;
  readonly lastRunError: string | null;
}

export interface SchedulerState {
  readonly featureEnabled: boolean;
  readonly schedulerEnabled: boolean;
  readonly telemetryEnabled: boolean;
  readonly running: boolean;
  readonly intervalMs: number | null;
  readonly activeRuns: number;
  readonly lastTickStartedAt: string | null;
  readonly lastTickCompletedAt: string | null;
  readonly lastTickDurationMs: number | null;
  readonly lastTickError: string | null;
  readonly lastTickEvaluated: number | null;
  readonly lastTickLaunched: number | null;
  readonly lastPersistedAt: string | null;
  readonly lastPersistReason: string | null;
}

export interface FetchMissionsOptions {
  readonly status?: MissionStatus | readonly MissionStatus[];
  readonly tag?: string;
  readonly includeDisabled?: boolean;
  readonly signal?: AbortSignal;
}

export type MissionScheduleDraft =
  | { readonly intervalMinutes: number; readonly timezone?: string }
  | { readonly cron: string; readonly timezone?: string };

export interface MissionDraft {
  readonly name: string;
  readonly description?: string | null;
  readonly schedule?: MissionScheduleDraft | null;
  readonly priority?: number;
  readonly tags?: readonly string[];
  readonly payload?: Readonly<Record<string, unknown>> | null;
  readonly enable?: boolean;
}

export async function fetchMissions(options: FetchMissionsOptions = {}): Promise<readonly Mission[]> {
  const params = new URLSearchParams();
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    for (const status of statuses) {
      params.append("status", status);
    }
  }
  if (options.tag) {
    params.set("tag", options.tag);
  }
  if (typeof options.includeDisabled === "boolean") {
    params.set("include-disabled", options.includeDisabled ? "1" : "0");
  }

  const endpoint = params.size > 0 ? `/api/missions?${params.toString()}` : "/api/missions";
  const response = await fetch(endpoint, {
    credentials: "include",
    signal: options.signal,
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to load missions");
  }
  const records = Array.isArray((body as { missions?: unknown }).missions)
    ? ((body as { missions: unknown[] }).missions)
    : [];
  return Object.freeze(records.map((entry) => normalizeMission(entry)).filter(Boolean) as Mission[]);
}

export async function fetchSchedulerState(options: { readonly signal?: AbortSignal } = {}): Promise<SchedulerState> {
  const response = await fetch("/api/missions/state", {
    credentials: "include",
    signal: options.signal,
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to load mission scheduler state");
  }
  return normalizeSchedulerState(body);
}

export async function runMissionById(missionId: string): Promise<void> {
  const payload = { missionId };
  const response = await fetch("/api/missions/run", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, `Failed to run mission '${missionId}'`);
  }
}

export async function triggerSchedulerTick(): Promise<void> {
  const response = await fetch("/api/missions/tick", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to trigger mission scheduler tick");
  }
}

export async function startScheduler(): Promise<void> {
  const response = await fetch("/api/missions/start", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to start mission scheduler");
  }
}

export async function stopScheduler(): Promise<void> {
  const response = await fetch("/api/missions/stop", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to stop mission scheduler");
  }
}

export async function createMission(draft: MissionDraft): Promise<Mission> {
  const response = await fetch("/api/missions", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(normalizeMissionDraftPayload(draft)),
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to create mission");
  }
  const record = (body as { mission?: unknown })?.mission ?? body;
  const mission = normalizeMission(record);
  if (!mission) {
    throw new Error("Mission API returned an unreadable payload after create.");
  }
  return mission;
}

function normalizeMission(raw: unknown): Mission | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = toNonEmptyString(record.id);
  if (!id) {
    return null;
  }
  const name = toNonEmptyString(record.name) ?? id;
  const description = toNullableString(record.description);
  const schedule = normalizeSchedule(record.schedule);
  const priorityValue = toNumber(record.priority, null);
  const priority = typeof priorityValue === "number" ? priorityValue : 0;
  const tags = normalizeStringArray(record.tags);
  const payload = normalizeObject(record.payload);
  const status = normalizeStatus(record.status);
  const enable = toBoolean(record.enable, true);
  const createdAt = toIsoOrNull(record.createdAt);
  const updatedAt = toIsoOrNull(record.updatedAt);
  const nextRunAt = toIsoOrNull(record.nextRunAt);
  const lastRunAt = toIsoOrNull(record.lastRunAt);
  const lastFinishedAt = toIsoOrNull(record.lastFinishedAt);
  const lastRunError = toNullableString(record.lastRunError);

  return Object.freeze({
    id,
    name,
    description,
    schedule,
    priority,
    tags,
    payload,
    status,
    enable,
    createdAt,
    updatedAt,
    nextRunAt,
    lastRunAt,
    lastFinishedAt,
    lastRunError,
  });
}

function normalizeSchedule(raw: unknown): MissionSchedule {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.trim().toLowerCase() : null;
  if (type === "interval") {
    const intervalMinutes = toNumber(record.intervalMinutes, null);
    if (intervalMinutes === null || intervalMinutes <= 0) {
      return null;
    }
    const timezone = toNonEmptyString(record.timezone) ?? "UTC";
    return Object.freeze({ type: "interval", intervalMinutes: Math.round(intervalMinutes), timezone });
  }
  if (type === "cron") {
    const cron = toNonEmptyString(record.cron);
    if (!cron) {
      return null;
    }
    const timezone = toNonEmptyString(record.timezone) ?? "UTC";
    return Object.freeze({ type: "cron", cron, timezone });
  }
  return null;
}

function normalizeSchedulerState(raw: unknown): SchedulerState {
  if (!raw || typeof raw !== "object") {
    return {
      featureEnabled: false,
      schedulerEnabled: false,
      telemetryEnabled: false,
      running: false,
      intervalMs: null,
      activeRuns: 0,
      lastTickStartedAt: null,
      lastTickCompletedAt: null,
      lastTickDurationMs: null,
      lastTickError: null,
      lastTickEvaluated: null,
      lastTickLaunched: null,
      lastPersistedAt: null,
      lastPersistReason: null,
    };
  }
  const record = raw as Record<string, unknown>;
  const state = typeof record.state === "object" && record.state !== null ? (record.state as Record<string, unknown>) : {};
  return Object.freeze({
    featureEnabled: toBoolean(record.featureEnabled, true),
    schedulerEnabled: toBoolean(record.schedulerEnabled, true),
    telemetryEnabled: toBoolean(record.telemetryEnabled, true),
    running: toBoolean(state.running, false),
    intervalMs: toNumber(state.intervalMs, null),
    activeRuns: (() => {
      const value = toNumber(state.activeRuns, null);
      return typeof value === "number" ? value : 0;
    })(),
    lastTickStartedAt: toIsoOrNull(state.lastTickStartedAt),
    lastTickCompletedAt: toIsoOrNull(state.lastTickCompletedAt),
    lastTickDurationMs: toNumber(state.lastTickDurationMs, null),
    lastTickError: toNullableString(state.lastTickError),
    lastTickEvaluated: toNumber(state.lastTickEvaluated, null),
    lastTickLaunched: toNumber(state.lastTickLaunched, null),
    lastPersistedAt: toIsoOrNull(state.lastPersistedAt),
    lastPersistReason: toNullableString(state.lastPersistReason),
  });
}

function normalizeStatus(value: unknown): MissionStatus {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "idle";
  switch (normalized) {
    case "idle":
    case "queued":
    case "running":
    case "paused":
    case "disabled":
    case "failed":
    case "completed":
      return normalized;
    default:
      return "idle";
  }
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("[missionsClient] Failed to parse JSON response", error);
    const preview = text.slice(0, 120).trim();
    if (preview.startsWith("<!doctype") || preview.startsWith("<html")) {
      throw new Error("Missions API responded with HTML instead of JSON. Is the backend running?");
    }
    throw new Error("Missions API returned an unreadable payload.");
  }
}

function createApiError(response: Response, body: unknown, fallback: string): Error {
  const message = extractErrorMessage(body) ?? `${fallback} (${response.status})`;
  const error = new Error(message);
  (error as Partial<ResponseErrorMeta>).status = response.status;
  (error as Partial<ResponseErrorMeta>).body = body;
  return error;
}

interface ResponseErrorMeta {
  status: number;
  body: unknown;
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function toNumber(value: unknown, fallback: number | null): number | null {
  if (value == null) {
    return fallback;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return numberValue;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }
  return fallback;
}

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  const entries = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return Object.freeze(Array.from(new Set(entries)));
}

function normalizeObject(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({});
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

function normalizeMissionDraftPayload(draft: MissionDraft): Record<string, unknown> {
  if (!draft || typeof draft !== "object") {
    throw new TypeError("Mission draft payload must be an object");
  }
  if (!draft.name) {
    throw new TypeError("Mission draft requires a name");
  }
  const payload: Record<string, unknown> = { name: draft.name };
  if (draft.description !== undefined) {
    payload.description = draft.description;
  }
  if (draft.schedule) {
    payload.schedule = { ...draft.schedule };
  }
  if (draft.priority !== undefined) {
    payload.priority = draft.priority;
  }
  if (draft.tags) {
    payload.tags = Array.from(draft.tags);
  }
  if (draft.payload !== undefined) {
    payload.payload = draft.payload ?? null;
  }
  if (draft.enable !== undefined) {
    payload.enable = draft.enable;
  }
  return payload;
}
