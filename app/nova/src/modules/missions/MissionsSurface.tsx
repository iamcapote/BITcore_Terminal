/**
 * @license INTERNAL ONLY — Missions surface
 *
 * Contract
 * Inputs:
 *   - MissionsProvider state (missions, scheduler, loading flags, mutation handlers)
 * Outputs:
 *   - Nova layout showing scheduler status, quick actions, kanban columns, and activity feed backed by live data
 * Error modes:
 *   - Displays inline error banners; does not throw from render path
 * Performance:
 *   - Renders at most a few hundred missions; memoized selectors prevent re-sorting unless inputs change
 * Side effects:
 *   - Dispatches HTTP-backed actions through MissionsProvider handlers when buttons are pressed
 *
 * Why: Present the mission scheduler state with actionable controls connected to the backend.
 * What: Wraps the MissionsProvider, renders scheduler insights, mission kanban, and recent activity using real missions.
 * How: Consume provider context, show loading placeholders, and route user actions to the mission client.
 */

import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MissionsProvider, useMissions } from "@/modules/missions/MissionsProvider";
import {
  formatMissionSchedule,
  formatRelativeTimestamp,
  missionPriorityTone,
  resolveStatusTone,
  type MissionColumnView,
} from "@/modules/missions/missionViewModel";
import type { Mission, SchedulerState } from "@/modules/missions/missionsClient";
import { AlertCircle, AlarmClock, CheckCircle2, Loader2, Pause, Play, RefreshCw, Target } from "lucide-react";

export function MissionsSurface(): JSX.Element {
  return (
    <MissionsProvider>
      <MissionsContent />
    </MissionsProvider>
  );
}

