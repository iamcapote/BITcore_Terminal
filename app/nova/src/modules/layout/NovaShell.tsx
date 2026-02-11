/**
 * Why: Orchestrate the Nova IDE shell layout — panels, presets, and chrome composition.
 * What: NovaShell wires the surface manager, layout presets, theme state, and resizable panel groups.
 * How: Import extracted TopBar, SurfaceStage, StatusBar, and LeftRail; delegate rendering to each.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LeftRail } from "@/modules/navigation/LeftRail";
import { useSurfaceManager } from "@/modules/layout/useSurfaceManager";
import { TopBar } from "@/modules/layout/TopBar";
import { SurfaceStage } from "@/modules/layout/SurfaceStage";
import { StatusBar } from "@/modules/status/StatusBar";
import { SURFACES } from "@/modules/layout/surfaceRegistry";
import {
  LAYOUT_DIMENSIONS,
  resolveInitialTheme,
  resolveDefaultTheme,
  type ThemeVariant,
  type SplitMode,
  type SurfaceStageAction,
} from "@/modules/layout/shellTypes";
import { useTerminal } from "@/modules/terminal/TerminalContext";
import type { LayoutPreset } from "@/stores/uiStore";
import {
  PanelBottom,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Save,
  Share2,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Square,
  Trash2,
} from "lucide-react";

export function NovaShell() {
  const { runCommand } = useTerminal();
  const [theme, setTheme] = useState<ThemeVariant>(() => resolveInitialTheme());
  const [defaultTheme, setDefaultTheme] = useState<ThemeVariant>(() => resolveDefaultTheme());
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("studio");
  const [studioSplitMode, setStudioSplitMode] = useState<SplitMode>("single");
  const [isLeftRailCollapsed, setLeftRailCollapsed] = useState(true);
  const [isWingCollapsed, setWingCollapsed] = useState(true);
  const [isDockCollapsed, setDockCollapsed] = useState(true);
  const hasAppliedPreset = useRef(false);
  const surfaceManager = useSurfaceManager(SURFACES);

  /* ── Theme persistence ───────────────────────────────────────────── */

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-nova-theme", theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nova.theme", theme);
    }
  }, [theme]);

  const handleThemeChange = useCallback((next: ThemeVariant) => setTheme(next), []);

  const handleSetDefaultTheme = useCallback(
    (next: ThemeVariant) => {
      setDefaultTheme(next);
      handleThemeChange(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("nova.theme.default", next);
      }
    },
    [handleThemeChange],
  );

  /* ── Placement queries ───────────────────────────────────────────── */

  const primary = surfaceManager.surfacesByPlacement("primary");
  const bottom = surfaceManager.surfacesByPlacement("bottom");
  const right = surfaceManager.surfacesByPlacement("right");

  const activePrimary = surfaceManager.active.primary ?? primary[0]?.id ?? null;
  const activeBottom = surfaceManager.active.bottom ?? bottom[0]?.id ?? null;
  const activeRight = surfaceManager.active.right ?? right[0]?.id ?? null;

  const gradientStyle = useMemo(
    () => ({
      backgroundImage:
        "linear-gradient(135deg, hsl(var(--shell-gradient-from)) 0%, hsl(var(--shell-gradient-via)) 48%, hsl(var(--shell-gradient-to)) 100%)",
    }),
    [theme],
  );

  /* ── Preset side-effects ─────────────────────────────────────────── */

  useEffect(() => {
    if (!hasAppliedPreset.current) {
      hasAppliedPreset.current = true;
      return;
    }
    if (layoutPreset === "studio") {
      setLeftRailCollapsed(false);
      setWingCollapsed(false);
      setDockCollapsed(false);
    } else if (layoutPreset === "analysis") {
      setLeftRailCollapsed(false);
      setWingCollapsed(false);
      setDockCollapsed(true);
    } else if (layoutPreset === "focus") {
      setLeftRailCollapsed(true);
      setWingCollapsed(true);
      setDockCollapsed(true);
    }
  }, [layoutPreset]);

  const toggleRail = () => setLeftRailCollapsed((p) => !p);
  const toggleWing = () => setWingCollapsed((p) => !p);
  const toggleDock = () => setDockCollapsed((p) => !p);
  const handleSplitToggle = (mode: SplitMode) =>
    setStudioSplitMode((p) => (p === mode ? "single" : mode));

  /* ── Toolbar actions ─────────────────────────────────────────────── */

  const studioActions: SurfaceStageAction[] = [
    { id: "toggle-rail", icon: PanelLeft, label: isLeftRailCollapsed ? "Expand left rail" : "Collapse left rail", onSelect: toggleRail, active: isLeftRailCollapsed },
    { id: "split-horizontal", icon: SplitSquareHorizontal, label: "Split horizontally", onSelect: () => handleSplitToggle("horizontal"), active: studioSplitMode === "horizontal" },
    { id: "split-vertical", icon: SplitSquareVertical, label: "Split vertically", onSelect: () => handleSplitToggle("vertical"), active: studioSplitMode === "vertical" },
    { id: "save", icon: Save, label: "Save file", onSelect: () => runCommand("file save") },
    { id: "share", icon: Share2, label: "Share snapshot", onSelect: () => runCommand("workspace share") },
  ];

  const wingActions: SurfaceStageAction[] = [
    { id: "toggle-wing", icon: PanelRight, label: isWingCollapsed ? "Expand wing" : "Collapse wing", onSelect: toggleWing, active: isWingCollapsed },
  ];

  const dockActions: SurfaceStageAction[] = [
    { id: "toggle-dock", icon: PanelBottom, label: isDockCollapsed ? "Expand dock" : "Collapse dock", onSelect: toggleDock, active: isDockCollapsed },
    { id: "run", icon: Play, label: "Run", onSelect: () => runCommand("task run") },
    { id: "pause", icon: Pause, label: "Pause", onSelect: () => runCommand("task pause") },
    { id: "stop", icon: Square, label: "Stop", onSelect: () => runCommand("task stop") },
    { id: "clear", icon: Trash2, label: "Clear output", onSelect: () => runCommand("terminal clear") },
  ];

  /* ── Layout dimensions ───────────────────────────────────────────── */

  const dimensions = LAYOUT_DIMENSIONS[layoutPreset];

  const shellKey = [
    theme, layoutPreset, studioSplitMode,
    isLeftRailCollapsed ? "rail:collapsed" : "rail:open",
    isWingCollapsed ? "wing:collapsed" : "wing:open",
    isDockCollapsed ? "dock:collapsed" : "dock:open",
    surfaceManager.active.primary,
    surfaceManager.active.bottom,
    surfaceManager.active.right,
  ].join(":");

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <TooltipProvider>
      <div
        className="grid h-screen w-screen max-w-full grid-rows-[auto_1fr_auto] overflow-hidden bg-background text-foreground transition-colors duration-300"
        style={gradientStyle}
      >
        <TopBar
          layoutPreset={layoutPreset}
          theme={theme}
          defaultTheme={defaultTheme}
          onThemeSelect={handleThemeChange}
          onThemeDefault={handleSetDefaultTheme}
          onLayoutPresetChange={setLayoutPreset}
        />
        <PanelGroup key={shellKey} direction="vertical" className="min-h-0 min-w-0 overflow-hidden">
          <Panel
            defaultSize={bottom.length > 0 ? 100 - dimensions.bottom : 100}
            minSize={40}
            className="min-h-0 min-w-0"
          >
            <PanelGroup direction="horizontal" className="min-h-0 min-w-0 overflow-hidden">
              <Panel
                collapsible
                collapsedSize={6}
                minSize={isLeftRailCollapsed ? 6 : 16}
                defaultSize={isLeftRailCollapsed ? 8 : dimensions.left}
                maxSize={28}
                className="border-r bg-muted/10 data-[panel-collapsed=true]:px-1"
              >
                <LeftRail
                  surfaces={surfaceManager.surfaces}
                  active={surfaceManager.active}
                  collapsed={isLeftRailCollapsed}
                  onActivate={surfaceManager.activate}
                  onPlacementChange={surfaceManager.setPlacement}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border/80" />
              <Panel
                minSize={40}
                defaultSize={right.length > 0 ? dimensions.primary : 80}
                className="min-w-0 bg-background/50"
              >
                <SurfaceStage
                  label="Studio"
                  surfaces={primary}
                  activeId={activePrimary}
                  onSelect={surfaceManager.activate}
                  onReorder={(id, direction) => surfaceManager.reorder(id, direction)}
                  splitMode={studioSplitMode}
                  toolbarActions={studioActions}
                  placement="primary"
                />
              </Panel>
              {right.length > 0 && (
                <>
                  <PanelResizeHandle className="w-1 bg-border/80" />
                  <Panel
                    collapsible
                    collapsedSize={6}
                    minSize={isWingCollapsed ? 6 : 18}
                    defaultSize={isWingCollapsed ? 8 : dimensions.right}
                    maxSize={32}
                    className="min-w-0 border-l bg-muted/10 data-[panel-collapsed=true]:px-0"
                  >
                    <SurfaceStage
                      label="Wing"
                      surfaces={right}
                      activeId={activeRight}
                      onSelect={surfaceManager.activate}
                      onReorder={(id, direction) => surfaceManager.reorder(id, direction)}
                      toolbarActions={wingActions}
                      placement="right"
                      collapsed={isWingCollapsed}
                      onExpand={() => setWingCollapsed(false)}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
          {bottom.length > 0 && (
            <>
              <PanelResizeHandle className="h-1 bg-border/80" />
              <Panel
                collapsible
                collapsedSize={6}
                minSize={isDockCollapsed ? 6 : 14}
                defaultSize={isDockCollapsed ? 8 : dimensions.bottom}
                className="min-h-0 bg-muted/10 data-[panel-collapsed=true]:py-0"
              >
                <SurfaceStage
                  label="Dock"
                  surfaces={bottom}
                  activeId={activeBottom}
                  onSelect={surfaceManager.activate}
                  onReorder={(id, direction) => surfaceManager.reorder(id, direction)}
                  toolbarActions={dockActions}
                  placement="bottom"
                  collapsed={isDockCollapsed}
                  onExpand={() => setDockCollapsed(false)}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
        <StatusBar
          active={surfaceManager.active}
          surfaces={surfaceManager.surfaces}
          layoutPreset={layoutPreset}
          onLayoutPresetChange={setLayoutPreset}
        />
      </div>
    </TooltipProvider>
  );
}
