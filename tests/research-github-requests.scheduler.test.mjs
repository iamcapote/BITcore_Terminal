import { describe, expect, it, vi } from 'vitest';
import { createResearchRequestScheduler } from '../app/features/research/github-sync/request.scheduler.mjs';

describe('createResearchRequestScheduler', () => {
  it('throws for invalid cron expressions', () => {
    expect(() => createResearchRequestScheduler({
      cronExpression: 'invalid cron',
      fetcher: async () => ({ requests: [] }),
      validate: () => false
    })).toThrow(RangeError);
  });

  it('invokes handler for each fetched request during runNow', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      requests: [
        { id: 'req-1', query: 'Test request 1' },
        { id: 'req-2', query: 'Test request 2' }
      ]
    });
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const scheduler = createResearchRequestScheduler({
      cronExpression: '* * * * *',
      fetcher,
      handler,
      validate: () => true,
      runOnStart: false
    });

    const result = await scheduler.runNow('manual');

  expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ limit: Infinity }));
    expect(handler).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ success: true, handled: 2, failed: 0, total: 2 });
  });

  it('skips overlapping runs when a tick is already in progress', async () => {
    let resolveFetch;
    const fetcher = vi.fn(() => new Promise(resolve => { resolveFetch = resolve; }));
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const scheduler = createResearchRequestScheduler({
      cronExpression: '* * * * *',
      fetcher,
      handler,
      validate: () => true,
      runOnStart: false
    });

    const firstRun = scheduler.runNow('manual');
    expect(typeof resolveFetch).toBe('function');
    const secondRun = await scheduler.runNow('manual');
    expect(secondRun).toEqual({ skipped: true, reason: 'already-running' });

    resolveFetch({ requests: [] });
    await firstRun;
  });

  it('schedules cron tasks on start without immediate run when disabled', () => {
    const cronStart = vi.fn();
    const cronStop = vi.fn();
    const scheduleStub = vi.fn().mockReturnValue({ start: cronStart, stop: cronStop });
    const fetcher = vi.fn().mockResolvedValue({ requests: [] });
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const scheduler = createResearchRequestScheduler({
      cronExpression: '* * * * *',
      fetcher,
      handler,
      schedule: scheduleStub,
      validate: () => true,
      runOnStart: false
    });

    scheduler.start();

    expect(scheduleStub).toHaveBeenCalledTimes(1);
    expect(cronStart).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();

    scheduler.stop();
    expect(cronStop).toHaveBeenCalledTimes(1);
  });
});
