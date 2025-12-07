/**
 * @license INTERNAL ONLY — GitHub Sync HTTP client
 *
 * Contract
 * Inputs:
 *   - REST endpoints under /api/research (github-sync, github-activity/snapshot, github-activity/stats)
 *   - Optional query filters for activity (limit, levels, since, search, sample)
 * Outputs:
 *   - Normalized sync results and activity entries for Nova surfaces
 * Error modes:
 *   - Throws Error with message from response body when HTTP status is not ok
 *   - Propagates AbortError for cancelled fetch requests
 * Performance:
 *   - Single network round-trip per invocation; JSON payloads expected < 100 KB
 * Side effects:
 *   - None besides outbound HTTP requests with credentials
 *
 * Why: Centralize GitHub sync and activity API access so Nova views can depend on typed helpers.
 * What: Wrap sync operations (verify, list, file, push, upload) and activity feed retrieval with normalization guards.
 * How: Issue fetch requests with credentials, parse JSON bodies, freeze results, and surface typed errors.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export type GitHubSyncAction = "verify" | "list" | "file" | "push" | "upload";

export interface GitHubSyncPayload {
  readonly action: GitHubSyncAction;
  readonly repo?: string;
  readonly ref?: string;
  readonly path?: string;
  readonly branch?: string;
  readonly message?: string;
  readonly files?: readonly GitHubFile[];
  readonly content?: string;
  readonly dryRun?: boolean;
}

export interface GitHubFile {
  readonly path: string;
  readonly content: string;
  readonly encoding?: "utf8" | "base64";
}

export interface GitHubSyncResult {
  readonly ok: boolean;
  readonly success: boolean;
  readonly action: string;
  readonly correlationId: string;
  readonly data: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

export type ActivityLevel = "debug" | "info" | "warn" | "error";

export interface ActivityEntry {
  readonly id: string;
  readonly sequence: number;
  readonly level: ActivityLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly source: string;
  readonly meta: Readonly<Record<string, unknown>>;
}

export interface ActivitySnapshot {
  readonly entries: readonly ActivityEntry[];
  readonly meta: {
    readonly total: number;
    readonly limit: number;
    readonly levels?: readonly ActivityLevel[];
    readonly since?: number;
    readonly sample: number;
  };
}

export interface ActivityStats {
  readonly total: number;
  readonly levels: Readonly<Record<ActivityLevel, number>>;
  readonly firstTimestamp: number | null;
  readonly lastTimestamp: number | null;
  readonly since?: number;
}

export interface FetchActivityOptions {
  readonly limit?: number;
  readonly levels?: readonly ActivityLevel[];
  readonly since?: number;
  readonly search?: string;
  readonly sample?: number;
  readonly signal?: AbortSignal;
}

export async function syncGitHub(payload: GitHubSyncPayload, signal?: AbortSignal): Promise<GitHubSyncResult> {
  const response = await fetch("/api/research/github-sync", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(payload),
    signal,
  });

  const body = await response.json();

  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`GitHub sync failed: ${message}`);
  }

  return Object.freeze({
    ok: Boolean(body.ok),
    success: Boolean(body.success),
    action: String(body.action ?? payload.action),
    correlationId: String(body.correlationId ?? "unknown"),
    data: body.data ?? null,
    meta: typeof body.meta === "object" && body.meta !== null ? body.meta : {},
    error: body.error,
  });
}

export async function verifyGitHubConnection(signal?: AbortSignal): Promise<GitHubSyncResult> {
  return syncGitHub({ action: "verify" }, signal);
}

export async function listGitHubEntries(
  options: { path?: string; ref?: string; signal?: AbortSignal } = {}
): Promise<GitHubSyncResult> {
  return syncGitHub(
    {
      action: "list",
      path: options.path,
      ref: options.ref,
    },
    options.signal
  );
}

export async function fetchGitHubFile(
  path: string,
  options: { ref?: string; signal?: AbortSignal } = {}
): Promise<GitHubSyncResult> {
  return syncGitHub(
    {
      action: "file",
      path,
      ref: options.ref,
    },
    options.signal
  );
}

export async function pushGitHubBatch(
  files: readonly GitHubFile[],
  options: { message?: string; branch?: string; signal?: AbortSignal } = {}
): Promise<GitHubSyncResult> {
  return syncGitHub(
    {
      action: "push",
      files,
      message: options.message,
      branch: options.branch,
    },
    options.signal
  );
}

export async function uploadGitHubFile(
  path: string,
  content: string,
  options: { message?: string; branch?: string; signal?: AbortSignal } = {}
): Promise<GitHubSyncResult> {
  return syncGitHub(
    {
      action: "upload",
      path,
      content,
      message: options.message,
      branch: options.branch,
    },
    options.signal
  );
}

export async function fetchActivitySnapshot(options: FetchActivityOptions = {}): Promise<ActivitySnapshot> {
  const params = new URLSearchParams();
  if (typeof options.limit === "number") {
    params.set("limit", options.limit.toString());
  }
  if (options.levels && options.levels.length > 0) {
    params.set("levels", options.levels.join(","));
  }
  if (typeof options.since === "number") {
    params.set("since", options.since.toString());
  }
  if (options.search) {
    params.set("search", options.search);
  }
  if (typeof options.sample === "number") {
    params.set("sample", options.sample.toString());
  }

  const url = `/api/research/github-activity/snapshot${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to fetch activity snapshot: ${message}`);
  }

  const payload = await response.json();
  const entries = Array.isArray(payload?.data) ? payload.data : [];
  const meta = typeof payload?.meta === "object" && payload.meta !== null ? payload.meta : {};

  return Object.freeze({
    entries: entries.map(normalizeActivityEntry),
    meta: {
      total: Number(meta.total) || 0,
      limit: Number(meta.limit) || 40,
      levels: Array.isArray(meta.levels) ? meta.levels : undefined,
      since: typeof meta.since === "number" ? meta.since : undefined,
      sample: Number(meta.sample) || 1,
    },
  });
}

export async function fetchActivityStats(
  options: { since?: number; signal?: AbortSignal } = {}
): Promise<ActivityStats> {
  const params = new URLSearchParams();
  if (typeof options.since === "number") {
    params.set("since", options.since.toString());
  }

  const url = `/api/research/github-activity/stats${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to fetch activity stats: ${message}`);
  }

  const payload = await response.json();
  const data = typeof payload?.data === "object" && payload.data !== null ? payload.data : {};
  const meta = typeof payload?.meta === "object" && payload.meta !== null ? payload.meta : {};

  return Object.freeze({
    total: Number(data.total) || 0,
    levels: normalizeLevelCounts(data.levels),
    firstTimestamp: typeof data.firstTimestamp === "number" ? data.firstTimestamp : null,
    lastTimestamp: typeof data.lastTimestamp === "number" ? data.lastTimestamp : null,
    since: typeof meta.since === "number" ? meta.since : undefined,
  });
}

function normalizeActivityEntry(raw: unknown): ActivityEntry {
  if (!raw || typeof raw !== "object") {
    return createFallbackEntry("Invalid activity entry");
  }

  const entry = raw as Record<string, unknown>;
  return Object.freeze({
    id: typeof entry.id === "string" ? entry.id : createId(),
    sequence: typeof entry.sequence === "number" ? entry.sequence : 0,
    level: isActivityLevel(entry.level) ? entry.level : "info",
    message: typeof entry.message === "string" ? entry.message : String(entry.message ?? ""),
    timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
    source: typeof entry.source === "string" ? entry.source : "unknown",
    meta: typeof entry.meta === "object" && entry.meta !== null ? (entry.meta as Record<string, unknown>) : {},
  });
}

function normalizeLevelCounts(raw: unknown): Record<ActivityLevel, number> {
  const defaults: Record<ActivityLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const counts = raw as Record<string, unknown>;
  return {
    debug: Number(counts.debug) || 0,
    info: Number(counts.info) || 0,
    warn: Number(counts.warn) || 0,
    error: Number(counts.error) || 0,
  };
}

function isActivityLevel(value: unknown): value is ActivityLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}

function createFallbackEntry(message: string): ActivityEntry {
  return Object.freeze({
    id: createId(),
    sequence: 0,
    level: "error" as const,
    message,
    timestamp: Date.now(),
    source: "githubSyncClient",
    meta: {},
  });
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
