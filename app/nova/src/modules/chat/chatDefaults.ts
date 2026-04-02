/**
 * Why: Keep chat default settings consistent between Settings surface and Chat session form.
 * What: Defines chat defaults contract plus localStorage load/save helpers.
 * How: Encapsulates the storage key and normalization so both callers share one stable implementation.
 */

export const CHAT_DEFAULTS_KEY = "nova.chat.defaults";

export interface ChatDefaults {
  persona: string;
  model: string;
  temperature: number;
  memoryEnabled: boolean;
  memoryDepth: "short" | "medium" | "long";
  githubSync: boolean;
}

export const INITIAL_CHAT_DEFAULTS: ChatDefaults = {
  persona: "bitcore",
  model: "qwen3-235b",
  temperature: 0.7,
  memoryEnabled: false,
  memoryDepth: "medium",
  githubSync: false,
};

function normalizeMemoryDepth(value: unknown): ChatDefaults["memoryDepth"] {
  if (value === "short" || value === "long") {
    return value;
  }
  return "medium";
}

function clampTemperature(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0.7;
  }
  return Math.min(1, Math.max(0, parsed));
}

export function loadChatDefaults(): ChatDefaults {
  if (typeof window === "undefined") {
    return { ...INITIAL_CHAT_DEFAULTS };
  }
  try {
    const raw = window.localStorage.getItem(CHAT_DEFAULTS_KEY);
    if (!raw) {
      return { ...INITIAL_CHAT_DEFAULTS };
    }
    const parsed = JSON.parse(raw) as Partial<ChatDefaults>;
    return {
      persona: typeof parsed.persona === "string" ? parsed.persona : INITIAL_CHAT_DEFAULTS.persona,
      model: typeof parsed.model === "string" ? parsed.model : INITIAL_CHAT_DEFAULTS.model,
      temperature: clampTemperature(parsed.temperature),
      memoryEnabled: Boolean(parsed.memoryEnabled),
      memoryDepth: normalizeMemoryDepth(parsed.memoryDepth),
      githubSync: Boolean(parsed.githubSync),
    };
  } catch {
    return { ...INITIAL_CHAT_DEFAULTS };
  }
}

export function saveChatDefaults(defaults: ChatDefaults): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CHAT_DEFAULTS_KEY, JSON.stringify(defaults));
}
