/**
 * Contract
 * Inputs:
 *   - MissionDraft objects from controllers/services. Shape: {
 *       name: string;
 *       description?: string;
 *       schedule: { cron?: string; intervalMinutes?: number; timezone?: string };
 *       priority?: number;
 *       tags?: string[];
 *       payload?: Record<string, unknown>;
 *     }
 *   - MissionUpdate patches providing partial fields for an existing mission.
 * Outputs:
 *   - Normalized Mission objects with canonical field ordering, immutable schedule/context,
 *     and derived timestamps suitable for persistence.
 * Error modes:
 *   - TypeError when payloads are not objects or when fields have invalid types.
 *   - RangeError when schedule values are out of bounds (e.g., negative interval minutes).
 * Performance:
 *   - Pure synchronous guards; < 1ms typical execution.
 * Side effects:
 *   - None. This module is pure.
 */

import crypto from 'crypto';

export const MISSION_STATUSES = Object.freeze({
  IDLE: 'idle',
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  DISABLED: 'disabled',
  FAILED: 'failed',
  COMPLETED: 'completed'
});

export const SCHEDULE_TYPES = Object.freeze({
  INTERVAL: 'interval',
  CRON: 'cron'
});

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function generateMissionId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeMissionDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new TypeError('Mission draft must be an object');
  }

  const name = normalizeName(draft.name);
  const description = draft.description == null ? null : normalizeDescription(draft.description);
  const schedule = normalizeSchedule(draft.schedule);
  const priority = draft.priority == null ? 0 : normalizePriority(draft.priority);
  const tags = normalizeTags(draft.tags);
  const payload = normalizePayload(draft.payload);
  const enable = draft.enable == null ? true : normalizeEnable(draft.enable);

  return Object.freeze({
    name,
    description,
    schedule,
    priority,
    tags,
    payload,
    enable
  });
}

export function normalizeMissionPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('Mission patch must be an object');
  }

  const normalized = {};
  if (patch.name !== undefined) {
    normalized.name = normalizeName(patch.name);
  }
  if (patch.description !== undefined) {
    normalized.description = patch.description == null ? null : normalizeDescription(patch.description);
  }
  if (patch.schedule !== undefined) {
    normalized.schedule = normalizeSchedule(patch.schedule);
  }
  if (patch.priority !== undefined) {
    normalized.priority = normalizePriority(patch.priority);
  }
  if (patch.tags !== undefined) {
    normalized.tags = normalizeTags(patch.tags);
  }
  if (patch.payload !== undefined) {
    normalized.payload = normalizePayload(patch.payload);
  }
  if (patch.enable !== undefined) {
    normalized.enable = normalizeEnable(patch.enable);
  }
  if (patch.status !== undefined) {
    normalized.status = normalizeStatus(patch.status);
  }
  if (patch.lastRunError !== undefined) {
    normalized.lastRunError = patch.lastRunError == null ? null : normalizeErrorMessage(patch.lastRunError);
  }
  if (patch.nextRunAt !== undefined) {
    normalized.nextRunAt = patch.nextRunAt == null ? null : normalizeTimestamp(patch.nextRunAt, 'nextRunAt');
  }
  if (patch.lastRunAt !== undefined) {
    normalized.lastRunAt = patch.lastRunAt == null ? null : normalizeTimestamp(patch.lastRunAt, 'lastRunAt');
  }
  if (patch.lastFinishedAt !== undefined) {
    normalized.lastFinishedAt = patch.lastFinishedAt == null ? null : normalizeTimestamp(patch.lastFinishedAt, 'lastFinishedAt');
  }

  return Object.freeze(normalized);
}

export function createMissionEntity(draft, { id = generateMissionId(), now = Date.now() } = {}) {
  const normalizedDraft = normalizeMissionDraft(draft);
  const createdAt = new Date(now).toISOString();
  const status = normalizedDraft.enable ? MISSION_STATUSES.IDLE : MISSION_STATUSES.DISABLED;

  return freezeMission({
    id,
    name: normalizedDraft.name,
    description: normalizedDraft.description,
    schedule: normalizedDraft.schedule,
    priority: normalizedDraft.priority,
    tags: normalizedDraft.tags,
    payload: normalizedDraft.payload,
    status,
    enable: normalizedDraft.enable,
    createdAt,
    updatedAt: createdAt,
    nextRunAt: null,
    lastRunAt: null,
    lastFinishedAt: null,
    lastRunError: null
  });
}

