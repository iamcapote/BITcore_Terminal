/**
 * @license INTERNAL ONLY — Left rail navigation (Step 1 shell)
 *
 * Lists every surface in the Nova shell. Each item exposes a placement menu so
 * the operator can move the view between the primary stage, the bottom dock, or
 * the right rail without touching layout code.
 */

import { Fragment, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActiveByPlacement, Placement, SurfaceState } from "@/modules/layout/layoutTypes";
import {
  databaseConnections,
  explorerTree,
  mcpServers,
  quickStats,
  vectorStores,
} from "@/modules/data/mockWorkspace";
import { promptTemplates } from "@/modules/data/mockPrompts";
import { missionColumns } from "@/modules/data/mockMissions";
import { stagedFiles } from "@/modules/data/mockGithub";
import { logEntries } from "@/modules/data/mockLogs";
import {
  BookOpen,
  Check,
  Database,
  Download,
  Layers,
  MoreVertical,
  Play,
  Plug,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExplorerTree } from "@/modules/navigation/ExplorerTree";

export interface LeftRailProps {
  readonly surfaces: SurfaceState[];
  readonly active: ActiveByPlacement;
  readonly collapsed?: boolean;
  readonly onActivate: (id: SurfaceState["id"]) => void;
  readonly onPlacementChange: (id: SurfaceState["id"], placement: Placement) => void;
}

const placementLabels: Record<Exclude<Placement, "hidden">, string> = {
  primary: "Move to Studio",
  bottom: "Move to Dock",
  right: "Move to Wing",
};

const GROUP_ORDER: Record<string, number> = {
  communication: 0,
  operations: 1,
  workspace: 2,
  knowledge: 3,
};

const SURFACE_ORDER: Partial<Record<SurfaceState["id"], number>> = {
  chat: 0,
  terminal: 1,
  tasks: 2,
  missions: 3,
  githubSync: 4,
  logs: 5,
  research: 6,
  prompts: 7,
};

