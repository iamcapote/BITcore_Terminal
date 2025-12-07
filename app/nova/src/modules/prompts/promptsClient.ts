/**
 * @license INTERNAL ONLY — Prompts HTTP client
 *
 * Contract
 * Inputs:
 *   - REST endpoints under /api/prompts (list, search, get, save, remove)
 *   - Optional query filters for tags, limit, includeBody
 * Outputs:
 *   - Normalized prompt arrays and prompt records for Nova surfaces
 * Error modes:
 *   - Throws Error with message from response body when HTTP status is not ok
 *   - Propagates AbortError for cancelled fetch requests
 * Performance:
 *   - Single network round-trip per invocation; JSON payloads expected < 100 KB
 * Side effects:
 *   - None besides outbound HTTP requests with credentials
 *
 * Why: Centralize prompts API access so Nova views can depend on typed helpers.
 * What: Wrap prompt retrieval, search, mutation, and GitHub sync with normalization guards.
 * How: Issue fetch requests with credentials, parse JSON bodies, freeze results, and surface typed errors.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export interface PromptSummary {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly description?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface PromptRecord extends PromptSummary {
  readonly body: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ListPromptsOptions {
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

export interface SearchPromptsOptions {
  readonly query?: string;
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly includeBody?: boolean;
  readonly signal?: AbortSignal;
}

export interface SavePromptOptions {
  readonly signal?: AbortSignal;
}

export interface GitHubStatusResult {
  readonly status: "synced" | "ahead" | "behind" | "diverged" | "untracked";
  readonly details: Readonly<Record<string, unknown>>;
}

export interface GitHubSyncResult {
  readonly action: "pull" | "push" | "sync";
  readonly changed: number;
  readonly details: Readonly<Record<string, unknown>>;
}

export async function listPrompts(options: ListPromptsOptions = {}): Promise<readonly PromptSummary[]> {
  const params = new URLSearchParams();
  if (options.tags && options.tags.length > 0) {
    params.set("tags", options.tags.join(","));
  }
  if (typeof options.limit === "number") {
    params.set("limit", options.limit.toString());
  }

  const url = `/api/prompts${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to list prompts: ${message}`);
  }

  const payload = await response.json();
  const prompts = Array.isArray(payload) ? payload : [];
  return Object.freeze(prompts.map(normalizePromptSummary));
}

export async function searchPrompts(options: SearchPromptsOptions = {}): Promise<readonly PromptRecord[]> {
  const params = new URLSearchParams();
  if (options.query) {
    params.set("query", options.query);
  }
  if (options.tags && options.tags.length > 0) {
    params.set("tags", options.tags.join(","));
  }
  if (typeof options.limit === "number") {
    params.set("limit", options.limit.toString());
  }
  if (typeof options.includeBody === "boolean") {
    params.set("includeBody", options.includeBody.toString());
  }

  const url = `/api/prompts/search${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to search prompts: ${message}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload) ? payload : [];
  return Object.freeze(results.map(normalizePromptRecord));
}

export async function getPrompt(id: string, signal?: AbortSignal): Promise<PromptRecord> {
  const response = await fetch(`/api/prompts/${encodeURIComponent(id)}`, {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to get prompt: ${message}`);
  }

  const payload = await response.json();
  return Object.freeze(normalizePromptRecord(payload));
}

export async function savePrompt(
  prompt: Omit<PromptRecord, "createdAt" | "updatedAt">,
  options: SavePromptOptions = {}
): Promise<PromptRecord> {
  const response = await fetch("/api/prompts", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(prompt),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to save prompt: ${message}`);
  }

  const payload = await response.json();
  return Object.freeze(normalizePromptRecord(payload));
}

export async function removePrompt(id: string, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`/api/prompts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to remove prompt: ${message}`);
  }
}

export async function checkPromptExists(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`/api/prompts/${encodeURIComponent(id)}`, {
    method: "HEAD",
    credentials: "include",
    signal,
  });

  return response.ok;
}

export async function getGitHubStatus(signal?: AbortSignal): Promise<GitHubStatusResult> {
  const response = await fetch("/api/prompts/github/status", {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to get GitHub status: ${message}`);
  }

  const payload = await response.json();
  return Object.freeze({
    status: isGitHubStatus(payload.status) ? payload.status : "untracked",
    details: typeof payload.details === "object" && payload.details !== null ? payload.details : {},
  });
}

export async function pullFromGitHub(signal?: AbortSignal): Promise<GitHubSyncResult> {
  const response = await fetch("/api/prompts/github/pull", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to pull from GitHub: ${message}`);
  }

  const payload = await response.json();
  return Object.freeze(normalizeGitHubSyncResult(payload, "pull"));
}

export async function pushToGitHub(signal?: AbortSignal): Promise<GitHubSyncResult> {
  const response = await fetch("/api/prompts/github/push", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to push to GitHub: ${message}`);
  }

  const payload = await response.json();
  return Object.freeze(normalizeGitHubSyncResult(payload, "push"));
}

export async function syncWithGitHub(signal?: AbortSignal): Promise<GitHubSyncResult> {
  const response = await fetch("/api/prompts/github/sync", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Failed to sync with GitHub: ${message}`);
  }

  const payload = await response.json();
  return Object.freeze(normalizeGitHubSyncResult(payload, "sync"));
}

function normalizePromptSummary(raw: unknown): PromptSummary {
  if (!raw || typeof raw !== "object") {
    return createFallbackSummary("Invalid prompt summary");
  }

  const summary = raw as Record<string, unknown>;
  return Object.freeze({
    id: typeof summary.id === "string" ? summary.id : createId(),
    title: typeof summary.title === "string" ? summary.title : "Untitled",
    tags: Array.isArray(summary.tags) ? summary.tags.filter((t): t is string => typeof t === "string") : [],
    description: typeof summary.description === "string" ? summary.description : undefined,
    createdAt: typeof summary.createdAt === "number" ? summary.createdAt : Date.now(),
    updatedAt: typeof summary.updatedAt === "number" ? summary.updatedAt : Date.now(),
  });
}

function normalizePromptRecord(raw: unknown): PromptRecord {
  if (!raw || typeof raw !== "object") {
    return createFallbackRecord("Invalid prompt record");
  }

  const record = raw as Record<string, unknown>;
  return Object.freeze({
    id: typeof record.id === "string" ? record.id : createId(),
    title: typeof record.title === "string" ? record.title : "Untitled",
    tags: Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === "string") : [],
    description: typeof record.description === "string" ? record.description : undefined,
    body: typeof record.body === "string" ? record.body : "",
    metadata: typeof record.metadata === "object" && record.metadata !== null ? (record.metadata as Record<string, unknown>) : {},
    createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
  });
}

function normalizeGitHubSyncResult(raw: unknown, defaultAction: "pull" | "push" | "sync"): GitHubSyncResult {
  if (!raw || typeof raw !== "object") {
    return { action: defaultAction, changed: 0, details: {} };
  }

  const result = raw as Record<string, unknown>;
  return {
    action: isGitHubSyncAction(result.action) ? result.action : defaultAction,
    changed: typeof result.changed === "number" ? result.changed : 0,
    details: typeof result.details === "object" && result.details !== null ? (result.details as Record<string, unknown>) : {},
  };
}

function isGitHubStatus(value: unknown): value is "synced" | "ahead" | "behind" | "diverged" | "untracked" {
  return value === "synced" || value === "ahead" || value === "behind" || value === "diverged" || value === "untracked";
}

function isGitHubSyncAction(value: unknown): value is "pull" | "push" | "sync" {
  return value === "pull" || value === "push" || value === "sync";
}

function createFallbackSummary(title: string): PromptSummary {
  return Object.freeze({
    id: createId(),
    title,
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function createFallbackRecord(title: string): PromptRecord {
  return Object.freeze({
    id: createId(),
    title,
    tags: [],
    body: "",
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
