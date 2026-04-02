/**
 * Why: Provide a global notification/toast system for async events, errors, and confirmations across Nova.
 * What: NotificationProvider context + useNotifications hook + toast queue with severity, auto-dismiss, and history.
 * How: Zustand-like reducer pattern in React context; consumers call notify() to enqueue; ToastContainer renders the queue.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from "react";
import { fetchNotifications, dismissBackendNotification, dismissAllBackendNotifications } from "@/modules/notifications/notificationsClient";

/* ── Types ─────────────────────────────────────────────────────────── */

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface Notification {
  readonly id: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly description?: string;
  readonly timestamp: number;
  readonly autoDismissMs?: number;
  readonly dismissed: boolean;
}

interface NotificationState {
  readonly queue: Notification[];
  readonly history: Notification[];
}

type NotificationAction =
  | { type: "ADD"; notification: Notification }
  | { type: "DISMISS"; id: string }
  | { type: "DISMISS_ALL" }
  | { type: "CLEAR_HISTORY" };

/* ── Reducer ───────────────────────────────────────────────────────── */

const MAX_HISTORY = 100;
const MAX_QUEUE = 8;

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "ADD": {
      const queue = [action.notification, ...state.queue].slice(0, MAX_QUEUE);
      const history = [action.notification, ...state.history].slice(0, MAX_HISTORY);
      return { queue, history };
    }
    case "DISMISS": {
      const queue = state.queue.filter((n) => n.id !== action.id);
      const history = state.history.map((n) =>
        n.id === action.id ? { ...n, dismissed: true } : n,
      );
      return { queue, history };
    }
    case "DISMISS_ALL":
      return {
        queue: [],
        history: state.history.map((n) => ({ ...n, dismissed: true })),
      };
    case "CLEAR_HISTORY":
      return { queue: state.queue, history: [] };
    default:
      return state;
  }
}

const INITIAL_STATE: NotificationState = { queue: [], history: [] };

/* ── Context ───────────────────────────────────────────────────────── */

interface NotificationContextValue {
  readonly queue: Notification[];
  readonly history: Notification[];
  notify: (severity: NotificationSeverity, title: string, description?: string, autoDismissMs?: number) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  clearHistory: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/* ── Provider ──────────────────────────────────────────────────────── */

let idCounter = 0;

export function NotificationProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, dispatch] = useReducer(notificationReducer, INITIAL_STATE);

  const notify = useCallback(
    (severity: NotificationSeverity, title: string, description?: string, autoDismissMs?: number) => {
      const id = `notif-${Date.now()}-${++idCounter}`;
      const notification: Notification = {
        id,
        severity,
        title,
        description,
        timestamp: Date.now(),
        autoDismissMs: autoDismissMs ?? (severity === "error" ? 8000 : 4000),
        dismissed: false,
      };
      dispatch({ type: "ADD", notification });
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "DISMISS", id });
    dismissBackendNotification(id).catch(() => { /* backend unavailable */ });
  }, []);

  const dismissAll = useCallback(() => {
    dispatch({ type: "DISMISS_ALL" });
    dismissAllBackendNotifications().catch(() => { /* backend unavailable */ });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: "CLEAR_HISTORY" });
  }, []);

  /* Sync undismissed backend notifications on mount and every 30s */
  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 30_000;
    const seenIds = new Set<string>();

    async function syncBackend() {
      try {
        const snapshot = await fetchNotifications({ dismissed: false });
        if (cancelled) return;
        for (const n of snapshot.queue) {
          if (!seenIds.has(n.id)) {
            seenIds.add(n.id);
            dispatch({
              type: "ADD",
              notification: {
                id: n.id,
                severity: n.severity,
                title: n.title,
                description: n.description ?? undefined,
                timestamp: n.timestamp,
                autoDismissMs: n.autoDismissMs ?? (n.severity === "error" ? 8000 : 4000),
                dismissed: false,
              },
            });
          }
        }
      } catch {
        /* backend unavailable — local queue still works */
      }
    }

    syncBackend();
    const timer = setInterval(syncBackend, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({ queue: state.queue, history: state.history, notify, dismiss, dismissAll, clearHistory }),
    [state, notify, dismiss, dismissAll, clearHistory],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────────── */

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
