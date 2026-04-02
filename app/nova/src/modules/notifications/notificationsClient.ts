/**
 * Why: Bridge the Nova NotificationProvider to the backend notification center for cross-surface event parity.
 * What: Typed fetch functions for listing, enqueuing, dismissing, and clearing backend notifications.
 * How: Mirrors the fetch pattern used by swarmClient; falls back gracefully so the local queue stays independent.
 */

/* ── Types ─────────────────────────────────────────────────────────── */

export type NotificationSeverity = "info" | "success" | "warning" | "error";
export type NotificationCategory = "system" | "mission" | "agent" | "research" | "memory" | "security" | "general";

export interface BackendNotification {
  readonly id: string;
  readonly severity: NotificationSeverity;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly description: string | null;
  readonly data: Record<string, unknown> | null;
  readonly dismissed: boolean;
  readonly autoDismissMs: number | null;
  readonly timestamp: number;
  readonly source: string;
}

export interface NotificationListSnapshot {
  readonly source: string;
  readonly total: number;
  readonly queue: readonly BackendNotification[];
  readonly history: readonly BackendNotification[];
  readonly items: readonly BackendNotification[];
  readonly updatedAt: string;
}

export interface EnqueuePayload {
  readonly title: string;
  readonly severity?: NotificationSeverity;
  readonly category?: NotificationCategory;
  readonly description?: string;
  readonly data?: Record<string, unknown>;
  readonly autoDismissMs?: number;
  readonly source?: string;
}

/* ── Normalization helpers ──────────────────────────────────────────── */

const EMPTY_SNAPSHOT: NotificationListSnapshot = {
  source: "fallback",
  total: 0,
  queue: [],
  history: [],
  items: [],
  updatedAt: new Date().toISOString(),
};

function normalizeNotification(raw: unknown): BackendNotification | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const title = typeof r.title === "string" ? r.title : "";
  if (!id || !title) return null;
  return {
    id,
    severity: (["info", "success", "warning", "error"].includes(r.severity as string) ? r.severity : "info") as NotificationSeverity,
    category: (["system", "mission", "agent", "research", "memory", "security", "general"].includes(r.category as string) ? r.category : "general") as NotificationCategory,
    title,
    description: typeof r.description === "string" ? r.description : null,
    data: r.data && typeof r.data === "object" && !Array.isArray(r.data) ? (r.data as Record<string, unknown>) : null,
    dismissed: Boolean(r.dismissed),
    autoDismissMs: typeof r.autoDismissMs === "number" ? r.autoDismissMs : null,
    timestamp: typeof r.timestamp === "number" ? r.timestamp : Date.now(),
    source: typeof r.source === "string" ? r.source : "system",
  };
}

function normalizeList(raw: unknown): NotificationListSnapshot {
  if (!raw || typeof raw !== "object") return EMPTY_SNAPSHOT;
  const r = raw as Record<string, unknown>;
  const mapArr = (arr: unknown) => (Array.isArray(arr) ? arr.map(normalizeNotification).filter(Boolean) : []) as BackendNotification[];
  return {
    source: typeof r.source === "string" ? r.source : "mock",
    total: typeof r.total === "number" ? r.total : 0,
    queue: mapArr(r.queue),
    history: mapArr(r.history),
    items: mapArr(r.items),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
  };
}

/* ── Fetch functions ────────────────────────────────────────────────── */

export interface NotificationFilter {
  severity?: NotificationSeverity;
  category?: NotificationCategory;
  dismissed?: boolean;
}

export async function fetchNotifications(filter: NotificationFilter = {}): Promise<NotificationListSnapshot> {
  try {
    const params = new URLSearchParams();
    if (filter.severity) params.set("severity", filter.severity);
    if (filter.category) params.set("category", filter.category);
    if (filter.dismissed === false) params.set("dismissed", "false");
    const qs = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`/api/notifications${qs}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return EMPTY_SNAPSHOT;
    const body = await response.json();
    return normalizeList(body);
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export async function enqueueBackendNotification(
  payload: EnqueuePayload,
): Promise<BackendNotification | null> {
  try {
    const response = await fetch("/api/notifications", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return normalizeNotification(body);
  } catch {
    return null;
  }
}

export async function dismissBackendNotification(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/dismiss`, {
      method: "PATCH",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function dismissAllBackendNotifications(): Promise<number> {
  try {
    const response = await fetch("/api/notifications/dismiss-all", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return 0;
    const body = await response.json();
    return typeof body.dismissed === "number" ? body.dismissed : 0;
  } catch {
    return 0;
  }
}

export async function clearNotificationHistory(): Promise<number> {
  try {
    const response = await fetch("/api/notifications/history", {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return 0;
    const body = await response.json();
    return typeof body.cleared === "number" ? body.cleared : 0;
  } catch {
    return 0;
  }
}
