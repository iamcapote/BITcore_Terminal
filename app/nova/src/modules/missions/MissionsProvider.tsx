/**
 * @license INTERNAL ONLY — Missions provider
 *
 * Contract
 * Inputs:
 *   - Missions HTTP client functions (list, state, actions) and React children
 * Outputs:
 *   - React context exposing mission arrays, scheduler snapshots, and mutation helpers
 * Error modes:
 *   - Swallows fetch errors into context state; action helpers rethrow for caller feedback
 * Performance:
 *   - Fetches missions and scheduler state on mount; subsequent refreshes are manual or action-triggered
 * Side effects:
 *   - HTTP requests to /api/missions endpoints via missionsClient
 *
 * Why: Share a single mission data source between Nova surfaces while coordinating scheduler actions and loading states.
 * What: Maintain reducer-driven state for missions, scheduler metadata, pending actions, and feedback strings.
 * How: Fetch on mount, expose refresh hooks, guard mounted state during async work, and freeze derived payloads before storing.
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
import {
  fetchMissions,
  fetchSchedulerState,
  runMissionById,
  startScheduler,
  stopScheduler,
  triggerSchedulerTick,
  type Mission,
  type SchedulerState,
} from "@/modules/missions/missionsClient";
import { computeMissionTotals, buildMissionColumns, buildMissionActivity, type MissionTotals, type MissionColumnView, type MissionActivityView } from "@/modules/missions/missionViewModel";

type AsyncStatus = "idle" | "loading" | "success" | "error";

type SchedulerActionKind = "start" | "stop" | "tick" | null;

interface MissionsState {
  readonly missions: readonly Mission[];
  readonly missionsStatus: AsyncStatus;
  readonly missionsError: string | null;
  readonly scheduler: SchedulerState | null;
  readonly schedulerStatus: AsyncStatus;
  readonly schedulerError: string | null;
  readonly lastMissionsUpdatedAt: number | null;
  readonly lastSchedulerUpdatedAt: number | null;
  readonly pendingMissionIds: readonly string[];
  readonly pendingSchedulerAction: SchedulerActionKind;
  readonly lastActionMessage: string | null;
  readonly actionError: string | null;
}

interface MissionsContextValue extends MissionsState {
  readonly totals: MissionTotals;
  readonly columns: readonly MissionColumnView[];
  readonly activity: readonly MissionActivityView[];
  readonly refreshMissions: () => Promise<void>;
  readonly refreshScheduler: () => Promise<void>;
  readonly runMission: (missionId: string) => Promise<void>;
  readonly startScheduler: () => Promise<void>;
  readonly stopScheduler: () => Promise<void>;
  readonly triggerScheduler: () => Promise<void>;
}

type MissionsAction =
  | { readonly type: "MISSIONS_LOADING" }
  | { readonly type: "MISSIONS_SUCCESS"; readonly missions: readonly Mission[]; readonly receivedAt: number }
  | { readonly type: "MISSIONS_ERROR"; readonly error: string | null }
  | { readonly type: "SCHEDULER_LOADING" }
  | { readonly type: "SCHEDULER_SUCCESS"; readonly scheduler: SchedulerState; readonly receivedAt: number }
  | { readonly type: "SCHEDULER_ERROR"; readonly error: string | null }
  | { readonly type: "MISSION_RUN_REQUEST"; readonly missionId: string }
  | { readonly type: "MISSION_RUN_FINISH"; readonly missionId: string; readonly error?: string | null; readonly message?: string | null }
  | { readonly type: "SCHEDULER_ACTION_REQUEST"; readonly action: Exclude<SchedulerActionKind, null> }
  | { readonly type: "SCHEDULER_ACTION_FINISH"; readonly action: Exclude<SchedulerActionKind, null>; readonly error?: string | null; readonly message?: string | null };

const INITIAL_STATE: MissionsState = Object.freeze({
  missions: Object.freeze([]),
  missionsStatus: "idle",
  missionsError: null,
  scheduler: null,
  schedulerStatus: "idle",
  schedulerError: null,
  lastMissionsUpdatedAt: null,
  lastSchedulerUpdatedAt: null,
  pendingMissionIds: Object.freeze([]),
  pendingSchedulerAction: null,
  lastActionMessage: null,
  actionError: null,
});

const MissionsContext = createContext<MissionsContextValue | null>(null);

const REQUEST_TIMEOUT_MS = 12000;

export function MissionsProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, dispatch] = useReducer(missionsReducer, INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshMissions = useCallback(async () => {
    if (!mountedRef.current) return;
    dispatch({ type: "MISSIONS_LOADING" });
    try {
      const missions = await fetchWithTimeout(
        (signal) => fetchMissions({ signal }),
        "Timed out while contacting the missions API.",
      );
      if (!mountedRef.current) return;
      dispatch({ type: "MISSIONS_SUCCESS", missions, receivedAt: Date.now() });
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({ type: "MISSIONS_ERROR", error: toErrorMessage(error) });
    }
  }, []);

  const refreshScheduler = useCallback(async () => {
    if (!mountedRef.current) return;
    dispatch({ type: "SCHEDULER_LOADING" });
    try {
      const scheduler = await fetchWithTimeout(
        (signal) => fetchSchedulerState({ signal }),
        "Timed out while loading the mission scheduler state.",
      );
      if (!mountedRef.current) return;
      dispatch({ type: "SCHEDULER_SUCCESS", scheduler, receivedAt: Date.now() });
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({ type: "SCHEDULER_ERROR", error: toErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    refreshMissions().catch(() => undefined);
    refreshScheduler().catch(() => undefined);
  }, [refreshMissions, refreshScheduler]);

  const runMission = useCallback(async (missionId: string) => {
    if (!missionId) {
      return;
    }
    dispatch({ type: "MISSION_RUN_REQUEST", missionId });
    try {
      await fetchWithTimeout(() => runMissionById(missionId), `Timed out while dispatching mission '${missionId}'.`);
      await refreshMissions();
      await refreshScheduler();
      if (!mountedRef.current) return;
      dispatch({ type: "MISSION_RUN_FINISH", missionId, message: `Mission ${missionId} dispatched.` });
    } catch (error) {
      if (!mountedRef.current) return;
      const message = toErrorMessage(error);
      dispatch({ type: "MISSION_RUN_FINISH", missionId, error: message });
      throw error;
    }
  }, [refreshMissions, refreshScheduler]);

  const invokeSchedulerAction = useCallback(async (action: Exclude<SchedulerActionKind, null>, handler: () => Promise<void>, successMessage: string) => {
    dispatch({ type: "SCHEDULER_ACTION_REQUEST", action });
    try {
      await fetchWithTimeout(handler, resolveActionTimeoutMessage(action));
      await refreshScheduler();
      if (!mountedRef.current) return;
      dispatch({ type: "SCHEDULER_ACTION_FINISH", action, message: successMessage });
    } catch (error) {
      if (!mountedRef.current) return;
      const message = toErrorMessage(error);
      dispatch({ type: "SCHEDULER_ACTION_FINISH", action, error: message });
      throw error;
    }
  }, [refreshScheduler]);

  const handleStartScheduler = useCallback(async () => {
    await invokeSchedulerAction("start", startScheduler, "Scheduler started.");
  }, [invokeSchedulerAction]);

  const handleStopScheduler = useCallback(async () => {
    await invokeSchedulerAction("stop", stopScheduler, "Scheduler stopped.");
  }, [invokeSchedulerAction]);

  const handleTriggerScheduler = useCallback(async () => {
    await invokeSchedulerAction("tick", triggerSchedulerTick, "Scheduler tick dispatched.");
    await refreshMissions();
  }, [invokeSchedulerAction, refreshMissions]);

  const totals = useMemo(() => computeMissionTotals(state.missions), [state.missions]);
  const columns = useMemo(() => buildMissionColumns(state.missions), [state.missions]);
  const activity = useMemo(() => buildMissionActivity(state.missions), [state.missions]);

  const contextValue = useMemo<MissionsContextValue>(() => ({
    ...state,
    totals,
    columns,
    activity,
    refreshMissions,
    refreshScheduler,
    runMission,
    startScheduler: handleStartScheduler,
    stopScheduler: handleStopScheduler,
    triggerScheduler: handleTriggerScheduler,
  }), [state, totals, columns, activity, refreshMissions, refreshScheduler, runMission, handleStartScheduler, handleStopScheduler, handleTriggerScheduler]);

  return <MissionsContext.Provider value={contextValue}>{children}</MissionsContext.Provider>;
}

export function useMissions(): MissionsContextValue {
  const context = useContext(MissionsContext);
  if (!context) {
    throw new Error("useMissions must be used within a MissionsProvider");
  }
  return context;
}

function missionsReducer(state: MissionsState, action: MissionsAction): MissionsState {
  switch (action.type) {
    case "MISSIONS_LOADING":
      return { ...state, missionsStatus: "loading", missionsError: null };
    case "MISSIONS_SUCCESS":
      return {
        ...state,
        missions: Object.freeze([...action.missions]),
        missionsStatus: "success",
        missionsError: null,
        lastMissionsUpdatedAt: action.receivedAt,
      };
    case "MISSIONS_ERROR":
      return { ...state, missionsStatus: "error", missionsError: action.error };
    case "SCHEDULER_LOADING":
      return { ...state, schedulerStatus: "loading", schedulerError: null };
    case "SCHEDULER_SUCCESS":
      return {
        ...state,
        scheduler: action.scheduler,
        schedulerStatus: "success",
        schedulerError: null,
        lastSchedulerUpdatedAt: action.receivedAt,
      };
    case "SCHEDULER_ERROR":
      return { ...state, schedulerStatus: "error", schedulerError: action.error };
    case "MISSION_RUN_REQUEST": {
      if (state.pendingMissionIds.includes(action.missionId)) {
        return state;
      }
      return {
        ...state,
        pendingMissionIds: Object.freeze([...state.pendingMissionIds, action.missionId]),
        actionError: null,
      };
    }
    case "MISSION_RUN_FINISH": {
      const pendingMissionIds = state.pendingMissionIds.filter((id) => id !== action.missionId);
      return {
        ...state,
        pendingMissionIds: Object.freeze(pendingMissionIds),
        lastActionMessage: action.error ? state.lastActionMessage : action.message ?? state.lastActionMessage,
        actionError: action.error ?? null,
      };
    }
    case "SCHEDULER_ACTION_REQUEST":
      return {
        ...state,
        pendingSchedulerAction: action.action,
        actionError: null,
      };
    case "SCHEDULER_ACTION_FINISH":
      return {
        ...state,
        pendingSchedulerAction: null,
        lastActionMessage: action.error ? state.lastActionMessage : action.message ?? state.lastActionMessage,
        actionError: action.error ?? null,
      };
    default:
      return state;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof MissionsTimeoutError) {
    return error.message;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request cancelled.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

class MissionsTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissionsTimeoutError";
  }
}

async function fetchWithTimeout<T>(task: (signal?: AbortSignal) => Promise<T>, timeoutMessage: string): Promise<T> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
      reject(new MissionsTimeoutError(timeoutMessage));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([task(controller?.signal), timeoutPromise]);
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}

function resolveActionTimeoutMessage(action: Exclude<SchedulerActionKind, null>): string {
  switch (action) {
    case "start":
      return "Timed out while starting the scheduler.";
    case "stop":
      return "Timed out while stopping the scheduler.";
    case "tick":
      return "Timed out while triggering a scheduler tick.";
    default:
      return "Scheduler action timed out.";
  }
}
