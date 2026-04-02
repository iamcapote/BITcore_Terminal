/**
 * Why: IDE-style code view for workflow editing — ported from semantic_flow IDE95.
 * What: JSON editor with syntax-aware colorbar, problems panel, and terminal output.
 * How: Receives nodes/edges via props, serializes to JSON, validates on change,
 *      and pushes updates back to the parent surface via onUpdate callback.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  Download,
  FileJson,
  Info,
  Play,
  Terminal,
  Upload,
  XCircle,
} from "lucide-react";
import type {
  CanvasEdge,
  CanvasNode,
  WorkflowProblem,
} from "@/modules/workflow/workflowTypes";
import {
  parseWorkflowJson,
  serializeWorkflow,
  validateWorkflow,
} from "@/modules/workflow/workflowTypes";
import {
  buildJsonFromSchemaGraph,
  createSchemaGraphFromJson,
} from "@/modules/workflow/workflowSchemaGraph";
import type { WorkflowWorkspaceKind } from "@/modules/workflow/workspaceCatalog";

/* ── Props ──────────────────────────────────────────────────────────── */

interface WorkflowCodePanelProps {
  readonly nodes: CanvasNode[];
  readonly edges: CanvasEdge[];
  readonly selectedId: string | null;
  readonly workspaceKind?: WorkflowWorkspaceKind;
  readonly onUpdate: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  readonly onSelectNode: (id: string | null) => void;
}

/* ── Severity icon map ──────────────────────────────────────────────── */

function SeverityIcon({ severity }: { severity: WorkflowProblem["severity"] }) {
  switch (severity) {
    case "error":
      return <XCircle className="h-3 w-3 shrink-0" style={{ color: "#FF5959" }} />;
    case "warn":
      return <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: "#FFD700" }} />;
    default:
      return <Info className="h-3 w-3 shrink-0" style={{ color: "#6B9BD2" }} />;
  }
}

/* ── Component ──────────────────────────────────────────────────────── */

