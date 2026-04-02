/**
 * Why: Retrieve chat workbench bootstrap hints from backend while preserving local fallback continuity.
 * What: Fetches models, personas, quick prompts, and defaults from `/api/chat/workbench/bootstrap`.
 * How: Normalizes unknown payloads into a stable snapshot shape and falls back on caller-provided defaults.
 */

export interface ChatWorkbenchModelOption {
  readonly id: string;
  readonly label: string;
  readonly provider: string;
  readonly capability: string;
}

export interface ChatWorkbenchPersonaOption {
  readonly slug: string;
  readonly label: string;
  readonly summary: string;
}

export interface ChatWorkbenchPromptOption {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
}

export interface ChatWorkbenchSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly models: readonly ChatWorkbenchModelOption[];
  readonly personas: readonly ChatWorkbenchPersonaOption[];
  readonly quickPrompts: readonly ChatWorkbenchPromptOption[];
  readonly defaults: {
    readonly persona: string;
    readonly model: string;
  };
  readonly updatedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSnapshot(payload: unknown, fallback: ChatWorkbenchSnapshot): ChatWorkbenchSnapshot {
  if (!isObject(payload)) {
    return fallback;
  }

  const source = typeof payload.source === "string" ? payload.source : fallback.source;
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt;
  const featurePayload = isObject(payload.feature) ? payload.feature : fallback.feature;
  const feature = {
    enabled: Boolean(featurePayload.enabled),
    mode: typeof featurePayload.mode === "string" ? featurePayload.mode : fallback.feature.mode,
    wiring: typeof featurePayload.wiring === "string" ? featurePayload.wiring : fallback.feature.wiring,
  };

  const models = Array.isArray(payload.models)
    ? payload.models
        .filter((item): item is Record<string, unknown> => isObject(item))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "unknown-model",
          label: typeof item.label === "string" ? item.label : "Unknown model",
          provider: typeof item.provider === "string" ? item.provider : "unknown",
          capability: typeof item.capability === "string" ? item.capability : "general",
        }))
    : fallback.models;

  const personas = Array.isArray(payload.personas)
    ? payload.personas
        .filter((item): item is Record<string, unknown> => isObject(item))
        .map((item) => ({
          slug: typeof item.slug === "string" ? item.slug : "persona",
          label: typeof item.label === "string" ? item.label : "Persona",
          summary: typeof item.summary === "string" ? item.summary : "",
        }))
    : fallback.personas;

  const quickPrompts = Array.isArray(payload.quickPrompts)
    ? payload.quickPrompts
        .filter((item): item is Record<string, unknown> => isObject(item))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "prompt",
          title: typeof item.title === "string" ? item.title : "Prompt",
          prompt: typeof item.prompt === "string" ? item.prompt : "",
        }))
    : fallback.quickPrompts;

  const defaultsPayload = isObject(payload.defaults) ? payload.defaults : fallback.defaults;
  const defaults = {
    persona: typeof defaultsPayload.persona === "string" ? defaultsPayload.persona : fallback.defaults.persona,
    model: typeof defaultsPayload.model === "string" ? defaultsPayload.model : fallback.defaults.model,
  };

  return {
    source,
    feature,
    models,
    personas,
    quickPrompts,
    defaults,
    updatedAt,
  };
}

export async function fetchChatWorkbenchSnapshot(fallback: ChatWorkbenchSnapshot): Promise<ChatWorkbenchSnapshot> {
  try {
    const response = await fetch("/api/chat/workbench/bootstrap", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeSnapshot(payload, fallback);
  } catch {
    return fallback;
  }
}
