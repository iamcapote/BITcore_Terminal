/**
 * Contract
 * Why: Centralize timeouts and polling intervals for research WebSocket sessions.
 * What: Exports shared constants controlling inactivity cleanup, prompt duration, and status refresh cadence.
 * How: Provides immutable numbers consumed by connection and handler modules to keep configuration consistent.
 */

export const SESSION_INACTIVITY_TIMEOUT = 60 * 60 * 1000;
export const PROMPT_TIMEOUT_MS = 2 * 60 * 1000;
export const STATUS_REFRESH_INTERVAL_MS = 60 * 1000;
