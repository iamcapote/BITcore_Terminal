/**
 * @license INTERNAL ONLY — Knowledge surfaces
 *
 * Vector, database, memory, and metrics panels lifted from the VS-code fork
 * prototype. Interfaces remain declarative so real data stores can hydrate them
 * during Step 3.
 */

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  databaseConnections,
  vectorStores,
  workspaceMetrics,
} from "@/modules/data/mockWorkspace";
import { useMemoryTelemetry } from "@/modules/memory/MemoryTelemetryProvider";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  ClipboardList,
  Database,
  Download,
  Layers,
  Play,
  Plus,
  RefreshCw,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

export function VectorManagerSurface() {
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" /> Vector Stores
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-2.5rem)] min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Index
          </Button>
          <Button size="sm" variant="secondary">
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backends</SelectItem>
                <SelectItem value="pinecone">Pinecone</SelectItem>
                <SelectItem value="faiss">FAISS</SelectItem>
                <SelectItem value="chroma">Chroma</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Filter" className="h-8 w-40" />
          </div>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
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
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Index</TableHead>
                <TableHead>Backend</TableHead>
                <TableHead>Dim</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vectorStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.index}</TableCell>
                  <TableCell>{store.backend}</TableCell>
                  <TableCell>{store.dimension}</TableCell>
                  <TableCell>{store.size.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={store.status === "Ready" ? "default" : "secondary"}>
                      {store.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ClipboardList className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Inspect</DropdownMenuItem>
                        <DropdownMenuItem>Search Similar</DropdownMenuItem>
                        <DropdownMenuItem>Rebuild</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DatabaseManagerSurface() {
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" /> Databases
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-2.5rem)] min-w-0 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Connect
          </Button>
          <Button size="sm" variant="secondary">
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select defaultValue="postgres">
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">Postgres</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="duckdb">DuckDB</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Filter" className="h-8 w-40" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <Card className="overflow-hidden">
            <CardHeader className="py-2">
              <CardTitle className="text-xs">Connections</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Tables</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {databaseConnections.map((db) => (
                      <TableRow key={db.id}>
                        <TableCell className="font-medium">{db.name}</TableCell>
                        <TableCell>{db.engine}</TableCell>
                        <TableCell>{db.tables}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label={`Run query on ${db.name}`}>
                                  <Play className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Run query</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label={`Export ${db.name} schema`}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Export schema</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-xs">Query</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea className="min-h-[120px]" placeholder="SELECT * FROM table LIMIT 50;" />
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm">
                  <Play className="mr-1 h-4 w-4" /> Run
                </Button>
                <Button size="sm" variant="secondary">
                  <Download className="mr-1 h-4 w-4" /> Save
                </Button>
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <BrainCircuit className="h-3 w-3" /> Est. cost: 3 RU
                </div>
              </div>
              <Separator className="my-3" />
              <div className="rounded-md border p-3 text-sm">Result preview here</div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

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
          <div className="flex min-h-0 flex-col gap-4">
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
                  <Button size="sm" variant="outline" className="h-8" onClick={() => void refreshStats()} disabled={isRefreshing}>
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
                  <span>Total layers: {formatNumber(totals.layers)}</span>
                </div>
              </CardContent>
            </Card>

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
                              {layerSnapshot.depth}
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

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Telemetry feed</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-56 pr-2">
                    {telemetry.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No telemetry events yet.</p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {telemetry.map((entry) => (
                          <li key={entry.id} className="rounded-md border border-border/60 bg-background/60 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{entry.summary}</span>
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-56 pr-2">
                    {activity.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No recent memory activity.</p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {activity.map((entry) => (
                          <li key={entry.id} className="rounded-md border border-border/60 bg-background/60 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{entry.label}</span>
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
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Store memory</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleStoreSubmit}>
                  <Textarea
                    value={storeForm.content}
                    onChange={(event) => setStoreForm((previous) => ({ ...previous, content: event.target.value }))}
                    placeholder="Capture an insight, decision, or observation"
                    className="min-h-[96px] text-sm"
                    disabled={storePending}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Layer</span>
                      <Select value={storeForm.layer} onValueChange={(value) => setStoreForm((previous) => ({ ...previous, layer: value }))}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select layer" />
                        </SelectTrigger>
                        <SelectContent>
                          {LAYER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Source</span>
                      <Input
                        value={storeForm.source}
                        onChange={(event) => setStoreForm((previous) => ({ ...previous, source: event.target.value }))}
                        placeholder="Optional source label"
                        className="h-8"
                        disabled={storePending}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
                    <Input
                      value={storeForm.tags}
                      onChange={(event) => setStoreForm((previous) => ({ ...previous, tags: event.target.value }))}
                      placeholder="Comma-separated — e.g. planning, research"
                      className="h-8"
                      disabled={storePending}
                    />
                  </div>
                  <ToggleRow
                    label="Enable GitHub sync"
                    checked={storeForm.githubEnabled}
                    onChange={(checked) => setStoreForm((previous) => ({ ...previous, githubEnabled: checked }))}
                    disabled={storePending}
                  />
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={storePending}>
                      {storePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Store memory
                    </Button>
                    {storeState.lastRecord ? (
                      <span className="text-xs text-muted-foreground">Stored in {storeState.lastRecord.layer} layer.</span>
                    ) : null}
                  </div>
                  <p className={cn("text-xs", storeState.status === "error" || storeFeedback ? "text-destructive" : "text-muted-foreground")}>
                    {storeFeedback ?? storeState.error ?? (storeState.status === "success" ? `Saved ${formatRelativeTime(storeState.lastSuccessAt)}.` : "Captured memories keep research context ready.")}
                  </p>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recall memories</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleRecallSubmit}>
                  <Textarea
                    value={recallForm.query}
                    onChange={(event) => setRecallForm((previous) => ({ ...previous, query: event.target.value }))}
                    placeholder="Ask for prior work, decisions, or context"
                    className="min-h-[80px] text-sm"
                    disabled={recallPending}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Layer</span>
                      <Select value={recallForm.layer} onValueChange={(value) => setRecallForm((previous) => ({ ...previous, layer: value }))}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select layer" />
                        </SelectTrigger>
                        <SelectContent>
                          {LAYER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Limit</span>
                      <Input
                        type="number"
                        min="1"
                        value={recallForm.limit}
                        onChange={(event) => setRecallForm((previous) => ({ ...previous, limit: event.target.value }))}
                        placeholder="5"
                        className="h-8"
                        disabled={recallPending}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <ToggleRow
                      label="Include short-term"
                      checked={recallForm.includeShortTerm}
                      onChange={(checked) => setRecallForm((previous) => ({ ...previous, includeShortTerm: checked }))}
                      disabled={recallPending}
                    />
                    <ToggleRow
                      label="Include long-term"
                      checked={recallForm.includeLongTerm}
                      onChange={(checked) => setRecallForm((previous) => ({ ...previous, includeLongTerm: checked }))}
                      disabled={recallPending}
                    />
                    <ToggleRow
                      label="Include metadata"
                      checked={recallForm.includeMeta}
                      onChange={(checked) => setRecallForm((previous) => ({ ...previous, includeMeta: checked }))}
                      disabled={recallPending}
                    />
                    <ToggleRow
                      label="Enable GitHub sync"
                      checked={recallForm.githubEnabled}
                      onChange={(checked) => setRecallForm((previous) => ({ ...previous, githubEnabled: checked }))}
                      disabled={recallPending}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={recallPending}>
                      {recallPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Recall memories
                    </Button>
                    {recallState.status === "success" ? (
                      <span className="text-xs text-muted-foreground">{recallState.lastResultsCount} result{recallState.lastResultsCount === 1 ? "" : "s"}.</span>
                    ) : null}
                  </div>
                  <p className={cn("text-xs", recallState.status === "error" || recallFeedback ? "text-destructive" : "text-muted-foreground")}>
                    {recallFeedback ?? recallState.error ?? (recallState.status === "success" ? `Completed ${formatRelativeTime(recallState.lastSuccessAt)}.` : "Search stored memories across all layers.")}
                  </p>
                </form>
              </CardContent>
            </Card>

            <Card className="min-h-0 flex-1">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm">Recall results</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{recallResults.length} shown</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={clearResults} disabled={recallResults.length === 0}>
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-full min-h-0">
                {recallResults.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
                    Run a recall to populate this panel.
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-3">
                      {recallResults.map((memory, index) => (
                        <article key={`${memory.id}-${index}`} className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm">
                          <header className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium uppercase tracking-wide text-foreground">{memory.layer}</span>
                            <span>{formatTimestamp(memory.timestamp)}</span>
                          </header>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{memory.content || "(No content provided)"}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {memory.tags.length ? memory.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">
                                {tag}
                              </Badge>
                            )) : (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                no-tags
                              </Badge>
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
          </div>
        </section>
      </div>
    </div>
  );
}

export function MetricsBoardSurface() {
  return (
    <div className="grid h-full grid-cols-2 gap-4">
      {workspaceMetrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card
            key={metric.id}
            className="relative overflow-hidden border-border/60 bg-gradient-to-br from-background/80 via-background to-background/40"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10" />
            <CardContent className="relative flex h-full flex-col justify-between p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                {metric.label}
                <Badge variant="secondary">{metric.trend}</Badge>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-3xl font-semibold">{metric.value}</span>
                <Icon className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

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
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toLocaleString();
}

function parseTagsInput(raw: string): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) {
    return "never";
  }
  const delta = Date.now() - timestamp;
  if (!Number.isFinite(delta)) {
    return new Date(timestamp).toLocaleString();
  }
  if (delta < 45_000) return "just now";
  if (delta < 90_000) return "1 minute ago";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} minutes ago`;
  if (delta < 7_200_000) return "1 hour ago";
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} hours ago`;
  return new Date(timestamp).toLocaleString();
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toLocaleString();
  }
  return value;
}
