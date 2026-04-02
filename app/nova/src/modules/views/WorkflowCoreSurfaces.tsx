/**
 * Why: Expose dedicated core surfaces for Schema and Workflows without duplicating builder implementation.
 * What: Thin wrappers around WorkflowBuilderSurface with mode-aware intent.
 * How: Pass workspaceKind + view locks so each surface maps to one clear operator mental model.
 */

import { WorkflowBuilderSurface } from "@/modules/views/WorkflowBuilderSurface";

/* ── Dedicated core surfaces ───────────────────────────────────────── */

export function SchemaSurface(): JSX.Element {
  return <WorkflowBuilderSurface initialView="canvas" lockView workspaceKind="schema" />;
}

export function WorkflowsSurface(): JSX.Element {
  return <WorkflowBuilderSurface initialView="canvas" lockView workspaceKind="workflows" />;
}
