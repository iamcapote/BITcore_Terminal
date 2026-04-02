declare module "*semantic_flow/src/lib/ontology.js" {
  export const ONTOLOGY_CLUSTERS: Record<string, { name?: string; icon?: string; description?: string }>;
  export const NODE_TYPES: Record<string, { label?: string; icon?: string; tags?: readonly string[]; description?: string; cluster?: string }>;
  export const CLUSTER_COLORS: Record<string, string>;
}
