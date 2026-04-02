/**
 * Why: Enable interrupt/resume continuity for swarm coordinator workflows before live LangGraph wiring.
 * What: Mock-first checkpoint store — saves, retrieves, resumes, and abandons named workflow snapshots.
 * How: In-memory bounded Map keyed by workflowId; immutable envelopes shared across CLI and Nova surfaces.
 *
 * Contract
 * Inputs:
 *   - options.timeProvider?: () => number
 *   - options.maxCheckpoints?: number          default 50
 * Outputs:
 *   - saveCheckpoint(workflowId, payload): CheckpointSnapshot
 *   - getCheckpoint(workflowId): CheckpointSnapshot | null
 *   - resumeCheckpoint(workflowId, patch?): CheckpointSnapshot
 *   - abandonCheckpoint(workflowId): AbandonResult
 *   - listCheckpoints(): CheckpointListSnapshot
 * Error modes:
 *   - ValidationError for missing/malformed workflowId or payload.
 *   - NotFound when accessing a checkpoint that does not exist.
 * Performance: O(n) over bounded checkpoint Map; no external IO.
 * Side effects: none — mutates in-memory store only.
 */

/* ── Helpers ─────────────────────────────────────────────────────── */

function safeIso(timestamp) {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeWorkflowId(id) {
  const v = typeof id === 'string' ? id.trim() : '';
  if (!v) throw new Error('ValidationError: workflowId is required.');
  return v;
}

/** Allowed checkpoint thread states derived from Deerflow state-machine research. */
const VALID_STATES = new Set(['queued', 'running', 'interrupted', 'awaiting_approval', 'done', 'abandoned']);

function normalizeState(state) {
  const s = typeof state === 'string' ? state.trim().toLowerCase() : 'queued';
  return VALID_STATES.has(s) ? s : 'queued';
}

function freezeCheckpoint(workflowId, record) {
  return Object.freeze({
    source: 'mock',
    workflowId,
    state: record.state,
    thread: Object.freeze({
      step: record.thread.step,
      phase: record.thread.phase,
      variables: Object.freeze({ ...record.thread.variables }),
      interruptReason: record.thread.interruptReason || null,
    }),
    history: Object.freeze([...record.history]),
    resumeCount: record.resumeCount,
    createdAt: record.createdAt,
    updatedAt: safeIso(record.updatedAt),
  });
}

/* ── Factory ─────────────────────────────────────────────────────── */

let singletonService = null;

export function createWorkflowCheckpointService(options = {}) {
  const {
    timeProvider = () => Date.now(),
    maxCheckpoints = 50,
  } = options;

  const store = new Map();

  function pruneIfNeeded() {
    if (store.size <= maxCheckpoints) return;
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  /* ── saveCheckpoint ──────────────────────────────────────────── */
  function saveCheckpoint(workflowId, payload) {
    const id = normalizeWorkflowId(workflowId);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('ValidationError: payload must be an object.');
    }
    const now = timeProvider();
    const existing = store.get(id);
    const previousState = existing ? existing.state : null;
    const record = {
      state: normalizeState(payload.state),
      thread: {
        step: typeof payload.step === 'number' ? payload.step : (existing?.thread.step ?? 0),
        phase: typeof payload.phase === 'string' ? payload.phase.trim() : (existing?.thread.phase ?? 'coordinator'),
        variables: (payload.variables && typeof payload.variables === 'object') ? { ...payload.variables } : (existing?.thread.variables ?? {}),
        interruptReason: typeof payload.interruptReason === 'string' ? payload.interruptReason.trim() : null,
      },
      history: [
        ...(existing?.history ?? []),
        ...(previousState ? [Object.freeze({ state: previousState, at: safeIso(existing?.updatedAt ?? now) })] : []),
      ].slice(-20),
      resumeCount: existing?.resumeCount ?? 0,
      createdAt: existing?.createdAt ?? safeIso(now),
      updatedAt: now,
    };
    store.set(id, record);
    pruneIfNeeded();
    return freezeCheckpoint(id, record);
  }

  /* ── getCheckpoint ───────────────────────────────────────────── */
  function getCheckpoint(workflowId) {
    const id = normalizeWorkflowId(workflowId);
    const record = store.get(id);
    if (!record) return null;
    return freezeCheckpoint(id, record);
  }

  /* ── resumeCheckpoint ────────────────────────────────────────── */
  function resumeCheckpoint(workflowId, patch) {
    const id = normalizeWorkflowId(workflowId);
    const existing = store.get(id);
    if (!existing) throw new Error(`NotFound: checkpoint '${id}' does not exist.`);
    if (!['interrupted', 'awaiting_approval', 'queued'].includes(existing.state)) {
      throw new Error(`ValidationError: checkpoint '${id}' is in state '${existing.state}' and cannot be resumed.`);
    }
    const now = timeProvider();
    const variables = (patch && typeof patch === 'object' && !Array.isArray(patch) && patch.variables)
      ? { ...existing.thread.variables, ...patch.variables }
      : existing.thread.variables;
    const approvalNote = (patch && typeof patch.approvalNote === 'string') ? patch.approvalNote.trim() : null;
    const record = {
      state: 'running',
      thread: {
        step: existing.thread.step,
        phase: existing.thread.phase,
        variables,
        interruptReason: null,
      },
      history: [
        ...existing.history,
        Object.freeze({ state: existing.state, at: safeIso(existing.updatedAt), approvalNote }),
      ].slice(-20),
      resumeCount: existing.resumeCount + 1,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    store.set(id, record);
    return freezeCheckpoint(id, record);
  }

  /* ── abandonCheckpoint ───────────────────────────────────────── */
  function abandonCheckpoint(workflowId) {
    const id = normalizeWorkflowId(workflowId);
    if (!store.has(id)) throw new Error(`NotFound: checkpoint '${id}' does not exist.`);
    const existing = store.get(id);
    const now = timeProvider();
    const record = {
      ...existing,
      state: 'abandoned',
      thread: { ...existing.thread, interruptReason: 'operator_abandoned' },
      history: [
        ...existing.history,
        Object.freeze({ state: existing.state, at: safeIso(existing.updatedAt) }),
      ].slice(-20),
      updatedAt: now,
    };
    store.set(id, record);
    return Object.freeze({
      source: 'mock',
      workflowId: id,
      abandoned: true,
      previousState: existing.state,
      updatedAt: safeIso(now),
    });
  }

  /* ── listCheckpoints ─────────────────────────────────────────── */
  function listCheckpoints() {
    const checkpoints = [];
    for (const [id, record] of store.entries()) {
      checkpoints.push(Object.freeze({
        workflowId: id,
        state: record.state,
        phase: record.thread.phase,
        step: record.thread.step,
        resumeCount: record.resumeCount,
        updatedAt: safeIso(record.updatedAt),
      }));
    }
    return Object.freeze({
      source: 'mock',
      total: checkpoints.length,
      checkpoints: Object.freeze([...checkpoints].reverse()),
      updatedAt: safeIso(timeProvider()),
    });
  }

  return Object.freeze({ saveCheckpoint, getCheckpoint, resumeCheckpoint, abandonCheckpoint, listCheckpoints });
}

export function getWorkflowCheckpointService(options = {}) {
  if (!singletonService) {
    singletonService = createWorkflowCheckpointService(options);
  }
  return singletonService;
}

export function resetWorkflowCheckpointService() {
  singletonService = null;
}
