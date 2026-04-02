/**
 * Why: Provide a grouped, severity-aware backend event center before live notification provider wiring.
 * What: Mock-first notification center — enqueue, list, dismiss, and clear alerts with severity queues.
 * How: Bounded in-memory deque keyed by id; immutable envelopes shared across CLI and Nova surfaces.
 *
 * Contract
 * Inputs:
 *   - options.timeProvider?: () => number
 *   - options.maxHistory?: number    default 200
 *   - options.maxQueue?: number      default 30
 * Outputs:
 *   - enqueue(payload): NotificationRecord
 *   - list(filter?): NotificationListSnapshot
 *   - dismiss(id): DismissResult
 *   - dismissAll(): DismissAllResult
 *   - clearHistory(): ClearResult
 * Error modes:
 *   - ValidationError for missing title or invalid severity.
 *   - NotFound when dismissing a notification that does not exist.
 * Performance: O(n) bounded; no external IO.
 * Side effects: none — in-memory only.
 */

/* ── Constants ──────────────────────────────────────────────────── */

/** Severity levels from Agent Zero's grouping model. */
const VALID_SEVERITIES = new Set(['info', 'success', 'warning', 'error']);

const CATEGORIES = new Set(['system', 'mission', 'agent', 'research', 'memory', 'security', 'general']);

/* ── ID generator ─────────────────────────────────────────────── */

function makeId(timeProvider) {
  const stamp = timeProvider().toString(36);
  const rand = Math.random().toString(36).slice(2, 9);
  return `notif-${stamp}-${rand}`;
}

/* ── Freeze helpers ──────────────────────────────────────────── */

function freezeRecord(record) {
  return Object.freeze({
    id: record.id,
    severity: record.severity,
    category: record.category,
    title: record.title,
    description: record.description || null,
    data: record.data ? Object.freeze({ ...record.data }) : null,
    dismissed: record.dismissed,
    autoDismissMs: record.autoDismissMs || null,
    timestamp: record.timestamp,
    source: record.source || 'system',
  });
}

function freezeList(queue, history, filter) {
  let items = [...queue, ...history.filter(h => queue.every(q => q.id !== h.id))];
  if (filter?.severity) {
    const s = filter.severity;
    items = items.filter(n => n.severity === s);
  }
  if (filter?.category) {
    const c = filter.category;
    items = items.filter(n => n.category === c);
  }
  if (filter?.dismissed === false) {
    items = items.filter(n => !n.dismissed);
  }
  return Object.freeze({
    source: 'mock',
    total: items.length,
    queue: Object.freeze(queue.map(freezeRecord)),
    history: Object.freeze(history.map(freezeRecord)),
    items: Object.freeze(items.map(freezeRecord)),
    updatedAt: new Date().toISOString(),
  });
}

/* ── Factory ─────────────────────────────────────────────────── */

let singletonService = null;

export function createNotificationCenterService(options = {}) {
  const {
    timeProvider = () => Date.now(),
    maxHistory = 200,
    maxQueue = 30,
  } = options;

  const queue = [];
  const history = [];

  /* ── enqueue ─────────────────────────────────────────────── */
  function enqueue(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('ValidationError: payload must be an object.');
    }
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) throw new Error('ValidationError: title is required.');

    const severity = typeof payload.severity === 'string' && VALID_SEVERITIES.has(payload.severity)
      ? payload.severity
      : 'info';
    const category = typeof payload.category === 'string' && CATEGORIES.has(payload.category)
      ? payload.category
      : 'general';

    const record = {
      id: makeId(timeProvider),
      severity,
      category,
      title,
      description: typeof payload.description === 'string' ? payload.description.trim() : null,
      data: (payload.data && typeof payload.data === 'object') ? { ...payload.data } : null,
      dismissed: false,
      autoDismissMs: typeof payload.autoDismissMs === 'number' && payload.autoDismissMs > 0
        ? payload.autoDismissMs
        : null,
      timestamp: timeProvider(),
      source: typeof payload.source === 'string' ? payload.source.trim() : 'system',
    };

    queue.unshift(record);
    if (queue.length > maxQueue) queue.pop();
    history.unshift(record);
    if (history.length > maxHistory) history.pop();

    return freezeRecord(record);
  }

  /* ── list ────────────────────────────────────────────────── */
  function list(filter = {}) {
    return freezeList(queue.filter(n => !n.dismissed), history, filter);
  }

  /* ── dismiss ─────────────────────────────────────────────── */
  function dismiss(id) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('ValidationError: id is required.');
    }
    const qIdx = queue.findIndex(n => n.id === id);
    if (qIdx === -1) {
      // Try history
      const hIdx = history.findIndex(n => n.id === id);
      if (hIdx === -1) throw new Error(`NotFound: notification '${id}' does not exist.`);
      history[hIdx] = { ...history[hIdx], dismissed: true };
      return Object.freeze({ id, dismissed: true, source: 'mock' });
    }
    queue[qIdx] = { ...queue[qIdx], dismissed: true };
    const hIdx = history.findIndex(n => n.id === id);
    if (hIdx !== -1) history[hIdx] = { ...history[hIdx], dismissed: true };
    return Object.freeze({ id, dismissed: true, source: 'mock' });
  }

  /* ── dismissAll ──────────────────────────────────────────── */
  function dismissAll() {
    const count = queue.filter(n => !n.dismissed).length;
    for (let i = 0; i < queue.length; i++) {
      if (!queue[i].dismissed) queue[i] = { ...queue[i], dismissed: true };
    }
    for (let i = 0; i < history.length; i++) {
      if (!history[i].dismissed) history[i] = { ...history[i], dismissed: true };
    }
    return Object.freeze({ dismissed: count, source: 'mock' });
  }

  /* ── clearHistory ────────────────────────────────────────── */
  function clearHistory() {
    const count = history.length;
    history.length = 0;
    return Object.freeze({ cleared: count, source: 'mock' });
  }

  return Object.freeze({ enqueue, list, dismiss, dismissAll, clearHistory });
}

export function getNotificationCenterService(options = {}) {
  if (!singletonService) {
    singletonService = createNotificationCenterService(options);
  }
  return singletonService;
}

export function resetNotificationCenterService() {
  singletonService = null;
}
