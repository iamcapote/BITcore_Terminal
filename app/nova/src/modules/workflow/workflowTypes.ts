/**
 * Why: Shared data model for the workflow canvas, code editor, and console panels.
 * What: Canonical CanvasNode and CanvasEdge interfaces plus helper constructors.
 * How: Imported by WorkflowBuilderSurface, WorkflowCodePanel, WorkflowConsolePanel, and NodeEnhanceDialog.
 */

import {
  getClusterByCode,
  ONTOLOGY_NODE_TYPES,
  type OntologyNodeType,
} from "@/modules/workflow/semanticOntology";

/* ── Core types ─────────────────────────────────────────────────────── */

export interface CanvasNode {
  readonly id: string;
  readonly ontologyCode: string;
  readonly cluster: string;
  readonly icon: string;
  readonly color: string;
  x: number;
  y: number;
  label: string;
  notes: string;
  content: string;
  language?: "markdown" | "json" | "yaml" | "xml";
  fields?: CanvasField[];
  ports?: {
    inputs?: CanvasPort[];
    outputs?: CanvasPort[];
  };
  config?: {
    isExecutable?: boolean;
    requiresInput?: boolean;
    maxInputs?: number | null;
    maxOutputs?: number | null;
  };
  workflowRole?: WorkflowNodeRole;
  stateInputs?: string[];
  stateOutputs?: string[];
  schemaKind?: "object" | "array" | "keyvalue";
  schemaKey?: string;
  schemaValueType?: "string" | "number" | "boolean" | "null";
  schemaValue?: string;
}

export type WorkflowNodeRole =
  | "start"
  | "agent"
  | "tool"
  | "router"
  | "memory"
  | "guardrail"
  | "human"
  | "subgraph"
  | "end";

export interface CanvasPort {
  readonly id: string;
  readonly type: "input" | "output" | "premise" | "conclusion" | "condition" | "evidence" | "hypothesis";
  readonly label: string;
}

export interface CanvasField {
  readonly name: string;
  readonly type: "text" | "longText" | "number" | "boolean" | "enum" | "multiEnum" | "date" | "object" | "array" | "tags" | "file" | "fileFormat";
  readonly value: unknown;
  readonly options?: readonly string[];
}

export const CANVAS_FIELD_TYPES = [
  "text",
  "longText",
  "number",
  "boolean",
  "enum",
  "multiEnum",
  "date",
  "object",
  "array",
  "tags",
  "file",
  "fileFormat",
] as const;

export const CANVAS_PORT_TYPES = [
  "input",
  "output",
  "premise",
  "conclusion",
  "condition",
  "evidence",
  "hypothesis",
] as const;

export const WORKFLOW_NODE_ROLES = [
  "start",
  "agent",
  "tool",
  "router",
  "memory",
  "guardrail",
  "human",
  "subgraph",
  "end",
] as const;

export const WORKFLOW_TRANSITION_MODES = ["always", "when", "whenNot", "onSuccess", "onFailure"] as const;

const RESERVED_FIELD_NAMES = new Set(["__proto__", "constructor", "prototype"]);
export const CORE_CANVAS_FIELD_NAMES = ["title", "ontologyType", "description", "content", "icon", "cluster", "tags"] as const;

export interface CanvasEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
  data?: {
    operator?: string;
    condition?: string;
    weight?: number;
    metadata?: {
      label?: string;
    };
    transition?: {
      mode?: typeof WORKFLOW_TRANSITION_MODES[number];
      expression?: string;
      channel?: string;
    };
  };
  style?: {
    stroke?: string;
    opacity?: number;
  };
}

export interface WorkflowData {
  readonly nodes: CanvasNode[];
  readonly edges: CanvasEdge[];
  readonly metadata?: {
    exportedAt?: string;
    title?: string;
    version?: string;
    viewport?: { x: number; y: number; zoom: number };
  };
}

/* ── Problem severity for validation ────────────────────────────────── */

export type ProblemSeverity = "error" | "warn" | "info";

export interface WorkflowProblem {
  readonly severity: ProblemSeverity;
  readonly where: "node" | "edge" | "schema";
  readonly id: string;
  readonly message: string;
}

export interface WorkflowExecutionPlan {
  readonly order: string[];
  readonly hasCycle: boolean;
  readonly blockedNodes: string[];
}

/* ── Console line kind ──────────────────────────────────────────────── */

export type LineKind = "plain" | "ok" | "err" | "cmd" | "info";

export interface ConsoleLine {
  readonly kind: LineKind;
  readonly text: string;
}

