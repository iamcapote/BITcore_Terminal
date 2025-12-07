/**
 * @license INTERNAL ONLY — Chat state store
 *
 * Why: Keep chat session state predictable across Nova surfaces without duplicating reducer logic in components.
 * What: Defines reducer actions, default configuration, helpers for history management, and message factory utilities.
 * How: Apply a small reducer with immutable updates, clamp history size, and reuse deterministic helpers across the provider and UI.
 */

import type {
  ChatMessage,
  ChatMessageRole,
  ChatMessageStatus,
  ChatPersona,
  ChatSessionConfig,
  ChatState,
  MemoryContextEntry,
} from "@/modules/chat/chatTypes";

const MAX_CHAT_HISTORY = 200;

export const DEFAULT_CHAT_PROMPT = "[chat] > ";

export const DEFAULT_CHAT_CONFIG: ChatSessionConfig = {
  memoryEnabled: false,
  memoryDepth: "medium",
  memoryGithubEnabled: false,
  character: null,
  model: null,
};

export const INITIAL_CHAT_STATE: ChatState = {
  active: false,
  prompt: DEFAULT_CHAT_PROMPT,
  model: null,
  persona: null,
  history: [],
  memoryContext: [],
  memoryEnabled: DEFAULT_CHAT_CONFIG.memoryEnabled,
  memoryDepth: DEFAULT_CHAT_CONFIG.memoryDepth,
  memoryGithubEnabled: DEFAULT_CHAT_CONFIG.memoryGithubEnabled,
  pending: false,
  pendingConfig: null,
  lastConfig: DEFAULT_CHAT_CONFIG,
  lastError: null,
};

export type ChatAction =
  | { readonly type: "REQUEST_START"; readonly config: ChatSessionConfig }
  | { readonly type: "CHAT_READY"; readonly prompt: string; readonly persona: ChatPersona | null; readonly model: string | null }
  | { readonly type: "APPEND_MESSAGE"; readonly message: ChatMessage }
  | { readonly type: "MESSAGE_FAILED"; readonly id: string; readonly error: string }
  | { readonly type: "CHAT_EXIT" }
  | { readonly type: "CHAT_ERROR"; readonly error: string }
  | { readonly type: "SET_MEMORY_CONTEXT"; readonly entries: readonly MemoryContextEntry[] }
  | { readonly type: "SET_MODE"; readonly mode: string; readonly prompt?: string }
  | { readonly type: "RESET" };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "REQUEST_START": {
      return {
        ...state,
        active: false,
        pending: true,
        pendingConfig: action.config,
        lastConfig: action.config,
        lastError: null,
        history: [],
        memoryContext: [],
      };
    }
    case "CHAT_READY": {
      const config = state.pendingConfig ?? state.lastConfig;
      return {
        ...state,
        active: true,
        pending: false,
        pendingConfig: null,
        prompt: action.prompt || DEFAULT_CHAT_PROMPT,
        model: action.model ?? config.model ?? state.model,
        persona: action.persona,
        memoryEnabled: config.memoryEnabled,
        memoryDepth: config.memoryDepth,
        memoryGithubEnabled: config.memoryGithubEnabled,
        lastError: null,
      };
    }
    case "APPEND_MESSAGE": {
      const nextHistory = [...state.history, action.message];
      if (nextHistory.length > MAX_CHAT_HISTORY) {
        nextHistory.splice(0, nextHistory.length - MAX_CHAT_HISTORY);
      }
      return {
        ...state,
        history: nextHistory,
      };
    }
    case "MESSAGE_FAILED": {
      const nextHistory = state.history.map((entry) =>
        entry.id === action.id
          ? { ...entry, status: "failed" as ChatMessageStatus, error: action.error }
          : entry,
      );
      return {
        ...state,
        history: nextHistory,
        lastError: action.error,
      };
    }
    case "CHAT_EXIT": {
      return {
        ...state,
        active: false,
        pending: false,
        pendingConfig: null,
        prompt: DEFAULT_CHAT_PROMPT,
        memoryContext: [],
      };
    }
    case "CHAT_ERROR": {
      return {
        ...state,
        pending: false,
        lastError: action.error,
      };
    }
    case "SET_MEMORY_CONTEXT": {
      return {
        ...state,
        memoryContext: [...action.entries],
      };
    }
    case "SET_MODE": {
      const nextPrompt = typeof action.prompt === "string" && action.prompt.length > 0 ? action.prompt : state.prompt;
      if (action.mode === "chat") {
        return {
          ...state,
          active: true,
          prompt: nextPrompt,
        };
      }
      if (action.mode === "command") {
        return {
          ...state,
          active: false,
          prompt: DEFAULT_CHAT_PROMPT,
          pending: false,
          pendingConfig: null,
        };
      }
      return state;
    }
    case "RESET": {
      return {
        ...INITIAL_CHAT_STATE,
        lastConfig: state.lastConfig,
      };
    }
    default:
      return state;
  }
}

export function createChatMessage(role: ChatMessageRole, content: string, status: ChatMessageStatus = "normal", error?: string): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    createdAt: Date.now(),
    status,
    error,
  };
}

export function normalizeSessionConfig(partial: Partial<ChatSessionConfig> | null | undefined, fallback?: ChatSessionConfig): ChatSessionConfig {
  const base = fallback ?? DEFAULT_CHAT_CONFIG;
  return {
    memoryEnabled: typeof partial?.memoryEnabled === "boolean" ? partial.memoryEnabled : base.memoryEnabled,
    memoryDepth: partial?.memoryDepth ?? base.memoryDepth,
    memoryGithubEnabled: typeof partial?.memoryGithubEnabled === "boolean" ? partial.memoryGithubEnabled : base.memoryGithubEnabled,
    character: partial?.character ?? base.character ?? null,
    model: partial?.model ?? base.model ?? null,
  };
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}
