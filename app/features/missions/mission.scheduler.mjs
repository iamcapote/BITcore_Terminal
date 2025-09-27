/**
 * Mission Scheduler runtime orchestrates periodic polling of stored missions
 * and dispatches due work through an injected executor.
 *
 * Contract
 * Inputs:
 *   - controller: MissionController-like with list/get/markRunning/markResult methods.
 *   - telemetry?: emit function from mission.telemetry.
 *   - executor?: async (mission, context) => { success?: boolean, error?: Error|string, result?: any }.
 *   - intervalMs?: polling cadence (default 30s).
 *   - clock?: () => number for easier testing.
 * Outputs:
 *   - start()/stop()/trigger() controls plus runMission helpers.
 * Error modes:
 *   - Internal errors are logged and surfaced via telemetry; never thrown to callers of start/stop/trigger.
 * Performance:
 *   - Poll loop is O(n) over mission count (<1k expected). Executor runs sequentially per mission.
 * Side effects:
 *   - Marks mission lifecycle transitions and invokes executor side effects.
 */

import { MISSION_STATUSES } from './mission.schema.mjs';
import { createMissionTelemetry } from './mission.telemetry.mjs';
import { MissionSchedulerStateRepository } from './mission.scheduler-state.repository.mjs';

const DEFAULT_INTERVAL_MS = 30_000;

const noopTelemetry = () => {};
const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function defaultExecutor(mission, { logger }) {
  logger?.info?.(`[MissionScheduler] No executor configured; mission ${mission.id} marked complete without work.`);
  return Promise.resolve({ success: true, result: { note: 'no-op executor' } });
}