/* ── Constants ──────────────────────────────────────────────────────── */

export const NODE_W = 200;
export const NODE_H = 100;

/* ── Helpers ────────────────────────────────────────────────────────── */

export function positionForIndex(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 60 + col * 240, y: 50 + row * 150 };
}

export function makeNodeFromType(nodeType: OntologyNodeType, index: number): CanvasNode {
  const cluster = getClusterByCode(nodeType.cluster);
  const pos = positionForIndex(index);
  const workflowRole = inferWorkflowRoleFromCode(nodeType.code);
  const defaultChannels = defaultChannelsForRole(workflowRole);
  const base: CanvasNode = {
    id: `node-${Date.now()}-${index}`,
    ontologyCode: nodeType.code,
    cluster: nodeType.cluster,
    icon: nodeType.icon,
    color: cluster?.color ?? "#808080",
    x: pos.x,
    y: pos.y,
    label: nodeType.label,
    notes: "",
    content: "",
    language: "markdown",
    fields: [],
    ports: {
      inputs: [{ id: "in-main", type: "input", label: "Input" }],
      outputs: [{ id: "out-main", type: "output", label: "Output" }],
    },
    config: {
      isExecutable: true,
      requiresInput: false,
      maxInputs: null,
      maxOutputs: null,
    },
    workflowRole,
    stateInputs: defaultChannels.inputs,
    stateOutputs: defaultChannels.outputs,
  };

  if (nodeType.code === "JSON-OBJECT") {
    return ensureNodePrimitives({
      ...base,
      label: "object",
      notes: "Children will appear connected below",
      schemaKind: "object",
      schemaKey: "object",
      language: "json",
    });
  }

  if (nodeType.code === "JSON-ARRAY") {
    return ensureNodePrimitives({
      ...base,
      label: "array",
      notes: "Array items will appear connected below",
      schemaKind: "array",
      schemaKey: "array",
      language: "json",
    });
  }

  if (nodeType.code === "JSON-KEYVALUE") {
    return ensureNodePrimitives({
      ...base,
      label: "Key-Value",
      schemaKind: "keyvalue",
      schemaKey: "key",
      schemaValueType: "string",
      schemaValue: "value",
      content: "value",
      language: "json",
    });
  }

  return ensureNodePrimitives({
    ...base,
  });
}

export function normalizeCanvasField(field: Partial<CanvasField>): CanvasField | null {
  const rawName = typeof field.name === "string" ? field.name.trim() : "";
  if (!rawName || RESERVED_FIELD_NAMES.has(rawName)) {
    return null;
  }
  const rawType = typeof field.type === "string" ? field.type : "text";
  const type = (CANVAS_FIELD_TYPES as readonly string[]).includes(rawType) ? rawType as CanvasField["type"] : "text";
  const value = normalizeFieldValue(type, field.value);
  const options = Array.isArray(field.options)
    ? field.options.filter((entry): entry is string => typeof entry === "string").slice(0, 50)
    : undefined;
  return {
    name: rawName,
    type,
    value,
    ...(options && options.length > 0 ? { options } : {}),
  };
}

export function normalizeCanvasPort(port: Partial<CanvasPort>, fallback: "input" | "output"): CanvasPort | null {
  const id = typeof port.id === "string" ? port.id.trim() : "";
  if (!id || RESERVED_FIELD_NAMES.has(id)) {
    return null;
  }
  const allowedTypes: CanvasPort["type"][] = ["input", "output", "premise", "conclusion", "condition", "evidence", "hypothesis"];
  const type = allowedTypes.includes(port.type as CanvasPort["type"])
    ? (port.type as CanvasPort["type"])
    : fallback;
  const label = typeof port.label === "string" && port.label.trim().length > 0 ? port.label.trim() : id;
  return { id, type, label };
}

