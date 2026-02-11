/**
 * @license INTERNAL ONLY — Mission templates HTTP client
 *
 * Contract
 * Inputs:
 *   - REST endpoints under /api/missions/templates (list, detail) and /api/missions for scaffolding
 * Outputs:
 *   - Normalized mission template summaries, single template lookups, and scaffold helpers
 * Error modes:
 *   - Throws Error with response body message when HTTP status is not ok
 *   - Propagates AbortError for cancelled fetch requests
 * Performance:
 *   - Single network round-trip per invocation; payload sizes are typically < 10 KB
 * Side effects:
 *   - None besides outbound HTTP requests with credentials
 *
 * Why: Provide Nova surfaces with typed access to mission templates so operators can scaffold automations without the CLI.
 * What: Wrap template list/detail retrieval and expose a helper to scaffold missions (optionally running them immediately).
 * How: Fetch JSON payloads, normalize schedules into mission-friendly shapes, and reuse mission client helpers for creation and dispatch.
 */

import {
  MissionSchedule,
  MissionScheduleDraft,
  Mission,
  createMission,
  runMissionById,
  type MissionDraft,
} from "@/modules/missions/missionsClient";

export interface MissionTemplate {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly schedule: MissionSchedule;
  readonly scheduleInput: MissionScheduleDraft | null;
  readonly priority: number;
  readonly tags: readonly string[];
  readonly payload: Readonly<Record<string, unknown>> | null;
  readonly enable: boolean;
}

export interface MissionTemplateScaffoldOptions {
  readonly run?: boolean;
}

export async function fetchMissionTemplates(signal?: AbortSignal): Promise<readonly MissionTemplate[]> {
  const response = await fetch("/api/missions/templates", {
    credentials: "include",
    signal,
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Failed to load mission templates");
  }
  const records = Array.isArray((body as { templates?: unknown }).templates)
    ? ((body as { templates: unknown[] }).templates)
    : [];
  return Object.freeze(records.map((entry) => normalizeTemplate(entry)).filter(Boolean) as MissionTemplate[]);
}

export async function fetchMissionTemplate(slug: string, signal?: AbortSignal): Promise<MissionTemplate> {
  if (!slug) {
    throw new TypeError("Mission template slug must be provided");
  }
  const response = await fetch(`/api/missions/templates/${encodeURIComponent(slug)}`, {
    credentials: "include",
    signal,
  });
  const body = await safeParseJson(response);
  if (!response.ok) {
    throw createApiError(response, body, `Failed to load mission template '${slug}'`);
  }
  const record = (body as { template?: unknown })?.template ?? body;
  const template = normalizeTemplate(record);
  if (!template) {
    throw new Error("Mission templates API returned an unreadable payload.");
  }
  return template;
}

export async function scaffoldMissionFromTemplate(slug: string, options: MissionTemplateScaffoldOptions = {}): Promise<{ mission: Mission }> {
  const template = await fetchMissionTemplate(slug);
  const draft: MissionDraft = {
    name: template.name,
    description: template.description,
    schedule: template.scheduleInput ?? undefined,
    priority: template.priority,
    tags: template.tags,
    payload: template.payload,
    enable: template.enable,
  };
  const mission = await createMission(draft);
  if (options.run) {
    await runMissionById(mission.id);
  }
  return { mission };
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("[missionTemplatesClient] Failed to parse JSON response", error);
    const preview = text.slice(0, 120).trim();
    if (preview.startsWith("<!doctype") || preview.startsWith("<html")) {
      throw new Error("Mission templates API responded with HTML instead of JSON. Is the backend running?");
    }
    throw new Error("Mission templates API returned an unreadable payload.");
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

function normalizeTemplate(raw: unknown): MissionTemplate | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const slug = toNonEmptyString(record.slug);
  const name = toNonEmptyString(record.name);
  if (!slug || !name) {
    return null;
  }
  const description = toNullableString(record.description);
  const scheduleInput = normalizeScheduleInput(record.schedule);
  const schedule = scheduleInput ? normalizeScheduleForView(scheduleInput) : null;
  const priority = toNumber(record.priority, 0) ?? 0;
  const tags = normalizeStringArray(record.tags);
  const payload = normalizeObjectOrNull(record.payload);
  const enable = toBoolean(record.enable, true);

  return Object.freeze({
    slug,
    name,
    description,
    schedule,
    scheduleInput,
    priority,
    tags,
    payload,
    enable,
  });
}

function normalizeScheduleInput(value: unknown): MissionScheduleDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.intervalMinutes != null) {
    const minutes = toNumber(record.intervalMinutes, null);
    if (minutes == null || minutes <= 0) {
      return null;
    }
    const timezone = toNonEmptyString(record.timezone) ?? undefined;
    return { intervalMinutes: Math.round(minutes), timezone };
  }
  if (record.cron != null) {
    const cron = toNonEmptyString(record.cron);
    if (!cron) {
      return null;
    }
    const timezone = toNonEmptyString(record.timezone) ?? undefined;
    return { cron, timezone };
  }
  return null;
}

function normalizeScheduleForView(schedule: MissionScheduleDraft): MissionSchedule {
  if ("intervalMinutes" in schedule) {
    return Object.freeze({
      type: "interval", 
      intervalMinutes: schedule.intervalMinutes,
      timezone: schedule.timezone ?? "UTC",
    });
  }
  return Object.freeze({
    type: "cron",
    cron: schedule.cron,
    timezone: schedule.timezone ?? "UTC",
  });
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

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  const entries = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return Object.freeze(Array.from(new Set(entries)));
}

function normalizeObjectOrNull(value: unknown): Readonly<Record<string, unknown>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}
