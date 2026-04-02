/**
 * Why: PowerShell++ style run log for workflow operations — ported from semantic_flow Console95.
 * What: Command-style panel with status, run, export, validate, clear, and help commands.
 * How: Maintains a scrolling output buffer, processes typed commands against the current workflow,
 *      renders with Win95-authentic PowerShell dark viewport colors.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { CanvasEdge, CanvasNode, ConsoleLine } from "@/modules/workflow/workflowTypes";
import { buildExecutionPlan, serializeWorkflow, validateWorkflow } from "@/modules/workflow/workflowTypes";

/* ── Props ──────────────────────────────────────────────────────────── */

interface WorkflowConsolePanelProps {
  readonly nodes: CanvasNode[];
  readonly edges: CanvasEdge[];
  readonly onSelectNode: (id: string | null) => void;
}

/* ── Brand tokens (PowerShell++ palette) ────────────────────────────── */

const PS = {
  viewport: "#012456",
  input: "#011B3A",
  accent: "#00D7FF",
  warn: "#FFD700",
  ok: "#00FF00",
  err: "#FF5959",
  text: "#E6E6E6",
} as const;

/* ── Help text ──────────────────────────────────────────────────────── */

const HELP_TEXT = [
  "  help              Show this help",
  "  status            Workflow statistics",
  "  validate          Run validation checks",
  "  list [nodes|edges] List nodes or edges",
  "  select <id>       Select a node by ID",
  "  export json       Export workflow as JSON",
  "  export summary    Print node/edge summary",
  "  plan              Show topological execution plan",
  "  run               Simulate execution order",
  "  clear             Clear console output",
  "  ver               Version info",
];

/* ── Component ──────────────────────────────────────────────────────── */

