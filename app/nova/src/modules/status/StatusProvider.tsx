/**
 * Why: Feed Nova surfaces with the same status, telemetry, log, and token usage signals that power the legacy terminal.
 * What: React context that fetches the status summary, listens to WebComm events, and normalizes aggregates for consumers.
 * How: Loads an initial REST snapshot, registers WebSocket handlers via the terminal client, and derives timeline metadata per update.
 * Contract
 * Inputs:
 *   - Requires TerminalProvider ancestry to supply `registerWebCommHandler` and connection state.
 *   - Fetches `/api/status/summary` with credentials and consumes WebComm events (status-summary, research-*, log-*).
 * Outputs:
 *   - Provides `{ summary, telemetry, tokenUsage, logs, timeline }` through React context; values are frozen per reducer state.
 * Error modes:
 *   - Logs REST/WebSocket issues to console, emits SUMMARY_ERROR without throwing so UI can retain last known state.
 * Performance:
 *   - REST snapshot on mount/reconnect; WebSocket handlers update reducer in O(1); token event dedupe capped at 200 ids.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react";
import { useTerminal } from "@/modules/terminal/TerminalContext";

interface StatusDescriptor {
  readonly state: string;
  readonly label: string;
  readonly message: string;
  readonly meta: Record<string, unknown>;
}

interface StatusSummaryData {
  readonly generatedAt: string | null;
  readonly statuses: Record<string, StatusDescriptor>;
}

interface TelemetryState {
  readonly stage: string;
  readonly message: string;
  readonly progressPercent: number;
  readonly updatedAt: number | null;
}

interface TokenUsageState {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly events: number;
  readonly updatedAt: number | null;
}

interface LogsState {
  readonly total: number;
  readonly info: number;
  readonly warn: number;
  readonly error: number;
  readonly lastEntryAt: number | null;
  readonly lastCommandAt: number | null;
}

interface ConnectionState {
  readonly connected: boolean;
  readonly reason: string | null;
}

interface TimelineState {
  readonly branch: string;
  readonly branchHint: string | null;
  readonly remote: string;
  readonly remoteHint: string | null;
  readonly guardrail: string;
  readonly guardrailHint: string | null;
  readonly gpuStatus: string;
  readonly gpuHint: string | null;
  readonly lastCommandAt: number | null;
}

interface StatusState {
  readonly summary: StatusSummaryData;
  readonly telemetry: TelemetryState;
  readonly tokenUsage: TokenUsageState;
  readonly logs: LogsState;
  readonly connection: ConnectionState;
  readonly timeline: TimelineState;
}

interface TokenUsageSnapshot {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly events: number;
  readonly updatedAt: number | null;
}

type StatusAction =
  | { readonly type: "SUMMARY_RECEIVED"; readonly summary: StatusSummaryData; readonly tokenSnapshot: TokenUsageSnapshot | null }
  | { readonly type: "SUMMARY_ERROR"; readonly reason: string }
  | { readonly type: "TELEMETRY_STATUS"; readonly stage: unknown; readonly message?: unknown; readonly timestamp?: number | null; readonly progressPercent?: number | null }
  | { readonly type: "TELEMETRY_PROGRESS"; readonly percent?: number | null; readonly timestamp?: number | null }
  | { readonly type: "TELEMETRY_RESET"; readonly stage?: string; readonly message?: string; readonly timestamp?: number | null }
  | { readonly type: "TOKEN_SNAPSHOT"; readonly snapshot: TokenUsageSnapshot | null }
  | { readonly type: "TOKEN_EVENT"; readonly usage: Record<string, unknown>; readonly timestamp?: number | null }
  | { readonly type: "LOG_SNAPSHOT"; readonly logs: unknown }
  | { readonly type: "LOG_EVENT"; readonly entry: unknown }
  | { readonly type: "CONNECTION_CHANGE"; readonly connected: boolean; readonly reason: string | null };

const INITIAL_TELEMETRY: TelemetryState = Object.freeze({
  stage: "Idle",
  message: "Waiting for telemetry…",
  progressPercent: 0,
  updatedAt: null,
});

const INITIAL_TOKEN_USAGE: TokenUsageState = Object.freeze({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  events: 0,
  updatedAt: null,
});

const INITIAL_LOGS: LogsState = Object.freeze({
  total: 0,
  info: 0,
  warn: 0,
  error: 0,
  lastEntryAt: null,
  lastCommandAt: null,
});

const INITIAL_CONNECTION: ConnectionState = Object.freeze({
  connected: false,
  reason: null,
});

const INITIAL_TIMELINE: TimelineState = Object.freeze({
  branch: "—",
  branchHint: null,
  remote: "offline",
  remoteHint: "Not connected",
  guardrail: "Unknown",
  guardrailHint: null,
  gpuStatus: "Memory idle",
  gpuHint: null,
  lastCommandAt: null,
});

const INITIAL_STATE: StatusState = Object.freeze({
  summary: { generatedAt: null, statuses: {} },
  telemetry: INITIAL_TELEMETRY,
  tokenUsage: INITIAL_TOKEN_USAGE,
  logs: INITIAL_LOGS,
  connection: INITIAL_CONNECTION,
  timeline: INITIAL_TIMELINE,
});

const STATUS_REFRESH_INTERVAL_MS = 60_000;

interface StatusContextValue {
  readonly summary: StatusSummaryData;
  readonly telemetry: TelemetryState;
  readonly tokenUsage: TokenUsageState;
  readonly logs: LogsState;
  readonly timeline: TimelineState;
  readonly refresh: (options?: { validate?: boolean }) => Promise<void>;
}

const StatusContext = createContext<StatusContextValue | null>(null);

function statusReducer(state: StatusState, action: StatusAction): StatusState {
  switch (action.type) {
    case "SUMMARY_RECEIVED": {
      const nextSummary = action.summary;
      const nextTokenUsage = action.tokenSnapshot ? applyTokenSnapshot(state.tokenUsage, action.tokenSnapshot) : state.tokenUsage;
      const nextState: StatusState = {
        ...state,
        summary: nextSummary,
        tokenUsage: nextTokenUsage,
      };
      return { ...nextState, timeline: rebuildTimeline(nextState, state.timeline) };
    }
    case "SUMMARY_ERROR": {
      return state;
    }
    case "TELEMETRY_STATUS": {
      const timestamp = action.timestamp ?? Date.now();
      const progressFromStatus = clampPercent(action.progressPercent);
      return {
        ...state,
        telemetry: {
          stage: formatStage(action.stage),
          message: typeof action.message === "string" && action.message.trim() ? action.message.trim() : state.telemetry.message,
          progressPercent: progressFromStatus ?? state.telemetry.progressPercent,
          updatedAt: timestamp,
        },
      };
    }
    case "TELEMETRY_PROGRESS": {
      const percent = clampPercent(action.percent);
      if (percent === null) {
        return {
          ...state,
          telemetry: {
            ...state.telemetry,
            updatedAt: action.timestamp ?? Date.now(),
          },
        };
      }
      return {
        ...state,
        telemetry: {
          ...state.telemetry,
          progressPercent: percent,
          updatedAt: action.timestamp ?? Date.now(),
        },
      };
    }
    case "TELEMETRY_RESET": {
      return {
        ...state,
        telemetry: {
          stage: action.stage ?? "Starting",
          message: action.message ?? "Initializing research…",
          progressPercent: 0,
          updatedAt: action.timestamp ?? Date.now(),
        },
      };
    }
    case "TOKEN_SNAPSHOT": {
      if (!action.snapshot) {
        return state;
      }
      return {
        ...state,
        tokenUsage: applyTokenSnapshot(state.tokenUsage, action.snapshot),
      };
    }
    case "TOKEN_EVENT": {
      return {
        ...state,
        tokenUsage: applyTokenEvent(state.tokenUsage, action.usage, action.timestamp),
      };
    }
    case "LOG_SNAPSHOT": {
      const logs = reduceLogs(action.logs);
      const nextState: StatusState = { ...state, logs };
      return { ...nextState, timeline: rebuildTimeline(nextState, state.timeline) };
    }
    case "LOG_EVENT": {
      const logs = appendLogEntry(state.logs, action.entry);
      if (logs === state.logs) {
        return state;
      }
      const nextState: StatusState = { ...state, logs };
      return { ...nextState, timeline: rebuildTimeline(nextState, state.timeline) };
    }
    case "CONNECTION_CHANGE": {
      if (state.connection.connected === action.connected && state.connection.reason === action.reason) {
        return state;
      }
      const nextState: StatusState = {
        ...state,
        connection: {
          connected: action.connected,
          reason: action.reason,
        },
      };
      return { ...nextState, timeline: rebuildTimeline(nextState, state.timeline) };
    }
    default:
      return state;
  }
}

export function StatusProvider({ children }: PropsWithChildren): JSX.Element {
  const { registerWebCommHandler, connection, requestStatusRefresh } = useTerminal();
  const [state, dispatch] = useReducer(statusReducer, INITIAL_STATE);
  const mountedRef = useRef(true);
  const tokenEventIdsRef = useRef<{ seen: Set<string>; order: string[] }>({ seen: new Set(), order: [] });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    dispatch({ type: "CONNECTION_CHANGE", connected: connection.connected, reason: connection.reason ?? null });
  }, [connection.connected, connection.reason]);

  const fetchLatestSummary = useCallback(async ({ validate = false } = {}) => {
    try {
      const endpoint = validate ? "/api/status/summary?validate=1" : "/api/status/summary";
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Status summary request failed (${response.status})`);
      }
      const payload = await response.json();
      if (!mountedRef.current) {
        return;
      }
      const summary = normalizeSummary(payload);
      const tokenSnapshot = extractTokenAggregate(summary.statuses);
      dispatch({ type: "SUMMARY_RECEIVED", summary, tokenSnapshot });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      const reason = error instanceof Error ? error.message : String(error);
      dispatch({ type: "SUMMARY_ERROR", reason });
      console.warn("[StatusProvider] Failed to fetch status summary:", reason);
    }
  }, []);

  const refreshSummary = useCallback(async ({ validate = false } = {}) => {
    if (connection.connected && typeof requestStatusRefresh === "function") {
      try {
        await requestStatusRefresh({ validate });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[StatusProvider] WebSocket status refresh failed, falling back to REST:", message);
      }
    }
    await fetchLatestSummary({ validate });
  }, [connection.connected, fetchLatestSummary, requestStatusRefresh]);

  const previousConnectionRef = useRef(connection.connected);
  useEffect(() => {
    if (!previousConnectionRef.current && connection.connected) {
      refreshSummary().catch(() => undefined);
    }
    previousConnectionRef.current = connection.connected;
  }, [connection.connected, refreshSummary]);

  useEffect(() => {
    refreshSummary().catch(() => undefined);
  }, [refreshSummary]);

  useEffect(() => {
    if (typeof window === "undefined" || STATUS_REFRESH_INTERVAL_MS <= 0) {
      return;
    }
    const timerId = window.setInterval(() => {
      refreshSummary().catch(() => undefined);
    }, STATUS_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [refreshSummary]);

  useEffect(() => {
    const disposers: Array<() => void> = [];

    const safeRegister = (type: string, handler: (message: Record<string, unknown>) => void) => {
      const dispose = registerWebCommHandler(type, handler);
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    };

    safeRegister("status-summary", (message) => {
      if (typeof message?.error === "string" && message.error) {
        dispatch({ type: "SUMMARY_ERROR", reason: message.error });
        console.warn("[StatusProvider] status-summary error:", message.error);
        return;
      }
      const raw = (message.data ?? message.summary ?? message) as unknown;
      const summary = normalizeSummary(raw);
      const tokenSnapshot = extractTokenAggregate(summary.statuses);
      dispatch({ type: "SUMMARY_RECEIVED", summary, tokenSnapshot });
    });

    safeRegister("research-status", (message) => {
      const data = (message.data ?? message) as Record<string, unknown>;
      const timestamp = normalizeTimestamp(data.timestamp ?? message.timestamp);
      const progressPercent = typeof data.progress === "object" && data.progress
        ? clampPercent((data.progress as Record<string, unknown>).percent as number)
        : undefined;
      dispatch({
        type: "TELEMETRY_STATUS",
        stage: data.stage,
        message: data.message,
        timestamp,
        progressPercent,
      });
    });

    safeRegister("research-progress", (message) => {
      const data = (message.data ?? message) as Record<string, unknown>;
      const timestamp = normalizeTimestamp(data.timestamp ?? message.timestamp);
      const percent = resolveProgressPercent(data);
      dispatch({ type: "TELEMETRY_PROGRESS", percent, timestamp });
    });

    safeRegister("research_start", () => {
      dispatch({ type: "TELEMETRY_RESET", stage: "Starting", message: "Initializing research…", timestamp: Date.now() });
    });

    safeRegister("research-complete", (message) => {
      const data = (message.data ?? message) as Record<string, unknown>;
      const timestamp = normalizeTimestamp(data.timestamp ?? message.timestamp) ?? Date.now();
      const success = data.success !== false;
      const statusMessage = success
        ? (typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : "Research complete.")
        : (typeof data.error === "string" && data.error.trim() ? data.error.trim() : "Research run failed.");
      dispatch({
        type: "TELEMETRY_STATUS",
        stage: success ? "complete" : "error",
        message: statusMessage,
        timestamp,
        progressPercent: success ? 100 : null,
      });
    });

    safeRegister("research-token-usage", (message) => {
      const data = (message.data ?? message) as Record<string, unknown>;
      const eventId = typeof data.eventId === "string" && data.eventId ? data.eventId : typeof message.eventId === "string" ? message.eventId : null;
      if (eventId && tokenEventIdsRef.current.seen.has(eventId)) {
        return;
      }
      if (eventId) {
        tokenEventIdsRef.current.seen.add(eventId);
        tokenEventIdsRef.current.order.push(eventId);
        if (tokenEventIdsRef.current.order.length > 200) {
          const oldest = tokenEventIdsRef.current.order.shift();
          if (oldest) {
            tokenEventIdsRef.current.seen.delete(oldest);
          }
        }
      }
      const timestamp = normalizeTimestamp(data.timestamp ?? message.timestamp);
      dispatch({ type: "TOKEN_EVENT", usage: data, timestamp });
    });

    safeRegister("log-snapshot", (message) => {
      const logs = Array.isArray(message.logs) ? message.logs : Array.isArray(message.data) ? message.data : [];
      dispatch({ type: "LOG_SNAPSHOT", logs });
    });

    safeRegister("log-event", (message) => {
      const entry = message.data ?? message.entry ?? message;
      dispatch({ type: "LOG_EVENT", entry });
    });

    safeRegister("connection", (message) => {
      const connected = Boolean(message.connected);
      const reason = typeof message.reason === "string" && message.reason ? message.reason : null;
      dispatch({ type: "CONNECTION_CHANGE", connected, reason });
    });

    return () => {
      disposers.forEach((dispose) => {
        try {
          dispose();
        } catch (error) {
          console.warn("[StatusProvider] Failed to release WebComm handler:", error);
        }
      });
    };
  }, [registerWebCommHandler]);

  const value = useMemo<StatusContextValue>(
    () => ({
      summary: state.summary,
      telemetry: state.telemetry,
      tokenUsage: state.tokenUsage,
      logs: state.logs,
      timeline: state.timeline,
      refresh: refreshSummary,
    }),
    [state.summary, state.telemetry, state.tokenUsage, state.logs, state.timeline, refreshSummary],
  );

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus(): StatusContextValue {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within a StatusProvider");
  }
  return context;
}

function normalizeSummary(raw: unknown): StatusSummaryData {
  if (!raw || typeof raw !== "object") {
    return { generatedAt: null, statuses: {} };
  }
  const source = raw as Record<string, unknown>;
  const generatedAt = typeof source.generatedAt === "string" ? source.generatedAt : null;
  const statusesRaw = source.statuses;
  const statuses: Record<string, StatusDescriptor> = {};
  if (statusesRaw && typeof statusesRaw === "object") {
    for (const [key, value] of Object.entries(statusesRaw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const descriptor = value as Record<string, unknown>;
      const state = typeof descriptor.state === "string" && descriptor.state.trim() ? descriptor.state.trim() : "unknown";
      const label = typeof descriptor.label === "string" && descriptor.label.trim() ? descriptor.label.trim() : formatStage(key);
      const message = typeof descriptor.message === "string" ? descriptor.message : "";
      const meta = descriptor.meta && typeof descriptor.meta === "object" ? { ...(descriptor.meta as Record<string, unknown>) } : {};
      statuses[key] = { state, label, message, meta };
    }
  }
  return { generatedAt, statuses };
}

function extractTokenAggregate(statuses: Record<string, StatusDescriptor>): TokenUsageSnapshot | null {
  const security = statuses.security;
  if (!security) {
    return null;
  }
  const tokenUsage = security.meta?.tokenUsage;
  if (!tokenUsage || typeof tokenUsage !== "object") {
    return null;
  }
  const aggregate = (tokenUsage as Record<string, unknown>).aggregate;
  if (!aggregate || typeof aggregate !== "object") {
    return null;
  }
  const source = aggregate as Record<string, unknown>;
  const promptTokens = coercePositiveInt(source.promptTokens) ?? 0;
  const completionTokens = coercePositiveInt(source.completionTokens) ?? 0;
  const totalTokens = coercePositiveInt(source.totalTokens) ?? 0;
  const events = coercePositiveInt(source.events) ?? 0;
  const updatedAt = normalizeTimestamp(source.updatedAt);
  return { promptTokens, completionTokens, totalTokens, events, updatedAt };
}

function applyTokenSnapshot(previous: TokenUsageState, snapshot: TokenUsageSnapshot): TokenUsageState {
  return {
    promptTokens: snapshot.promptTokens,
    completionTokens: snapshot.completionTokens,
    totalTokens: snapshot.totalTokens,
    events: snapshot.events,
    updatedAt: snapshot.updatedAt ?? previous.updatedAt,
  };
}

function applyTokenEvent(previous: TokenUsageState, usage: Record<string, unknown>, timestamp?: number | null): TokenUsageState {
  const promptIncrement = coercePositiveInt(usage.promptTokens) ?? 0;
  const completionIncrement = coercePositiveInt(usage.completionTokens) ?? 0;
  const totalIncrementRaw = coercePositiveInt(usage.totalTokens);
  const totalIncrement = totalIncrementRaw ?? promptIncrement + completionIncrement;
  if (promptIncrement === 0 && completionIncrement === 0 && totalIncrement === 0) {
    return {
      ...previous,
      updatedAt: timestamp ?? Date.now(),
    };
  }
  return {
    promptTokens: previous.promptTokens + promptIncrement,
    completionTokens: previous.completionTokens + completionIncrement,
    totalTokens: previous.totalTokens + totalIncrement,
    events: previous.events + 1,
    updatedAt: timestamp ?? Date.now(),
  };
}

function reduceLogs(raw: unknown): LogsState {
  if (!Array.isArray(raw)) {
    return INITIAL_LOGS;
  }
  let info = 0;
  let warn = 0;
  let error = 0;
  let total = 0;
  let lastEntryAt: number | null = null;
  let lastCommandAt: number | null = null;

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    total += 1;
    const record = entry as Record<string, unknown>;
    const level = normalizeLogLevel(record.level);
    if (level === "error") {
      error += 1;
    } else if (level === "warn") {
      warn += 1;
    } else {
      info += 1;
    }
    const timestamp = normalizeTimestamp(record.timestamp);
    if (timestamp !== null) {
      if (lastEntryAt === null || timestamp > lastEntryAt) {
        lastEntryAt = timestamp;
      }
      if (isCommandLog(record.message) && (lastCommandAt === null || timestamp > lastCommandAt)) {
        lastCommandAt = timestamp;
      }
    }
  }

  return {
    total,
    info,
    warn,
    error,
    lastEntryAt,
    lastCommandAt,
  };
}

function appendLogEntry(previous: LogsState, entry: unknown): LogsState {
  if (!entry || typeof entry !== "object") {
    return previous;
  }
  const record = entry as Record<string, unknown>;
  const level = normalizeLogLevel(record.level);
  const timestamp = normalizeTimestamp(record.timestamp) ?? Date.now();
  const message = typeof record.message === "string" ? record.message : "";

  return {
    total: previous.total + 1,
    info: level === "error" || level === "warn" ? previous.info : previous.info + 1,
    warn: level === "warn" ? previous.warn + 1 : previous.warn,
    error: level === "error" ? previous.error + 1 : previous.error,
    lastEntryAt: previous.lastEntryAt !== null && previous.lastEntryAt > timestamp ? previous.lastEntryAt : timestamp,
    lastCommandAt: isCommandLog(message) && (previous.lastCommandAt === null || timestamp > previous.lastCommandAt)
      ? timestamp
      : previous.lastCommandAt,
  };
}

function rebuildTimeline(state: StatusState, previous: TimelineState): TimelineState {
  const fallback = previous ?? INITIAL_TIMELINE;
  const github = state.summary.statuses.github;
  const security = state.summary.statuses.security;
  const memory = state.summary.statuses.memory;

  const branchInfo = deriveBranch(github);
  const remoteInfo = deriveRemote(github, state.connection);
  const guardrailInfo = deriveGuardrail(security);
  const memoryInfo = deriveMemory(memory);

  return {
    branch: branchInfo.label ?? fallback.branch,
    branchHint: branchInfo.hint ?? fallback.branchHint,
    remote: remoteInfo.label ?? fallback.remote,
    remoteHint: remoteInfo.hint ?? fallback.remoteHint,
    guardrail: guardrailInfo.label ?? fallback.guardrail,
    guardrailHint: guardrailInfo.hint ?? fallback.guardrailHint,
    gpuStatus: memoryInfo.label ?? fallback.gpuStatus,
    gpuHint: memoryInfo.hint ?? fallback.gpuHint,
    lastCommandAt: state.logs.lastCommandAt ?? fallback.lastCommandAt,
  };
}

function deriveBranch(github?: StatusDescriptor): { readonly label?: string; readonly hint?: string | null } {
  if (!github) {
    return {};
  }
  const meta = github.meta || {};
  const branch = typeof meta.branch === "string" && meta.branch.trim() ? meta.branch.trim() : null;
  const repository = typeof meta.repository === "string" && meta.repository.trim() ? meta.repository.trim() : null;
  const hintParts: string[] = [];
  if (repository) {
    hintParts.push(repository);
  }
  if (branch) {
    hintParts.push(`branch ${branch}`);
  }
  return {
    label: branch ?? repository ?? undefined,
    hint: hintParts.length > 0 ? hintParts.join(" • ") : github.message || null,
  };
}

function deriveRemote(github: StatusDescriptor | undefined, connection: ConnectionState): { readonly label?: string; readonly hint?: string | null } {
  if (!connection.connected) {
    return { label: "offline", hint: connection.reason ?? "Disconnected" };
  }
  if (!github) {
    return { label: "unknown", hint: null };
  }
  const message = github.message || null;
  const meta = github.meta || {};
  switch (github.state) {
    case "active": {
      const verified = Boolean(meta.verified);
      const repository = typeof meta.repository === "string" ? meta.repository : null;
      return {
        label: verified ? "synced" : "configured",
        hint: repository ? `Connected (${repository})` : message,
      };
    }
    case "warning":
      return { label: "warning", hint: message ?? "Check GitHub credentials" };
    case "missing":
      return { label: "missing", hint: message ?? "Repository not configured" };
    case "error":
      return { label: "error", hint: message ?? "GitHub verification failed" };
    default:
      return { label: github.state || "unknown", hint: message };
  }
}

function deriveGuardrail(security?: StatusDescriptor): { readonly label?: string; readonly hint?: string | null } {
  if (!security) {
    return { label: "Unknown", hint: null };
  }
  const message = security.message || null;
  switch (security.state) {
    case "active":
      return { label: "Guarded", hint: message };
    case "warning":
      return { label: "Warning", hint: message ?? "Review guardrail configuration" };
    case "missing":
      return { label: "Disabled", hint: message ?? "Guardrails disabled" };
    case "error":
      return { label: "Error", hint: message ?? "Guardrail error" };
    default:
      return { label: formatStage(security.state), hint: message };
  }
}

function deriveMemory(memory?: StatusDescriptor): { readonly label?: string; readonly hint?: string | null } {
  if (!memory) {
    return { label: "Memory idle", hint: null };
  }
  const message = memory.message || null;
  const meta = memory.meta || {};
  const mode = typeof meta.mode === "string" ? meta.mode : null;
  if (mode === "github") {
    return { label: memory.state === "active" ? "GitHub sync" : "GitHub pending", hint: message };
  }
  if (mode === "local-fallback") {
    return { label: "Local fallback", hint: message };
  }
  if (mode === "local") {
    return { label: memory.state === "active" ? "Local ready" : "Local mode", hint: message };
  }
  switch (memory.state) {
    case "active":
      return { label: "Memory ready", hint: message };
    case "warning":
      return { label: "Memory warning", hint: message };
    case "error":
      return { label: "Memory error", hint: message };
    default:
      return { label: "Memory idle", hint: message };
  }
}

function resolveProgressPercent(data: Record<string, unknown>): number | null {
  const direct = clampPercent(data.percentComplete);
  if (direct !== null) {
    return direct;
  }
  const completed = coercePositiveInt(data.completed ?? data.completedQueries);
  const total = coercePositiveInt(data.total ?? data.totalQueries);
  if (completed !== null && total && total > 0) {
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  }
  return null;
}

function clampPercent(value: unknown): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function coercePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }
  return Math.round(numberValue);
}

function formatStage(stage: unknown): string {
  if (typeof stage !== "string" || !stage.trim()) {
    return "Unknown";
  }
  return stage
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeLogLevel(level: unknown): "info" | "warn" | "error" {
  const value = typeof level === "string" ? level.trim().toLowerCase() : "";
  if (value === "error") {
    return "error";
  }
  if (value === "warn" || value === "warning") {
    return "warn";
  }
  return "info";
}

function isCommandLog(message: unknown): boolean {
  return typeof message === "string" && /^\[CMD\b/i.test(message);
}
