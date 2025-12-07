/**
 * @license INTERNAL ONLY — Prompts React provider
 *
 * Contract
 * Inputs:
 *   - PromptsProvider wrapping components that need access to prompt library
 * Outputs:
 *   - Context providing prompts array, loading/error states, and actions (refresh, save, remove, search, sync)
 * Error modes:
 *   - Surfaces promptsClient errors in error state; guards render with error messages
 * Performance:
 *   - Fetches prompts once on mount and on explicit refresh; caches until next action
 * Side effects:
 *   - Mounts AbortController for cleanup on unmount; uses promptsClient for backend HTTP calls
 *
 * Why: Provide centralized prompts state management for Nova surfaces.
 * What: Wrap prompt retrieval, search, mutation, and GitHub sync behind a React context and reducer.
 * How: Issue promptsClient requests on mount/action, store results in state, freeze outputs, expose via hook.
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react";
import * as promptsClient from "./promptsClient";
import type { PromptSummary, PromptRecord, GitHubStatusResult } from "./promptsClient";

interface PromptsState {
  readonly prompts: readonly PromptSummary[];
  readonly selectedPrompt: PromptRecord | null;
  readonly githubStatus: GitHubStatusResult | null;
  readonly loading: boolean;
  readonly error: string | null;
}

type PromptsAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; prompts: readonly PromptSummary[] }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "SELECT_PROMPT"; prompt: PromptRecord | null }
  | { type: "SAVE_SUCCESS"; prompt: PromptRecord }
  | { type: "REMOVE_SUCCESS"; id: string }
  | { type: "GITHUB_STATUS"; status: GitHubStatusResult };

interface PromptsContextValue extends PromptsState {
  readonly refreshPrompts: (options?: promptsClient.ListPromptsOptions) => Promise<void>;
  readonly searchPrompts: (options?: promptsClient.SearchPromptsOptions) => Promise<readonly PromptRecord[]>;
  readonly selectPrompt: (id: string | null) => Promise<void>;
  readonly savePrompt: (prompt: Omit<PromptRecord, "createdAt" | "updatedAt">) => Promise<void>;
  readonly removePrompt: (id: string) => Promise<void>;
  readonly syncWithGitHub: () => Promise<void>;
  readonly pullFromGitHub: () => Promise<void>;
  readonly pushToGitHub: () => Promise<void>;
  readonly fetchGitHubStatus: () => Promise<void>;
}

const PromptsContext = createContext<PromptsContextValue | null>(null);

const initialState: PromptsState = {
  prompts: [],
  selectedPrompt: null,
  githubStatus: null,
  loading: false,
  error: null,
};

function promptsReducer(state: PromptsState, action: PromptsAction): PromptsState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, prompts: action.prompts, loading: false, error: null };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SELECT_PROMPT":
      return { ...state, selectedPrompt: action.prompt };
    case "SAVE_SUCCESS": {
      const existing = state.prompts.find((p) => p.id === action.prompt.id);
      const updatedPrompts = existing
        ? state.prompts.map((p) => (p.id === action.prompt.id ? action.prompt : p))
        : [...state.prompts, action.prompt];
      return { ...state, prompts: updatedPrompts, selectedPrompt: action.prompt };
    }
    case "REMOVE_SUCCESS":
      return {
        ...state,
        prompts: state.prompts.filter((p) => p.id !== action.id),
        selectedPrompt: state.selectedPrompt?.id === action.id ? null : state.selectedPrompt,
      };
    case "GITHUB_STATUS":
      return { ...state, githubStatus: action.status };
    default:
      return state;
  }
}

export function PromptsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(promptsReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshPrompts = async (options?: promptsClient.ListPromptsOptions) => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      dispatch({ type: "FETCH_START" });
      const prompts = await promptsClient.listPrompts({ ...options, signal: controller.signal });
      dispatch({ type: "FETCH_SUCCESS", prompts });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to fetch prompts" });
    }
  };

  const searchPrompts = async (options?: promptsClient.SearchPromptsOptions) => {
    try {
      return await promptsClient.searchPrompts(options);
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to search prompts" });
      return [];
    }
  };

  const selectPrompt = async (id: string | null) => {
    try {
      if (!id) {
        dispatch({ type: "SELECT_PROMPT", prompt: null });
        return;
      }
      const prompt = await promptsClient.getPrompt(id);
      dispatch({ type: "SELECT_PROMPT", prompt });
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to load prompt" });
    }
  };

  const savePrompt = async (prompt: Omit<PromptRecord, "createdAt" | "updatedAt">) => {
    try {
      const saved = await promptsClient.savePrompt(prompt);
      dispatch({ type: "SAVE_SUCCESS", prompt: saved });
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to save prompt" });
    }
  };

  const removePrompt = async (id: string) => {
    try {
      await promptsClient.removePrompt(id);
      dispatch({ type: "REMOVE_SUCCESS", id });
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to remove prompt" });
    }
  };

  const syncWithGitHub = async () => {
    try {
      await promptsClient.syncWithGitHub();
      await refreshPrompts();
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to sync with GitHub" });
    }
  };

  const pullFromGitHub = async () => {
    try {
      await promptsClient.pullFromGitHub();
      await refreshPrompts();
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to pull from GitHub" });
    }
  };

  const pushToGitHub = async () => {
    try {
      await promptsClient.pushToGitHub();
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Failed to push to GitHub" });
    }
  };

  const fetchGitHubStatus = async () => {
    try {
      const status = await promptsClient.getGitHubStatus();
      dispatch({ type: "GITHUB_STATUS", status });
    } catch (err) {
      // Silent fail for GitHub status (may not be configured)
      console.warn("Failed to fetch GitHub status:", err);
    }
  };

  useEffect(() => {
    refreshPrompts();
    fetchGitHubStatus();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const value: PromptsContextValue = {
    ...state,
    refreshPrompts,
    searchPrompts,
    selectPrompt,
    savePrompt,
    removePrompt,
    syncWithGitHub,
    pullFromGitHub,
    pushToGitHub,
    fetchGitHubStatus,
  };

  return <PromptsContext.Provider value={value}>{children}</PromptsContext.Provider>;
}

export function usePrompts(): PromptsContextValue {
  const context = useContext(PromptsContext);
  if (!context) {
    throw new Error("usePrompts must be used within a PromptsProvider");
  }
  return context;
}