export function WorkflowCodePanel({
  nodes,
  edges,
  selectedId,
  workspaceKind = "workflows",
  onUpdate,
  onSelectNode,
}: WorkflowCodePanelProps): JSX.Element {
  const isSchemaWorkspace = workspaceKind === "schema";
  const primaryFileName = isSchemaWorkspace ? "schema.json" : "workflow.json";
  const [json, setJson] = useState(() => serializeWorkflow(nodes, edges));
  const [parseError, setParseError] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"problems" | "terminal">("problems");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] ${isSchemaWorkspace ? "Schema" : "Workflow"} IDE initialized`,
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Sync when parent state changes (via canvas edits) */
  const parentJson = useMemo(() => serializeWorkflow(nodes, edges), [nodes, edges]);
  const [lastParent, setLastParent] = useState(parentJson);
  useEffect(() => {
    if (parentJson !== lastParent) {
      setLastParent(parentJson);
      setJson(parentJson);
      setParseError(null);
    }
  }, [lastParent, parentJson]);

  /* Validate current workflow */
  const problems = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);

  /* Colorbar: map JSON lines to node colors */
  const colorMap = useMemo(() => {
    const lines = json.split("\n");
    const map = new Map<number, string>();
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    let currentNodeId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const idMatch = lines[i].match(/"id"\s*:\s*"([^"]+)"/);
      if (idMatch) {
        const n = nodeById.get(idMatch[1]);
        if (n) {
          currentNodeId = n.id;
          map.set(i, n.color);
          continue;
        }
      }
      if (currentNodeId) {
        const node = nodeById.get(currentNodeId);
        if (node) map.set(i, node.color);
        if (lines[i].includes("}")) currentNodeId = null;
      }
    }
    return map;
  }, [json, nodes]);

  const lineCount = useMemo(() => json.split("\n").length, [json]);

  /* Apply JSON changes back to parent */
  const applyJson = useCallback(() => {
    const data = parseWorkflowJson(json);
    if (data) {
      setParseError(null);
      onUpdate(data.nodes, data.edges);
      const ts = new Date().toLocaleTimeString();
      setTerminalLines((prev) => [...prev, `[${ts}] Applied JSON → ${data.nodes.length} nodes, ${data.edges.length} edges`]);
      return;
    }

    try {
      const plain = JSON.parse(json);
      const graph = createSchemaGraphFromJson(plain);
      setParseError(null);
      onUpdate(graph.nodes, graph.edges);
      const ts = new Date().toLocaleTimeString();
      setTerminalLines((prev) => [...prev, `[${ts}] Applied plain JSON as schema graph → ${graph.nodes.length} nodes, ${graph.edges.length} edges`]);
    } catch {
      setParseError("Invalid JSON — check syntax");
    }
  }, [json, onUpdate]);

  /* Format JSON */
  const formatJson = useCallback(() => {
    try {
      const obj = JSON.parse(json);
      setJson(JSON.stringify(obj, null, 2));
      setParseError(null);
    } catch (e) {
      setParseError(`Format failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [json]);

  /* Copy to clipboard */
  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(json);
      const ts = new Date().toLocaleTimeString();
      setTerminalLines((prev) => [...prev, `[${ts}] Copied JSON to clipboard`]);
    } catch { /* noop */ }
  }, [json]);

  /* Export as file download */
  const exportJson = useCallback(() => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = primaryFileName;
    a.click();
    URL.revokeObjectURL(url);
    const ts = new Date().toLocaleTimeString();
    setTerminalLines((prev) => [...prev, `[${ts}] Exported ${primaryFileName}`]);
  }, [json, primaryFileName]);

  const exportSchemaJson = useCallback(() => {
    const schemaValue = buildJsonFromSchemaGraph(nodes, edges);
    const text = JSON.stringify(schemaValue, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema.json";
    a.click();
    URL.revokeObjectURL(url);
    const ts = new Date().toLocaleTimeString();
    setTerminalLines((prev) => [...prev, `[${ts}] Exported schema.json`]);
  }, [nodes, edges]);

  /* Import from file */
  const handleImport = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const obj = JSON.parse(text);
        if (Array.isArray(obj.nodes) && Array.isArray(obj.edges)) {
          setJson(JSON.stringify(obj, null, 2));
          setParseError(null);
          onUpdate(obj.nodes, obj.edges);
          const ts = new Date().toLocaleTimeString();
          setTerminalLines((prev) => [...prev, `[${ts}] Imported ${file.name} → ${obj.nodes.length} nodes`]);
          return;
        }

        const graph = createSchemaGraphFromJson(obj);
        setJson(JSON.stringify({ nodes: graph.nodes, edges: graph.edges, metadata: { importedFrom: file.name } }, null, 2));
        setParseError(null);
        onUpdate(graph.nodes, graph.edges);
        const ts = new Date().toLocaleTimeString();
        setTerminalLines((prev) => [...prev, `[${ts}] Imported plain JSON ${file.name} → ${graph.nodes.length} schema nodes`]);
      } catch (err) {
        setParseError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [onUpdate]);

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null),
    [nodes, selectedId],
  );

  /* Run action (validate + log) */
  const runValidation = useCallback(() => {
    setBottomTab("problems");
    const ts = new Date().toLocaleTimeString();
    const p = validateWorkflow(nodes, edges);
    const errs = p.filter((x) => x.severity === "error").length;
    const warns = p.filter((x) => x.severity === "warn").length;
    setTerminalLines((prev) => [...prev, `[${ts}] Validation: ${errs} error(s), ${warns} warning(s), ${nodes.length} nodes, ${edges.length} edges`]);
  }, [nodes, edges]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-1.5 px-2 py-1"
        style={{
          background: "#C0C0C0",
          borderBottom: "2px solid",
          borderColor: "#808080 #fff #fff #808080",
        }}
      >
        <FileJson className="h-3.5 w-3.5" style={{ color: "#000080" }} />
        <span className="text-xs font-bold" style={{ color: "#000080" }}>{primaryFileName}</span>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={applyJson}>
          <Play className="mr-1 h-3 w-3" /> Apply
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={formatJson}>Format</Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={copyJson}>
          <ClipboardCopy className="mr-1 h-3 w-3" /> Copy
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={exportJson}>
          <Download className="mr-1 h-3 w-3" /> Export
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={exportSchemaJson}>
          <Download className="mr-1 h-3 w-3" /> Export Schema
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1 h-3 w-3" /> Import
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={runValidation}>
          <CheckCircle2 className="mr-1 h-3 w-3" /> Validate
        </Button>
        <span className="ml-auto text-[10px]" style={{ color: "#808080" }}>
          {lineCount} lines · {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      {/* Editor area: gutter + colorbar + code */}
      <div className="flex min-h-0 flex-1">
        {/* Line numbers gutter */}
        <div
          className="shrink-0 select-none overflow-hidden py-2 text-right font-mono text-[11px] leading-[18px]"
          style={{
            width: 44,
            background: "#E6E6E6",
            borderRight: "1px solid #808080",
            color: "#808080",
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="px-1">{i + 1}</div>
          ))}
        </div>

        {/* Colorbar: 8px strip showing node cluster colors */}
        <div
          className="shrink-0 relative"
          style={{
            width: 8,
            background: "#f3f4f6",
            borderRight: "1px solid #808080",
          }}
        >
          {Array.from(colorMap.entries()).map(([line, color]) => (
            <div
              key={line}
              className="absolute w-full"
              style={{
                top: line * 18 + 8,
                height: 18,
                background: color,
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        {/* Code editor */}
        <div className="relative min-h-0 min-w-0 flex-1">
          <Textarea
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setParseError(null);
            }}
            className="absolute inset-0 resize-none rounded-none border-0 font-mono text-xs leading-[18px] p-2"
            style={{
              background: "#012456",
              color: "#E6E6E6",
              caretColor: "#fff",
              tabSize: 2,
            }}
            spellCheck={false}
          />
          {/* Parse error toast */}
          {parseError && (
            <div
              className="absolute left-2 right-2 bottom-2 flex items-center gap-2 border px-3 py-1.5 text-xs"
              style={{
                background: "#3B0000",
                borderColor: "#FF5959",
                color: "#FF5959",
              }}
            >
              <XCircle className="h-3 w-3 shrink-0" />
              {parseError}
            </div>
          )}
        </div>

        {/* Minimap placeholder */}
        <div
          className="shrink-0"
          style={{
            width: 8,
            background: "#C0C0C0",
            borderLeft: "1px solid #808080",
          }}
        />
      </div>

      {/* Bottom panel: Problems | Terminal */}
      <div
        className="flex shrink-0 flex-col"
        style={{ height: 140, borderTop: "2px solid #808080" }}
      >
        {/* Tabs */}
        <div
          className="flex shrink-0 items-center gap-2 px-2 py-0.5"
          style={{
            background: "#C0C0C0",
            borderBottom: "1px solid #808080",
          }}
        >
          <button
            type="button"
            onClick={() => setBottomTab("problems")}
            className="px-2 py-0.5 text-[11px]"
            style={{
              background: bottomTab === "problems" ? "#fff" : "#D6D6D6",
              border: "1px solid #808080",
              fontWeight: bottomTab === "problems" ? 700 : 400,
              cursor: "pointer",
            }}
          >
            Problems {problems.length > 0 && `(${problems.length})`}
          </button>
          <button
            type="button"
            onClick={() => setBottomTab("terminal")}
            className="px-2 py-0.5 text-[11px]"
            style={{
              background: bottomTab === "terminal" ? "#fff" : "#D6D6D6",
              border: "1px solid #808080",
              fontWeight: bottomTab === "terminal" ? 700 : 400,
              cursor: "pointer",
            }}
          >
            <Terminal className="mr-1 inline h-3 w-3" />
            Output
          </button>
          <span className="ml-auto text-[10px]" style={{ color: "#808080" }}>
            {problems.filter((p) => p.severity === "error").length} errors · {problems.filter((p) => p.severity === "warn").length} warnings
          </span>
        </div>

        {/* Panel body */}
        <ScrollArea className="flex-1 min-h-0">
          {bottomTab === "problems" ? (
            <div className="p-2 space-y-0.5">
              {problems.length === 0 ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#00AA00" }}>
                  <CheckCircle2 className="h-3 w-3" /> No problems detected
                </div>
              ) : (
                problems.map((p, i) => (
                  <button
                    key={`${p.id}-${i}`}
                    type="button"
                    onClick={() => p.where === "node" && onSelectNode(p.id)}
                    className="flex w-full items-center gap-2 text-left text-xs py-0.5 px-1 hover:bg-black/5"
                    style={{ cursor: p.where === "node" ? "pointer" : "default" }}
                  >
                    <SeverityIcon severity={p.severity} />
                    <span className="font-mono text-[10px]" style={{ color: "#808080" }}>{p.where}:{p.id}</span>
                    <span>{p.message}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div
              className="min-h-full p-2 font-mono text-xs leading-relaxed"
              style={{ background: "#012456", color: "#E6E6E6" }}
            >
              {terminalLines.map((line, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap" }}>{line}</div>
              ))}
              <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: "#00D7FF" }}>
                <Circle className="h-2 w-2 fill-current" /> Ready
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Status bar */}
      <div
        className="flex shrink-0 items-center gap-4 px-3 py-0.5 text-[10px]"
        style={{
          background: "#C0C0C0",
          borderTop: "1px solid #fff",
          color: "#000",
        }}
      >
        <span>Ln {lineCount}, Col 1</span>
        <span>UTF-8</span>
        <span>JSON</span>
        <span>{selectedNode ? `Selected: ${selectedNode.label}` : "Selected: none"}</span>
        <span className="ml-auto">{problems.filter((p) => p.severity === "error").length === 0 ? "OK" : `${problems.filter((p) => p.severity === "error").length} error(s)`}</span>
      </div>
    </div>
  );
}
