/**
 * Why: Full-featured memory management panel — the only LIVE-wired knowledge surface.
 * What: Store/recall forms, layer breakdown, telemetry feed, activity log, and recall results.
 * How: Consumes useMemoryTelemetry for real-time state; forms dispatch store/recall operations.
 */

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMemoryTelemetry } from "@/modules/memory/MemoryTelemetryProvider";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";

/* ── Constants ─────────────────────────────────────────────────────── */

const LAYER_OPTIONS = [
  { value: "working", label: "Working — Short" },
  { value: "episodic", label: "Episodic — Medium" },
  { value: "semantic", label: "Semantic — Long" },
];

const DEFAULT_TOTALS = Object.freeze({
  stored: 0,
  retrieved: 0,
  validated: 0,
  summarized: 0,
  ephemeralCount: 0,
  validatedCount: 0,
  layers: 0,
});

/* ── Local type mirrors for provider-internal readonly types ─────── */

interface FeedEntry {
  readonly id: string;
  readonly detail: string | null;
  readonly layer: string | null;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

interface LayerSnapshotEntry {
  readonly layer: string;
  readonly depth?: string;
  readonly githubEnabled?: boolean;
  readonly stored: number;
  readonly retrieved: number;
  readonly validated: number;
  readonly summarized: number;
  readonly ephemeralCount: number;
}

interface RecallEntry {
  readonly id: string;
  readonly layer: string;
  readonly timestamp: string | null;
  readonly content: string;
  readonly tags: readonly string[];
  readonly source?: string | null;
  readonly score?: number | null;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function MemoryManagerSurface() {
  const {
    stats,
    statsStatus,
    statsError,
    lastUpdatedAt,
    activity,
    telemetry,
    recallResults,
    storeState,
    recallState,
    refreshStats,
    storeMemory,
    recallMemory,
    clearResults,
  } = useMemoryTelemetry();

  const [storeForm, setStoreForm] = useState({
    content: "",
    layer: "working",
    source: "",
    tags: "",
    githubEnabled: false,
  });
  const [storeFeedback, setStoreFeedback] = useState<string | null>(null);
  const [recallForm, setRecallForm] = useState({
    query: "",
    layer: "working",
    limit: "5",
    includeShortTerm: true,
    includeLongTerm: true,
    includeMeta: false,
    githubEnabled: false,
  });
  const [recallFeedback, setRecallFeedback] = useState<string | null>(null);

  const totals = stats?.totals ?? DEFAULT_TOTALS;
  const layers = stats?.layers ?? [];
  const summaryItems = [
    { label: "Stored", value: totals.stored },
    { label: "Recalled", value: totals.retrieved },
    { label: "Validated", value: totals.validated },
    { label: "Summarized", value: totals.summarized },
  ];
  const isRefreshing = statsStatus === "loading";
  const storePending = storeState.status === "loading";
  const recallPending = recallState.status === "loading";

  const handleStoreSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = storeForm.content.trim();
    if (!content) {
      setStoreFeedback("Add content before storing the memory.");
      return;
    }
    setStoreFeedback(null);
    const payload = {
      content,
      layer: storeForm.layer || undefined,
      source: storeForm.source.trim() ? storeForm.source.trim() : null,
      tags: parseTagsInput(storeForm.tags),
      githubEnabled: storeForm.githubEnabled,
    };
    const record = await storeMemory(payload);
    if (record) {
      setStoreFeedback("Memory stored successfully.");
      setStoreForm((previous) => ({ ...previous, content: "", source: "", tags: "" }));
    } else {
      setStoreFeedback(storeState.error ?? "Failed to store memory.");
    }
  };

  const handleRecallSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = recallForm.query.trim();
    if (!query) {
      setRecallFeedback("Ask a question or describe what to recall.");
      return;
    }
    setRecallFeedback(null);
    const limitValue = Number.parseInt(recallForm.limit, 10);
    const payload = {
      query,
      layer: recallForm.layer || undefined,
      limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined,
      includeShortTerm: recallForm.includeShortTerm,
      includeLongTerm: recallForm.includeLongTerm,
      includeMeta: recallForm.includeMeta,
      githubEnabled: recallForm.githubEnabled,
    } as const;
    const results = await recallMemory(payload);
    if (results.length === 0) {
      setRecallFeedback(recallState.error ?? "No memories matched that query.");
    }
  };

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-3">
      <div className="flex min-h-0 w-full max-w-6xl flex-col gap-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          {/* ── Left column: overview, layers, telemetry, activity ── */}
          <div className="flex min-h-0 flex-col gap-4">
            <OverviewCard
              summaryItems={summaryItems}
              statsStatus={statsStatus}
              statsError={statsError}
              isRefreshing={isRefreshing}
              lastUpdatedAt={lastUpdatedAt}
              totalLayers={totals.layers}
              onRefresh={() => void refreshStats()}
            />
            <LayerBreakdownCard layers={layers as unknown as ReadonlyArray<LayerSnapshotEntry>} />
            <div className="grid gap-4 lg:grid-cols-2">
              <FeedCard title="Telemetry feed" items={telemetry as unknown as ReadonlyArray<FeedEntry>} />
              <FeedCard title="Activity" items={activity as unknown as ReadonlyArray<FeedEntry>} labelKey="label" />
            </div>
          </div>

