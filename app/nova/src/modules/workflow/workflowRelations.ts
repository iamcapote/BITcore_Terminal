/**
 * Why: Keep workflow relation semantics centralized across canvas inspector and modal editors.
 * What: Declares supported relation operators/conditions and metadata helpers for labels/colors/icons.
 * How: Exposes readonly arrays plus lookup functions consumed by workflow surfaces and dialogs.
 */

export interface RelationOperatorMeta {
  readonly label: string;
  readonly icon: string;
  readonly color: string;
  readonly description: string;
}

export const RELATION_OPERATOR_META: Record<string, RelationOperatorMeta> = {
  related: {
    label: "Related",
    icon: "↔",
    color: "#334155",
    description: "General semantic association.",
  },
  depends_on: {
    label: "Depends On",
    icon: "⤴",
    color: "#7c3aed",
    description: "Source requires target before execution.",
  },
  enables: {
    label: "Enables",
    icon: "✓",
    color: "#15803d",
    description: "Source unlocks or activates target.",
  },
  blocks: {
    label: "Blocks",
    icon: "⛔",
    color: "#b91c1c",
    description: "Source prevents target progression.",
  },
  informs: {
    label: "Informs",
    icon: "ℹ",
    color: "#0369a1",
    description: "Source provides context to target.",
  },
  connected: {
    label: "Connected",
    icon: "🪢",
    color: "#2563eb",
    description: "Nodes are connected in the workflow or ontology.",
  },
  summarization: {
    label: "Summarization",
    icon: "📝",
    color: "#64748B",
    description: "Captures or summarizes information.",
  },
  clustering: {
    label: "Clustering",
    icon: "🧩",
    color: "#a855f7",
    description: "Groups similar items or concepts.",
  },
  chronology: {
    label: "Chronology",
    icon: "⏱️",
    color: "#22c55e",
    description: "Orders events by time.",
  },
  causality: {
    label: "Causality",
    icon: "⚡",
    color: "#ef4444",
    description: "Cause-effect relationship.",
  },
  anomalies: {
    label: "Anomalies",
    icon: "🧨",
    color: "#f97316",
    description: "Detects outliers or anomalies.",
  },
  forecasting: {
    label: "Forecasting",
    icon: "📈",
    color: "#0ea5e9",
    description: "Predicts future values.",
  },
  visualization: {
    label: "Visualization",
    icon: "📊",
    color: "#14b8a6",
    description: "Represents via charts or graph visuals.",
  },
  correlation: {
    label: "Correlation",
    icon: "🔬",
    color: "#06b6d4",
    description: "Statistical correlation relationship.",
  },
  outlining: {
    label: "Outlining",
    icon: "🧾",
    color: "#10b981",
    description: "Creates hierarchical outline structure.",
  },
  arithmetic: {
    label: "Arithmetic",
    icon: "➗",
    color: "#71717a",
    description: "Performs numerical calculations.",
  },
  filtering: {
    label: "Filtering",
    icon: "🧹",
    color: "#22c55e",
    description: "Filters data by criteria.",
  },
  tagging: {
    label: "Tagging",
    icon: "🏷️",
    color: "#f59e0b",
    description: "Assigns labels and tags.",
  },
  validation: {
    label: "Validation",
    icon: "✅",
    color: "#84cc16",
    description: "Validates content or logic.",
  },
  annotation: {
    label: "Annotation",
    icon: "🗒️",
    color: "#f43f5e",
    description: "Adds notes and structured annotations.",
  },
  indexing: {
    label: "Indexing",
    icon: "🗂️",
    color: "#6b7280",
    description: "Indexes data or corpus segments.",
  },
  extraction: {
    label: "Extraction",
    icon: "🧵",
    color: "#8b5cf6",
    description: "Extracts entities and structured facts.",
  },
  sorting: {
    label: "Sorting",
    icon: "🔢",
    color: "#6366f1",
    description: "Sorts records or candidate sets.",
  },
  merging: {
    label: "Merging",
    icon: "🧬",
    color: "#0ea5e9",
    description: "Merges streams, records, or branches.",
  },
  normalization: {
    label: "Normalization",
    icon: "🧰",
    color: "#0891b2",
    description: "Normalizes and standardizes values.",
  },
  hierarchy: {
    label: "Hierarchy",
    icon: "🌲",
    color: "#ef4444",
    description: "Defines parent-child structure.",
  },
};

export const RELATION_OPERATORS = Object.entries(RELATION_OPERATOR_META).map(([value, meta]) => ({
  value,
  label: meta.label,
})) as ReadonlyArray<{ value: string; label: string }>;

export const RELATION_CONDITIONS = [
  "always",
  "optional",
  "follows",
  "if_true",
  "if_false",
  "implies",
  "supports",
  "contradicts",
  "refines",
  "exemplifies",
  "enables",
  "depends_on",
] as const;

export const DEFAULT_RELATION_OPERATOR = "related";
export const DEFAULT_RELATION_CONDITION = "follows";

export function normalizeRelationOperatorToken(operator: string | undefined): string {
  if (!operator) {
    return DEFAULT_RELATION_OPERATOR;
  }
  const canonical = operator.trim().toLowerCase().replace(/\s+/g, "_");
  return canonical.length > 0 ? canonical : DEFAULT_RELATION_OPERATOR;
}

export function getRelationOperatorMeta(operator: string | undefined): RelationOperatorMeta {
  if (!operator || operator.trim().length === 0) {
    return RELATION_OPERATOR_META[DEFAULT_RELATION_OPERATOR];
  }
  const canonical = normalizeRelationOperatorToken(operator);
  if (RELATION_OPERATOR_META[canonical]) {
    return RELATION_OPERATOR_META[canonical];
  }
  return {
    label: operator.trim(),
    icon: "✳",
    color: "#4b5563",
    description: "Custom operator defined for this schema relation.",
  };
}