function MissionsContent(): JSX.Element {
  const {
    missionsStatus,
    missionsError,
  scheduler,
    schedulerStatus,
    schedulerError,
    pendingMissionIds,
    pendingSchedulerAction,
    lastActionMessage,
    actionError,
  totals,
    columns,
    activity,
    refreshMissions,
    refreshScheduler,
    runMission,
    startScheduler,
    stopScheduler,
    triggerScheduler,
  } = useMissions();

  const schedulerLabel = scheduler
    ? scheduler.running
      ? "Running"
      : scheduler.schedulerEnabled
        ? "Idle"
        : "Stopped"
    : "Unknown";

  const schedulerVariant: "default" | "secondary" | "outline" = scheduler
    ? scheduler.running
      ? "default"
      : scheduler.schedulerEnabled
        ? "outline"
        : "secondary"
    : "secondary";

  const isMissionsLoading = missionsStatus === "loading";
  const isSchedulerLoading = schedulerStatus === "loading";
  const hasMissions = columns.some((column) => column.missions.length > 0);

  const totalsSummary = useMemo(
    () => [
      { label: "Total", value: totals.total.toString() },
      { label: "Running", value: totals.running.toString() },
      { label: "Attention", value: totals.attention.toString() },
      { label: "Queued", value: totals.queued.toString() },
    ],
    [totals],
  );

  const handleRefreshAll = useCallback(() => {
    return Promise.all([refreshMissions(), refreshScheduler()]).then(() => undefined).catch(() => undefined);
  }, [refreshMissions, refreshScheduler]);

  const quickActions = useMemo(
    () => [
      {
        id: "refresh-missions",
        label: "Refresh missions",
        onClick: () => refreshMissions().catch(() => undefined),
        icon: RefreshCw,
        pending: isMissionsLoading,
      },
      {
        id: "refresh-scheduler",
        label: "Refresh scheduler",
        onClick: () => refreshScheduler().catch(() => undefined),
        icon: RefreshCw,
        pending: isSchedulerLoading,
      },
      {
        id: "trigger-tick",
        label: "Trigger tick",
        onClick: () => triggerScheduler().catch(() => undefined),
        icon: Play,
        pending: pendingSchedulerAction === "tick",
      },
    ],
    [refreshMissions, isMissionsLoading, refreshScheduler, isSchedulerLoading, triggerScheduler, pendingSchedulerAction],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlarmClock className="h-4 w-4" /> Scheduler
              </CardTitle>
              <Badge variant={schedulerVariant} className="text-[10px] uppercase tracking-[0.2em]">
                {schedulerLabel}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoBlock label="Last tick" value={formatTimestamp(scheduler?.lastTickCompletedAt ?? scheduler?.lastTickStartedAt)} />
                <InfoBlock label="Cadence" value={formatSchedulerCadence(scheduler)} />
                <InfoBlock label="Active runs" value={scheduler ? scheduler.activeRuns.toString() : "0"} />
                <InfoBlock label="Telemetry" value={scheduler?.telemetryEnabled ? "Enabled" : "Disabled"} />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {totalsSummary.map((entry) => (
                  <InfoBlock key={entry.label} label={entry.label} value={entry.value} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-w-[140px] justify-center"
                  disabled={pendingSchedulerAction === "start" || scheduler?.running === true}
                  onClick={() => startScheduler().catch(() => undefined)}
                >
                  {pendingSchedulerAction === "start" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Start scheduler
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-w-[140px] justify-center"
                  disabled={pendingSchedulerAction === "stop" || scheduler?.running === false}
                  onClick={() => stopScheduler().catch(() => undefined)}
                >
                  {pendingSchedulerAction === "stop" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}Stop scheduler
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-w-[140px] justify-center"
                  disabled={pendingSchedulerAction === "tick"}
                  onClick={() => triggerScheduler().catch(() => undefined)}
                >
                  {pendingSchedulerAction === "tick" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Trigger tick
                </Button>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Operations</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.id}
                      size="sm"
                      variant="ghost"
                      className="flex-1 min-w-[160px] justify-start font-mono text-[11px] uppercase tracking-[0.2em]"
                      onClick={action.onClick}
                      disabled={action.pending}
                    >
                      {action.pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <action.icon className="mr-2 h-3.5 w-3.5" />} {action.label}
                    </Button>
                  ))}
                </div>
              </div>
              <InlineErrors
                missionsError={missionsError}
                schedulerError={schedulerError}
                actionError={actionError}
                lastActionMessage={lastActionMessage}
              />
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" /> Activity feed
              </CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                {activity.length} entries
              </Badge>
            </CardHeader>
            <CardContent className="text-sm">
              <ScrollArea className="h-60 pr-3">
                <div className="space-y-2">
                  {activity.length === 0 && !isMissionsLoading ? (
                    <EmptyNotice message="No mission activity recorded yet." />
                  ) : null}
                  {activity.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.label}</span>
                        <time>{formatTimestamp(entry.timestamp)}</time>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{entry.summary}</p>
                    </div>
                  ))}
                  {isMissionsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading activity…
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>

        <Separator />

        <section className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {!hasMissions && !isMissionsLoading ? (
            <StartupPlaceholder onRefresh={handleRefreshAll} />
          ) : (
            columns.map((column) => (
              <MissionColumnCard
                key={column.id}
                column={column}
                pendingMissionIds={pendingMissionIds}
                isLoading={isMissionsLoading}
                onRun={(missionId) => runMission(missionId).catch(() => undefined)}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function MissionColumnCard({ column, pendingMissionIds, onRun, isLoading }: { column: MissionColumnView; pendingMissionIds: readonly string[]; onRun: (missionId: string) => void; isLoading: boolean }) {
  const pending = new Set(pendingMissionIds);
  return (
    <Card className="flex min-h-0 flex-col border-border/60 bg-background/70">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm uppercase tracking-[0.2em]">{column.title}</CardTitle>
        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
          {column.missions.length}
        </Badge>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="h-80 pr-3">
          <div className="space-y-3">
            {column.missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} pending={pending.has(mission.id)} onRun={onRun} />
            ))}
            {column.missions.length === 0 && !isLoading ? (
              <EmptyNotice message="No missions in this column." />
            ) : null}
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading missions…
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MissionCard({ mission, pending, onRun }: { mission: Mission; pending: boolean; onRun: (missionId: string) => void }) {
  const priorityTone = missionPriorityTone(mission.priority);
  const statusTone = resolveStatusTone(mission.status);
  const scheduleLabel = mission.schedule ? formatMissionSchedule(mission.schedule) : "Manual";
  const lastRunLabel = formatRelativeTimestamp(mission.lastRunAt ?? mission.updatedAt ?? mission.createdAt);
  return (
    <article className="rounded-xl border border-border/60 bg-background/80 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{mission.name}</span>
        <PriorityPill priority={priorityTone} />
      </div>
      {mission.description ? <p className="mt-2 text-sm text-muted-foreground">{mission.description}</p> : null}
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="uppercase tracking-[0.2em]">Status</dt>
          <dd>
            <Badge variant={statusTone.variant} className={cn("mt-1 text-[10px] uppercase tracking-[0.18em]", statusTone.className)}>
              {statusTone.label}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.2em]">Schedule</dt>
          <dd className="mt-1">{scheduleLabel}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.2em]">Next run</dt>
          <dd className="mt-1">{formatTimestamp(mission.nextRunAt)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.2em]">Last change</dt>
          <dd className="mt-1">{lastRunLabel}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="px-3 text-xs"
          disabled={pending}
          onClick={() => onRun(mission.id)}
        >
          {pending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}Run
        </Button>
      </div>
    </article>
  );
}

function InlineErrors({ missionsError, schedulerError, actionError, lastActionMessage }: { missionsError: string | null; schedulerError: string | null; actionError: string | null; lastActionMessage: string | null }) {
  const entries = (
    [
      missionsError && { type: "error" as const, message: missionsError },
      schedulerError && { type: "error" as const, message: schedulerError },
      actionError && { type: "error" as const, message: actionError },
      lastActionMessage && { type: "success" as const, message: lastActionMessage },
    ].filter(Boolean) as Array<{ type: "error" | "success"; message: string }>
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div
          key={`${entry.type}-${index}`}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
            entry.type === "error" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
          )}
        >
          {entry.type === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {entry.message}
        </div>
      ))}
    </div>
  );
}

