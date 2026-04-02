/**
 * Why: Left rail navigation surfaces with collapsible grouped sections.
 * What: Renders surface list grouped by taxonomy (core/agents/tools/system),
 *       each section collapsible, with placement controls and layout mode toggles.
 * How: Groups surfaces via GROUP_ORDER, tracks collapsed state per group via useState Set,
 *       renders expanded or icon-only rail depending on panel collapse state.
 */

import { Fragment, useMemo, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActiveByPlacement, Placement, SurfaceGroup, SurfaceState } from "@/modules/layout/layoutTypes";
import type { LayoutPreset } from "@/stores/uiStore";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Focus,
  LayoutGrid,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Props ─────────────────────────────────────────────────────────── */

export interface LeftRailProps {
  readonly surfaces: SurfaceState[];
  readonly active: ActiveByPlacement;
  readonly collapsed?: boolean;
  readonly onActivate: (id: SurfaceState["id"]) => void;
  readonly onPlacementChange: (id: SurfaceState["id"], placement: Placement) => void;
  readonly layoutPreset?: LayoutPreset;
  readonly onLayoutPresetChange?: (preset: LayoutPreset) => void;
  readonly onReorder?: (id: SurfaceState["id"], direction: "forward" | "backward") => void;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const placementLabels: Record<Exclude<Placement, "hidden">, string> = {
  primary: "Move to Studio",
  bottom: "Move to Dock",
  right: "Move to Wing",
};

const GROUP_ORDER: Record<SurfaceGroup, number> = {
  core: 0,
  agents: 1,
  tools: 2,
  system: 4,
};

const GROUP_LABELS: Record<SurfaceGroup, string> = {
  core: "Core",
  agents: "AGENTS",
  tools: "Tools",
  system: "System",
};

const COLLAPSED_GROUPS_STORAGE_KEY = "nova.leftRail.collapsedGroups.v1";

function loadCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    const values = parsed.filter((value): value is string => typeof value === "string");
    return new Set(values);
  } catch {
    return new Set();
  }
}

function persistCollapsedGroups(next: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify([...next]));
}