export function createMissionScheduler(options = {}) {
  const {
    controller,
    telemetry = createMissionTelemetry(),
    intervalMs = DEFAULT_INTERVAL_MS,
    clock = () => Date.now(),
    logger = noopLogger,
    executor,
    stateRepository
  } = options;

  if (!controller) {
    throw new TypeError('MissionScheduler requires a mission controller instance.');
  }

  const emit = typeof telemetry === 'function' ? telemetry : noopTelemetry;
  const stateRepo = stateRepository || new MissionSchedulerStateRepository({ logger });
  let currentExecutor = typeof executor === 'function'
    ? executor
    : (mission, context) => defaultExecutor(mission, context);

  let timer = null;
  let ticking = false;
  let destroyed = false;
  const activeRuns = new Set();
  let lastTickStartedAt = null;
  let lastTickCompletedAt = null;
  let lastTickDurationMs = null;
  let lastTickError = null;
  let lastTickEvaluated = 0;
  let lastTickLaunched = 0;
  let lastPersistedAt = null;
  let lastPersistReason = null;

  restoreFromPersistedState();

  async function evaluate() {
    if (ticking) {
      logger?.debug?.('[MissionScheduler] Tick skipped; previous tick still running.');
      return;
    }
    ticking = true;
    const tickStartedAt = clock();
    lastTickStartedAt = new Date(tickStartedAt).toISOString();
    lastTickError = null;
    emit('scheduler_tick', { startedAt: lastTickStartedAt, state: buildStateSnapshot() });
    publishState('tick_started');

    try {
      const missions = await controller.list({ includeDisabled: false });
      const now = tickStartedAt;
      const dueMissions = missions
        .filter(mission => isMissionDue(mission, now))
        .sort(sortByPriorityAndNextRun);
      lastTickEvaluated = Array.isArray(missions) ? missions.length : 0;
      lastTickLaunched = dueMissions.length;

      for (const mission of dueMissions) {
        emit('mission_due', { mission });
        await runMissionInternal(mission, { forced: false });
      }
    } catch (error) {
      logger?.error?.(`[MissionScheduler] Tick failed: ${error.message}`);
      lastTickError = error.message || 'Unknown error';
      emit('scheduler_error', { error: lastTickError, state: buildStateSnapshot() });
      publishState('tick_error', { error: lastTickError });
    } finally {
      const finishedAt = clock();
      lastTickCompletedAt = new Date(finishedAt).toISOString();
      lastTickDurationMs = finishedAt - tickStartedAt;
      emit('scheduler_tick_complete', { completedAt: lastTickCompletedAt, state: buildStateSnapshot() });
      publishState('tick_complete');
      ticking = false;
    }
  }

  function start() {
    if (destroyed) {
      throw new Error('MissionScheduler has been destroyed.');
    }
    if (timer) {
      return;
    }
    emit('scheduler_started', { intervalMs, state: buildStateSnapshot() });
    timer = setInterval(evaluate, intervalMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    publishState('started');
    evaluate();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      emit('scheduler_stopped', { state: buildStateSnapshot() });
      publishState('stopped');
    }
  }

  function destroy() {
    stop();
    destroyed = true;
    activeRuns.clear();
  }

  function isRunning() {
    return Boolean(timer);
  }

  function getState() {
    return buildStateSnapshot();
  }

  function setExecutor(nextExecutor) {
    if (typeof nextExecutor !== 'function') {
      throw new TypeError('MissionScheduler setExecutor expects a function');
    }
    currentExecutor = nextExecutor;
  }

  async function runMissionById(id, options = {}) {
    const mission = await controller.get(id);
    if (!mission) {
      throw new Error(`Mission '${id}' not found`);
    }
    return runMissionInternal(mission, { ...options, forced: options.forced ?? true });
  }

  async function runMission(mission, options = {}) {
    if (!mission || !mission.id) {
      throw new TypeError('runMission expects a mission object with an id');
    }
    return runMissionInternal(mission, options);
  }

  async function runMissionInternal(mission, { forced = false } = {}) {
    const missionId = mission.id;

    if (activeRuns.has(missionId)) {
      emit('mission_skipped', { mission, reason: 'already running' });
      return { success: false, skipped: true, reason: 'already running' };
    }

    if (!forced && !isMissionDue(mission, clock())) {
      emit('mission_skipped', { mission, reason: 'not due' });
      return { success: false, skipped: true, reason: 'not due' };
    }

    if (!mission.enable && !forced) {
      emit('mission_skipped', { mission, reason: 'disabled' });
      return { success: false, skipped: true, reason: 'disabled' };
    }

    activeRuns.add(missionId);
    const startedAt = clock();

    try {
      let runningSnapshot;
      try {
        runningSnapshot = await controller.markRunning(missionId, startedAt);
      } catch (error) {
        emit('mission_skipped', { mission, reason: `markRunning failed: ${error.message}` });
        logger?.warn?.(`[MissionScheduler] Failed to mark mission ${missionId} running: ${error.message}`);
        return { success: false, skipped: true, reason: 'markRunning failed' };
      }

      emit('mission_started', { mission: runningSnapshot, forced });

      let executionResult = null;
      let executionError = null;
      try {
        executionResult = await currentExecutor(runningSnapshot, {
          controller,
          telemetry: emit,
          logger,
          clock
        });
      } catch (error) {
        executionError = error;
      }

      const finishedAt = clock();
      const success = executionError ? false : executionResult?.success !== false;
      const errorMessage = executionError
        ? executionError.message || String(executionError)
        : (typeof executionResult?.error === 'string' ? executionResult.error : executionResult?.error?.message);

      let resultSnapshot = runningSnapshot;
      try {
        resultSnapshot = await controller.markResult(missionId, {
          finishedAt,
          success,
          error: errorMessage
        });
      } catch (error) {
        logger?.error?.(`[MissionScheduler] Failed to record result for mission ${missionId}: ${error.message}`);
        emit('mission_error', { mission: runningSnapshot, error: error.message });
        throw error;
      }

      if (success) {
        emit('mission_completed', { mission: resultSnapshot, result: executionResult?.result ?? null });
        return { success: true, result: executionResult?.result ?? null, mission: resultSnapshot };
      }

      emit('mission_failed', { mission: resultSnapshot, error: errorMessage || 'Unknown error' });
      return { success: false, error: errorMessage || 'Unknown error', mission: resultSnapshot };
    } finally {
      activeRuns.delete(missionId);
    }
  }

  function buildStateSnapshot() {
    return Object.freeze({
      running: Boolean(timer),
      intervalMs,
      destroyed,
      activeRuns: activeRuns.size,
      lastTickStartedAt,
      lastTickCompletedAt,
      lastTickDurationMs,
      lastTickError,
      lastTickEvaluated,
      lastTickLaunched,
      lastPersistedAt,
      lastPersistReason
    });
  }

  function publishState(reason, additional = {}) {
    try {
      const timestamp = new Date().toISOString();
      lastPersistedAt = timestamp;
      lastPersistReason = reason;
      const snapshot = buildStateSnapshot();
      const persistencePayload = { ...snapshot, reason, ...additional };
      if (stateRepo && typeof stateRepo.saveState === 'function') {
        stateRepo.saveState(persistencePayload).catch(error => {
          logger?.warn?.(`[MissionScheduler] Failed to persist scheduler state (${reason}): ${error.message}`);
        });
      }
      emit('scheduler_state', { reason, state: snapshot, ...additional });
      return snapshot;
    } catch (error) {
      logger?.warn?.(`[MissionScheduler] publishState failed (${reason}): ${error.message}`);
      return buildStateSnapshot();
    }
  }

  function restoreFromPersistedState() {
    if (!stateRepo || typeof stateRepo.loadState !== 'function') {
      return;
    }
    stateRepo.loadState().then(state => {
      if (!state) {
        return;
      }
      lastTickStartedAt = state.lastTickStartedAt ?? lastTickStartedAt;
      lastTickCompletedAt = state.lastTickCompletedAt ?? lastTickCompletedAt;
      lastTickDurationMs = state.lastTickDurationMs ?? lastTickDurationMs;
      lastTickError = state.lastTickError ?? lastTickError;
      lastTickEvaluated = Number.isFinite(state.lastTickEvaluated) ? state.lastTickEvaluated : lastTickEvaluated;
      lastTickLaunched = Number.isFinite(state.lastTickLaunched) ? state.lastTickLaunched : lastTickLaunched;
      lastPersistedAt = state.lastPersistedAt ?? lastPersistedAt;
      lastPersistReason = state.reason ?? lastPersistReason;
      emit('scheduler_state', { reason: 'restored', state: buildStateSnapshot() });
    }).catch(error => {
      logger?.warn?.(`[MissionScheduler] Failed to restore scheduler state: ${error.message}`);
    });
  }

  return Object.freeze({
    start,
    stop,
    destroy,
    trigger: evaluate,
    isRunning,
    setExecutor,
    runMission,
    runMissionById,
    getState
  });
}

function isMissionDue(mission, nowMs) {
  if (!mission || mission.status === MISSION_STATUSES.RUNNING) {
    return false;
  }
  if (!mission.nextRunAt) {
    return false;
  }
  const nextRunTime = Date.parse(mission.nextRunAt);
  if (!Number.isFinite(nextRunTime)) {
    return false;
  }
  return nextRunTime <= nowMs;
}

function sortByPriorityAndNextRun(a, b) {
  const priorityA = Number.isFinite(a.priority) ? a.priority : 0;
  const priorityB = Number.isFinite(b.priority) ? b.priority : 0;
  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }
  const timeA = Date.parse(a.nextRunAt || 0) || 0;
  const timeB = Date.parse(b.nextRunAt || 0) || 0;
  return timeA - timeB;
}