export function LeftRail({ surfaces, active, collapsed = false, onActivate, onPlacementChange }: LeftRailProps) {
  const orderedGroups = useMemo(() => {
    const buckets = surfaces.reduce<Record<string, SurfaceState[]>>((acc, surface) => {
      if (!acc[surface.group]) acc[surface.group] = [];
      acc[surface.group].push(surface);
      return acc;
    }, {});

    return Object.entries(buckets)
      .map(([groupId, members]) => {
        const orderedMembers = [...members].sort((a, b) => {
          const orderA = SURFACE_ORDER[a.id] ?? 99;
          const orderB = SURFACE_ORDER[b.id] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.label.localeCompare(b.label);
        });
        return { groupId, members: orderedMembers };
      })
      .sort((a, b) => {
        const rankA = GROUP_ORDER[a.groupId] ?? 99;
        const rankB = GROUP_ORDER[b.groupId] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.groupId.localeCompare(b.groupId);
      });
  }, [surfaces]);

  const surfaceBadges = useMemo<Partial<Record<SurfaceState["id"], string>>>(
    () => ({
      vectors: vectorStores.length.toString(),
      databases: databaseConnections.length.toString(),
      mcp: mcpServers.length.toString(),
      explorer: countFiles(explorerTree).toString(),
      prompts: promptTemplates.length.toString(),
      missions: missionColumns.reduce((total, column) => total + column.missions.length, 0).toString(),
      githubSync: stagedFiles.length.toString(),
      logs: logEntries.length.toString(),
    }),
    [],
  );

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

  if (collapsed) {
    const flattened = orderedGroups.flatMap(({ members }) => members);
    return (
      <div className="flex h-full flex-col items-center gap-3 py-3">
        <div className="flex flex-col items-center gap-2">
          {flattened.map((surface) => {
            const Icon = surface.icon;
            const isActive = [active.primary, active.bottom, active.right].includes(surface.id);
            const isHidden = surface.placement === "hidden";
            const badge = surfaceBadges[surface.id];
            return (
              <div key={surface.id} className="flex flex-col items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant={isActive ? "default" : "ghost"}
                      className="h-8 w-8 rounded-lg"
                      onClick={() => onActivate(surface.id)}
                      aria-pressed={isActive}
                    >
                      <Icon className={`h-4 w-4 ${isHidden ? "opacity-50" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-col items-start gap-1">
                      <span>{surface.label}</span>
                      {badge ? (
                        <Badge variant="outline" className="px-1.5 text-[10px] uppercase">
                          {badge}
                        </Badge>
                      ) : null}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-2 pt-2 pb-1">
        <Input placeholder="Search files, vectors, DB…" className="h-9" />
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-4 py-2">
          {orderedGroups.map(({ groupId, members }) => (
            <div key={groupId} className="space-y-1">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {toLabel(groupId)}
              </p>
              {members.map((surface) => (
                <SurfaceRow
                  key={surface.id}
                  surface={surface}
                  onActivate={onActivate}
                  onPlacementChange={onPlacementChange}
                  badge={surfaceBadges[surface.id]}
                />
              ))}
            </div>
          ))}
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
  readonly badge?: string;
}

function SurfaceRow({ surface, onActivate, onPlacementChange, badge }: SurfaceRowProps) {
  const Icon = surface.icon;

  return (
    <DropdownMenu>
      <div className="relative">
        <Button
          key={surface.id}
          variant="ghost"
          className={cn(
            "flex w-full items-center justify-start gap-2 rounded-xl px-2.5 py-2 pr-10 text-sm",
            surface.placement !== "hidden" && "bg-accent text-accent-foreground",
          )}
          onClick={() => onActivate(surface.id)}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{surface.label}</span>
          {badge ? (
            <Badge variant="outline" className="ml-2 flex-shrink-0 px-1.5 text-[10px] uppercase">
              {badge}
            </Badge>
          ) : null}
        </Button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
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
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

function countFiles(nodes: typeof explorerTree): number {
  return nodes.reduce((total, node) => {
    if (node.children && node.children.length > 0) {
      return total + countFiles(node.children);
    }
    return total + 1;
  }, 0);
}

function VectorStoresSection() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Vector Spaces</p>
      <div className="space-y-1.5">
        {vectorStores.map((store) => (
          <div
            key={store.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-300" />
              <div className="text-sm">
                <div className="font-medium leading-tight">{store.index}</div>
                <div className="text-xs text-muted-foreground">
                  {store.backend} · {store.dimension}-d · {store.size.toLocaleString()} vectors
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] uppercase">
                {store.status}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Sync ${store.index}`}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sync embeddings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Inspect ${store.index}`}>
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open details</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DatabaseConnectionsSection() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Databases</p>
      <div className="space-y-1.5">
        {databaseConnections.map((connection) => (
          <div
            key={connection.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-300" />
              <div className="text-sm">
                <div className="font-medium leading-tight">{connection.name}</div>
                <div className="text-xs text-muted-foreground">
                  {connection.engine} · {connection.tables} tables
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Run query on ${connection.name}`}>
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Run query</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Export ${connection.name} schema`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export schema</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function McpServersSection() {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">MCP Servers</p>
      <div className="space-y-1.5">
        {mcpServers.map((server) => (
          <div
            key={server.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-sky-300" />
              <div className="text-sm">
                <div className="font-medium leading-tight">{server.name}</div>
                <div className="text-xs text-muted-foreground">
                  {server.endpoints.length} endpoints · {server.status}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Reconnect ${server.name}`}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reconnect</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`View ${server.name} docs`}>
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View documentation</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkspaceSummarySection() {
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-widest text-muted-foreground">Workspace</span>
        <Badge variant="outline" className="uppercase">
          {quickStats.workspaceTag}
        </Badge>
      </div>
      <div className="rounded-lg border border-dashed px-2 py-3 text-muted-foreground">
        {quickStats.terminalHint}
      </div>
    </section>
  );
}

function WorkspaceFilesSection() {
  return (
    <section className="pb-8">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Files</p>
      <ExplorerTree nodes={explorerTree} />
    </section>
  );
}

function toLabel(groupId: string): string {
  switch (groupId) {
    case "workspace":
      return "Workspace";
    case "knowledge":
      return "Knowledge";
    case "operations":
      return "Operations";
    case "communication":
      return "Communication";
    default:
      return groupId;
  }
}
