/**
 * Why: Provide typed fetch access to workflow checkpoint endpoints for the Nova Agents surface.
 * What: CRUD client for checkpoint save/get/list/resume/abandon seams added in Pass 12 (Deerflow).
 * How: Mirrors swarmClient fetch pattern with normalization guards and fallback-safe returns.
 */

/* ── Types ─────────────────────────────────────────────────────────── */

export type CheckpointState = "queued" | "running" | "interrupted" | "awaiting_approval" | "done" | "abandoned";

export interface CheckpointThread {
  readonly step: number;
  readonly phase: string;
  readonly variables: Record<string, unknown>;
  readonly interruptReason: string | null;
}

export interface CheckpointHistoryEntry {
  readonly state: CheckpointState;
  readonly at: string;
  readonly approvalNote?: string;
}

export interface CheckpointSnapshot {
  readonly source: string;
  readonly workflowId: string;
  readonly state: CheckpointState;
  readonly thread: CheckpointThread;
  readonly history: readonly CheckpointHistoryEntry[];
  readonly resumeCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CheckpointListItem {
  readonly workflowId: string;
  readonly state: CheckpointState;
  readonly phase: string;
  readonly step: number;
  readonly resumeCount: number;
  readonly updatedAt: string;
}

export interface CheckpointListSnapshot {
  readonly source: string;
  readonly total: number;
  readonly checkpoints: readonly CheckpointListItem[];
  readonly updatedAt: string;
}

export interface AbandonResult {
  readonly source: string;
  readonly workflowId: string;
  readonly abandoned: boolean;
  readonly previousState: CheckpointState;
  readonly updatedAt: string;
}

export interface SaveCheckpointPayload {
  state?: CheckpointState;
  step?: number;
  phase?: string;
  variables?: Record<string, unknown>;
  interruptReason?: string;
}

/* ── Normalization helpers ──────────────────────────────────────────── */

const VALID_STATES = new Set<CheckpointState>(["queued", "running", "interrupted", "awaiting_approval", "done", "abandoned"]);

function normalizeState(s: unknown): CheckpointState {
  return typeof s === "string" && VALID_STATES.has(s as CheckpointState) ? (s as CheckpointState) : "queued";
}

function normalizeThread(raw: unknown): CheckpointThread {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    step: typeof t.step === "number" ? t.step : 0,
    phase: typeof t.phase === "string" ? t.phase : "coordinator",
    variables: t.variables && typeof t.variables === "object" && !Array.isArray(t.variables) ? (t.variables as Record<string, unknown>) : {},
    interruptReason: typeof t.interruptReason === "string" ? t.interruptReason : null,
  };
}

const EMPTY_LIST: CheckpointListSnapshot = {
  source: "fallback",
  total: 0,
  checkpoints: [],
  updatedAt: new Date().toISOString(),
};

function normalizeCheckpoint(raw: unknown): CheckpointSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const workflowId = typeof r.workflowId === "string" ? r.workflowId : "";
  if (!workflowId) return null;
  return {
    source: typeof r.source === "string" ? r.source : "mock",
    workflowId,
    state: normalizeState(r.state),
    thread: normalizeThread(r.thread),
    history: Array.isArray(r.history)
      ? r.history.map((h: unknown) => {
          const hh = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
          return { state: normalizeState(hh.state), at: typeof hh.at === "string" ? hh.at : new Date().toISOString() };
        })
      : [],
    resumeCount: typeof r.resumeCount === "number" ? r.resumeCount : 0,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
  };
}

function normalizeList(raw: unknown): CheckpointListSnapshot {
  if (!raw || typeof raw !== "object") return EMPTY_LIST;
  const r = raw as Record<string, unknown>;
  const checkpoints = Array.isArray(r.checkpoints)
    ? r.checkpoints.map((c: unknown) => {
        const cc = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
        return {
          workflowId: typeof cc.workflowId === "string" ? cc.workflowId : "",
          state: normalizeState(cc.state),
          phase: typeof cc.phase === "string" ? cc.phase : "coordinator",
          step: typeof cc.step === "number" ? cc.step : 0,
          resumeCount: typeof cc.resumeCount === "number" ? cc.resumeCount : 0,
          updatedAt: typeof cc.updatedAt === "string" ? cc.updatedAt : new Date().toISOString(),
        } as CheckpointListItem;
      }).filter((c) => c.workflowId)
    : [];
  return {
    source: typeof r.source === "string" ? r.source : "mock",
    total: typeof r.total === "number" ? r.total : checkpoints.length,
    checkpoints,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
  };
}

/* ── Fetch functions ────────────────────────────────────────────────── */

export async function fetchCheckpoints(): Promise<CheckpointListSnapshot> {
  try {
    const res = await fetch("/api/ai/swarm/checkpoint", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return EMPTY_LIST;
    return normalizeList(await res.json());
  } catch {
    return EMPTY_LIST;
  }
}

export async function fetchCheckpoint(workflowId: string): Promise<CheckpointSnapshot | null> {
  try {
    const res = await fetch(`/api/ai/swarm/checkpoint/${encodeURIComponent(workflowId)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return normalizeCheckpoint(await res.json());
  } catch {
    return null;
  }
}

export async function saveCheckpoint(
  workflowId: string,
  payload: SaveCheckpointPayload,
): Promise<CheckpointSnapshot | null> {
  try {
    const res = await fetch(`/api/ai/swarm/checkpoint/${encodeURIComponent(workflowId)}`, {
      method: "PUT",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return normalizeCheckpoint(await res.json());
  } catch {
    return null;
  }
}

export async function resumeCheckpoint(
  workflowId: string,
  patch: { approvalNote?: string; variables?: Record<string, unknown> } = {},
): Promise<CheckpointSnapshot | null> {
  try {
    const res = await fetch(`/api/ai/swarm/checkpoint/${encodeURIComponent(workflowId)}/resume`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return normalizeCheckpoint(await res.json());
  } catch {
    return null;
  }
}

export async function abandonCheckpoint(workflowId: string): Promise<AbandonResult | null> {
  try {
    const res = await fetch(`/api/ai/swarm/checkpoint/${encodeURIComponent(workflowId)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = await res.json() as Record<string, unknown>;
    return {
      source: typeof body.source === "string" ? body.source : "mock",
      workflowId: typeof body.workflowId === "string" ? body.workflowId : workflowId,
      abandoned: Boolean(body.abandoned),
      previousState: normalizeState(body.previousState),
      updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