function PriorityPill({ priority }: { priority: "low" | "medium" | "high" }) {
  const tone =
    priority === "high"
      ? "bg-red-500/20 text-red-200 border-red-500/60"
      : priority === "medium"
        ? "bg-amber-500/20 text-amber-200 border-amber-500/60"
        : "bg-emerald-500/20 text-emerald-200 border-emerald-500/60";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]", tone)}>
      {priority}
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function StartupPlaceholder({ onRefresh }: { onRefresh: () => void | Promise<void> }) {
  return (
    <Card className="flex min-h-[240px] flex-col items-center justify-center border-border/60 bg-background/70 p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold text-foreground">No missions yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-md text-sm text-muted-foreground">
          The scheduler is online but no missions are registered. Use the command line ({"`mission list`"}) or API to create one, then refresh to see it here.
        </p>
        <Button size="sm" variant="secondary" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh missions
        </Button>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

function formatSchedulerCadence(scheduler: SchedulerState | null): string {
  if (!scheduler) {
    return "—";
  }
  const interval = scheduler.intervalMs;
  if (typeof interval === "number" && interval > 0) {
    if (interval % 60000 === 0) {
      const minutes = Math.round(interval / 60000);
      return `${minutes}m interval`;
    }
    if (interval % 1000 === 0) {
      const seconds = Math.round(interval / 1000);
      return `${seconds}s interval`;
    }
    return `${interval}ms interval`;
  }
  if (scheduler.schedulerEnabled) {
    return "Manual";
  }
  return "Disabled";
}
