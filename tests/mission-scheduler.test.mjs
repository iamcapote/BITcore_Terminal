import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMissionScheduler } from '../app/features/missions/mission.scheduler.mjs';
import { MISSION_STATUSES } from '../app/features/missions/mission.schema.mjs';

const BASE_TIME = Date.parse('2025-01-01T00:00:00Z');

function createMission(overrides = {}) {
  return Object.freeze({
    id: overrides.id || 'mission-1',
    name: overrides.name || 'Test Mission',
    status: overrides.status || MISSION_STATUSES.IDLE,
    enable: overrides.enable !== undefined ? overrides.enable : true,
    nextRunAt: overrides.nextRunAt ?? new Date(BASE_TIME).toISOString(),
    priority: overrides.priority ?? 0,
    schedule: overrides.schedule ?? { type: 'interval', intervalMinutes: 60 },
    tags: overrides.tags ?? []
  });
}

describe('MissionScheduler', () => {
  let controller;
  let telemetry;
  let now;
  let clock;
  let stateRepository;

  beforeEach(() => {
    now = BASE_TIME;
    clock = () => now;
    telemetry = vi.fn();
    controller = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      markRunning: vi.fn(),
      markResult: vi.fn()
    };
    stateRepository = {
      loadState: vi.fn().mockResolvedValue(null),
      saveState: vi.fn().mockResolvedValue()
    };
  });

  it('runs due missions and records a successful result', async () => {
    const mission = createMission();
    controller.list.mockResolvedValue([mission]);
    controller.markRunning.mockResolvedValue({ ...mission, status: MISSION_STATUSES.RUNNING, lastRunAt: new Date(now).toISOString() });
    controller.markResult.mockResolvedValue({ ...mission, status: MISSION_STATUSES.IDLE, nextRunAt: new Date(now + 60_000).toISOString() });

    const executor = vi.fn(async () => ({ success: true, result: { note: 'done' } }));
  const scheduler = createMissionScheduler({ controller, telemetry, clock, executor, stateRepository });

    const result = await scheduler.trigger();

    expect(controller.list).toHaveBeenCalledWith({ includeDisabled: false });
    expect(controller.markRunning).toHaveBeenCalledWith(mission.id, now);
    expect(controller.markResult).toHaveBeenCalledWith(mission.id, expect.objectContaining({ success: true }));
    expect(executor).toHaveBeenCalledTimes(1);
    expect(telemetry).toHaveBeenCalledWith('mission_completed', expect.any(Object));
    expect(result).toBeUndefined();
  });

  it('skips missions that are not yet due', async () => {
    const futureMission = createMission({ id: 'future', nextRunAt: new Date(now + 60_000).toISOString() });
    controller.list.mockResolvedValue([futureMission]);

  const scheduler = createMissionScheduler({ controller, telemetry, clock, stateRepository });

    await scheduler.trigger();

    expect(controller.markRunning).not.toHaveBeenCalled();
    const missionStartedCall = telemetry.mock.calls.find(([event]) => event === 'mission_started');
    expect(missionStartedCall).toBeUndefined();
  });

  it('records mission failure when executor throws', async () => {
    const mission = createMission({ id: 'fail' });
    controller.list.mockResolvedValue([mission]);
    controller.markRunning.mockResolvedValue({ ...mission, status: MISSION_STATUSES.RUNNING });
    controller.markResult.mockResolvedValue({ ...mission, status: MISSION_STATUSES.FAILED });

    const executor = vi.fn(async () => { throw new Error('boom'); });
  const scheduler = createMissionScheduler({ controller, telemetry, clock, executor, stateRepository });

    await scheduler.trigger();

    expect(controller.markResult).toHaveBeenCalledWith('fail', expect.objectContaining({ success: false, error: 'boom' }));
    expect(telemetry).toHaveBeenCalledWith('mission_failed', expect.any(Object));
  });

  it('prevents concurrent runs of the same mission', async () => {
    const mission = createMission({ id: 'dupe' });
    controller.markRunning.mockResolvedValue({ ...mission, status: MISSION_STATUSES.RUNNING });
    controller.markResult.mockResolvedValue({ ...mission, status: MISSION_STATUSES.IDLE });

  const scheduler = createMissionScheduler({ controller, telemetry, clock, stateRepository });

    const [first, second] = await Promise.all([
      scheduler.runMission(mission, { forced: true }),
      scheduler.runMission(mission, { forced: true })
    ]);

    expect(first.success || first.skipped).toBe(true);
    expect(second.skipped).toBe(true);
    expect(controller.markRunning).toHaveBeenCalledTimes(1);
  });

  it('persists scheduler state snapshots and restores prior metrics', async () => {
    const mission = createMission();
    controller.list.mockResolvedValue([mission]);
    controller.markRunning.mockResolvedValue({ ...mission, status: MISSION_STATUSES.RUNNING, lastRunAt: new Date(now).toISOString() });
    controller.markResult.mockResolvedValue({ ...mission, status: MISSION_STATUSES.IDLE, nextRunAt: new Date(now + 60_000).toISOString() });

    const restoredState = {
      lastTickStartedAt: '2025-01-01T00:00:00.000Z',
      lastTickCompletedAt: null,
      lastTickDurationMs: null,
      lastTickError: null,
      lastTickEvaluated: 5,
      lastTickLaunched: 2,
      lastPersistedAt: '2025-01-01T00:05:00.000Z',
      reason: 'tick_complete'
    };
    stateRepository.loadState.mockResolvedValue(restoredState);

    const executor = vi.fn(async () => ({ success: true }));
    const scheduler = createMissionScheduler({ controller, telemetry, clock, executor, stateRepository });

    // Allow asynchronous restoration to settle
    await Promise.resolve();

    expect(stateRepository.loadState).toHaveBeenCalled();
    const restoredCall = telemetry.mock.calls.find(([event, payload]) => event === 'scheduler_state' && payload?.reason === 'restored');
    expect(restoredCall).toBeTruthy();

    await scheduler.trigger();

    // stateRepository should persist at least tick start and completion snapshots
    expect(stateRepository.saveState).toHaveBeenCalled();
    const persistArgs = stateRepository.saveState.mock.calls.map(([payload]) => payload);
    const completedSnapshot = persistArgs.find(snapshot => snapshot.reason === 'tick_complete');
    expect(completedSnapshot).toBeTruthy();
    expect(completedSnapshot.lastTickEvaluated).toBe(1);
    expect(completedSnapshot.lastTickLaunched).toBe(1);
    expect(completedSnapshot.lastPersistedAt).toBeTruthy();
    expect(completedSnapshot.running).toBe(false);

    const completedStateCall = telemetry.mock.calls.find(([event, payload]) => event === 'scheduler_state' && payload?.reason === 'tick_complete');
    expect(completedStateCall).toBeTruthy();
  });
});
