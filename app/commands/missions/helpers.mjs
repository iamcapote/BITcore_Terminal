/**
 * Why: Centralize shared utilities for missions CLI flows so handlers stay lean.
 * What: Exposes boolean coercion, JSON logging, mission formatting, and schedule helpers used across commands.
 * How: Provides pure functions with no external side effects; callers inject IO functions explicitly.
 * Contract
 *   Inputs:
 *     - Functions accept primitive values, mission records, or flag dictionaries as noted in their JSDoc.
 *   Outputs:
 *     - Each helper returns derived values (boolean, string, array/object copies) without mutating inputs.
 *   Error modes:
 *     - `buildScheduleOverrides` throws on conflicting or invalid schedule flags to keep validation centralized.
 *   Performance:
 *     - O(1) per call; no filesystem or network interactions.
 *   Side effects:
 *     - None.
 */

const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'on']);

export function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE.has(String(value).trim().toLowerCase());
}

export function logJson(outputFn, payload) {
  outputFn(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
}

export function formatMissionLine(mission) {
  const parts = [
    `${mission.id} :: ${mission.name}`,
    `status=${mission.status}`,
    `priority=${mission.priority ?? 0}`,
    `next=${mission.nextRunAt ?? 'n/a'}`
  ];
  return parts.join(' | ');
}

export function describeSchedule(schedule) {
  if (!schedule) return 'n/a';
  if (schedule.intervalMinutes) {
    return `${schedule.intervalMinutes}m${schedule.timezone ? `@${schedule.timezone}` : ''}`;
  }
  if (schedule.cron) {
    return `cron(${schedule.cron})${schedule.timezone ? `@${schedule.timezone}` : ''}`;
  }
  return 'n/a';
}

export function parseTags(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function buildScheduleOverrides(flags = {}) {
  const overrides = {};
  const intervalValue = flags['interval-minutes'];
  const cronValue = flags.cron;
  const timezone = flags.timezone;

  if (intervalValue != null && cronValue != null) {
    throw new Error('Provide either --interval-minutes or --cron, not both.');
  }
  if (intervalValue != null) {
    const interval = Number(intervalValue);
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new Error('--interval-minutes must be a positive number.');
    }
    overrides.intervalMinutes = interval;
  }
  if (cronValue != null) {
    const cron = String(cronValue).trim();
    if (!cron) {
      throw new Error('--cron must be a non-empty string.');
    }
    overrides.cron = cron;
  }
  if (timezone != null) {
    overrides.timezone = String(timezone).trim();
  }
  return overrides;
}
