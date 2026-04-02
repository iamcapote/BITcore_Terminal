/**
 * Why: Define mode-specific ontology palettes for Schema and Workflows canvases.
 * What: Exports curated node templates, utility primitives, and defaults per workspace kind.
 * How: Classifies ontology nodes via explicit cluster+code membership, not keyword heuristics.
 *      Both workspaces share a composable utility suite (blank, note, group, variable) so
 *      every canvas starts with generic building blocks ready for specialization.
 */

import { ONTOLOGY_NODE_TYPES, type OntologyNodeType } from "@/modules/workflow/semanticOntology";

/* ── Public types ──────────────────────────────────────────────────── */

export type WorkflowWorkspaceKind = "schema" | "workflows";

export interface WorkspacePaletteSet {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly nodeCodes: readonly string[];
}

/* ── Utility suite (shared across both workspaces) ─────────────────── */
/* Generic composable primitives: blank canvases, notes, groups, variables.
   These enable modular graphs regardless of workspace purpose. */

const UTILITY_NODE_TYPES: readonly OntologyNodeType[] = [
  {
    code: "UTIL-BLANK",
    label: "Blank",
    cluster: "UTIL",
    icon: "⬜",
    description: "Empty composable node. Wire it into any graph as a placeholder or custom step.",
    tags: ["utility", "blank", "composable"],
  },
  {
    code: "UTIL-NOTE",
    label: "Note",
    cluster: "UTIL",
    icon: "📝",
    description: "Annotation node for documenting intent, design decisions, or context.",
    tags: ["utility", "note", "comment", "documentation"],
  },
  {
    code: "UTIL-GROUP",
    label: "Group",
    cluster: "UTIL",
    icon: "📦",
    description: "Logical container that groups related nodes for clarity and encapsulation.",
    tags: ["utility", "group", "container", "encapsulation"],
  },
  {
    code: "UTIL-VAR",
    label: "Variable",
    cluster: "UTIL",
    icon: "🔤",
    description: "Named variable node. Store and reference values across the graph.",
    tags: ["utility", "variable", "reference", "state"],
  },
  {
    code: "UTIL-CONST",
    label: "Constant",
    cluster: "UTIL",
    icon: "🔒",
    description: "Immutable constant value. Use for fixed config, thresholds, or literals.",
    tags: ["utility", "constant", "literal", "config"],
  },
  {
    code: "UTIL-IO",
    label: "I/O Port",
    cluster: "UTIL",
    icon: "🔌",
    description: "External input/output boundary. Marks data entry and exit points of a subgraph.",
    tags: ["utility", "io", "port", "boundary", "interface"],
  },
];

/* ── Schema-native node types (JSON builders) ──────────────────────── */

const SCHEMA_NATIVE_TYPES: readonly OntologyNodeType[] = [
  {
    code: "JSON-OBJECT",
    label: "Object",
    cluster: "UTIL",
    icon: "🧱",
    description: "JSON object container with keyed child relations.",
    tags: ["schema", "json", "object"],
  },
  {
    code: "JSON-ARRAY",
    label: "Array",
    cluster: "UTIL",
    icon: "📚",
    description: "JSON array container with ordered item relations.",
    tags: ["schema", "json", "array"],
  },
  {
    code: "JSON-KEYVALUE",
    label: "Key-Value",
    cluster: "UTIL",
    icon: "🧩",
    description: "Typed scalar key-value field for schema definitions.",
    tags: ["schema", "json", "field"],
  },
];

/* ── Schema classifier ─────────────────────────────────────────────── */
/* Schema = nodes that define data shape, structure, format, or schema.
   Workflow = nodes that define operations, processes, transformations, or flow.
   Classification uses explicit cluster and code assignments to avoid false positives
   from broad keyword matching (e.g., "AgentBasedModel" is an operation, not a schema). */

