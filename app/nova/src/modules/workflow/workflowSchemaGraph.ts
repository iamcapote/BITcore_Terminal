/**
 * Why: Provide deterministic schema-builder round-trip conversion between workflow graphs and plain JSON.
 * What: Converts JSON -> schema nodes/edges and schema nodes/edges -> JSON values.
 * How: Uses recursive traversal with stable ordering, type-safe primitive parsing, and cycle guards.
 */

import type { CanvasEdge, CanvasNode } from "@/modules/workflow/workflowTypes";

const X_GAP = 300;
const Y_GAP = 160;

function createNodeId(seed: number): string {
  return `schema-${Date.now()}-${seed}`;
}

export type SchemaNodeKind = "object" | "array" | "keyvalue";
export type SchemaValueType = "string" | "number" | "boolean" | "null";

export function isSchemaNode(node: CanvasNode): boolean {
  return node.ontologyCode === "JSON-OBJECT" || node.ontologyCode === "JSON-ARRAY" || node.ontologyCode === "JSON-KEYVALUE";
}

export function schemaKindForNode(node: CanvasNode): SchemaNodeKind | null {
  if (node.schemaKind) {
    return node.schemaKind;
  }
  if (node.ontologyCode === "JSON-OBJECT") return "object";
  if (node.ontologyCode === "JSON-ARRAY") return "array";
  if (node.ontologyCode === "JSON-KEYVALUE") return "keyvalue";
  return null;
}

function guessValueType(value: unknown): SchemaValueType {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

export function parseSchemaPrimitive(type: SchemaValueType, rawValue: string): unknown {
  switch (type) {
    case "null":
      return null;
    case "boolean": {
      const value = rawValue.trim().toLowerCase();
      return value === "true";
    }
    case "number": {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case "string":
    default:
      return rawValue;
  }
}

function stringifyPrimitive(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function makeSchemaNode(kind: SchemaNodeKind, seed: number, x: number, y: number): CanvasNode {
  if (kind === "object") {
    return {
      id: createNodeId(seed),
      ontologyCode: "JSON-OBJECT",
      cluster: "UTIL",
      icon: "🧱",
      color: "#7c83ff",
      x,
      y,
      label: "object",
      notes: "Children will appear connected below",
      content: "",
      schemaKind: "object",
      schemaKey: "object",
    };
  }
  if (kind === "array") {
    return {
      id: createNodeId(seed),
      ontologyCode: "JSON-ARRAY",
      cluster: "UTIL",
      icon: "📚",
      color: "#7c83ff",
      x,
      y,
      label: "array",
      notes: "Array items will appear connected below",
      content: "",
      schemaKind: "array",
      schemaKey: "array",
    };
  }
  return {
    id: createNodeId(seed),
    ontologyCode: "JSON-KEYVALUE",
    cluster: "UTIL",
    icon: "🧩",
    color: "#7c83ff",
    x,
    y,
    label: "Key-Value",
    notes: "",
    content: "",
    schemaKind: "keyvalue",
    schemaKey: "key",
    schemaValueType: "string",
    schemaValue: "value",
  };
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createSchemaGraphFromJson(input: unknown): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  let seed = 0;
  let row = 0;

  function walk(value: unknown, depth: number, parentId: string | null, key: string | null): string {
    const x = 80 + depth * X_GAP;
    const y = 80 + row * Y_GAP;
    row += 1;

    let node: CanvasNode;
    if (Array.isArray(value)) {
      node = makeSchemaNode("array", seed++, x, y);
      node.label = key ?? node.label;
      node.schemaKey = key ?? node.schemaKey;
    } else if (isObjectValue(value)) {
      node = makeSchemaNode("object", seed++, x, y);
      node.label = key ?? node.label;
      node.schemaKey = key ?? node.schemaKey;
    } else {
      node = makeSchemaNode("keyvalue", seed++, x, y);
      node.schemaKey = key ?? node.schemaKey;
      node.label = key ? "Key-Value" : node.label;
      node.schemaValueType = guessValueType(value);
      node.schemaValue = stringifyPrimitive(value);
      node.content = node.schemaValue;
    }

    nodes.push(node);

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        data: {
          operator: "contains",
          condition: "always",
          weight: 1,
          metadata: { label: key ?? "item" },
        },
      });
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        walk(entry, depth + 1, node.id, `item_${index + 1}`);
      });
    } else if (isObjectValue(value)) {
      Object.entries(value).forEach(([entryKey, entryValue]) => {
        walk(entryValue, depth + 1, node.id, entryKey);
      });
    }

    return node.id;
  }

  if (Array.isArray(input) || isObjectValue(input)) {
    walk(input, 0, null, Array.isArray(input) ? "root_array" : "root_object");
  } else {
    walk(input, 0, null, "value");
  }

  return { nodes, edges };
}

export function buildJsonFromSchemaGraph(nodes: CanvasNode[], edges: CanvasEdge[]): unknown {
  const schemaNodes = nodes.filter(isSchemaNode);
  if (schemaNodes.length === 0) {
    return null;
  }

  const nodeById = new Map(schemaNodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, CanvasEdge[]>();
  const incomingCount = new Map<string, number>();

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      continue;
    }
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  const roots = schemaNodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .sort((a, b) => a.x - b.x || a.y - b.y);

  const visitedStack = new Set<string>();

  function nodeKey(node: CanvasNode): string {
    const raw = node.schemaKey?.trim() || node.label.trim() || node.id;
    return raw;
  }

  function build(node: CanvasNode): unknown {
    if (visitedStack.has(node.id)) {
      return null;
    }
    visitedStack.add(node.id);

    const kind = schemaKindForNode(node);
    const children = (outgoing.get(node.id) ?? [])
      .map((edge) => nodeById.get(edge.target))
      .filter((entry): entry is CanvasNode => Boolean(entry))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    let output: unknown;
    if (kind === "array") {
      output = children.map((child) => build(child));
    } else if (kind === "object") {
      const record: Record<string, unknown> = {};
      for (const child of children) {
        const childKind = schemaKindForNode(child);
        const key = nodeKey(child);
        if (childKind === "keyvalue") {
          const valueType = child.schemaValueType ?? "string";
          const value = parseSchemaPrimitive(valueType, child.schemaValue ?? "");
          record[key] = value;
        } else {
          record[key] = build(child);
        }
      }
      output = record;
    } else {
      const valueType = node.schemaValueType ?? "string";
      output = parseSchemaPrimitive(valueType, node.schemaValue ?? "");
    }

    visitedStack.delete(node.id);
    return output;
  }

  if (roots.length === 1) {
    return build(roots[0]);
  }

  const multiRoot: Record<string, unknown> = {};
  for (const root of roots) {
    multiRoot[nodeKey(root)] = build(root);
  }
  return multiRoot;
}
