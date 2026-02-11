/**
 * Why: Centralize shell-level type contracts shared across layout subcomponents.
 * What: Theme variants, split modes, menu descriptors, colophon, layout dimensions, and surface stage action types.
 * How: Export frozen constants and narrow union types consumed by TopBar, SurfaceStage, ShellMenubar, and ThemeSwitcher.
 */

import type { LucideIcon } from "lucide-react";
import type { LayoutPreset } from "@/stores/uiStore";

/* ── Theme ─────────────────────────────────────────────────────────── */

export type ThemeVariant = "light" | "dark" | "retro";

export function isThemeVariant(value: string | null | undefined): value is ThemeVariant {
  return value === "light" || value === "dark" || value === "retro";
}

export function resolveDefaultTheme(): ThemeVariant {
  if (typeof window === "undefined") return "dark";
  const storedDefault = window.localStorage.getItem("nova.theme.default");
  if (isThemeVariant(storedDefault)) return storedDefault;
  const storedActive = window.localStorage.getItem("nova.theme");
  return isThemeVariant(storedActive) ? storedActive : "dark";
}

export function resolveInitialTheme(): ThemeVariant {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("nova.theme");
  if (isThemeVariant(stored)) return stored;
  return resolveDefaultTheme();
}

/* ── Split Mode ────────────────────────────────────────────────────── */

export type SplitMode = "single" | "horizontal" | "vertical";

/* ── Surface Stage Action ──────────────────────────────────────────── */

export interface SurfaceStageAction {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onSelect: () => void;
  readonly active?: boolean;
}

/* ── Menu Descriptors ──────────────────────────────────────────────── */

export type MenuItemDescriptor =
  | { readonly type: "item"; readonly label: string }
  | { readonly type: "separator" };

export interface MenuDescriptor {
  readonly label: string;
  readonly items: readonly MenuItemDescriptor[];
}

/* ── Layout Dimensions ─────────────────────────────────────────────── */

export const LAYOUT_DIMENSIONS: Record<LayoutPreset, { left: number; primary: number; right: number; bottom: number }> = {
  studio: { left: 22, primary: 58, right: 20, bottom: 24 },
  analysis: { left: 20, primary: 48, right: 32, bottom: 26 },
  focus: { left: 18, primary: 72, right: 10, bottom: 22 },
};

/* ── Colophon ──────────────────────────────────────────────────────── */

export const TOP_COLOPHON = Object.freeze({
  product: "Nova IDE",
  branch: "main",
  status: "Guarded",
  model: "GPT-5",
  remote: "synced",
});