function normalizeFieldValue(type: CanvasField["type"], value: unknown): unknown {
  if (type === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return false;
  }
  if (type === "tags" || type === "multiEnum" || type === "array" || type === "file") {
    if (Array.isArray(value)) {
      return value.slice(0, 200);
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return value.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
    return [];
  }
  if (type === "object") {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    return {};
  }
  if (type === "date") {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    return "";
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function inferWorkflowRoleFromCode(code: string): WorkflowNodeRole | undefined {
  if (code === "AZ-START" || code === "AZ-TRIGGER") return "start";
  if (code === "AZ-AGENT" || code === "AZ-MANAGER" || code === "AZ-CHILD") return "agent";
  if (code === "AZ-TOOL" || code === "AZ-TOOLS" || code === "AZ-MCP" || code === "AZ-BROWSER" || code === "AZ-CODE" || code === "AZ-REGISTRY") return "tool";
  if (code === "AZ-ROUTER") return "router";
  if (code === "AZ-MEMORY") return "memory";
  if (code === "AZ-GUARDRAIL" || code === "AZ-RETRY") return "guardrail";
  if (code === "AZ-HUMAN" || code === "AZ-APPROVAL") return "human";
  if (code === "AZ-SUBGRAPH" || code === "AZ-PARALLEL" || code === "AZ-DELEGATE" || code === "AZ-MERGE") return "subgraph";
  if (code === "AZ-END" || code === "AZ-OUTPUT" || code === "AZ-NOTIFY") return "end";
  return undefined;
}

function defaultChannelsForRole(role?: WorkflowNodeRole): { inputs: string[]; outputs: string[] } {
  if (role === "start") return { inputs: [], outputs: ["messages"] };
  if (role === "end") return { inputs: ["messages"], outputs: [] };
  if (role === "memory") return { inputs: ["messages"], outputs: ["messages", "memory"] };
  if (role) return { inputs: ["messages"], outputs: ["messages"] };
  return { inputs: [], outputs: [] };
}

function normalizeChannels(channels: unknown, fallback: string[]): string[] {
  if (!Array.isArray(channels)) {
    return [...fallback];
  }
  const unique = new Set<string>();
  for (const entry of channels) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized || RESERVED_FIELD_NAMES.has(normalized)) continue;
    unique.add(normalized);
  }
  return [...unique].slice(0, 32);
}

function buildCoreFields(node: CanvasNode): CanvasField[] {
  return [
    { name: "title", type: "text", value: node.label },
    { name: "ontologyType", type: "text", value: node.ontologyCode },
    { name: "description", type: "longText", value: node.notes },
    { name: "content", type: "longText", value: node.content },
    { name: "icon", type: "text", value: node.icon },
    { name: "cluster", type: "text", value: node.cluster },
    { name: "tags", type: "tags", value: [] },
  ];
}

export function ensureNodePrimitives(node: CanvasNode): CanvasNode {
  const normalizedCustomFields = (node.fields || [])
    .map((field) => normalizeCanvasField(field))
    .filter((field): field is CanvasField => Boolean(field))
    .filter((field) => !CORE_CANVAS_FIELD_NAMES.includes(field.name as typeof CORE_CANVAS_FIELD_NAMES[number]));

  const normalizedInputs = (node.ports?.inputs || [{ id: "in-main", type: "input", label: "Input" }])
    .map((port) => normalizeCanvasPort(port, "input"))
    .filter((port): port is CanvasPort => Boolean(port));

  const normalizedOutputs = (node.ports?.outputs || [{ id: "out-main", type: "output", label: "Output" }])
    .map((port) => normalizeCanvasPort(port, "output"))
    .filter((port): port is CanvasPort => Boolean(port));
  const fallbackChannels = defaultChannelsForRole(node.workflowRole);
  const stateInputs = normalizeChannels(node.stateInputs, fallbackChannels.inputs);
  const stateOutputs = normalizeChannels(node.stateOutputs, fallbackChannels.outputs);

  return {
    ...node,
    language: node.language || "markdown",
    fields: [...buildCoreFields(node), ...normalizedCustomFields],
    ports: {
      inputs: normalizedInputs.length > 0 ? normalizedInputs : [{ id: "in-main", type: "input", label: "Input" }],
      outputs: normalizedOutputs.length > 0 ? normalizedOutputs : [{ id: "out-main", type: "output", label: "Output" }],
    },
    config: {
      isExecutable: node.config?.isExecutable !== false,
      requiresInput: Boolean(node.config?.requiresInput),
      maxInputs: typeof node.config?.maxInputs === "number" ? Math.max(0, node.config.maxInputs) : null,
      maxOutputs: typeof node.config?.maxOutputs === "number" ? Math.max(0, node.config.maxOutputs) : null,
    },
    stateInputs,
    stateOutputs,
  };
}

export function pickNodeForSentence(sentence: string): OntologyNodeType {
  const t = sentence.toLowerCase();
  const match = (keywords: string[], code: string) =>
    keywords.some((k) => t.includes(k))
      ? ONTOLOGY_NODE_TYPES.find((n) => n.code === code)
      : undefined;

  return (
    match(["question", "why", "how", "ask"], "INQ-QUESTION") ??
    match(["policy", "risk", "safe", "guard"], "SAF-POLICY") ??
    match(["retrieve", "search", "context", "find"], "RAG-RETRIEVE") ??
    match(["route", "branch", "if ", "switch"], "CTL-ROUTER") ??
    match(["evaluate", "check", "validate", "verify"], "EVL-CHECK") ??
    match(["persona", "agent", "role"], "AGT-PERSONA") ??
    match(["loop", "repeat", "retry", "iterate"], "CTL-LOOP") ??
    match(["index", "embed", "ingest"], "RAG-INDEX") ??
    match(["train", "fine-tune", "model"], "MLO-TRAIN") ??
    match(["synth", "merge", "aggregate", "summarize"], "RSN-SYNTH") ??
    ONTOLOGY_NODE_TYPES.find((n) => n.code === "RSN-DECOMPOSE") ??
    ONTOLOGY_NODE_TYPES[0]
  );
}

export function buildWorkflowFromText(input: string): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const sentences = input
    .split(/\n+|\.(?=\s|$)/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 12);

  const source = sentences.length > 0
    ? sentences
    : ["Define intent", "Retrieve context", "Generate output"];

  const nodes = source.map((sentence, i) => {
    const nodeType = pickNodeForSentence(sentence);
    const node = makeNodeFromType(nodeType, i);
    return { ...node, label: nodeType.label, notes: sentence, content: sentence };
  });

  const edges = nodes.slice(1).map((node, i) => ({
    id: `edge-${Date.now()}-${i}`,
    source: nodes[i].id,
    target: node.id,
  }));

  return { nodes, edges };
}

