import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MissionRepository } from '../app/features/missions/mission.repository.mjs';
import { MissionService } from '../app/features/missions/mission.service.mjs';
import { MISSION_STATUSES } from '../app/features/missions/mission.schema.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

describe('MissionService', () => {
  let tempDir;
  let clockNow;
  let service;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'missions-'));
    clockNow = new Date('2025-01-01T00:00:00Z').getTime();
    const clock = () => clockNow;
    const repository = new MissionRepository({ dataDir: tempDir, fileName: 'missions.json', logger: noopLogger });
    service = new MissionService({ repository, clock, logger: noopLogger });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates missions with interval schedule and computes next run', async () => {
    const mission = await service.createMission({
      name: 'Hourly sync',
      schedule: { intervalMinutes: 60 },
      tags: ['ops']
    });

    expect(mission.status).toBe(MISSION_STATUSES.IDLE);
    expect(mission.nextRunAt).toBe('2025-01-01T01:00:00.000Z');
    expect(mission.tags).toContain('ops');

    const stored = await service.getMissionById(mission.id);
    expect(stored).not.toBeNull();
  });

  it('supports listing with status and tag filters', async () => {
    await service.createMission({ name: 'Daily digest', schedule: { intervalMinutes: 1440 }, tags: ['report'] });
    const paused = await service.createMission({ name: 'Paused task', schedule: { intervalMinutes: 30 }, tags: ['ops'] });
    await service.updateMission(paused.id, { enable: false });

    const active = await service.listMissions({ status: MISSION_STATUSES.IDLE });
    expect(active.every(mission => mission.status === MISSION_STATUSES.IDLE)).toBe(true);

    const ops = await service.listMissions({ tag: 'ops', includeDisabled: true });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe(paused.id);
  });

  it('recalculates next run when schedule changes', async () => {
    const mission = await service.createMission({
      name: 'Sync',
      schedule: { intervalMinutes: 120 }
    });

    clockNow = new Date('2025-01-01T02:00:00Z').getTime();
    const updated = await service.updateMission(mission.id, { schedule: { intervalMinutes: 30 } });

    expect(updated.nextRunAt).toBe('2025-01-01T02:30:00.000Z');
  });

  it('computes cron-based schedules respecting timezone', async () => {
    const mission = await service.createMission({
      name: 'Morning brief',
      schedule: { cron: '0 9 * * *', timezone: 'America/New_York' }
    });

    expect(mission.nextRunAt).toBe('2025-01-01T14:00:00.000Z');

    clockNow = new Date('2025-01-01T14:05:00Z').getTime();
    await service.recordRunStart(mission.id);

    clockNow = new Date('2025-01-01T14:10:00Z').getTime();
    const result = await service.recordRunResult(mission.id, { success: true });

    expect(result.nextRunAt).toBe('2025-01-02T14:00:00.000Z');
  });

  it('records run lifecycle and schedules next run on success', async () => {
    const mission = await service.createMission({ name: 'Lifecycle', schedule: { intervalMinutes: 15 } });

    clockNow = new Date('2025-01-01T00:05:00Z').getTime();
    const running = await service.recordRunStart(mission.id);
    expect(running.status).toBe(MISSION_STATUSES.RUNNING);

    clockNow = new Date('2025-01-01T00:07:00Z').getTime();
    const result = await service.recordRunResult(mission.id, { success: true });
    expect(result.status).toBe(MISSION_STATUSES.IDLE);
    expect(result.lastFinishedAt).toBe('2025-01-01T00:07:00.000Z');
    expect(result.nextRunAt).toBe('2025-01-01T00:22:00.000Z');
  });

  it('marks missions as failed on run error and keeps nextRunAt untouched', async () => {
    const mission = await service.createMission({ name: 'Failure', schedule: { intervalMinutes: 45 } });

    clockNow = new Date('2025-01-01T00:10:00Z').getTime();
    const result = await service.recordRunResult(mission.id, { success: false, error: new Error('boom') });

    expect(result.status).toBe(MISSION_STATUSES.FAILED);
    expect(result.lastRunError).toBe('boom');
    expect(result.nextRunAt).toBeNull();
  });
});