/** Entire cluster classifies as schema: data engineering and knowledge-graph definitions. */
const SCHEMA_CLUSTER_CODES = new Set(["DSE", "KGE"]);

/** Individual node codes that belong in schema despite their cluster being operational.
 *  These are serialization formats, data structures, or structural blueprints. */
const SCHEMA_OVERRIDE_CODES = new Set([
  // Serialization/format definitions
  "CODE-JSON",
  "CODE-XML",
  "CODE-YAML",
  "CODE-DATAFLOW",
  // Bioinformatics data formats (structure, not pipeline)
  "BIO-VCF",
  "BIO-STRUCT",
  "BIO-ANN",
  "BIO-FASTA",
  "BIO-FASTQ",
  "BIO-GFF3",
  "BIO-SAM",
  "BIO-CRAM",
  // Schematics and structural models
  "EEE-SCH",
  "EEE-STEP",
  "ELE-SCHEM",
  // Fabrication data formats
  "FAB-3D-MDL",
  "FAB-3MF",
  "FAB-AMF",
  "FAB-GCODE",
  // Cognitive schema
  "COG-SCH",
  // Graph/network structure definition
  "NET-G",
  // Propositions as data records
  "PROP-CLM",
  "PROP-OBS",
  // Raw data / hypothesis definitions
  "HEM-DAT",
  "HEM-HYP",
  // Tokenization as text structure
  "TOK-VOCAB",
]);

/** Nodes that should stay in workflow even if their cluster is schema-classified.
 *  These are operational/process nodes housed in DSE or KGE clusters. */
const WORKFLOW_OVERRIDE_CODES = new Set([
  "DSE-SYN",   // SyntheticDataGen is a process, not a structure
  "KGE-ETL",   // GraphETL is an operation pipeline
]);

function isSchemaOntologyNodeType(nodeType: OntologyNodeType): boolean {
  // Explicit JSON-prefix nodes are always schema
  if (nodeType.code.startsWith("JSON-")) return true;
  // Override to workflow takes precedence
  if (WORKFLOW_OVERRIDE_CODES.has(nodeType.code)) return false;
  // Explicit code-level schema assignment
  if (SCHEMA_OVERRIDE_CODES.has(nodeType.code)) return true;
  // Full-cluster schema assignment
  if (SCHEMA_CLUSTER_CODES.has(nodeType.cluster)) return true;
  return false;
}

/* ── Derived node lists ────────────────────────────────────────────── */

/** Ontology nodes (excluding JSON-builders and UTIL-BLANK) classified as schema. */
const ONTOLOGY_SCHEMA_NODES: readonly OntologyNodeType[] = ONTOLOGY_NODE_TYPES
  .filter((n) => !n.code.startsWith("JSON-") && !n.code.startsWith("UTIL-"))
  .filter(isSchemaOntologyNodeType);

/** Ontology nodes classified as workflow (operational flow). */
const ONTOLOGY_WORKFLOW_NODES: readonly OntologyNodeType[] = ONTOLOGY_NODE_TYPES
  .filter((n) => !n.code.startsWith("JSON-") && !n.code.startsWith("UTIL-"))
  .filter((n) => !isSchemaOntologyNodeType(n));

/** Complete schema palette: utility suite + JSON builders + ontology schema nodes. */
const SCHEMA_WORKSPACE_NODE_TYPES: readonly OntologyNodeType[] = [
  ...UTILITY_NODE_TYPES,
  ...SCHEMA_NATIVE_TYPES,
  ...ONTOLOGY_SCHEMA_NODES,
];

/** Complete workflow palette: utility suite + all operational ontology nodes. */
const WORKFLOW_WORKSPACE_NODE_TYPES: readonly OntologyNodeType[] = [
  ...UTILITY_NODE_TYPES,
  ...ONTOLOGY_WORKFLOW_NODES,
];

/* ── Defaults ──────────────────────────────────────────────────────── */