export function LeftRail({ surfaces, active, collapsed = false, onActivate, onPlacementChange, layoutPreset, onLayoutPresetChange, onReorder }: LeftRailProps) {
  /* Track which groups are collapsed in the expanded rail */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => loadCollapsedGroups());
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      persistCollapsedGroups(next);
      return next;
    });
  }, []);

  /* Sort surfaces into ordered groups, preserving registry order within each group */
  const orderedGroups = useMemo(() => {
    const buckets = surfaces.reduce<Record<string, SurfaceState[]>>((acc, surface) => {
      if (!acc[surface.group]) acc[surface.group] = [];
      acc[surface.group].push(surface);
      return acc;
    }, {});

    return Object.entries(buckets)
      .map(([groupId, members]) => ({ groupId: groupId as SurfaceGroup, members }))
      .sort((a, b) => {
        const rankA = GROUP_ORDER[a.groupId] ?? 99;
        const rankB = GROUP_ORDER[b.groupId] ?? 99;
        return rankA - rankB;
      });
  }, [surfaces]);

  const surfaceBadges = useMemo<Partial<Record<SurfaceState["id"], string>>>(() => ({}), []);

  const activeSurfaceIds = useMemo(
    () => new Set(Object.values(active).filter(Boolean) as SurfaceState["id"][]),
    [active],
  );

  const showVectorStores = activeSurfaceIds.has("vectors");
  const showDatabaseConnections = activeSurfaceIds.has("databases");
  const showMcpServers = activeSurfaceIds.has("mcp");
  const showWorkspaceInsights = activeSurfaceIds.has("explorer");

  const extraSections = (
    [
      showVectorStores && { key: "vectors", element: <VectorStoresSection /> },
      showDatabaseConnections && { key: "databases", element: <DatabaseConnectionsSection /> },
      showMcpServers && { key: "mcp", element: <McpServersSection /> },
      showWorkspaceInsights && { key: "workspace-summary", element: <WorkspaceSummarySection /> },
      showWorkspaceInsights && { key: "workspace-files", element: <WorkspaceFilesSection /> },
    ].filter(Boolean) as Array<{ key: string; element: JSX.Element }>
  );

  /* ── Collapsed icon rail ───────────────────────────────────────── */
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1 py-2">
        {/* Layout preset toggles */}
        {layoutPreset && onLayoutPresetChange && (
          <div className="flex flex-col items-center gap-1 pb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant={layoutPreset === "studio" ? "default" : "ghost"} className="h-7 w-7 rounded-md" onClick={() => onLayoutPresetChange("studio")} aria-label="Studio mode">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Studio</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant={layoutPreset === "analysis" ? "default" : "ghost"} className="h-7 w-7 rounded-md" onClick={() => onLayoutPresetChange("analysis")} aria-label="Analysis mode">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Analysis</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant={layoutPreset === "focus" ? "default" : "ghost"} className="h-7 w-7 rounded-md" onClick={() => onLayoutPresetChange("focus")} aria-label="Focus mode">
                  <Focus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Focus</TooltipContent>
            </Tooltip>
            <Separator className="my-0.5 w-5" />
          </div>
        )}
        {/* Surface icons grouped with thin separators */}
        {orderedGroups.map(({ groupId, members }, groupIdx) => (
          <Fragment key={groupId}>
            {groupIdx > 0 && <Separator className="my-0.5 w-5" />}
            {members.map((surface) => {
              const Icon = surface.icon;
              const isActive = [active.primary, active.bottom, active.right].includes(surface.id);
              const isHidden = surface.placement === "hidden";
              return (
                <Tooltip key={surface.id}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant={isActive ? "default" : "ghost"}
                      className="h-7 w-7 rounded-md"
                      onClick={() => onActivate(surface.id)}
                      aria-pressed={isActive}
                    >
                      <Icon className={cn("h-3.5 w-3.5", isHidden && "opacity-40")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{surface.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </Fragment>
        ))}
      </div>
    );
  }

  /* ── Expanded rail with collapsible groups ──────────────────────── */
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
      {/* Layout preset toggle row */}
      {layoutPreset && onLayoutPresetChange && (
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mr-auto">Mode</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant={layoutPreset === "studio" ? "default" : "ghost"} className="h-6 px-2 text-[10px]" onClick={() => onLayoutPresetChange("studio")}>
                <LayoutGrid className="mr-1 h-3 w-3" />Studio
              </Button>
            </TooltipTrigger>
            <TooltipContent>Studio: all panels visible</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant={layoutPreset === "analysis" ? "default" : "ghost"} className="h-6 px-2 text-[10px]" onClick={() => onLayoutPresetChange("analysis")}>
                <Eye className="mr-1 h-3 w-3" />Analysis
              </Button>
            </TooltipTrigger>
            <TooltipContent>Analysis: dock hidden</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant={layoutPreset === "focus" ? "default" : "ghost"} className="h-6 px-2 text-[10px]" onClick={() => onLayoutPresetChange("focus")}>
                <Focus className="mr-1 h-3 w-3" />Focus
              </Button>
            </TooltipTrigger>
            <TooltipContent>Focus: all chrome collapsed</TooltipContent>
          </Tooltip>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="space-y-1 py-2">
          {orderedGroups.map(({ groupId, members }) => {
            const isGroupCollapsed = collapsedGroups.has(groupId);
            const activeCount = members.filter((s) => activeSurfaceIds.has(s.id)).length;
            return (
              <div key={groupId}>
                {/* Collapsible group header */}
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:bg-accent/50 transition-colors"
                  onClick={() => toggleGroup(groupId)}
                >
                  {isGroupCollapsed
                    ? <ChevronRight className="h-3 w-3 shrink-0" />
                    : <ChevronDown className="h-3 w-3 shrink-0" />}
                  <span className="flex-1 text-left">{GROUP_LABELS[groupId]}</span>
                  {isGroupCollapsed && activeCount > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-[1rem] px-1 text-[9px] leading-none">
                      {activeCount}
                    </Badge>
                  )}
                </button>
                {/* Group members with animated reveal */}
                {!isGroupCollapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {members.map((surface) => (
                      <SurfaceRow
                        key={surface.id}
                        surface={surface}
                        onActivate={onActivate}
                        onPlacementChange={onPlacementChange}
                        onReorder={onReorder}
                        badge={surfaceBadges[surface.id]}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {extraSections.map((section) => (
          <Fragment key={section.key}>
            <Separator className="my-4" />
            {section.element}
          </Fragment>
        ))}
      </ScrollArea>
    </div>
  );
}

interface SurfaceRowProps {
  readonly surface: SurfaceState;
  readonly onActivate: LeftRailProps["onActivate"];
  readonly onPlacementChange: LeftRailProps["onPlacementChange"];
  readonly onReorder?: LeftRailProps["onReorder"];
  readonly badge?: string;
}

function SurfaceRow({ surface, onActivate, onPlacementChange, onReorder, badge }: SurfaceRowProps) {
  const Icon = surface.icon;

  return (
    <DropdownMenu>
      <div className="group/row relative">
        <Button
          key={surface.id}
          variant="ghost"
          className={cn(
            "flex w-full items-center justify-start gap-2 rounded-lg px-2 py-1.5 pr-9 text-sm",
            surface.placement !== "hidden" && "bg-accent text-accent-foreground",
          )}
          onClick={() => onActivate(surface.id)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{surface.label}</span>
          {badge ? (
            <Badge variant="outline" className="ml-1 flex-shrink-0 px-1.5 text-[10px] uppercase">
              {badge}
            </Badge>
          ) : null}
        </Button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover/row:opacity-100 hover:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-48">
          {(Object.keys(placementLabels) as Array<Exclude<Placement, "hidden">>).map((placementKey) => (
            <DropdownMenuItem
              key={placementKey}
              className="flex items-center gap-2"
              onClick={() => onPlacementChange(surface.id, placementKey)}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground",
                  surface.placement === placementKey ? "opacity-100" : "opacity-0",
                )}
              />
              <span>{placementLabels[placementKey]}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onPlacementChange(surface.id, "hidden")}>
            Hide from workspace
          </DropdownMenuItem>
          {onReorder && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReorder(surface.id, "backward")}>
                <ArrowUp className="mr-2 h-3.5 w-3.5" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReorder(surface.id, "forward")}>
                <ArrowDown className="mr-2 h-3.5 w-3.5" /> Move down
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

function VectorStoresSection() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Vector Spaces</p>
      <p className="px-2 text-xs text-muted-foreground">No vector stores connected. Configure in Settings.</p>
    </section>
  );
}

function DatabaseConnectionsSection() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Databases</p>
      <p className="px-2 text-xs text-muted-foreground">No database connections configured.</p>
    </section>
  );
}
function McpServersSection() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">MCP Servers</p>
      <p className="px-2 text-xs text-muted-foreground">No MCP servers registered.</p>
    </section>
  );
}

function WorkspaceSummarySection() {
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-widest text-muted-foreground">Workspace</span>
      </div>
      <p className="text-muted-foreground">Open a project folder to explore workspace files.</p>
    </section>
  );
}

function WorkspaceFilesSection() {
  return (
    <section className="pb-8">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Files</p>
      <p className="px-2 text-xs text-muted-foreground">No workspace folder open.</p>
    </section>
  );
}

/* End of file — helper sections above */