export function applyMissionPatch(mission, patch, { now = Date.now() } = {}) {
  if (!mission || typeof mission !== 'object') {
    throw new TypeError('Mission must be an object');
  }
  const normalizedPatch = normalizeMissionPatch(patch);
  if (Object.keys(normalizedPatch).length === 0) {
    return freezeMission({ ...mission, updatedAt: new Date(now).toISOString() });
  }

  const updated = {
    ...mission,
    ...normalizedPatch,
    updatedAt: new Date(now).toISOString()
  };

  if (normalizedPatch.enable !== undefined) {
    updated.status = normalizedPatch.enable ? MISSION_STATUSES.IDLE : MISSION_STATUSES.DISABLED;
  }

  return freezeMission(updated);
}

export function freezeMission(mission) {
  const schedule = mission.schedule && typeof mission.schedule === 'object'
    ? Object.freeze({ ...mission.schedule })
    : null;
  const tags = Array.isArray(mission.tags) ? Object.freeze([...mission.tags]) : Object.freeze([]);
  const payload = mission.payload && typeof mission.payload === 'object' && !Array.isArray(mission.payload)
    ? Object.freeze({ ...mission.payload })
    : Object.freeze({});

  return Object.freeze({
    ...mission,
    schedule,
    tags,
    payload
  });
}

export function normalizeStatus(status) {
  if (status == null) {
    throw new TypeError('Mission status is required');
  }
  const value = String(status).trim().toLowerCase();
  const match = Object.values(MISSION_STATUSES).find(entry => entry === value);
  if (!match) {
    throw new RangeError(`Invalid mission status '${status}'`);
  }
  return match;
}

function normalizeName(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Mission name must be a non-empty string');
  }
  return value.trim();
}

function normalizeDescription(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Mission description must be a string when provided');
  }
  return value.trim();
}

function normalizeSchedule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Mission schedule must be an object');
  }
  const schedule = { ...value };
  const timezone = schedule.timezone ? normalizeTimezone(schedule.timezone) : undefined;
  if (schedule.intervalMinutes != null) {
    const intervalMinutes = Number(schedule.intervalMinutes);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      throw new RangeError('intervalMinutes must be a positive number');
    }
    return Object.freeze({
      type: SCHEDULE_TYPES.INTERVAL,
      intervalMinutes: Math.ceil(intervalMinutes),
      timezone: timezone || 'UTC'
    });
  }
  if (schedule.cron != null) {
    const cronExpression = String(schedule.cron).trim();
    if (!cronExpression) {
      throw new Error('cron expression must be a non-empty string');
    }
    if (!isValidCron(cronExpression)) {
      throw new RangeError(`Invalid cron expression '${cronExpression}'`);
    }
    return Object.freeze({
      type: SCHEDULE_TYPES.CRON,
      cron: cronExpression,
      timezone: timezone || 'UTC'
    });
  }
  throw new Error('Mission schedule requires either intervalMinutes or cron');
}

function normalizePriority(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new TypeError('Mission priority must be a finite number');
  }
  return Math.max(0, Math.min(10, Math.round(num)));
}

function normalizeTags(tags) {
  if (tags == null) {
    return Object.freeze([]);
  }
  if (!Array.isArray(tags)) {
    throw new TypeError('Mission tags must be an array when provided');
  }
  const normalized = Array.from(new Set(tags
    .map(tag => typeof tag === 'string' ? tag.trim().toLowerCase() : '')
    .filter(Boolean)));
  return Object.freeze(normalized);
}

function normalizePayload(payload) {
  if (payload == null) {
    return Object.freeze({});
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Mission payload must be an object when provided');
  }
  return Object.freeze({ ...payload });
}

function normalizeEnable(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return BOOLEAN_TRUE_VALUES.has(value.trim().toLowerCase());
  }
  throw new TypeError('enable flag must be a boolean-like value');
}

function normalizeErrorMessage(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Error message must be a string when provided');
  }
  return value.trim();
}

function normalizeTimestamp(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${fieldName} must be a valid date or timestamp`);
  }
  return date.toISOString();
}

function normalizeTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('timezone must be a non-empty string');
  }
  return value.trim();
}

function isValidCron(expression) {
  const parts = expression.trim().split(/\s+/);
  return parts.length >= 5 && parts.length <= 7;
}
