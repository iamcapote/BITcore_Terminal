/**
 * Why: Persist Nova shell layout ergonomics across sessions without coupling UI components to storage details.
 * What: Reads/writes layout preset, split mode, and panel collapse booleans via localStorage.
 * How: Validates values at boundaries and falls back to safe defaults when storage is unavailable.
 */

import type { LayoutPreset } from "@/stores/uiStore";
import type { SplitMode } from "@/modules/layout/shellTypes";

export interface ShellLayoutSnapshot {
  readonly layoutPreset: LayoutPreset;
  readonly splitMode: SplitMode;
  readonly leftRailCollapsed: boolean;
  readonly wingCollapsed: boolean;
  readonly dockCollapsed: boolean;
}

const STORAGE_KEY = "nova.shell.layout.v1";

const DEFAULT_SNAPSHOT: ShellLayoutSnapshot = Object.freeze({
  layoutPreset: "studio",
  splitMode: "single",
  leftRailCollapsed: true,
  wingCollapsed: true,
  dockCollapsed: true,
});

function isLayoutPreset(value: unknown): value is LayoutPreset {
  return value === "studio" || value === "analysis" || value === "focus";
}

function isSplitMode(value: unknown): value is SplitMode {
  return value === "single" || value === "horizontal" || value === "vertical";
}

function normalizeSnapshot(raw: unknown): ShellLayoutSnapshot {
  const input = raw && typeof raw === "object" ? (raw as Partial<ShellLayoutSnapshot>) : null;

  return {
    layoutPreset: isLayoutPreset(input?.layoutPreset) ? input.layoutPreset : DEFAULT_SNAPSHOT.layoutPreset,
    splitMode: isSplitMode(input?.splitMode) ? input.splitMode : DEFAULT_SNAPSHOT.splitMode,
    leftRailCollapsed: typeof input?.leftRailCollapsed === "boolean" ? input.leftRailCollapsed : DEFAULT_SNAPSHOT.leftRailCollapsed,
    wingCollapsed: typeof input?.wingCollapsed === "boolean" ? input.wingCollapsed : DEFAULT_SNAPSHOT.wingCollapsed,
    dockCollapsed: typeof input?.dockCollapsed === "boolean" ? input.dockCollapsed : DEFAULT_SNAPSHOT.dockCollapsed,
  };
}

export function loadShellLayoutSnapshot(): ShellLayoutSnapshot {
  if (typeof window === "undefined") {
    return DEFAULT_SNAPSHOT;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SNAPSHOT;
    }
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

export function saveShellLayoutSnapshot(snapshot: ShellLayoutSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export const SHELL_LAYOUT_DEFAULTS = DEFAULT_SNAPSHOT;