const SCHEMA_DEFAULT_CODES = ["JSON-OBJECT", "JSON-KEYVALUE", "UTIL-BLANK"] as const;

const WORKFLOW_DEFAULT_CODES: readonly string[] = (() => {
  const preferred = ["AGT-ARCH", "CTL-SEQ", "AGT-TOOL"] as const;
  const available = new Set(ONTOLOGY_WORKFLOW_NODES.map((n) => n.code));
  const found = preferred.filter((code) => available.has(code));
  if (found.length > 0) return found;
  return ONTOLOGY_WORKFLOW_NODES.slice(0, 3).map((n) => n.code);
})();

/* ── Palette sets ──────────────────────────────────────────────────── */

const SCHEMA_PALETTE_SETS: readonly WorkspacePaletteSet[] = [
  {
    id: "starter",
    label: "Starter",
    description: "Essential schema primitives for fast data modeling.",
    nodeCodes: ["JSON-OBJECT", "JSON-ARRAY", "JSON-KEYVALUE", "UTIL-BLANK"],
  },
  {
    id: "utility",
    label: "Utility",
    description: "Composable building blocks: blanks, notes, groups, variables.",
    nodeCodes: UTILITY_NODE_TYPES.map((n) => n.code),
  },
  {
    id: "containers",
    label: "Containers",
    description: "Structure containers for nested schema graphs.",
    nodeCodes: ["JSON-OBJECT", "JSON-ARRAY"],
  },
  {
    id: "fields",
    label: "Fields",
    description: "Typed field primitives for value-level modeling.",
    nodeCodes: ["JSON-KEYVALUE"],
  },
];

const WORKFLOW_PALETTE_SETS: readonly WorkspacePaletteSet[] = [
  {
    id: "all",
    label: "All Nodes",
    description: "Every operational ontology node plus composable utilities.",
    nodeCodes: WORKFLOW_WORKSPACE_NODE_TYPES.map((n) => n.code),
  },
  {
    id: "utility",
    label: "Utility",
    description: "Composable building blocks: blanks, notes, groups, variables.",
    nodeCodes: UTILITY_NODE_TYPES.map((n) => n.code),
  },
  ...Array.from(new Set(ONTOLOGY_WORKFLOW_NODES.map((n) => n.cluster)))
    .sort((a, b) => a.localeCompare(b))
    .map((clusterCode) => ({
      id: `cluster-${clusterCode.toLowerCase()}`,
      label: `${clusterCode} Cluster`,
      description: `Operational nodes in ${clusterCode}.`,
      nodeCodes: ONTOLOGY_WORKFLOW_NODES
        .filter((n) => n.cluster === clusterCode)
        .map((n) => n.code),
    })),
];

/* ── Public API ────────────────────────────────────────────────────── */

export function getWorkspaceNodeTypes(kind: WorkflowWorkspaceKind): readonly OntologyNodeType[] {
  return kind === "schema" ? SCHEMA_WORKSPACE_NODE_TYPES : WORKFLOW_WORKSPACE_NODE_TYPES;
}

export function getWorkspaceDefaultNodeCodes(kind: WorkflowWorkspaceKind): readonly string[] {
  return kind === "schema" ? SCHEMA_DEFAULT_CODES : WORKFLOW_DEFAULT_CODES;
}

export function getWorkspacePaletteSets(kind: WorkflowWorkspaceKind): readonly WorkspacePaletteSet[] {
  return kind === "schema" ? SCHEMA_PALETTE_SETS : WORKFLOW_PALETTE_SETS;
}

export function getDefaultPaletteSetIds(kind: WorkflowWorkspaceKind): readonly string[] {
  const starterSet = getWorkspacePaletteSets(kind).find((entry) => entry.id === "starter");
  return starterSet ? [starterSet.id] : [];
}

export function getUtilityNodeTypes(): readonly OntologyNodeType[] {
  return UTILITY_NODE_TYPES;
}

export { isSchemaOntologyNodeType };
