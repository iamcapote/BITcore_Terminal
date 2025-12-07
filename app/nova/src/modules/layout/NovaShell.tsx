/**
 * @license INTERNAL ONLY — Nova shell layout (Step 1)
 *
 * Why: emulate the VS Code fork experience inside the Nova surface manager so we
 * can prove placement parity before wiring the legacy UI and vendor overlays.
 * What: compose surface placements, a top menubar, themed status surfaces, and
 * contextual toolbars for the Studio, Wing, and Dock.
 * How: guard inputs via the surface manager contract, render stages with
 * toolbar affordances, and pipe menu actions through the terminal command bus.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LeftRail } from "@/modules/navigation/LeftRail";
import { useSurfaceManager } from "@/modules/layout/useSurfaceManager";
import type { SurfaceDefinition, SurfaceId, SurfaceState, WiringStatus } from "@/modules/layout/layoutTypes";
import {
  AgentsSurface,
  ComputerAsToolSurface,
} from "@/modules/views/AgentSurfaces";
import { ChatSurface } from "@/modules/chat/ChatSurface";
import { EditorSurface } from "@/modules/views/EditorSurface";
import {
  DatabaseManagerSurface,
  MemoryManagerSurface,
  MetricsBoardSurface,
  VectorManagerSurface,
} from "@/modules/views/KnowledgeSurfaces";
import {
  InstrumentsSurface,
  TasksSurface,
  TerminalSurface,
} from "@/modules/views/OperationsSurfaces";
import { ResearchSurface } from "@/modules/research/ResearchSurface";
import { PromptLibrarySurface } from "@/modules/prompts/PromptLibrarySurface";
import { MissionsSurface } from "@/modules/missions/MissionsSurface";
import { GithubSyncSurface } from "@/modules/github/GithubSyncSurface";
import { LogsSurface } from "@/modules/logs/LogsSurface";
import { useTerminal } from "@/modules/terminal/TerminalContext";
import { StatusBar } from "@/modules/status/StatusBar";
import type { LayoutPreset } from "@/stores/uiStore";
import {
  Bell,
  Check,
  Bot,
  BrainCircuit,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Database,
  FolderTree,
  Gauge,
  GitPullRequest,
  Layers,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Monitor,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Plug,
  Rocket,
  ScrollText,
  Share2,
  Save,
  Search,
  Settings,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Square,
  Sun,
  TerminalSquare,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SURFACES: SurfaceDefinition[] = [
  { id: "explorer", label: "Explorer", icon: FolderTree, group: "workspace", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "vectors", label: "Vector Stores", icon: Layers, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "databases", label: "Databases", icon: Database, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "memory", label: "Memory", icon: BrainCircuit, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "metrics", label: "Metrics", icon: Gauge, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "research", label: "Research", icon: Search, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "prompts", label: "Prompts", icon: BookOpenCheck, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "agents", label: "Agents", icon: Bot, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "instruments", label: "Instruments", icon: Wrench, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "missions", label: "Missions", icon: Rocket, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "tasks", label: "Tasks", icon: ListChecks, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "githubSync", label: "GitHub Sync", icon: GitPullRequest, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "logs", label: "Logs", icon: ScrollText, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "terminal", label: "Terminal", icon: TerminalSquare, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "mcp", label: "MCP", icon: Plug, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "communication", defaultPlacement: "primary", initialPlacement: "primary", wiringStatus: "wired" },
];

const SURFACE_COMPONENTS: Record<SurfaceId, () => JSX.Element> = {
  explorer: EditorSurface,
  vectors: VectorManagerSurface,
  databases: DatabaseManagerSurface,
  memory: MemoryManagerSurface,
  metrics: MetricsBoardSurface,
  research: ResearchSurface,
  prompts: PromptLibrarySurface,
  agents: AgentsSurface,
  instruments: InstrumentsSurface,
  missions: MissionsSurface,
  tasks: TasksSurface,
  githubSync: GithubSyncSurface,
  logs: LogsSurface,
  terminal: TerminalSurface,
  mcp: ComputerAsToolSurface,
  chat: ChatSurface,
};

const TOP_COLOPHON = {
  product: "Nova IDE",
  branch: "main",
  status: "Guarded",
  model: "GPT-5",
  remote: "synced",
};

type ThemeVariant = "light" | "dark" | "retro";

type SplitMode = "single" | "horizontal" | "vertical";

function isThemeVariant(value: string | null | undefined): value is ThemeVariant {
  return value === "light" || value === "dark" || value === "retro";
}

function resolveDefaultTheme(): ThemeVariant {
  if (typeof window === "undefined") return "dark";
  const storedDefault = window.localStorage.getItem("nova.theme.default");
  if (isThemeVariant(storedDefault)) return storedDefault;
  const storedActive = window.localStorage.getItem("nova.theme");
  return isThemeVariant(storedActive) ? storedActive : "dark";
}

function resolveInitialTheme(): ThemeVariant {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("nova.theme");
  if (isThemeVariant(stored)) {
    return stored;
  }
  return resolveDefaultTheme();
}

const LAYOUT_DIMENSIONS: Record<LayoutPreset, { left: number; primary: number; right: number; bottom: number }> = {
  studio: { left: 22, primary: 58, right: 20, bottom: 24 },
  analysis: { left: 20, primary: 48, right: 32, bottom: 26 },
  focus: { left: 18, primary: 72, right: 10, bottom: 22 },
};

interface SurfaceStageAction {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onSelect: () => void;
  readonly active?: boolean;
}

type MenuItemDescriptor =
  | { readonly type: "item"; readonly label: string }
  | { readonly type: "separator" };

interface MenuDescriptor {
  readonly label: string;
  readonly items: readonly MenuItemDescriptor[];
}

const PRE_VIEW_MENUS: readonly MenuDescriptor[] = [
  {
    label: "File",
    items: [
  { type: "item", label: "New File" },
      { type: "item", label: "New Workspace" },
  { type: "item", label: "Open…" },
      { type: "separator" },
  { type: "item", label: "Save" },
      { type: "item", label: "Save All" },
      { type: "item", label: "Export Session…" },
    ],
  },
  {
    label: "Edit",
    items: [
  { type: "item", label: "Undo" },
  { type: "item", label: "Redo" },
      { type: "separator" },
  { type: "item", label: "Find" },
  { type: "item", label: "Replace" },
    ],
  },
];

const POST_VIEW_MENUS: readonly MenuDescriptor[] = [
  {
    label: "Go",
    items: [
  { type: "item", label: "File…" },
  { type: "item", label: "Symbol…" },
  { type: "item", label: "Definition" },
    ],
  },
  {
    label: "Run",
    items: [
  { type: "item", label: "Start" },
      { type: "item", label: "Pause" },
      { type: "item", label: "Stop" },
    ],
  },
  {
    label: "AI",
    items: [
      { type: "item", label: "Open Chat" },
      { type: "item", label: "Suggest Refactor" },
      { type: "item", label: "Planner" },
      { type: "item", label: "MCP Servers" },
      { type: "item", label: "Instruments" },
    ],
  },
  {
    label: "Data",
    items: [
      { type: "item", label: "Vector Stores" },
      { type: "item", label: "Databases" },
      { type: "item", label: "Pipelines" },
    ],
  },
  {
    label: "Tools",
    items: [
      { type: "item", label: "Task Runner" },
      { type: "item", label: "Terminal Profiles" },
      { type: "item", label: "Extensions" },
    ],
  },
  {
    label: "Micro",
    items: [
      { type: "item", label: "Launch Micro Workspace" },
      { type: "item", label: "Show Micro Logs" },
      { type: "item", label: "Reset Micro Session" },
    ],
  },
  {
    label: "Computer",
    items: [
      { type: "item", label: "Open Tool Controls…" },
      { type: "item", label: "Review Guardrails" },
      { type: "item", label: "Audit Logs" },
    ],
  },
  {
    label: "Window",
    items: [
      { type: "item", label: "Toggle Dock" },
      { type: "item", label: "Toggle Wing" },
      { type: "item", label: "Zen Mode" },
    ],
  },
  {
    label: "Help",
    items: [
      { type: "item", label: "Documentation" },
      { type: "item", label: "Keyboard Shortcuts" },
      { type: "item", label: "Report Issue…" },
    ],
  },
];

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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-nova-theme", theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nova.theme", theme);
    }
  }, [theme]);

  const handleThemeChange = useCallback((nextTheme: ThemeVariant) => {
    setTheme(nextTheme);
  }, []);

  const handleSetDefaultTheme = useCallback((nextTheme: ThemeVariant) => {
    setDefaultTheme(nextTheme);
    handleThemeChange(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nova.theme.default", nextTheme);
    }
  }, [handleThemeChange]);

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

  const toggleRail = () => setLeftRailCollapsed((prev) => !prev);
  const toggleWing = () => setWingCollapsed((prev) => !prev);
  const toggleDock = () => setDockCollapsed((prev) => !prev);

  const handleSplitToggle = (mode: SplitMode) => {
    setStudioSplitMode((prev) => (prev === mode ? "single" : mode));
  };

  const studioActions: SurfaceStageAction[] = [
    {
      id: "toggle-rail",
      icon: PanelLeft,
      label: isLeftRailCollapsed ? "Expand left rail" : "Collapse left rail",
      onSelect: toggleRail,
      active: isLeftRailCollapsed,
    },
    {
      id: "split-horizontal",
      icon: SplitSquareHorizontal,
      label: "Split horizontally",
      onSelect: () => handleSplitToggle("horizontal"),
      active: studioSplitMode === "horizontal",
    },
    {
      id: "split-vertical",
      icon: SplitSquareVertical,
      label: "Split vertically",
      onSelect: () => handleSplitToggle("vertical"),
      active: studioSplitMode === "vertical",
    },
    {
      id: "save",
      icon: Save,
      label: "Save file",
      onSelect: () => runCommand("file save"),
    },
    {
      id: "share",
      icon: Share2,
      label: "Share snapshot",
      onSelect: () => runCommand("workspace share"),
    },
  ];

  const wingActions: SurfaceStageAction[] = [
    {
      id: "toggle-wing",
      icon: PanelRight,
      label: isWingCollapsed ? "Expand wing" : "Collapse wing",
      onSelect: toggleWing,
      active: isWingCollapsed,
    },
  ];

  const dockActions: SurfaceStageAction[] = [
    {
      id: "toggle-dock",
      icon: PanelBottom,
      label: isDockCollapsed ? "Expand dock" : "Collapse dock",
      onSelect: toggleDock,
      active: isDockCollapsed,
    },
    {
      id: "run",
      icon: Play,
      label: "Run",
      onSelect: () => runCommand("task run"),
    },
    {
      id: "pause",
      icon: Pause,
      label: "Pause",
      onSelect: () => runCommand("task pause"),
    },
    {
      id: "stop",
      icon: Square,
      label: "Stop",
      onSelect: () => runCommand("task stop"),
    },
    {
      id: "clear",
      icon: Trash2,
      label: "Clear output",
      onSelect: () => runCommand("terminal clear"),
    },
  ];

  const dimensions = LAYOUT_DIMENSIONS[layoutPreset];

  const shellKey = [
    theme,
    layoutPreset,
    studioSplitMode,
    isLeftRailCollapsed ? "rail:collapsed" : "rail:open",
    isWingCollapsed ? "wing:collapsed" : "wing:open",
    isDockCollapsed ? "dock:collapsed" : "dock:open",
    surfaceManager.active.primary,
    surfaceManager.active.bottom,
    surfaceManager.active.right,
  ].join(":");

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

interface SurfaceStageProps {
  readonly label: string;
  readonly surfaces: SurfaceState[];
  readonly activeId: SurfaceId | null;
  readonly onSelect: (id: SurfaceId) => void;
  readonly toolbarActions?: SurfaceStageAction[];
  readonly splitMode?: SplitMode;
  readonly onReorder?: (id: SurfaceId, direction: "forward" | "backward") => void;
  readonly placement: "primary" | "right" | "bottom";
  readonly collapsed?: boolean;
  readonly onExpand?: () => void;
}

function SurfaceStage({
  label,
  surfaces,
  activeId,
  onSelect,
  toolbarActions = [],
  splitMode = "single",
  onReorder,
  placement,
  collapsed = false,
  onExpand,
}: SurfaceStageProps) {
  const ActiveComponent = activeId ? SURFACE_COMPONENTS[activeId] : null;
  const activeSurface = activeId ? surfaces.find((surface) => surface.id === activeId) ?? null : null;
  const activeStatus = activeSurface?.wiringStatus ?? null;
  const stageStatusClass = wiringStatusClass(activeStatus);
  const activeStatusBadge = wiringBadge(activeStatus);
  const activeIndex = activeId ? surfaces.findIndex((surface) => surface.id === activeId) : -1;
  const canMoveBackward = activeIndex > 0;
  const canMoveForward = activeIndex > -1 && activeIndex < surfaces.length - 1;

  if (collapsed) {
    const ExpandIcon = placement === "right" ? PanelRight : PanelBottom;
    return (
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 items-center justify-center gap-1",
          stageStatusClass,
          placement === "right" && "flex-col gap-1 py-2",
          placement === "bottom" && "flex-row gap-1 px-2",
        )}
      >
        {onExpand && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md border border-border/60 bg-background/40"
                onClick={onExpand}
                aria-label={`Expand ${label}`}
              >
                <ExpandIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={placement === "right" ? "left" : "top"}>Expand {label}</TooltipContent>
          </Tooltip>
        )}
        {surfaces.map((surface) => {
          const Icon = surface.icon;
          const isActive = surface.id === activeId;
          return (
            <Tooltip key={surface.id}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isActive ? "default" : "ghost"}
                  className={cn("h-7 w-7 rounded-md", wiringStatusClass(surface.wiringStatus))}
                  onClick={() => onSelect(surface.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={placement === "right" ? "left" : "top"}>{surface.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  const primaryPane = ActiveComponent ? <ActiveComponent /> : <StagePlaceholder label={label} />;
  const secondaryIndex = surfaces.length > 1 ? (activeIndex > -1 ? (activeIndex + 1) % surfaces.length : 1) : -1;
  const secondarySurface = secondaryIndex > -1 ? surfaces[secondaryIndex] : null;
  const SecondaryComponent = secondarySurface ? SURFACE_COMPONENTS[secondarySurface.id] : null;
  const secondaryPane = SecondaryComponent ? (
    <SecondaryComponent />
  ) : (
    <StagePlaceholder label={`${label} secondary`} />
  );

  const primaryShell = (
    <div className={cn("h-full min-h-0 min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/40", stageStatusClass)}>
      {primaryPane}
    </div>
  );

  const secondaryShell = (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col rounded-md border border-border/60 bg-background/30", wiringStatusClass(secondarySurface?.wiringStatus))}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="font-semibold">{secondarySurface?.label ?? "Secondary View"}</span>
        <Badge variant="outline" className="text-[9px] uppercase">
          Preview
        </Badge>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-auto">{secondaryPane}</div>
    </div>
  );

  let body: JSX.Element;
  if (splitMode === "horizontal") {
    body = (
      <PanelGroup direction="vertical" className="min-h-0 min-w-0">
        <Panel defaultSize={65} minSize={35} className="min-h-0 min-w-0 p-2">
          {primaryShell}
        </Panel>
        <PanelResizeHandle className="h-1 bg-border/60" />
        <Panel defaultSize={35} minSize={20} className="min-h-0 min-w-0 p-2">
          {secondaryShell}
        </Panel>
      </PanelGroup>
    );
  } else if (splitMode === "vertical") {
    body = (
      <PanelGroup direction="horizontal" className="min-h-0 min-w-0">
        <Panel defaultSize={65} minSize={35} className="min-h-0 min-w-0 p-2">
          {primaryShell}
        </Panel>
        <PanelResizeHandle className="w-1 bg-border/60" />
        <Panel defaultSize={35} minSize={20} className="min-h-0 min-w-0 p-2">
          {secondaryShell}
        </Panel>
      </PanelGroup>
    );
  } else {
    body = <div className="h-full min-w-0 p-3">{primaryShell}</div>;
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex min-h-[44px] min-w-0 items-center gap-2 border-b px-2 py-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="flex-shrink-0" title={label}>
          {label}
        </span>
        {activeStatusBadge}
        <div className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto pb-1">
          {surfaces.map((surface) => (
            <Button
              key={surface.id}
              className={cn(
                "h-8 flex-shrink-0 px-2 text-[11px] uppercase tracking-tight",
                "whitespace-nowrap text-ellipsis overflow-hidden",
                wiringStatusClass(surface.wiringStatus),
              )}
              size="sm"
              variant={surface.id === activeId ? "default" : "outline"}
              onClick={() => onSelect(surface.id)}
              title={surface.label}
            >
              <surface.icon className="mr-1 h-3.5 w-3.5" />
              {surface.label}
            </Button>
          ))}
        </div>
        {(onReorder || toolbarActions.length > 0) && (
          <div className="ml-auto flex flex-shrink-0 items-center gap-1">
            {onReorder && activeId && surfaces.length > 1 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onReorder(activeId, "backward")}
                      aria-label="Move tab backward"
                      disabled={!canMoveBackward}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move left</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onReorder(activeId, "forward")}
                      aria-label="Move tab forward"
                      disabled={!canMoveForward}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move right</TooltipContent>
                </Tooltip>
              </>
            )}
            {toolbarActions.map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={action.active ? "default" : "ghost"}
                    onClick={action.onSelect}
                    aria-label={action.label}
                    aria-pressed={action.active ?? false}
                    className="h-8 w-8"
                  >
                    <action.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">{body}</div>
    </div>
  );
}

function StagePlaceholder({ label }: { readonly label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-muted-foreground/80">
      {label} idle
    </div>
  );
}

function wiringStatusClass(status?: WiringStatus | null): string | undefined {
  if (status === "unwired") return "is-unwired";
  if (status === "partial") return "is-partial";
  return undefined;
}

function wiringBadge(status?: WiringStatus | null): JSX.Element | null {
  if (status === "unwired") {
    return (
      <Badge
        variant="destructive"
        className="ml-2 hidden flex-shrink-0 items-center px-2 py-0 text-[9px] font-semibold uppercase tracking-[0.2em] md:inline-flex"
      >
        Unwired
      </Badge>
    );
  }

  if (status === "partial") {
    return (
      <Badge
        variant="secondary"
        className="ml-2 hidden flex-shrink-0 items-center px-2 py-0 text-[9px] font-semibold uppercase tracking-[0.2em] md:inline-flex"
      >
        Partial
      </Badge>
    );
  }

  return null;
}

interface TopBarProps {
  readonly layoutPreset: LayoutPreset;
  readonly theme: ThemeVariant;
  readonly defaultTheme: ThemeVariant;
  readonly onThemeSelect: (theme: ThemeVariant) => void;
  readonly onThemeDefault: (theme: ThemeVariant) => void;
  readonly onLayoutPresetChange: (preset: LayoutPreset) => void;
}

function TopBar({ layoutPreset, theme, defaultTheme, onThemeSelect, onThemeDefault, onLayoutPresetChange }: TopBarProps) {
  return (
    <div className="flex h-12 items-center gap-3 border-b px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold tracking-wide">{TOP_COLOPHON.product}</div>
          <Badge variant="outline" className="uppercase text-[10px]">
            {TOP_COLOPHON.status}
          </Badge>
        </div>
        <ShellMenubar
          theme={theme}
          layoutPreset={layoutPreset}
          onThemeSelect={onThemeSelect}
          onLayoutPresetChange={onLayoutPresetChange}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <TopBarSearch />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Open notifications" className="h-9 w-9">
              <Bell className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Open settings" className="h-9 w-9">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
        <ThemeSwitcher theme={theme} defaultTheme={defaultTheme} onThemeSelect={onThemeSelect} onThemeDefault={onThemeDefault} />
      </div>
    </div>
  );
}

function ShellMenubar({
  theme,
  layoutPreset,
  onThemeSelect,
  onLayoutPresetChange,
}: {
  readonly theme: ThemeVariant;
  readonly layoutPreset: LayoutPreset;
  readonly onThemeSelect: (theme: ThemeVariant) => void;
  readonly onLayoutPresetChange: (preset: LayoutPreset) => void;
}) {
  return (
    <Menubar className="border-none bg-transparent p-0">
      {PRE_VIEW_MENUS.map((menu) => (
        <ShellMenu key={menu.label} descriptor={menu} />
      ))}
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>Theme</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarCheckboxItem
                checked={theme === "dark"}
                onCheckedChange={() => onThemeSelect("dark")}
              >
                Dark
              </MenubarCheckboxItem>
              <MenubarCheckboxItem
                checked={theme === "light"}
                onCheckedChange={() => onThemeSelect("light")}
              >
                Light
              </MenubarCheckboxItem>
              <MenubarCheckboxItem
                checked={theme === "retro"}
                onCheckedChange={() => onThemeSelect("retro")}
              >
                Retro
              </MenubarCheckboxItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Layout Preset</MenubarSubTrigger>
            <MenubarSubContent>
              {(Object.keys(LAYOUT_DIMENSIONS) as LayoutPreset[]).map((preset) => (
                <MenubarCheckboxItem
                  key={preset}
                  checked={layoutPreset === preset}
                  onCheckedChange={() => onLayoutPresetChange(preset)}
                >
                  {presetLabel(preset)}
                </MenubarCheckboxItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem>Toggle Status Bar</MenubarItem>
          <MenubarItem>Enter Focus Mode</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      {POST_VIEW_MENUS.map((menu) => (
        <ShellMenu key={menu.label} descriptor={menu} />
      ))}
    </Menubar>
  );
}

const THEME_OPTIONS: Array<{ readonly id: ThemeVariant; readonly label: string; readonly icon: LucideIcon }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "retro", label: "Retro", icon: Monitor },
];

function ThemeSwitcher({
  theme,
  defaultTheme,
  onThemeSelect,
  onThemeDefault,
}: {
  readonly theme: ThemeVariant;
  readonly defaultTheme: ThemeVariant;
  readonly onThemeSelect: (theme: ThemeVariant) => void;
  readonly onThemeDefault: (theme: ThemeVariant) => void;
}) {
  const activeOption = THEME_OPTIONS.find((option) => option.id === theme) ?? THEME_OPTIONS[0];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Select theme" className="h-9 w-9">
              <activeOption.icon className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Select theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44 space-y-1">
        {THEME_OPTIONS.map((option) => {
          const isActive = theme === option.id;
          const isDefault = defaultTheme === option.id;
          return (
            <div key={option.id} role="none" className="flex items-center gap-1">
              <DropdownMenuItem
                onSelect={(event) => {
                  if (isActive) {
                    event.preventDefault();
                    return;
                  }
                  onThemeSelect(option.id);
                }}
                className={cn(
                  "flex flex-1 items-center gap-3",
                  isActive && "text-primary",
                  isDefault && !isActive && "text-foreground",
                )}
              >
                <option.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 text-sm font-medium">{option.label}</span>
                {isDefault ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                    Default
                  </Badge>
                ) : null}
                {isActive ? <Check className="h-4 w-4" /> : null}
              </DropdownMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`Theme options for ${option.label}`}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-44">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onThemeDefault(option.id);
                    }}
                  >
                    Set as default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShellMenu({ descriptor }: { readonly descriptor: MenuDescriptor }) {
  return (
    <MenubarMenu>
      <MenubarTrigger>{descriptor.label}</MenubarTrigger>
      <MenubarContent>
        {descriptor.items.map((item, index) => {
          if (item.type === "separator") return <MenubarSeparator key={`${descriptor.label}-sep-${index}`} />;
          return (
            <MenubarItem key={`${descriptor.label}-item-${index}`} className="flex items-center justify-between gap-4">
              <span>{item.label}</span>
            </MenubarItem>
          );
        })}
      </MenubarContent>
    </MenubarMenu>
  );
}

function TopBarSearch() {
  return (
    <div className="relative hidden w-64 md:block lg:w-72">
      <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Search files, vectors, DB, MCP…"
        className="h-9 w-full rounded-lg pl-8 pr-3"
      />
    </div>
  );
}

function presetLabel(preset: LayoutPreset): string {
  switch (preset) {
    case "studio":
      return "Studio";
    case "analysis":
      return "Analysis";
    case "focus":
      return "Focus";
    default:
      return preset;
  }
}
