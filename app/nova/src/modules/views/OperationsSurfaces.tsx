/**
 * @license INTERNAL ONLY — Operations surfaces
 *
 * Why: Present mission control, task orchestration, and terminal supervision inside the Nova dock with live terminal wiring.
 * What: Renders automation instruments, a mission-backed kanban, and a command console bound to the WebComm-backed terminal context.
 * How: Read instrument metadata from mock scaffolding, project real missions into kanban columns via MissionsProvider, and stream terminal events through the terminal context.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  Play,
  RefreshCw,
  TerminalSquare,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { instruments } from "@/modules/data/mockWorkspace";
import { TerminalConsole, TerminalShortcutBar } from "@/modules/terminal/Terminal";
import { useStatus } from "@/modules/status/StatusProvider";
import { MissionsProvider, useMissions } from "@/modules/missions/MissionsProvider";
import {
  formatMissionSchedule,
  formatRelativeTimestamp,
  resolveStatusTone,
  type MissionColumnView,
} from "@/modules/missions/missionViewModel";
import type { Mission } from "@/modules/missions/missionsClient";

export function InstrumentsSurface() {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Automation Instruments</h2>
          <p className="text-xs text-muted-foreground/80">Compose reusable task chains and run them directly from the dock.</p>
        </div>
        <Button size="sm" variant="secondary">
          <ClipboardList className="mr-1 h-4 w-4" /> New instrument
        </Button>
      </header>
      <ScrollArea className="grow rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="space-y-3">
          {instruments.map((instrument) => (
            <Card key={instrument.id} className="border-border/60 bg-background/80">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{instrument.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Ready</Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">{instrument.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <code className="rounded-md bg-muted px-2 py-1 text-xs">{instrument.command}</code>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Authed runners • dry-run enforced</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary">
                    <ArrowRight className="mr-1 h-4 w-4" /> Queue
                  </Button>
                  <Button size="sm" variant="ghost">
                    <RefreshCw className="mr-1 h-4 w-4" /> Clone
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function TasksSurface() {
  return (
    <MissionsProvider>
      <TasksContent />
    </MissionsProvider>
  );
}

function TasksContent(): JSX.Element {
  const {
    columns,
    missionsStatus,
    missionsError,
    pendingMissionIds,
    runMission,
    refreshMissions,
    lastMissionsUpdatedAt,
  } = useMissions();

  const isLoading = missionsStatus === "loading";
  const pending = new Set(pendingMissionIds);
  const lastUpdatedLabel = lastMissionsUpdatedAt
    ? formatRelativeTimestamp(new Date(lastMissionsUpdatedAt).toISOString())
    : null;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Mission Tasks</h2>
          <p className="text-xs text-muted-foreground/80">Track mission readiness, dispatch runs, and surface items requiring attention.</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedLabel ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
              Updated {lastUpdatedLabel}
            </Badge>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => refreshMissions().catch(() => undefined)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Refresh
          </Button>
        </div>
      </header>
      {missionsError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {missionsError}
        </div>
      ) : null}
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column) => (
          <TaskColumn
            key={column.id}
            column={column}
            isLoading={isLoading}
            pendingMissionIds={pending}
            onRun={(missionId) => runMission(missionId).catch(() => undefined)}
          />
        ))}
      </div>
    </div>
  );
}

export function TerminalSurface() {
  const { timeline } = useStatus();

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Command Console</h2>
          <p className="text-xs text-muted-foreground/80">Run Bitcore tasks, observe guardrails, and inspect the live stream.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TerminalSquare className="h-3.5 w-3.5" /> {timeline.branch}
          </span>
          <span>•</span>
          <span>{timeline.gpuStatus}</span>
          <span>•</span>
          <span>{timeline.guardrail}</span>
        </div>
      </header>
      <TerminalConsole className="flex-1" focusInputOnMount />
      <TerminalShortcutBar />
    </div>
  );
}

function TaskColumn({ column, pendingMissionIds, onRun, isLoading }: { column: MissionColumnView; pendingMissionIds: ReadonlySet<string>; onRun: (missionId: string) => void; isLoading: boolean }) {
  return (
    <Card className="flex min-h-0 flex-col border-border/60 bg-background/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm uppercase tracking-[0.2em]">
          <span>{column.title}</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">{column.missions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1">
        <ScrollArea className="h-80 pr-2">
          <div className="space-y-2">
            {column.missions.map((mission) => (
              <TaskCard key={mission.id} mission={mission} pending={pendingMissionIds.has(mission.id)} onRun={onRun} />
            ))}
            {column.missions.length === 0 && !isLoading ? <EmptyNotice message="No missions in this column." /> : null}
            {isLoading ? <LoadingNotice /> : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TaskCard({ mission, pending, onRun }: { mission: Mission; pending: boolean; onRun: (missionId: string) => void }) {
  const statusTone = resolveStatusTone(mission.status);
  const nextRunLabel = formatRelativeTimestamp(mission.nextRunAt);
  const lastRunLabel = formatRelativeTimestamp(mission.lastRunAt ?? mission.lastFinishedAt ?? mission.updatedAt ?? mission.createdAt);
  const scheduleLabel = formatMissionSchedule(mission.schedule ?? null);

  return (
    <article className="rounded-xl border border-border/60 bg-background/80 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 text-xs font-semibold text-foreground">
        <span>{mission.name}</span>
        <Badge variant={statusTone.variant} className={cn("text-[10px] uppercase tracking-[0.18em]", statusTone.className)}>
          {statusTone.label}
        </Badge>
      </div>
      {mission.description ? <p className="mt-2 text-xs text-muted-foreground">{mission.description}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <div>
          <dt>Next Run</dt>
          <dd className="mt-1 text-[12px] font-medium normal-case tracking-normal text-foreground">{nextRunLabel}</dd>
        </div>
        <div>
          <dt>Last Event</dt>
          <dd className="mt-1 text-[12px] font-medium normal-case tracking-normal text-foreground">{lastRunLabel}</dd>
        </div>
        <div className="col-span-2">
          <dt>Schedule</dt>
          <dd className="mt-1 text-[12px] font-medium normal-case tracking-normal text-foreground">{scheduleLabel}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.18em]">Priority {mission.priority ?? 0}</span>
        <Button size="sm" variant="ghost" className="px-3 text-xs" disabled={pending} onClick={() => onRun(mission.id)}>
          {pending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}Run
        </Button>
      </div>
    </article>
  );
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function LoadingNotice() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading missions…
    </div>
  );
}
