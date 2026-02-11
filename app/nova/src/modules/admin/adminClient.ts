/**
 * Why: Fetch CLI metadata, runtime config, and feature flags from the backend so the settings surface renders real data.
 * What: API client functions for /api/commands, /api/config, /api/admin/surfaces, and preferences endpoints.
 * How: Plain fetch wrappers with error handling and typed responses.
 */

/* ── Types ─────────────────────────────────────────────────────────── */

export interface CliCommand {
  readonly id: string;
  readonly signature: string;
  readonly example: string;
  readonly category: string;
  readonly description: string;
  readonly helpText: string;
  readonly flags: readonly { name: string; type: string; required: boolean }[];
  readonly subcommands: readonly { name: string; description: string }[];
  readonly requiresAuth: boolean;
  readonly requiresPassword: boolean;
  readonly shortcut: string | null;
  readonly aliases: readonly string[];
}

export interface CliMetadata {
  readonly version: string;
  readonly commands: Record<string, CliCommand>;
}

export interface FeatureFlag {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly category: string;
}

export interface ConfigResponse {
  readonly config: Record<string, unknown>;
  readonly featureFlags: FeatureFlag[];
  readonly surfaceDefaults: Record<string, boolean>;
}

export interface TerminalPreferences {
  showTimestamps: boolean;
  clearOnStart: boolean;
  maxHistoryLines: number;
  [key: string]: unknown;
}

export interface ResearchPreferences {
  depth: number;
  breadth: number;
  maxTokens: number;
  [key: string]: unknown;
}

/* ── API functions ─────────────────────────────────────────────────── */

const BASE = "";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function patchJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/* ── CLI Commands ──────────────────────────────────────────────────── */

export async function fetchCliMetadata(): Promise<CliMetadata> {
  return fetchJson<CliMetadata>("/api/commands");
}

/* ── Config + Flags ────────────────────────────────────────────────── */

export async function fetchConfig(): Promise<ConfigResponse> {
  return fetchJson<ConfigResponse>("/api/config");
}

/* ── Surface Visibility ────────────────────────────────────────────── */

export async function fetchSurfaceDefaults(): Promise<Record<string, boolean>> {
  const data = await fetchJson<{ surfaces: Record<string, boolean> }>("/api/admin/surfaces");
  return data.surfaces;
}

/* ── Terminal Preferences ──────────────────────────────────────────── */

export async function fetchTerminalPreferences(): Promise<TerminalPreferences> {
  return fetchJson<TerminalPreferences>("/api/preferences/terminal");
}

export async function updateTerminalPreferences(prefs: Partial<TerminalPreferences>): Promise<TerminalPreferences> {
  return patchJson<TerminalPreferences>("/api/preferences/terminal", prefs);
}

export async function resetTerminalPreferences(): Promise<TerminalPreferences> {
  return postJson<TerminalPreferences>("/api/preferences/terminal/reset");
}

/* ── Research Preferences ──────────────────────────────────────────── */

export async function fetchResearchPreferences(): Promise<ResearchPreferences> {
  return fetchJson<ResearchPreferences>("/api/preferences/research");
}

export async function fetchResearchDefaults(): Promise<ResearchPreferences> {
  return fetchJson<ResearchPreferences>("/api/preferences/research/defaults");
}

export async function updateResearchPreferences(prefs: Partial<ResearchPreferences>): Promise<ResearchPreferences> {
  return patchJson<ResearchPreferences>("/api/preferences/research", prefs);
}

export async function resetResearchPreferences(): Promise<ResearchPreferences> {
  return postJson<ResearchPreferences>("/api/preferences/research/reset");
}

/* ── Venice Models ─────────────────────────────────────────────────── */

export interface VeniceModel {
  readonly id: string;
  readonly object: string;
  readonly created?: number;
  readonly owned_by?: string;
  [key: string]: unknown;
}

export async function fetchVeniceModels(): Promise<VeniceModel[]> {
  const data = await fetchJson<{ data: VeniceModel[] } | VeniceModel[]>("/api/models/venice");
  return Array.isArray(data) ? data : (data.data ?? []);
}

/* ── Status ────────────────────────────────────────────────────────── */

export async function fetchStatusSummary(): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>("/api/status/summary");
}
