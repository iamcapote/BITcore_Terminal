/**
 * @license INTERNAL ONLY — Nova Shell Types
 *
 * Core layout contracts used by the Nova shell. Each surface represents a modular
 * panel (Explorer, Vectors, Tasks, etc.) that can be placed in the primary stage,
 * the bottom dock, or the right insights rail. Surfaces are configured in Step 1
 * before the legacy GUI and vendor features are merged in Step 2.
 */

import type { LucideIcon } from "lucide-react";

export type WiringStatus = "unwired" | "partial" | "wired";

export type Placement = "primary" | "bottom" | "right" | "hidden";

export type SurfaceGroup =
  | "core"
  | "agents"
  | "tools"
  | "system";

export type SurfaceId =
  | "dashboard"
  | "schema"
  | "explorer"
  | "vectors"
  | "databases"
  | "skills"
  | "computer"
  | "mcp"
  | "memory"
  | "agents"
  | "terminal"
  | "chat"
  | "workflows"
  | "research"
  | "prompts"
  | "missions"
  | "githubSync"
  | "logs"
  | "browser"
  | "settings";

export interface SurfaceDefinition {
  readonly id: SurfaceId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: SurfaceGroup;
  readonly badge?: string;
  readonly defaultPlacement: Placement;
  readonly initialPlacement?: Placement;
  readonly wiringStatus?: WiringStatus;
}

export interface SurfaceState extends SurfaceDefinition {
  placement: Placement;
}

export type ActiveByPlacement = Record<Exclude<Placement, "hidden">, SurfaceId | null>;
