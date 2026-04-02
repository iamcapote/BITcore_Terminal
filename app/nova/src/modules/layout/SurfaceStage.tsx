/**
 * Why: Render a tabbed surface stage with toolbar actions, split views, and wiring status indicators.
 * What: SurfaceStage displays tabs for placed surfaces, resolves the active component, renders split panes, and shows wiring badges.
 * How: Receive surfaces from the shell, look up components from the registry, and compose resizable panels for split modes.
 */

import { Suspense } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SURFACE_COMPONENTS } from "@/modules/layout/surfaceRegistry";
import type { SurfaceId, SurfaceState, WiringStatus } from "@/modules/layout/layoutTypes";
import type { SplitMode, SurfaceStageAction } from "@/modules/layout/shellTypes";
import { useContainerBreakpoint, bpLte } from "@/hooks/useResponsive";
import { ChevronLeft, ChevronRight, PanelBottom, PanelRight, X } from "lucide-react";

/* ── Props ─────────────────────────────────────────────────────────── */

export interface SurfaceStageProps {
  readonly label: string;
  readonly surfaces: SurfaceState[];
  readonly activeId: SurfaceId | null;
  readonly onSelect: (id: SurfaceId) => void;
  readonly onClose?: (id: SurfaceId) => void;
  readonly toolbarActions?: SurfaceStageAction[];
  readonly splitMode?: SplitMode;
  readonly onReorder?: (id: SurfaceId, direction: "forward" | "backward") => void;
  readonly placement: "primary" | "right" | "bottom";
  readonly collapsed?: boolean;
  readonly onExpand?: () => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function SurfaceStage({
  label,
  surfaces,
  activeId,
  onSelect,
  onClose,
  toolbarActions = [],
  splitMode = "single",
  onReorder,
  placement,
  collapsed = false,
  onExpand,
}: SurfaceStageProps) {
  const [containerRef, containerBp] = useContainerBreakpoint<HTMLDivElement>();
  const isCompact = bpLte(containerBp, "sm");
  const ActiveComponent = activeId ? SURFACE_COMPONENTS[activeId] : null;
  const activeSurface = activeId ? surfaces.find((s) => s.id === activeId) ?? null : null;
  const activeStatus = activeSurface?.wiringStatus ?? null;
  const stageStatusClass = wiringStatusClass(activeStatus);
  const activeStatusBadge = wiringBadge(activeStatus);
  const activeIndex = activeId ? surfaces.findIndex((s) => s.id === activeId) : -1;
  const canMoveBackward = activeIndex > 0;
  const canMoveForward = activeIndex > -1 && activeIndex < surfaces.length - 1;

  /* ── Collapsed state (responsive) ──────────────────────────────── */

  if (collapsed) {
    const ExpandIcon = placement === "right" ? PanelRight : PanelBottom;
    return (
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 items-center justify-center gap-1 transition-all duration-200",
          stageStatusClass,
          placement === "right" && "flex-col gap-1 py-2",
          placement === "bottom" && "flex-row flex-wrap gap-1 px-2",
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

  /* ── Expanded panes ──────────────────────────────────────────────── */

  const primaryPane = ActiveComponent ? <Suspense fallback={<StagePlaceholder label={`Loading ${label}…`} />}><ActiveComponent /></Suspense> : <StagePlaceholder label={label} />;
  const secondaryIndex = surfaces.length > 1 ? (activeIndex > -1 ? (activeIndex + 1) % surfaces.length : 1) : -1;
  const secondarySurface = secondaryIndex > -1 ? surfaces[secondaryIndex] : null;
  const SecondaryComponent = secondarySurface ? SURFACE_COMPONENTS[secondarySurface.id] : null;
  const secondaryPane = SecondaryComponent ? <Suspense fallback={<StagePlaceholder label={`Loading ${label} secondary…`} />}><SecondaryComponent /></Suspense> : <StagePlaceholder label={`${label} secondary`} />;

  const primaryShell = (
    <div className={cn("h-full min-h-0 min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/40", stageStatusClass)}>
      {primaryPane}
    </div>
  );

  const secondaryShell = (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col rounded-md border border-border/60 bg-background/30", wiringStatusClass(secondarySurface?.wiringStatus))}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="font-semibold">{secondarySurface?.label ?? "Secondary View"}</span>
        <Badge variant="outline" className="text-[9px] uppercase">Preview</Badge>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-auto">{secondaryPane}</div>
    </div>
  );

  /* ── Split body ──────────────────────────────────────────────────── */

  let body: JSX.Element;
  if (splitMode === "horizontal") {
    body = (
      <PanelGroup direction="vertical" className="min-h-0 min-w-0">
        <Panel defaultSize={65} minSize={35} className="min-h-0 min-w-0 p-2">{primaryShell}</Panel>
        <PanelResizeHandle className="h-1 bg-border/60" />
        <Panel defaultSize={35} minSize={20} className="min-h-0 min-w-0 p-2">{secondaryShell}</Panel>
      </PanelGroup>
    );
  } else if (splitMode === "vertical") {
    body = (
      <PanelGroup direction="horizontal" className="min-h-0 min-w-0">
        <Panel defaultSize={65} minSize={35} className="min-h-0 min-w-0 p-2">{primaryShell}</Panel>
        <PanelResizeHandle className="w-1 bg-border/60" />
        <Panel defaultSize={35} minSize={20} className="min-h-0 min-w-0 p-2">{secondaryShell}</Panel>
      </PanelGroup>
    );
  } else {
    body = <div className="h-full min-w-0 p-3">{primaryShell}</div>;
  }

  /* ── Stage chrome ────────────────────────────────────────────────── */

  return (
    <div ref={containerRef} className="flex h-full min-h-0 min-w-0 flex-col">
      <div className={cn(
        "flex min-h-[44px] min-w-0 items-center gap-1 border-b px-2 py-2 text-xs uppercase tracking-widest text-muted-foreground",
        isCompact && "flex-wrap gap-y-1 min-h-[36px] px-1",
      )}>
        <span className="flex-shrink-0" title={label}>{isCompact ? label.slice(0, 3) : label}</span>
        {!isCompact && activeStatusBadge}
        <div className={cn(
          "flex flex-1 min-w-0 items-center gap-1 overflow-x-auto",
          isCompact ? "pb-0" : "pb-1",
        )}>
          {surfaces.map((surface) => (
            <div key={surface.id} className="group relative flex flex-shrink-0 items-center">
              <Button
                className={cn(
                  "h-8 flex-shrink-0 text-[11px] uppercase tracking-tight",
                  "whitespace-nowrap text-ellipsis overflow-hidden",
                  isCompact ? "h-7 px-1.5 pr-6 max-w-[100px]" : "px-2 pr-7",
                  wiringStatusClass(surface.wiringStatus),
                )}
                size="sm"
                variant={surface.id === activeId ? "default" : "outline"}
                onClick={() => onSelect(surface.id)}
                title={surface.label}
              >
                <surface.icon className={cn("mr-1 h-3.5 w-3.5 flex-shrink-0", isCompact && "mr-0.5 h-3 w-3")} />
                {isCompact ? null : surface.label}
              </Button>
              {onClose && (
                <button
                  type="button"
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-sm",
                    "text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100",
                    surface.id === activeId && "opacity-60",
                    isCompact && "right-0.5 h-4 w-4",
                  )}
                  onClick={(e) => { e.stopPropagation(); onClose(surface.id); }}
                  aria-label={`Close ${surface.label}`}
                >
                  <X className={cn("h-3 w-3", isCompact && "h-2.5 w-2.5")} />
                </button>
              )}
            </div>
          ))}
        </div>
        {(onReorder || toolbarActions.length > 0) && (
          <div className={cn(
            "ml-auto flex flex-shrink-0 items-center gap-1",
            isCompact && "gap-0.5",
          )}>
            {onReorder && activeId && surfaces.length > 1 && !isCompact && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={() => onReorder(activeId, "backward")} aria-label="Move tab backward" disabled={!canMoveBackward} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move left</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={() => onReorder(activeId, "forward")} aria-label="Move tab forward" disabled={!canMoveForward} className="h-8 w-8">
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
                  <Button size="icon" variant={action.active ? "default" : "ghost"} onClick={action.onSelect} aria-label={action.label} aria-pressed={action.active ?? false} className={cn("h-8 w-8", isCompact && "h-7 w-7")}>
                    <action.icon className={cn("h-4 w-4", isCompact && "h-3.5 w-3.5")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{body}</div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

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
      <Badge variant="destructive" className="ml-2 hidden flex-shrink-0 items-center px-2 py-0 text-[9px] font-semibold uppercase tracking-[0.2em] md:inline-flex">
        Unwired
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="secondary" className="ml-2 hidden flex-shrink-0 items-center px-2 py-0 text-[9px] font-semibold uppercase tracking-[0.2em] md:inline-flex">
        Partial
      </Badge>
    );
  }
  return null;
}
