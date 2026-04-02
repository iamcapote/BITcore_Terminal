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
import type { SurfaceState } from "@/modules/layout/layoutTypes";
import {
  LAYOUT_DIMENSIONS,
  resolveInitialTheme,
  resolveDefaultTheme,
  type ThemeVariant,
  type SplitMode,
  type SurfaceStageAction,
} from "@/modules/layout/shellTypes";
import {
  loadShellLayoutSnapshot,
  saveShellLayoutSnapshot,
} from "@/modules/layout/shellPersistence";
import { useTerminal } from "@/modules/terminal/TerminalContext";
import { useViewportBreakpoint, bpLte } from "@/hooks/useResponsive";
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
  const vp = useViewportBreakpoint();
  const isNarrow = bpLte(vp, "sm");
  const isMedium = bpLte(vp, "md");
  const initialShellLayout = useMemo(() => loadShellLayoutSnapshot(), []);
  const [theme, setTheme] = useState<ThemeVariant>(() => resolveInitialTheme());
  const [defaultTheme, setDefaultTheme] = useState<ThemeVariant>(() => resolveDefaultTheme());
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>(initialShellLayout.layoutPreset);
  const [studioSplitMode, setStudioSplitMode] = useState<SplitMode>(initialShellLayout.splitMode);
  const [isLeftRailCollapsed, setLeftRailCollapsed] = useState(initialShellLayout.leftRailCollapsed);
  const [isWingCollapsed, setWingCollapsed] = useState(initialShellLayout.wingCollapsed);
  const [isDockCollapsed, setDockCollapsed] = useState(initialShellLayout.dockCollapsed);
  const hasAppliedPreset = useRef(false);
  const surfaceManager = useSurfaceManager(SURFACES);

  /* ── Auto-collapse panels on narrow viewports ────────────────────── */

  useEffect(() => {
    if (isNarrow) {
      setLeftRailCollapsed(true);
      setWingCollapsed(true);
      setDockCollapsed(true);
    }
  }, [isNarrow]);

  useEffect(() => {
    saveShellLayoutSnapshot({
      layoutPreset,
      splitMode: studioSplitMode,
      leftRailCollapsed: isLeftRailCollapsed,
      wingCollapsed: isWingCollapsed,
      dockCollapsed: isDockCollapsed,
    });
  }, [
    layoutPreset,
    studioSplitMode,
    isLeftRailCollapsed,
    isWingCollapsed,
    isDockCollapsed,
  ]);

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

  const handleCloseSurface = useCallback(
    (id: SurfaceState["id"]) => {
      surfaceManager.setPlacement(id, "hidden");
    },
    [surfaceManager],
  );

  /* ── Toolbar actions ─────────────────────────────────────────────── */

  const studioActions: SurfaceStageAction[] = [
    { id: "toggle-rail", icon: PanelLeft, label: isLeftRailCollapsed ? "Expand left rail" : "Collapse left rail", onSelect: toggleRail, active: isLeftRailCollapsed },
    ...(!isNarrow
      ? [
          {
            id: "split-horizontal",
            icon: SplitSquareHorizontal,
            label: "Split horizontally",
            onSelect: () => handleSplitToggle("vertical"),
            active: studioSplitMode === "vertical",
          },
          {
            id: "split-vertical",
            icon: SplitSquareVertical,
            label: "Split vertically",
            onSelect: () => handleSplitToggle("horizontal"),
            active: studioSplitMode === "horizontal",
          },
        ]
      : []),
    ...(!isNarrow
      ? [
          { id: "save", icon: Save, label: "Save file", onSelect: () => runCommand("file save") },
          { id: "share", icon: Share2, label: "Share snapshot", onSelect: () => runCommand("workspace share") },
        ]
      : []),
  ];

  const wingActions: SurfaceStageAction[] = [
    { id: "toggle-wing", icon: PanelRight, label: isWingCollapsed ? "Expand wing" : "Collapse wing", onSelect: toggleWing, active: isWingCollapsed },
  ];

  const dockActions: SurfaceStageAction[] = [
    { id: "toggle-dock", icon: PanelBottom, label: isDockCollapsed ? "Expand dock" : "Collapse dock", onSelect: toggleDock, active: isDockCollapsed },
    ...(!isNarrow
      ? [
          { id: "run", icon: Play, label: "Run", onSelect: () => runCommand("task run") },
          { id: "pause", icon: Pause, label: "Pause", onSelect: () => runCommand("task pause") },
          { id: "stop", icon: Square, label: "Stop", onSelect: () => runCommand("task stop") },
          { id: "clear", icon: Trash2, label: "Clear output", onSelect: () => runCommand("terminal clear") },
        ]
      : []),
  ];

  /* ── Layout dimensions (responsive) ──────────────────────────────── */

  const baseDimensions = LAYOUT_DIMENSIONS[layoutPreset];
  const dimensions = useMemo(() => {
    if (isNarrow) return { left: 4, primary: 92, right: 4, bottom: 8 };
    if (isMedium) return { left: baseDimensions.left, primary: baseDimensions.primary + 10, right: Math.max(baseDimensions.right - 6, 10), bottom: Math.max(baseDimensions.bottom - 4, 12) };
    return baseDimensions;
  }, [baseDimensions, isNarrow, isMedium]);

  const shellKey = [
    theme, layoutPreset, studioSplitMode,
    isLeftRailCollapsed ? "rail:collapsed" : "rail:open",
    isWingCollapsed ? "wing:collapsed" : "wing:open",
    isDockCollapsed ? "dock:collapsed" : "dock:open",
    surfaceManager.active.primary,
    surfaceManager.active.bottom,
    surfaceManager.active.right,
  ].join(":");

  const leftDefaultSize = isLeftRailCollapsed ? (isNarrow ? 0 : 4) : dimensions.left;
  const rightDefaultSize = right.length > 0
    ? (isWingCollapsed ? (isNarrow ? 0 : 8) : dimensions.right)
    : 0;
  const primaryDefaultSize = Math.max(10, 100 - leftDefaultSize - rightDefaultSize);
  const bottomDefaultSize = bottom.length > 0
    ? (isDockCollapsed ? (isNarrow ? 0 : 8) : dimensions.bottom)
    : 0;
  const topDefaultSize = bottom.length > 0 ? Math.max(10, 100 - bottomDefaultSize) : 100;

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
            defaultSize={topDefaultSize}
            minSize={isNarrow ? 60 : 40}
            className="min-h-0 min-w-0"
          >
            <PanelGroup direction="horizontal" className="min-h-0 min-w-0 overflow-hidden">
              <Panel
                collapsible
                collapsedSize={isNarrow ? 0 : 3}
                minSize={isLeftRailCollapsed ? (isNarrow ? 0 : 3) : (isNarrow ? 10 : 16)}
                defaultSize={leftDefaultSize}
                maxSize={isNarrow ? 60 : 28}
                className="border-r bg-muted/10 transition-all duration-200 data-[panel-collapsed=true]:px-0"
              >
                <LeftRail
                  surfaces={surfaceManager.surfaces}
                  active={surfaceManager.active}
                  collapsed={isLeftRailCollapsed}
                  onActivate={surfaceManager.activate}
                  onPlacementChange={surfaceManager.setPlacement}
                  layoutPreset={layoutPreset}
                  onLayoutPresetChange={setLayoutPreset}
                  onReorder={(id, direction) => surfaceManager.reorder(id, direction)}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border/80" />
              <Panel
                minSize={40}
                defaultSize={primaryDefaultSize}
                className="min-w-0 bg-background/50"
              >
                <SurfaceStage
                  label="Studio"
                  surfaces={primary}
                  activeId={activePrimary}
                  onSelect={surfaceManager.activate}
                  onClose={handleCloseSurface}
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
                    collapsedSize={isNarrow ? 0 : 6}
                    minSize={isWingCollapsed ? (isNarrow ? 0 : 6) : (isNarrow ? 30 : 18)}
                    defaultSize={rightDefaultSize}
                    maxSize={isNarrow ? 80 : 32}
                    className="min-w-0 border-l bg-muted/10 transition-all duration-200 data-[panel-collapsed=true]:px-0"
                  >
                    <SurfaceStage
                      label="Wing"
                      surfaces={right}
                      activeId={activeRight}
                      onSelect={surfaceManager.activate}
                      onClose={handleCloseSurface}
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
                collapsedSize={isNarrow ? 0 : 6}
                minSize={isDockCollapsed ? (isNarrow ? 0 : 6) : (isNarrow ? 20 : 14)}
                defaultSize={bottomDefaultSize}
                className="min-h-0 bg-muted/10 transition-all duration-200 data-[panel-collapsed=true]:py-0"
              >
                <SurfaceStage
                  label="Dock"
                  surfaces={bottom}
                  activeId={activeBottom}
                  onSelect={surfaceManager.activate}
                  onClose={handleCloseSurface}
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
        />
      </div>
    </TooltipProvider>
  );
}
