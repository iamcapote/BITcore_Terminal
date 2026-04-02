/**
 * Why: Present consolidated runtime telemetry inside Nova without relying on the legacy UI Next shell.
 * What: Renders research progress, token usage, log health, branch metadata in the footer bar.
 * How: Consumes live state from StatusProvider, formats aggregates into lightweight badges.
 */

import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActiveByPlacement, SurfaceState } from "@/modules/layout/layoutTypes";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { useStatus } from "./StatusProvider";
import {
  Activity,
  BarChart3,
  Cpu,
  Database,
  FolderTree,
  Gauge,
  RefreshCw,
  PanelBottom,
  Plug,
  TerminalSquare,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StatusBarProps {
  readonly active: ActiveByPlacement;
  readonly surfaces: SurfaceState[];
}

const MAX_PROGRESS = 100;
const TOKEN_DIVISOR = 1_000;

type LogsSnapshot = ReturnType<typeof useStatus>["logs"];

function formatTokens(value: number): string {
  if (value >= TOKEN_DIVISOR) {
    return `${(value / TOKEN_DIVISOR).toFixed(1)}k`;
  }
  return `${value}`;
}

function getSurfaceLabel(active: ActiveByPlacement["bottom"], surfaces: SurfaceState[]): string {
  if (!active) return "Dock idle";
  const match = surfaces.find((surface) => surface.id === active);
  return match ? `${match.label}` : active;
}

function TelemetrySummary({ stage, progress, updatedAgo }: { readonly stage: string; readonly progress: number; readonly updatedAgo: string }): JSX.Element {

  return (
    <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground lg:flex">
      <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1">
        <Gauge className="h-3 w-3 text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground">{progress}%</span>
        <span aria-hidden="true" className="relative block h-1 w-16 overflow-hidden rounded-full bg-border/50">
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary/80" style={{ width: `${progress}%` }} />
        </span>
      </span>
      <Badge variant="outline" className="flex items-center gap-1 text-[10px] font-semibold">
        <Activity className="h-3 w-3" aria-hidden="true" />
        {stage}
      </Badge>
      <span className="tracking-normal text-muted-foreground/80">{updatedAgo}</span>
    </div>
  );
}

function TokenSummary({ totalTokens, promptTokens, completionTokens }: { readonly totalTokens: number; readonly promptTokens: number; readonly completionTokens: number }): JSX.Element {
  return (
    <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:flex">
      <Badge variant="outline" className="flex items-center gap-1 text-[10px] font-medium">
        <Database className="h-3 w-3" aria-hidden="true" />
        {formatTokens(totalTokens)}
      </Badge>
      <span className="inline-flex items-center gap-1 text-muted-foreground/80">
        P {formatTokens(promptTokens)}
      </span>
      <span className="inline-flex items-center gap-1 text-muted-foreground/80">
        C {formatTokens(completionTokens)}
      </span>
    </div>
  );
}

function LogSummaryBadge({ logs }: { readonly logs: LogsSnapshot }): JSX.Element {
  const hasErrors = logs.error > 0;
  const hasWarnings = logs.warn > 0;
  const variant = hasErrors ? "destructive" : hasWarnings ? "secondary" : "outline";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="flex items-center gap-1 text-[10px] font-medium">
          <BarChart3 className="h-3 w-3" aria-hidden="true" />
          {logs.error}/{logs.warn + logs.error}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <div className="flex flex-col gap-1">
          <span>{logs.total} total entries</span>
          <span>{logs.info} info · {logs.warn} warn · {logs.error} error</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function StatusItem({ icon: Icon, label, hint, className }: { icon: LucideIcon; label: string; hint?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/90", className)}>
          <Icon className="h-3 w-3" aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      {hint ? <TooltipContent className="text-xs">{hint}</TooltipContent> : null}
    </Tooltip>
  );
}

export const StatusBar = memo(function StatusBar({ active, surfaces }: StatusBarProps): JSX.Element {
  const { telemetry, tokenUsage, logs, timeline, refresh } = useStatus();
  const dockLabel = useMemo(() => getSurfaceLabel(active.bottom, surfaces), [active.bottom, surfaces]);
  const progress = Math.min(Math.max(Math.round(telemetry.progressPercent), 0), MAX_PROGRESS);
  const updatedAgo = useRelativeTime(telemetry.updatedAt, { refreshMs: 2000, fallback: "—" });
  const lastCommandAgo = useRelativeTime(timeline.lastCommandAt, { refreshMs: 5000, fallback: "—" });
  const lastCommandHint = timeline.lastCommandAt ? new Date(timeline.lastCommandAt).toLocaleString() : undefined;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(
    async (validate: boolean) => {
      if (refreshing) {
        return;
      }
      setRefreshing(true);
      try {
        await refresh({ validate });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn("[StatusBar] Failed to refresh status:", reason);
      } finally {
        setRefreshing(false);
      }
    },
    [refresh, refreshing],
  );

  const handleRefreshClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const validate = event.shiftKey || event.metaKey || event.altKey;
      event.preventDefault();
      await handleRefresh(validate);
    },
    [handleRefresh],
  );

  return (
    <div className="flex h-9 min-w-0 items-center gap-1 border-t px-2 text-[10px] text-muted-foreground sm:gap-3 sm:px-3 sm:text-[11px]">
      <TelemetrySummary stage={telemetry.stage} progress={progress} updatedAgo={updatedAgo} />
      <TokenSummary totalTokens={tokenUsage.totalTokens} promptTokens={tokenUsage.promptTokens} completionTokens={tokenUsage.completionTokens} />
      <LogSummaryBadge logs={logs} />
      <div className="hidden items-center gap-3 md:flex">
        <StatusItem icon={FolderTree} label={timeline.branch} hint={timeline.branchHint ?? "Git branch"} />
        <StatusItem icon={Timer} label={lastCommandAgo} hint={lastCommandHint ?? "Last CLI command"} />
        <StatusItem icon={Activity} label={timeline.guardrail} hint={timeline.guardrailHint ?? "Research guardrail"} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <StatusItem icon={TerminalSquare} label={dockLabel} hint="Active dock surface" className="max-w-[120px] truncate" />
        <StatusItem icon={Plug} label={timeline.remote} hint={timeline.remoteHint ?? "Remote sync"} className="hidden sm:inline-flex" />
        <StatusItem icon={Cpu} label="Agent runtime" hint="Runtime status" className="hidden md:inline-flex" />
        <StatusItem icon={PanelBottom} label={timeline.gpuStatus} hint={timeline.gpuHint ?? "Compute status"} className="hidden lg:inline-flex" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleRefreshClick}
              aria-label="Refresh status"
              aria-busy={refreshing}
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            <span>Refresh status</span>
            <br />
            <span>Shift+Click to validate GitHub</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});