          {/* ── Right column: store, recall, results ───────────── */}
          <div className="flex min-h-0 flex-col gap-4">
            <StoreCard
              form={storeForm}
              onChange={setStoreForm}
              onSubmit={handleStoreSubmit}
              pending={storePending}
              feedback={storeFeedback}
              storeState={storeState}
            />
            <RecallCard
              form={recallForm}
              onChange={setRecallForm}
              onSubmit={handleRecallSubmit}
              pending={recallPending}
              feedback={recallFeedback}
              recallState={recallState}
            />
            <RecallResultsCard results={recallResults as unknown as ReadonlyArray<RecallEntry>} onClear={clearResults} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function OverviewCard({
  summaryItems,
  statsStatus,
  statsError,
  isRefreshing,
  lastUpdatedAt,
  totalLayers,
  onRefresh,
}: {
  summaryItems: { label: string; value: number }[];
  statsStatus: string;
  statsError: string | null;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  totalLayers: number;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BrainCircuit className="h-4 w-4" /> Memory Overview
          </CardTitle>
          <p className="text-xs text-muted-foreground">Live totals across working, episodic, and semantic layers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {statsStatus === "error" ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {statsError ?? "Failed to load stats."}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              {statsStatus === "success" ? "Synced" : "Idle"}
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{formatNumber(item.value)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Updated {formatRelativeTime(lastUpdatedAt)}
          </span>
          <span>Total layers: {formatNumber(totalLayers)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LayerBreakdownCard({ layers }: { layers: ReadonlyArray<LayerSnapshotEntry> }) {
  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Layer breakdown</CardTitle>
      </CardHeader>
      <CardContent className="h-full min-h-0">
        {layers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
            No layer metrics available yet.
          </div>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-3">
              {layers.map((layerSnapshot) => (
                <div key={layerSnapshot.layer} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="capitalize">{layerSnapshot.layer}</span>
                    <Badge variant={layerSnapshot.githubEnabled ? "secondary" : "outline"} className="text-[10px] uppercase tracking-[0.18em]">
                      {layerSnapshot.depth ?? ""}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <LayerMetric label="Stored" value={layerSnapshot.stored} />
                    <LayerMetric label="Recalled" value={layerSnapshot.retrieved} />
                    <LayerMetric label="Validated" value={layerSnapshot.validated} />
                    <LayerMetric label="Summarized" value={layerSnapshot.summarized} />
                    <LayerMetric label="Ephemeral" value={layerSnapshot.ephemeralCount} />
                    <LayerMetric label="GitHub" value={layerSnapshot.githubEnabled ? "Enabled" : "Disabled"} />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function FeedCard({
  title,
  items,
  labelKey = "summary",
}: {
  title: string;
  items: ReadonlyArray<FeedEntry>;
  labelKey?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-56 pr-2">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No {title.toLowerCase()} events yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {items.map((entry) => (
                <li key={entry.id} className="rounded-md border border-border/60 bg-background/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{String((entry as Record<string, unknown>)[labelKey] ?? "")}</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
                  </div>
                  {entry.detail ? <p className="mt-1 text-muted-foreground">{entry.detail}</p> : null}
                  {entry.layer ? <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">Layer: {entry.layer}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function StoreCard({
  form,
  onChange,
  onSubmit,
  pending,
  feedback,
  storeState,
}: {
  form: { content: string; layer: string; source: string; tags: string; githubEnabled: boolean };
  onChange: React.Dispatch<React.SetStateAction<typeof form>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  feedback: string | null;
  storeState: { status: string; error?: string | null; lastRecord?: { layer: string } | null; lastSuccessAt?: number | null };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Store memory</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Textarea
            value={form.content}
            onChange={(e) => onChange((p) => ({ ...p, content: e.target.value }))}
            placeholder="Capture an insight, decision, or observation"
            className="min-h-[96px] text-sm"
            disabled={pending}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Layer</span>
              <Select value={form.layer} onValueChange={(v) => onChange((p) => ({ ...p, layer: v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Select layer" /></SelectTrigger>
                <SelectContent>
                  {LAYER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Source</span>
              <Input value={form.source} onChange={(e) => onChange((p) => ({ ...p, source: e.target.value }))} placeholder="Optional source label" className="h-8" disabled={pending} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
            <Input value={form.tags} onChange={(e) => onChange((p) => ({ ...p, tags: e.target.value }))} placeholder="Comma-separated — e.g. planning, research" className="h-8" disabled={pending} />
          </div>
          <ToggleRow label="Enable GitHub sync" checked={form.githubEnabled} onChange={(c) => onChange((p) => ({ ...p, githubEnabled: c }))} disabled={pending} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Store memory
            </Button>
            {storeState.lastRecord ? <span className="text-xs text-muted-foreground">Stored in {storeState.lastRecord.layer} layer.</span> : null}
          </div>
          <p className={cn("text-xs", storeState.status === "error" || feedback ? "text-destructive" : "text-muted-foreground")}>
            {feedback ?? storeState.error ?? (storeState.status === "success" ? `Saved ${formatRelativeTime(storeState.lastSuccessAt ?? null)}.` : "Captured memories keep research context ready.")}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function RecallCard({
  form,
  onChange,
  onSubmit,
  pending,
  feedback,
  recallState,
}: {
  form: { query: string; layer: string; limit: string; includeShortTerm: boolean; includeLongTerm: boolean; includeMeta: boolean; githubEnabled: boolean };
  onChange: React.Dispatch<React.SetStateAction<typeof form>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  feedback: string | null;
  recallState: { status: string; error?: string | null; lastResultsCount?: number; lastSuccessAt?: number | null };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recall memories</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Textarea
            value={form.query}
            onChange={(e) => onChange((p) => ({ ...p, query: e.target.value }))}
            placeholder="Ask for prior work, decisions, or context"
            className="min-h-[80px] text-sm"
            disabled={pending}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Layer</span>
              <Select value={form.layer} onValueChange={(v) => onChange((p) => ({ ...p, layer: v }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Select layer" /></SelectTrigger>
                <SelectContent>
                  {LAYER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Limit</span>
              <Input type="number" min="1" value={form.limit} onChange={(e) => onChange((p) => ({ ...p, limit: e.target.value }))} placeholder="5" className="h-8" disabled={pending} />
            </div>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <ToggleRow label="Include short-term" checked={form.includeShortTerm} onChange={(c) => onChange((p) => ({ ...p, includeShortTerm: c }))} disabled={pending} />
            <ToggleRow label="Include long-term" checked={form.includeLongTerm} onChange={(c) => onChange((p) => ({ ...p, includeLongTerm: c }))} disabled={pending} />
            <ToggleRow label="Include metadata" checked={form.includeMeta} onChange={(c) => onChange((p) => ({ ...p, includeMeta: c }))} disabled={pending} />
            <ToggleRow label="Enable GitHub sync" checked={form.githubEnabled} onChange={(c) => onChange((p) => ({ ...p, githubEnabled: c }))} disabled={pending} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Recall memories
            </Button>
            {recallState.status === "success" ? <span className="text-xs text-muted-foreground">{recallState.lastResultsCount} result{recallState.lastResultsCount === 1 ? "" : "s"}.</span> : null}
          </div>
          <p className={cn("text-xs", recallState.status === "error" || feedback ? "text-destructive" : "text-muted-foreground")}>
            {feedback ?? recallState.error ?? (recallState.status === "success" ? `Completed ${formatRelativeTime(recallState.lastSuccessAt ?? null)}.` : "Search stored memories across all layers.")}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function RecallResultsCard({
  results,
  onClear,
}: {
  results: ReadonlyArray<RecallEntry>;
  onClear: () => void;
}) {
  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">Recall results</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{results.length} shown</span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClear} disabled={results.length === 0}>Clear</Button>
        </div>
      </CardHeader>
      <CardContent className="h-full min-h-0">
        {results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
            Run a recall to populate this panel.
          </div>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-3">
              {results.map((memory, index) => (
                <article key={`${memory.id}-${index}`} className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm">
                  <header className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium uppercase tracking-wide text-foreground">{memory.layer}</span>
                    <span>{formatTimestamp(memory.timestamp)}</span>
                  </header>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{memory.content || "(No content provided)"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {memory.tags.length ? memory.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">{tag}</Badge>
                    )) : (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">no-tags</Badge>
                    )}
                  </div>
                  <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{memory.source ?? "unspecified source"}</span>
                    {typeof memory.score === "number" ? <span>score {memory.score.toFixed(2)}</span> : null}
                  </footer>
                </article>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Shared helpers ────────────────────────────────────────────────── */

function LayerMetric({ label, value }: { label: string; value: number | string }) {
  const display = typeof value === "number" ? formatNumber(value) : value;
  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-2 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{display}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function parseTagsInput(raw: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "never";
  const delta = Date.now() - timestamp;
  if (!Number.isFinite(delta)) return new Date(timestamp).toLocaleString();
  if (delta < 45_000) return "just now";
  if (delta < 90_000) return "1 minute ago";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} minutes ago`;
  if (delta < 7_200_000) return "1 hour ago";
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} hours ago`;
  return new Date(timestamp).toLocaleString();
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}
