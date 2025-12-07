/**
 * @license INTERNAL ONLY — GitHub Sync React provider
 *
 * Contract
 * Inputs:
 *   - GitHubSyncProvider wrapping components that need access to GitHub sync and activity
 * Outputs:
 *   - Context providing activity entries, stats, connection status, loading/error states, and actions (verify, list, push, etc.)
 * Error modes:
 *   - Surfaces githubSyncClient errors in error state; guards render with error messages
 * Performance:
 *   - Fetches activity snapshot once on mount and on explicit refresh; caches until next action
 * Side effects:
 *   - Mounts AbortController for cleanup on unmount; uses githubSyncClient for backend HTTP calls
 *
 * Why: Provide centralized GitHub sync and activity state management for Nova surfaces.
 * What: Wrap sync operations, activity feed retrieval, and stats behind a React context and reducer.
 * How: Issue githubSyncClient requests on mount/action, store results in state, freeze outputs, expose via hook.
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react";
import * as githubSyncClient from "./githubSyncClient";
import type {
  GitHubSyncPayload,
  GitHubSyncResult,
  ActivityEntry,
  ActivityStats,
  GitHubFile,
} from "./githubSyncClient";

interface GitHubSyncState {
  readonly activityEntries: readonly ActivityEntry[];
  readonly activityStats: ActivityStats | null;
  readonly connectionVerified: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastSyncResult: GitHubSyncResult | null;
}

type GitHubSyncAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; entries: readonly ActivityEntry[]; stats: ActivityStats }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "SYNC_SUCCESS"; result: GitHubSyncResult }
  | { type: "VERIFY_SUCCESS"; verified: boolean }
  | { type: "CLEAR_ERROR" };

interface GitHubSyncContextValue extends GitHubSyncState {
  readonly refreshActivity: (options?: githubSyncClient.FetchActivityOptions) => Promise<void>;
  readonly refreshStats: () => Promise<void>;
  readonly verifyConnection: () => Promise<boolean>;
  readonly listEntries: (options?: { path?: string; ref?: string }) => Promise<GitHubSyncResult>;
  readonly fetchFile: (path: string, options?: { ref?: string }) => Promise<GitHubSyncResult>;
  readonly pushBatch: (
    files: readonly GitHubFile[],
    options?: { message?: string; branch?: string }
  ) => Promise<GitHubSyncResult>;
  readonly uploadFile: (
    path: string,
    content: string,
    options?: { message?: string; branch?: string }
  ) => Promise<GitHubSyncResult>;
  readonly syncGitHub: (payload: GitHubSyncPayload) => Promise<GitHubSyncResult>;
  readonly clearError: () => void;
}

const GitHubSyncContext = createContext<GitHubSyncContextValue | null>(null);

const initialState: GitHubSyncState = {
  activityEntries: [],
  activityStats: null,
  connectionVerified: false,
  loading: false,
  error: null,
  lastSyncResult: null,
};

function githubSyncReducer(state: GitHubSyncState, action: GitHubSyncAction): GitHubSyncState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        activityEntries: action.entries,
        activityStats: action.stats,
        loading: false,
        error: null,
      };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SYNC_SUCCESS":
      return { ...state, lastSyncResult: action.result, loading: false, error: null };
    case "VERIFY_SUCCESS":
      return { ...state, connectionVerified: action.verified, loading: false };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

export function GitHubSyncProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(githubSyncReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshActivity = async (options?: githubSyncClient.FetchActivityOptions) => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      dispatch({ type: "FETCH_START" });

      const [snapshot, stats] = await Promise.all([
        githubSyncClient.fetchActivitySnapshot({ ...options, signal: controller.signal }),
        githubSyncClient.fetchActivityStats({ signal: controller.signal }),
      ]);

      dispatch({ type: "FETCH_SUCCESS", entries: snapshot.entries, stats });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to fetch activity" });
    }
  };

  const refreshStats = async () => {
    try {
      const stats = await githubSyncClient.fetchActivityStats();
      if (state.activityStats) {
        dispatch({ type: "FETCH_SUCCESS", entries: state.activityEntries, stats });
      }
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to fetch stats" });
    }
  };

  const verifyConnection = async (): Promise<boolean> => {
    try {
      dispatch({ type: "FETCH_START" });
      const result = await githubSyncClient.verifyGitHubConnection();
      const verified = result.ok && result.success;
      dispatch({ type: "VERIFY_SUCCESS", verified });
      return verified;
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Connection verification failed" });
      return false;
    }
  };

  const listEntries = async (options?: { path?: string; ref?: string }): Promise<GitHubSyncResult> => {
    try {
      dispatch({ type: "FETCH_START" });
      const result = await githubSyncClient.listGitHubEntries(options);
      dispatch({ type: "SYNC_SUCCESS", result });
      return result;
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to list entries" });
      throw err;
    }
  };

  const fetchFile = async (path: string, options?: { ref?: string }): Promise<GitHubSyncResult> => {
    try {
      dispatch({ type: "FETCH_START" });
      const result = await githubSyncClient.fetchGitHubFile(path, options);
      dispatch({ type: "SYNC_SUCCESS", result });
      return result;
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to fetch file" });
      throw err;
    }
  };

  const pushBatch = async (
    files: readonly GitHubFile[],
    options?: { message?: string; branch?: string }
  ): Promise<GitHubSyncResult> => {
    try {
      dispatch({ type: "FETCH_START" });
      const result = await githubSyncClient.pushGitHubBatch(files, options);
      dispatch({ type: "SYNC_SUCCESS", result });
      await refreshActivity(); // Refresh activity after push
      return result;
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to push batch" });
      throw err;
    }
  };

  const uploadFile = async (
    path: string,
    content: string,
    options?: { message?: string; branch?: string }
  ): Promise<GitHubSyncResult> => {
    try {
      dispatch({ type: "FETCH_START" });
      const result = await githubSyncClient.uploadGitHubFile(path, content, options);
      dispatch({ type: "SYNC_SUCCESS", result });
      await refreshActivity(); // Refresh activity after upload
      return result;
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to upload file" });
      throw err;
    }
  };

  const syncGitHub = async (payload: GitHubSyncPayload): Promise<GitHubSyncResult> => {
    try {
      dispatch({ type: "FETCH_START" });
      const result = await githubSyncClient.syncGitHub(payload);
      dispatch({ type: "SYNC_SUCCESS", result });
      await refreshActivity(); // Refresh activity after any sync
      return result;
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Sync failed" });
      throw err;
    }
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  useEffect(() => {
    verifyConnection();
    refreshActivity();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const value: GitHubSyncContextValue = {
    ...state,
    refreshActivity,
    refreshStats,
    verifyConnection,
    listEntries,
    fetchFile,
    pushBatch,
    uploadFile,
    syncGitHub,
    clearError,
  };

  return <GitHubSyncContext.Provider value={value}>{children}</GitHubSyncContext.Provider>;
}

export function useGitHubSync(): GitHubSyncContextValue {
  const context = useContext(GitHubSyncContext);
  if (!context) {
    throw new Error("useGitHubSync must be used within a GitHubSyncProvider");
  }
  return context;
}
