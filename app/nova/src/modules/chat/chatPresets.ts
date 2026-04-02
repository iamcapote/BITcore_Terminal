/**
 * Why: Shared chat configuration types and persistence helpers.
 * What: ChatPreset, ChatBranch types; localStorage load/save for presets.
 * How: Pure data types + side-effect-free serialization; consumed by ChatSurface.
 */

import type { ChatMessage, ChatMemoryDepth } from "@/modules/chat/chatTypes";

/* ── Types ─────────────────────────────────────────────────────────── */

export type ChatPreset = {
  readonly id: string;
  readonly name: string;
  readonly model: string | null;
  readonly persona: string | null;
  readonly memoryEnabled: boolean;
  readonly memoryDepth: ChatMemoryDepth;
  readonly memoryGithubEnabled: boolean;
  readonly systemPrompt: string;
  readonly temperature: number;
};

export type ChatBranch = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly messages: readonly ChatMessage[];
};

/* ── Constants ─────────────────────────────────────────────────────── */

export const MEMORY_DEPTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
] as const;

export const PRESET_STORAGE_KEY = "nova.chat.presets";

export const DEFAULT_TEMPERATURE = 0.7;

/* ── Persistence helpers ───────────────────────────────────────────── */

export function loadPresets(): ChatPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((preset) => Boolean(preset?.id && preset?.name));
  } catch {
    return [];
  }
}

export function savePresets(presets: ChatPreset[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}
