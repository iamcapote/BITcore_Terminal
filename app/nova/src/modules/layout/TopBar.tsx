/**
 * Why: Render the Nova top application bar with branding, menubar, search, and quick actions.
 * What: TopBar component with product colophon, ShellMenubar, search, notifications, settings, and theme controls.
 * How: Compose sub-components from shellMenubar and ThemeSwitcher; pass theme/layout callbacks from the shell.
 */

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShellMenubar } from "@/modules/layout/ShellMenubar";
import { ThemeSwitcher } from "@/modules/layout/ThemeSwitcher";
import { TOP_COLOPHON, type ThemeVariant } from "@/modules/layout/shellTypes";
import type { LayoutPreset } from "@/stores/uiStore";
import { Search } from "lucide-react";

/* ── Props ─────────────────────────────────────────────────────────── */

export interface TopBarProps {
  readonly layoutPreset: LayoutPreset;
  readonly theme: ThemeVariant;
  readonly defaultTheme: ThemeVariant;
  readonly onThemeSelect: (theme: ThemeVariant) => void;
  readonly onThemeDefault: (theme: ThemeVariant) => void;
  readonly onLayoutPresetChange: (preset: LayoutPreset) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function TopBar({
  layoutPreset,
  theme,
  defaultTheme,
  onThemeSelect,
  onThemeDefault,
  onLayoutPresetChange,
}: TopBarProps) {
  return (
    <div className="nova-topbar flex h-12 items-center gap-2 border-b px-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:gap-3 sm:px-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold tracking-wide truncate max-w-[120px] sm:max-w-none">{TOP_COLOPHON.product}</div>
          <Badge variant="outline" className="hidden text-[10px] uppercase sm:inline-flex">
            {TOP_COLOPHON.status}
          </Badge>
        </div>
        <div className="hidden md:block">
          <ShellMenubar
            theme={theme}
            layoutPreset={layoutPreset}
            onThemeSelect={onThemeSelect}
            onLayoutPresetChange={onLayoutPresetChange}
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <TopBarSearch />
        <ThemeSwitcher theme={theme} defaultTheme={defaultTheme} onThemeSelect={onThemeSelect} onThemeDefault={onThemeDefault} />
      </div>
    </div>
  );
}

/* ── Search ─────────────────────────────────────────────────────────── */

function TopBarSearch() {
  return (
    <div className="relative hidden w-48 sm:block md:w-56 lg:w-64 xl:w-72">
      <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Search files, vectors, DB, MCP…"
        className="h-9 w-full rounded-lg pl-8 pr-3"
      />
    </div>
  );
}