/** Validate a workflow and return structured problems. */
export function validateWorkflow(nodes: CanvasNode[], edges: CanvasEdge[]): WorkflowProblem[] {
  const problems: WorkflowProblem[] = [];
  const ids = new Set<string>();
  const dupes = new Set<string>();

  for (const n of nodes) {
    if (ids.has(n.id)) dupes.add(n.id);
    else ids.add(n.id);
    if (!n.label.trim()) {
      problems.push({ severity: "error", where: "node", id: n.id, message: "Missing label" });
    }
    if (n.config?.requiresInput) {
      const inbound = edges.filter((edge) => edge.target === n.id).length;
      if (inbound === 0) {
        problems.push({ severity: "warn", where: "node", id: n.id, message: "Node requires input but has no inbound edges" });
      }
    }
    const maxInputs = n.config?.maxInputs;
    if (typeof maxInputs === "number" && maxInputs >= 0) {
      const inbound = edges.filter((edge) => edge.target === n.id).length;
      if (inbound > maxInputs) {
        problems.push({ severity: "warn", where: "node", id: n.id, message: `Inbound edges exceed maxInputs (${maxInputs})` });
      }
    }
    const maxOutputs = n.config?.maxOutputs;
    if (typeof maxOutputs === "number" && maxOutputs >= 0) {
      const outbound = edges.filter((edge) => edge.source === n.id).length;
      if (outbound > maxOutputs) {
        problems.push({ severity: "warn", where: "node", id: n.id, message: `Outbound edges exceed maxOutputs (${maxOutputs})` });
      }
    }
  }

  const workflowNodes = nodes.filter((node) => Boolean(node.workflowRole));
  if (workflowNodes.length > 0) {
    const startNodes = workflowNodes.filter((node) => node.workflowRole === "start");
    const endNodes = workflowNodes.filter((node) => node.workflowRole === "end");
    if (startNodes.length === 0) {
      problems.push({ severity: "warn", where: "schema", id: "workflow-start", message: "Workflow should include a start node" });
    }
    if (endNodes.length === 0) {
      problems.push({ severity: "warn", where: "schema", id: "workflow-end", message: "Workflow should include an end node" });
    }
    for (const node of startNodes) {
      const inbound = edges.filter((edge) => edge.target === node.id).length;
      if (inbound > 0) {
        problems.push({ severity: "warn", where: "node", id: node.id, message: "Start node should not have inbound edges" });
      }
    }
    for (const node of endNodes) {
      const outbound = edges.filter((edge) => edge.source === node.id).length;
      if (outbound > 0) {
        problems.push({ severity: "warn", where: "node", id: node.id, message: "End node should not have outbound edges" });
      }
    }
  }
  for (const id of dupes) {
    problems.push({ severity: "error", where: "node", id, message: "Duplicate node ID" });
  }

  for (const e of edges) {
    const sourceNode = nodes.find((node) => node.id === e.source);
    const targetNode = nodes.find((node) => node.id === e.target);
    if (!ids.has(e.source)) {
      problems.push({ severity: "error", where: "edge", id: e.id, message: `Dangling source → ${e.source}` });
    }
    if (!ids.has(e.target)) {
      problems.push({ severity: "error", where: "edge", id: e.id, message: `Dangling target → ${e.target}` });
    }
    if (e.source === e.target) {
      problems.push({ severity: "warn", where: "edge", id: e.id, message: "Self-loop edge" });
    }
    if (sourceNode && targetNode && e.sourceHandle && e.targetHandle) {
      const sourcePort = sourceNode.ports?.outputs?.find((port) => port.id === e.sourceHandle)
        ?? sourceNode.ports?.inputs?.find((port) => port.id === e.sourceHandle);
      const targetPort = targetNode.ports?.inputs?.find((port) => port.id === e.targetHandle)
        ?? targetNode.ports?.outputs?.find((port) => port.id === e.targetHandle);
      if (sourcePort && targetPort && !canConnectPorts(sourcePort.type, targetPort.type)) {
        problems.push({
          severity: "warn",
          where: "edge",
          id: e.id,
          message: `Port mismatch: ${sourcePort.type} cannot connect to ${targetPort.type}`,
        });
      }
    }
    const transitionMode = e.data?.transition?.mode;
    const transitionExpression = e.data?.transition?.expression?.trim() || "";
    if (transitionMode === "when" || transitionMode === "whenNot") {
      if (!transitionExpression) {
        problems.push({ severity: "warn", where: "edge", id: e.id, message: "Conditional transition requires an expression" });
      }
    }
    const transitionChannel = e.data?.transition?.channel?.trim();
    if (transitionChannel && sourceNode && targetNode) {
      const sourceChannels = new Set(sourceNode.stateOutputs || []);
      const targetChannels = new Set(targetNode.stateInputs || []);
      if (!sourceChannels.has(transitionChannel)) {
        problems.push({ severity: "warn", where: "edge", id: e.id, message: `Source node does not emit state channel '${transitionChannel}'` });
      }
      if (!targetChannels.has(transitionChannel)) {
        problems.push({ severity: "warn", where: "edge", id: e.id, message: `Target node does not accept state channel '${transitionChannel}'` });
      }
    }
  }

  if (nodes.length === 0) {
    problems.push({ severity: "info", where: "schema", id: "empty", message: "Workflow has no nodes" });
  }

  return problems;
}

