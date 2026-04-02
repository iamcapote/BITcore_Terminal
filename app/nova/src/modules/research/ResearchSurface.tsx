/**
 * @license INTERNAL ONLY — Research surface
 *
 * Why: Present live research telemetry inside Nova so operators can track progress without relying on the legacy dashboard.
 * What: Visualizes status, progress, thoughts, suggestions, recent reports, and repository activity sourced from ResearchProvider.
 * How: Consumes the research context, derives lightweight metrics, and renders responsive cards aligned with Studio layout guidelines.
 */

import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BookOpen, CheckCircle2, ClipboardList, Flame, Loader2, RefreshCw } from "lucide-react";
import { useResearch } from "@/modules/research/ResearchProvider";
import { ResearchPreferencesPanel } from "@/modules/research/ResearchPreferencesPanel";
import { useStatus } from "@/modules/status/StatusProvider";

export function ResearchSurface(): JSX.Element {
  const { summary, status, progress, thoughts, suggestions, reports, memory, github } = useResearch();
  const { tokenUsage, refresh } = useStatus();

  const handleRefresh = useCallback(() => {
    refresh({ validate: true }).catch(() => undefined);
  }, [refresh]);

  const lastUpdatedLabel = summary.lastUpdated ? formatRelativeTime(summary.lastUpdated) : "Awaiting first run";
  const progressStage = progress.status || status.stage;
  const progressPercent = clampPercent(progress.percent);
  const summaryText = summary.summary ?? "";

  const tokenCards = useMemo(
    () => [
      { label: "Total", value: formatTokens(tokenUsage.totalTokens) },
      { label: "Prompt", value: formatTokens(tokenUsage.promptTokens) },
      { label: "Completion", value: formatTokens(tokenUsage.completionTokens) },
    ],
    [tokenUsage.completionTokens, tokenUsage.promptTokens, tokenUsage.totalTokens],
  );

  const githubStats = useMemo(
    () => buildGithubStats(github.aggregate),
    [github.aggregate],
  );

  const checklist = useMemo(
    () => ({
      synthesisFinished: progressPercent >= 80 || summaryText.length > 0,
      draftExported: Boolean(summary.suggestedFilename),
      stakeholderSummary: summaryText.length > 40,
      memoryTagged: memory.records.length > 0,
    }),
    [memory.records.length, progressPercent, summary.suggestedFilename, summaryText],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      <div className="flex w-full min-h-0 min-w-0 flex-col gap-4 p-3 sm:p-4">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Research Dashboard</h1>
              <p className="text-2xl font-semibold text-foreground leading-tight">
                {summary.title || "Active research"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-3 py-1 font-medium uppercase tracking-[0.2em]">
                <ClipboardList className="h-3.5 w-3.5" /> {progressStage || "Idle"}
              </span>
              <span>Last updated {lastUpdatedLabel}</span>
              <Button size="sm" variant="ghost" onClick={handleRefresh}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {summaryText || summary.description || "Run /research to populate live telemetry."}
          </p>
          <p className="text-xs text-muted-foreground/80">
            {summary.lead || (status.detail ?? "Telemetry ready.")}
          </p>
        </header>

        <section className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm">Progress</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                {status.stage}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <ProgressBar value={progressPercent} />
                <div className="grid gap-2 text-xs text-muted-foreground grid-cols-2 sm:grid-cols-4">
                  <Stat label="Stage" value={progressStage || "Idle"} />
                  <Stat label="Depth" value={formatDepth(progress.depth)} />
                  <Stat label="Breadth" value={formatBreadth(progress.breadth)} />
                  <Stat label="Updated" value={progress.lastUpdated ? formatRelativeTime(progress.lastUpdated) : "—"} />
                </div>
              </div>
              <Separator />
              <div className="grid gap-2 sm:grid-cols-3">
                {tokenCards.map((card) => (
                  <TokenCard key={card.label} label={card.label} value={card.value} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm">GitHub activity</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                {github.aggregate.lastTimestamp ? formatRelativeTime(github.aggregate.lastTimestamp) : "No activity"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {githubStats.map((stat) => (
                <div
                  key={stat.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                >
                  <span className="font-medium text-foreground">{stat.label}</span>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{stat.value}</p>
                    <p>{stat.hint}</p>
                  </div>
                </div>
              ))}
              {githubStats.length === 0 ? (
                <p className="text-xs text-muted-foreground">No GitHub telemetry yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid min-h-0 gap-4 grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <Card className="flex min-h-0 flex-col border-border/60 bg-background/70">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm">Active thoughts</CardTitle>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.2em]">
                {thoughts.length} entries
              </Badge>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-3 text-sm">
                  {thoughts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No telemetry thoughts yet.</p>
                  ) : (
                    thoughts.map((thought) => (
                      <article
                        key={thought.id}
                        className="rounded-xl border border-border/60 bg-background/80 p-3"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium uppercase tracking-[0.2em] text-foreground">
                            {thought.stage ? formatStageLabel(thought.stage) : "Insight"}
                          </span>
                          <time>{thought.timestamp ? formatRelativeTime(thought.timestamp) : "just now"}</time>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">{thought.text}</p>
                      </article>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Suggested next actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Memory suggestions will appear when research seeds follow-up prompts.</p>
              ) : (
                suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-xl border border-border/60 bg-background/80 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium uppercase tracking-[0.18em] text-foreground">{suggestion.source}</span>
                      <span>{suggestion.generatedAt ? formatRelativeTime(suggestion.generatedAt) : "recent"}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground leading-relaxed">{suggestion.prompt}</p>
                    {suggestion.focus ? (
                      <p className="mt-1 text-xs text-muted-foreground">Focus: {suggestion.focus}</p>
                    ) : null}
                    {suggestion.tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {suggestion.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="h-5 px-2 text-[10px] uppercase tracking-[0.2em]">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm">Recent reports</CardTitle>
              <Button size="sm" variant="ghost">
                <BookOpen className="mr-1 h-3.5 w-3.5" /> Open library
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {reports.length === 0 ? (
                <p className="text-xs text-muted-foreground">Complete a research run to populate report history.</p>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl border border-border/60 bg-background/80 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold uppercase tracking-[0.18em] text-foreground">{report.title}</span>
                      <StatusPill status={report.status} />
                    </div>
                    <p className="mt-2 text-sm text-foreground">{report.summary}</p>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>Authored {formatDate(report.authoredAt)}</span>
                      <span>Edited {formatDate(report.lastEditedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Report workflow checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ChecklistItem label="Synthesis finished" done={checklist.synthesisFinished} />
              <ChecklistItem label="Draft exported to GitHub" done={checklist.draftExported} />
              <ChecklistItem label="Stakeholder summary updated" done={checklist.stakeholderSummary} />
              <ChecklistItem label="Memory snapshots tagged" done={checklist.memoryTagged} />
            </CardContent>
          </Card>
        </section>

        <section className="max-w-3xl">
          <ResearchPreferencesPanel />
        </section>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { readonly value: number }) {
  const width = clampPercent(value);
  return (
    <div className="relative h-3 w-full rounded-full bg-border/60">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: `${width}%` }}
      />
      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-background">
        {width}%
      </span>
    </div>
  );
}

function TokenCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { readonly status: "draft" | "published" | "failed" }) {
  const palette = resolveStatusPalette(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]",
        palette.className,
      )}
    >
      {palette.icon}
      {palette.label}
    </span>
  );
}

function ChecklistItem({ label, done }: { readonly label: string; readonly done: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs">
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full border",
          done ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200" : "border-border/70 text-muted-foreground",
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
      </span>
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
}

function buildGithubStats(aggregate: { readonly total: number; readonly errors: number; readonly warnings: number; readonly lastAction: string | null; readonly lastMessage: string | null; readonly lastTimestamp: number | null; }): readonly { id: string; label: string; value: string; hint: string }[] {
  if (!aggregate.total && !aggregate.lastMessage) {
    return [];
  }
  return [
    {
      id: "github-events",
      label: "Events",
      value: aggregate.total ? aggregate.total.toString() : "0",
      hint: `${aggregate.errors} errors • ${aggregate.warnings} warnings`,
    },
    {
      id: "github-last-action",
      label: "Last action",
      value: aggregate.lastAction ?? "—",
      hint: aggregate.lastTimestamp ? formatRelativeTime(aggregate.lastTimestamp) : "Awaiting activity",
    },
    {
      id: "github-message",
      label: "Latest message",
      value: aggregate.lastMessage ?? "—",
      hint: aggregate.lastTimestamp ? formatDateTime(aggregate.lastTimestamp) : "",
    },
  ];
}

function formatTokens(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const numeric = Number(value);
  if (numeric >= 10_000) {
    return `${(numeric / 1000).toFixed(1)}k`;
  }
  return numeric.toString();
}

function formatDepth(depth: number | null | undefined): string {
  if (!Number.isFinite(depth)) {
    return "Level —";
  }
  return `Level ${depth}`;
}

function formatBreadth(breadth: number | null | undefined): string {
  if (!Number.isFinite(breadth)) {
    return "—";
  }
  return `${breadth} source${breadth === 1 ? "" : "s"}`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const delta = Math.max(0, now - timestamp);
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }
  const months = Math.round(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }
  const years = Math.round(days / 365);
  return `${years}y ago`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatStageLabel(stage: string): string {
  return stage
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveStatusPalette(status: "draft" | "published" | "failed") {
  if (status === "published") {
    return {
      className: "border-emerald-400/60 text-emerald-300",
      label: "Published",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  if (status === "failed") {
    return {
      className: "border-destructive/70 text-destructive",
      label: "Failed",
      icon: <Flame className="h-3 w-3" />,
    };
  }
  return {
    className: "border-amber-400/60 text-amber-300",
    label: "Draft",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  };
}
