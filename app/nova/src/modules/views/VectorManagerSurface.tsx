/**
 * Why: Vector store management panel for browsing, querying, and administering embedding indices.
 * What: Shows backend-driven store inventory and a guarded mock document-ingestion workflow.
 * How: Calls vector admin endpoints for overview/accepts/process with resilient fallback messaging.
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  BookOpen,
  ClipboardList,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  fetchVectorAcceptedMimes,
  fetchVectorOverview,
  processVectorDocument,
  type VectorStoreSnapshot,
} from "@/modules/vectors/vectorAdminClient";

export function VectorManagerSurface() {
  const [stores, setStores] = useState<readonly VectorStoreSnapshot[]>([]);
  const [acceptedMimes, setAcceptedMimes] = useState<readonly string[]>([]);
  const [backendFilter, setBackendFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processFilename, setProcessFilename] = useState("notes.md");
  const [processMimeType, setProcessMimeType] = useState("text/markdown");
  const [processSize, setProcessSize] = useState("4096");
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleStores = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return stores;
    }
    return stores.filter((store) => {
      const haystack = `${store.index} ${store.backend} ${store.status}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [stores, searchTerm]);

  const selectedProcessIndex = visibleStores[0]?.index ?? stores[0]?.index ?? "";

  async function loadOverview(nextBackend = backendFilter) {
    setLoading(true);
    setError(null);
    try {
      const [overview, accepts] = await Promise.all([
        fetchVectorOverview(nextBackend),
        fetchVectorAcceptedMimes(),
      ]);
      setStores(overview.stores);
      setAcceptedMimes(accepts.length > 0 ? accepts : overview.acceptedMimes);
      if (accepts.length > 0 && !accepts.includes(processMimeType)) {
        setProcessMimeType(accepts[0] ?? "text/markdown");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vector overview.");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProcessMockDocument() {
    if (!selectedProcessIndex) {
      setProcessResult("No vector index available.");
      return;
    }
    setProcessing(true);
    setProcessResult(null);
    setError(null);
    try {
      const result = await processVectorDocument({
        index: selectedProcessIndex,
        filename: processFilename.trim() || "document.txt",
        mimeType: processMimeType,
        sizeBytes: Number.parseInt(processSize, 10) || 0,
      });
      setProcessResult(result.reason);
      await loadOverview();
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Failed to process document.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" /> Vector Stores
          <Badge variant="outline" className="ml-auto border-amber-500/40 text-[9px] uppercase text-amber-400"><Construction className="mr-1 h-3 w-3" />partial</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
        {error ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled>
            <Plus className="mr-1 h-4 w-4" /> New Index
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { void loadOverview(); }} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Refresh
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={backendFilter}
              onValueChange={(value) => {
                setBackendFilter(value);
                void loadOverview(value);
              }}
            >
              <SelectTrigger className="h-8 w-32 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backends</SelectItem>
                <SelectItem value="pinecone">Pinecone</SelectItem>
                <SelectItem value="faiss">FAISS</SelectItem>
                <SelectItem value="chroma">Chroma</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter"
              className="h-8 w-28 sm:w-40"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_120px_auto]">
            <Input value={processFilename} onChange={(event) => setProcessFilename(event.target.value)} placeholder="document.md" />
            <Select value={processMimeType} onValueChange={setProcessMimeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(acceptedMimes.length > 0 ? acceptedMimes : ["text/markdown", "application/pdf"]).map((mime) => (
                  <SelectItem key={mime} value={mime}>{mime}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={processSize} onChange={(event) => setProcessSize(event.target.value)} placeholder="size bytes" />
            <Button size="sm" variant="secondary" onClick={() => { void handleProcessMockDocument(); }} disabled={processing || loading || !selectedProcessIndex}>
              {processing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Process doc
            </Button>
          </div>
          {processResult ? <p className="mt-2 text-xs text-muted-foreground">{processResult}</p> : null}
        </div>

        <div className="mb-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
          {visibleStores.map((store) => (
            <div
              key={store.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Layers className="h-4 w-4 text-violet-300" />
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium leading-tight">{store.index}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {store.backend} · {store.dimension}-d · {store.size.toLocaleString()} vectors
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {store.status}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Sync ${store.index}`} onClick={() => { void loadOverview(); }}>
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
        <div className="min-h-0 flex-1 overflow-x-auto rounded-md border">
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
              {visibleStores.map((store) => (
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
                        <DropdownMenuItem onClick={() => { void loadOverview(); }}>Rebuild</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {visibleStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                    {loading ? "Loading vector stores…" : "No vector stores found."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