export function WorkflowConsolePanel({
  nodes,
  edges,
  onSelectNode,
}: WorkflowConsolePanelProps): JSX.Element {
  const [lines, setLines] = useState<ConsoleLine[]>([
    { kind: "ok", text: "BITcore Workflow Run Log (PowerShell++) v1.0" },
    { kind: "info", text: 'Type "help" for available commands.' },
  ]);
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef(-1);
  const viewRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll on new output */
  useEffect(() => {
    const el = viewRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  /* Append helper */
  const append = useCallback((text: string, kind: ConsoleLine["kind"] = "plain") => {
    setLines((prev) => [
      ...prev,
      ...text.split("\n").map((t) => ({ kind, text: t })),
    ]);
  }, []);

  /* Command handler */
  const handle = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;

      setHistory((prev) => [input, ...prev.slice(0, 49)]);
      historyIndexRef.current = -1;
      setLines((prev) => [...prev, { kind: "cmd", text: input }]);

      const [command, ...rest] = input.split(/\s+/);
      const arg = rest.join(" ").toLowerCase();

      switch (command.toLowerCase()) {
        case "help":
          append(HELP_TEXT.join("\n"), "plain");
          break;

        case "ver":
        case "version":
          append("BITcore Nova Workflow Run Log v1.0.0\nPowered by semantic ontology primitives", "info");
          break;

        case "status": {
          const clusters = new Set(nodes.map((n) => n.cluster));
          append(
            [
              `Nodes: ${nodes.length}   Edges: ${edges.length}`,
              `Clusters: ${clusters.size} (${[...clusters].join(", ")})`,
              `Connected: ${edges.length > 0 ? "yes" : "no"}`,
            ].join("\n"),
            "plain",
          );
          break;
        }

        case "validate": {
          const problems = validateWorkflow(nodes, edges);
          if (problems.length === 0) {
            append("Validation passed — no issues found", "ok");
          } else {
            const errs = problems.filter((p) => p.severity === "error");
            const warns = problems.filter((p) => p.severity === "warn");
            if (errs.length > 0) {
              append(`ERRORS (${errs.length}):`, "err");
              for (const e of errs) append(`  [${e.where}:${e.id}] ${e.message}`, "err");
            }
            if (warns.length > 0) {
              append(`WARNINGS (${warns.length}):`, "warn" as ConsoleLine["kind"]);
              for (const w of warns) append(`  [${w.where}:${w.id}] ${w.message}`, "plain");
            }
          }
          break;
        }

        case "list": {
          if (arg === "edges" || arg === "e") {
            if (edges.length === 0) {
              append("No edges", "plain");
            } else {
              for (const e of edges) {
                const src = nodes.find((n) => n.id === e.source);
                const tgt = nodes.find((n) => n.id === e.target);
                append(`  ${src?.label ?? e.source} → ${tgt?.label ?? e.target}`, "plain");
              }
            }
          } else {
            if (nodes.length === 0) {
              append("No nodes", "plain");
            } else {
              for (const n of nodes) {
                append(`  [${n.cluster}] ${n.label} (${n.ontologyCode}) — ${n.id}`, "plain");
              }
            }
          }
          break;
        }

        case "select": {
          const target = rest[0];
          if (!target) {
            append("Usage: select <node-id>", "err");
            break;
          }
          const match = nodes.find(
            (n) => n.id === target || n.label.toLowerCase() === target.toLowerCase(),
          );
          if (match) {
            onSelectNode(match.id);
            append(`Selected: ${match.label} (${match.ontologyCode})`, "ok");
          } else {
            append(`Node not found: ${target}`, "err");
          }
          break;
        }

        case "export": {
          if (arg === "json") {
            append(serializeWorkflow(nodes, edges), "plain");
          } else if (arg === "summary") {
            append(`Workflow: ${nodes.length} nodes, ${edges.length} edges`, "info");
            for (const n of nodes) append(`  ${n.icon} ${n.label} [${n.cluster}]`, "plain");
          } else {
            append('Usage: export json | export summary', "err");
          }
          break;
        }

        case "plan": {
          const plan = buildExecutionPlan(nodes, edges);
          append(`Plan order: ${plan.order.length}/${nodes.length} node(s)`, "info");
          if (plan.order.length > 0) {
            for (const nodeId of plan.order) {
              const node = nodes.find((entry) => entry.id === nodeId);
              append(`  ${node?.label || nodeId} [${node?.ontologyCode || "unknown"}]`, "plain");
            }
          }
          if (plan.hasCycle) {
            append(`Cycle detected. Blocked nodes: ${plan.blockedNodes.join(", ")}`, "err");
          } else {
            append("Plan is acyclic and executable.", "ok");
          }
          break;
        }

        case "run": {
          const plan = buildExecutionPlan(nodes, edges);
          if (plan.hasCycle) {
            append("Cannot run: cycle detected. Use plan to inspect blocked nodes.", "err");
            break;
          }
          append("Run simulation start", "info");
          for (const [index, nodeId] of plan.order.entries()) {
            const node = nodes.find((entry) => entry.id === nodeId);
            append(`  [${index + 1}/${plan.order.length}] ${node?.label || nodeId} completed`, "ok");
          }
          append("Run simulation complete", "ok");
          break;
        }

        case "clear":
        case "cls":
          setLines([]);
          break;

        default:
          append(`Command not found: ${command}`, "err");
          append('Type "help" for available commands.', "plain");
      }
    },
    [nodes, edges, append, onSelectNode],
  );

  /* Keyboard handling */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const v = cmd;
        setCmd("");
        handle(v);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        historyIndexRef.current = Math.min(historyIndexRef.current + 1, history.length - 1);
        if (history[historyIndexRef.current]) setCmd(history[historyIndexRef.current]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        historyIndexRef.current = Math.max(historyIndexRef.current - 1, -1);
        setCmd(historyIndexRef.current < 0 ? "" : history[historyIndexRef.current] ?? "");
      }
    },
    [cmd, handle, history],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col" style={{ background: "#C0C0C0" }}>
      {/* Title bar */}
      <div
        className="flex shrink-0 items-center gap-2 px-2 py-1"
        style={{
          background: "linear-gradient(90deg, #000080, #1084d0)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        Workflow Run Log (PowerShell++)
        <span className="ml-auto text-[10px] font-normal opacity-80">
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      {/* Viewport */}
      <div
        ref={viewRef}
        className="min-h-0 flex-1 overflow-auto p-3 font-mono text-sm leading-relaxed"
        style={{
          background: PS.viewport,
          color: PS.text,
          border: "2px inset #808080",
          margin: "4px 4px 0 4px",
        }}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>
            {l.kind === "cmd" ? (
              <>
                <span style={{ color: PS.accent }}>PS</span>{" "}
                <span style={{ color: PS.warn }}>workflow&gt;</span>{" "}
                <span>{l.text}</span>
              </>
            ) : l.kind === "ok" ? (
              <span style={{ color: PS.ok }}>{l.text}</span>
            ) : l.kind === "err" ? (
              <span style={{ color: PS.err }}>{l.text}</span>
            ) : l.kind === "info" ? (
              <span style={{ color: PS.accent }}>{l.text}</span>
            ) : (
              <span>{l.text}</span>
            )}
          </div>
        ))}
      </div>

      {/* Input line */}
      <div
        className="flex shrink-0 items-center gap-2 px-2 py-1 font-mono text-sm"
        style={{
          background: PS.input,
          color: PS.text,
          border: "2px inset #808080",
          margin: "0 4px 4px 4px",
        }}
      >
        <span style={{ color: PS.accent }}>PS</span>
        <span style={{ color: PS.warn }}>workflow&gt;</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="help | status | validate | list | export"
          className="flex-1 border-0 bg-transparent text-sm font-mono outline-none"
          style={{ color: PS.text, caretColor: PS.ok }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          style={{ color: PS.text }}
          onClick={() => { const v = cmd; setCmd(""); handle(v); }}
        >
          Run
        </Button>
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
        <span>Ready</span>
        <span>Nodes: {nodes.length}</span>
        <span>Edges: {edges.length}</span>
        <span className="ml-auto">BITcore Nova</span>
      </div>
    </div>
  );
}
