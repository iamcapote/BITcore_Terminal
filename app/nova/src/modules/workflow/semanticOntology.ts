/**
 * Why: Preserve semantic_flow ontology intent while modernizing for Nova maintainability.
 * What: Full upstream ontology clusters and node templates plus local schema-builder primitives.
 * How: Vendor ontology data stubs (upstream library removed); schema node types defined locally.
 */

/* Vendor library removed — stubs keep the build clean until a real provider is wired. */
const VENDOR_CLUSTER_COLORS: Record<string, string> = {};
const VENDOR_NODE_TYPES: Record<string, VendorNodeType> = {};
const VENDOR_ONTOLOGY_CLUSTERS: Record<string, VendorCluster> = {};

export interface OntologyCluster {
  readonly code: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly color: string;
}

export interface OntologyNodeType {
  readonly code: string;
  readonly label: string;
  readonly cluster: string;
  readonly icon: string;
  readonly description: string;
  readonly tags: readonly string[];
}

interface VendorCluster {
  readonly name?: string;
  readonly icon?: string;
  readonly description?: string;
}

interface VendorNodeType {
  readonly label?: string;
  readonly icon?: string;
  readonly tags?: readonly string[];
  readonly description?: string;
  readonly cluster?: string;
}

const vendorClusterEntries = Object.entries(VENDOR_ONTOLOGY_CLUSTERS as Record<string, VendorCluster>);
const vendorNodeEntries = Object.entries(VENDOR_NODE_TYPES as Record<string, VendorNodeType>);

const normalizedClusters: OntologyCluster[] = vendorClusterEntries
  .map(([code, cluster]) => ({
    code,
    name: cluster.name ?? code,
    icon: cluster.icon ?? "🧩",
    description: cluster.description ?? "",
    color: (VENDOR_CLUSTER_COLORS as Record<string, string>)[code] ?? "#64748B",
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

const normalizedNodes: OntologyNodeType[] = vendorNodeEntries
  .map(([code, node]) => ({
    code,
    label: node.label ?? code,
    cluster: node.cluster ?? "UTIL",
    icon: node.icon ?? "🧩",
    description: node.description ?? "",
    tags: Array.isArray(node.tags) ? [...node.tags] : [],
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

const schemaNodes: OntologyNodeType[] = [
  { code: "JSON-OBJECT", label: "Object", cluster: "UTIL", icon: "🧱", description: "JSON object container with keyed child relations.", tags: ["json", "schema", "object"] },
  { code: "JSON-ARRAY", label: "Array", cluster: "UTIL", icon: "📚", description: "JSON array container with ordered item relations.", tags: ["json", "schema", "array"] },
  { code: "JSON-KEYVALUE", label: "Key-Value", cluster: "UTIL", icon: "🧩", description: "Typed scalar key-value field for schema definitions.", tags: ["json", "schema", "primitive"] },
];

for (const schemaNode of schemaNodes) {
  if (!normalizedNodes.some((node) => node.code === schemaNode.code)) {
    normalizedNodes.push(schemaNode);
  }
}

export const ONTOLOGY_CLUSTERS: readonly OntologyCluster[] = normalizedClusters;

export const ONTOLOGY_NODE_TYPES: readonly OntologyNodeType[] = normalizedNodes
  .slice()
  .sort((a, b) => a.code.localeCompare(b.code));

export function getClusterByCode(code: string): OntologyCluster | undefined {
  return ONTOLOGY_CLUSTERS.find((cluster) => cluster.code === code);
}

export function getNodesByCluster(code: string): OntologyNodeType[] {
  return ONTOLOGY_NODE_TYPES.filter((node) => node.cluster === code);
}