export function canConnectPorts(sourceType: CanvasPort["type"], targetType: CanvasPort["type"]): boolean {
  const sourceAllowed: Record<CanvasPort["type"], CanvasPort["type"][]> = {
    input: [],
    output: ["input", "condition", "premise", "evidence", "hypothesis"],
    premise: ["condition", "input", "conclusion"],
    conclusion: ["input", "condition", "premise"],
    condition: ["input", "condition"],
    evidence: ["premise", "hypothesis", "input"],
    hypothesis: ["evidence", "condition", "input"],
  };
  return sourceAllowed[sourceType].includes(targetType);
}

export function getDefaultOutputPort(node: CanvasNode): CanvasPort {
  const preferred = node.ports?.outputs?.[0];
  if (preferred) {
    return preferred;
  }
  return { id: "out-main", type: "output", label: "Output" };
}

export function getDefaultInputPort(node: CanvasNode): CanvasPort {
  const preferred = node.ports?.inputs?.[0];
  if (preferred) {
    return preferred;
  }
  return { id: "in-main", type: "input", label: "Input" };
}

export function buildExecutionPlan(nodes: CanvasNode[], edges: CanvasEdge[]): WorkflowExecutionPlan {
  const nodeIds = nodes.map((node) => node.id);
  const indegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) {
      continue;
    }
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }

  const queue = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const nextInDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextInDegree);
      if (nextInDegree === 0) {
        queue.push(next);
      }
    }
  }

  const blockedNodes = nodeIds.filter((id) => !order.includes(id));
  return {
    order,
    hasCycle: blockedNodes.length > 0,
    blockedNodes,
  };
}

/** Serialize workflow data as formatted JSON. */
export function serializeWorkflow(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  const data: WorkflowData = {
    nodes,
    edges,
    metadata: {
      exportedAt: new Date().toISOString(),
      version: "2.0.0",
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
  return JSON.stringify(data, null, 2);
}

/** Parse workflow JSON safely; returns null on parse failure. */
export function parseWorkflowJson(json: string): WorkflowData | null {
  try {
    const obj = JSON.parse(json) as WorkflowData;
    if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return null;
    return obj;
  } catch {
    return null;
  }
}
