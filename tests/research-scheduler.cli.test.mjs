import { beforeEach, describe, expect, it, vi } from 'vitest';

const schedulerMock = {
  getState: vi.fn(),
  runNow: vi.fn(),
  start: vi.fn(),
  stop: vi.fn()
};

const getResearchSchedulerConfigMock = vi.fn();
const getResearchRequestSchedulerMock = vi.fn();

vi.mock('../app/features/research/github-sync/index.mjs', () => ({
  getResearchSchedulerConfig: getResearchSchedulerConfigMock,
  getResearchRequestScheduler: getResearchRequestSchedulerMock
}));

const { executeResearchScheduler } = await import('../app/commands/research-scheduler.cli.mjs');

describe('executeResearchScheduler', () => {
  beforeEach(() => {
      vi.clearAllMocks();
      schedulerMock.getState.mockReset();
      schedulerMock.runNow.mockReset();
      schedulerMock.start.mockReset();
      schedulerMock.stop.mockReset();
    schedulerMock.getState.mockReturnValue({
      active: false,
      running: false,
      lastRunTrigger: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastRunSummary: { total: 0, handled: 0, failed: 0 },
      lastRunError: null,
      totalRuns: 0,
      totalRequestsHandled: 0,
      totalErrors: 0
    });
    schedulerMock.runNow.mockResolvedValue({ success: true, handled: 0, failed: 0, total: 0 });
      schedulerMock.start.mockImplementation(() => schedulerMock.getState());
      schedulerMock.stop.mockImplementation(() => schedulerMock.getState());

      getResearchSchedulerConfigMock.mockReset();
      getResearchSchedulerConfigMock.mockReturnValue({
      enabled: true,
      cron: '*/15 * * * *',
      timezone: 'UTC',
      runOnStart: true
    });
      getResearchRequestSchedulerMock.mockReset();
      getResearchRequestSchedulerMock.mockReturnValue(schedulerMock);
  });

  it('prints scheduler status by default', async () => {
    const lines = [];
    const result = await executeResearchScheduler({
      output: (line) => lines.push(line),
      error: () => {}
    });

    expect(result.success).toBe(true);
    expect(getResearchRequestSchedulerMock).toHaveBeenCalled();
    expect(lines[0]).toMatch(/Enabled via config/);
  });

  it('triggers a manual run and reports summary', async () => {
    schedulerMock.runNow.mockResolvedValue({ success: true, handled: 2, failed: 1, total: 3 });
    const lines = [];

    const result = await executeResearchScheduler({
      positionalArgs: ['run'],
      output: (line) => lines.push(line),
      error: () => {}
    });

    expect(result.success).toBe(true);
    expect(schedulerMock.runNow).toHaveBeenCalledWith('manual');
    expect(lines.pop()).toMatch(/handled=2/);
  });

  it('reports skipped manual run', async () => {
    schedulerMock.runNow.mockResolvedValue({ skipped: true, reason: 'already-running' });
    const lines = [];

    const result = await executeResearchScheduler({
      positionalArgs: ['run'],
      output: (line) => lines.push(line),
      error: () => {}
    });

    expect(result.skipped).toBe(true);
    expect(lines.pop()).toContain('Run skipped');
  });

  it('starts and stops the scheduler', async () => {
    const outputLines = [];

    const startResult = await executeResearchScheduler({
      positionalArgs: ['start'],
      output: (line) => outputLines.push(line),
      error: () => {}
    });
    expect(startResult.success).toBe(true);
    expect(schedulerMock.start).toHaveBeenCalled();

    const stopResult = await executeResearchScheduler({
      positionalArgs: ['stop'],
      output: (line) => outputLines.push(line),
      error: () => {}
    });
    expect(stopResult.success).toBe(true);
    expect(schedulerMock.stop).toHaveBeenCalled();
  });

  it('returns error for unknown actions', async () => {
    const errors = [];
    const result = await executeResearchScheduler({
      positionalArgs: ['unknown'],
      output: () => {},
      error: (line) => errors.push(line)
    });

    expect(result.success).toBe(false);
    expect(errors[0]).toMatch(/Unknown action/);
  });
});
