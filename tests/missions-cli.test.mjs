import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMock = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn()
};

const schedulerMock = {
  runMission: vi.fn(),
  trigger: vi.fn()
};

const templatesRepositoryMock = {
  listTemplates: vi.fn(),
  createDraftFromTemplate: vi.fn(),
  getTemplate: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn()
};

const githubSyncControllerMock = {
  status: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  resolve: vi.fn(),
  config: {
    repoPath: '/tmp/missions',
    branch: 'main',
    filePath: 'missions.json'
  }
};

const getMissionControllerMock = vi.fn(() => controllerMock);
const getMissionSchedulerMock = vi.fn(() => schedulerMock);
const getMissionTemplatesRepositoryMock = vi.fn(() => templatesRepositoryMock);
const getMissionGitHubSyncControllerMock = vi.fn(() => githubSyncControllerMock);
const missionConfigMock = {
  enabled: true,
  schedulerEnabled: true,
  telemetryEnabled: true,
  httpEnabled: true,
  github: {
    enabled: true
  }
};
const getMissionConfigMock = vi.fn(() => missionConfigMock);

vi.mock('../app/features/missions/index.mjs', () => ({
  getMissionController: getMissionControllerMock,
  getMissionScheduler: getMissionSchedulerMock,
  getMissionTemplatesRepository: getMissionTemplatesRepositoryMock,
  getMissionConfig: getMissionConfigMock,
  getMissionGitHubSyncController: getMissionGitHubSyncControllerMock
}));

const { executeMissions, getMissionsHelpText } = await import('../app/commands/missions.cli.mjs');

function createSpies() {
  const outputs = [];
  const errors = [];
  return {
    outputs,
    errors,
    output: vi.fn((value) => outputs.push(value)),
    error: vi.fn((value) => errors.push(value))
  };
}

describe('missions CLI', () => {
  beforeEach(() => {
    controllerMock.list.mockReset();
    controllerMock.get.mockReset();
    controllerMock.create.mockReset();
    schedulerMock.runMission.mockReset();
    schedulerMock.trigger.mockReset();
    templatesRepositoryMock.listTemplates.mockReset();
    templatesRepositoryMock.createDraftFromTemplate.mockReset();
  templatesRepositoryMock.getTemplate.mockReset();
  templatesRepositoryMock.saveTemplate.mockReset();
  templatesRepositoryMock.deleteTemplate.mockReset();
    githubSyncControllerMock.status.mockReset();
    githubSyncControllerMock.load.mockReset();
    githubSyncControllerMock.save.mockReset();
    githubSyncControllerMock.resolve.mockReset();
    getMissionControllerMock.mockClear();
    getMissionSchedulerMock.mockClear();
    getMissionTemplatesRepositoryMock.mockClear();
    getMissionGitHubSyncControllerMock.mockClear();
    getMissionConfigMock.mockClear();
    missionConfigMock.github.enabled = true;
  });

  it('fails scaffold with both interval and cron override', async () => {
    const spies = createSpies();
    const result = await executeMissions({
      action: 'scaffold',
      positionalArgs: ['weekly-digest'],
      flags: { 'interval-minutes': 60, cron: '* * * * *' }
    }, spies.output, spies.error);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/either --interval-minutes or --cron/);
    expect(spies.errors[0]).toMatch(/either --interval-minutes or --cron/);
  });

  it('fails scaffold with invalid interval', async () => {
    const spies = createSpies();
    const result = await executeMissions({
      action: 'scaffold',
      positionalArgs: ['weekly-digest'],
      flags: { 'interval-minutes': -5 }
    }, spies.output, spies.error);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/must be a positive number/);
    expect(spies.errors[0]).toMatch(/must be a positive number/);
  });

  it('fails scaffold with invalid priority', async () => {
    const spies = createSpies();
    const result = await executeMissions({
      action: 'scaffold',
      positionalArgs: ['weekly-digest'],
      flags: { priority: 'not-a-number' }
    }, spies.output, spies.error);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/priority must be a number/);
    expect(spies.errors[0]).toMatch(/priority must be a number/);
  });

  it('propagates error from createDraftFromTemplate', async () => {
    templatesRepositoryMock.createDraftFromTemplate.mockRejectedValueOnce(new Error('template error'));
    const spies = createSpies();
    const result = await executeMissions({
      action: 'scaffold',
      positionalArgs: ['weekly-digest']
    }, spies.output, spies.error);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/template error/);
    expect(spies.errors[0]).toMatch(/template error/);
  });

  it('propagates error from controller.create', async () => {
    const draft = {
      name: 'Weekly Digest',
      description: 'desc',
      schedule: { intervalMinutes: 60 },
      tags: ['ops'],
      priority: 3,
      payload: null,
      enable: true
    };
    templatesRepositoryMock.createDraftFromTemplate.mockResolvedValue(draft);
    controllerMock.create.mockRejectedValueOnce(new Error('create error'));
    const spies = createSpies();
    const result = await executeMissions({
      action: 'scaffold',
      positionalArgs: ['weekly-digest']
    }, spies.output, spies.error);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/create error/);
    expect(spies.errors[0]).toMatch(/create error/);
  });

  it('returns error for unknown subcommand', async () => {
    const spies = createSpies();
    const result = await executeMissions({ action: 'notarealcommand' }, spies.output, spies.error);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown missions action/);
    expect(spies.errors[0]).toMatch(/Unknown missions action/);
  });

  it('exposes help text', () => {
    const help = getMissionsHelpText();
    expect(help).toContain('/missions list');
    expect(help).toContain('/missions run');
    expect(help).toContain('/missions templates');
    expect(help).toContain('/missions scaffold');
  });

  it('lists missions with human formatting', async () => {
    const mission = {
      id: 'm-1',
      name: 'Nightly Sync',
      status: 'idle',
      priority: 2,
      nextRunAt: '2025-01-01T00:00:00.000Z'
    };
    controllerMock.list.mockResolvedValue([mission]);

    const spies = createSpies();
    const result = await executeMissions({ action: 'list' }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(spies.outputs[0]).toContain('Nightly Sync');
    expect(spies.errors).toHaveLength(0);
  });

  it('inspects a mission by id', async () => {
    const mission = {
      id: 'm-1',
      name: 'Nightly Sync',
      status: 'idle',
      priority: 1,
      enable: true,
      tags: ['ops'],
      schedule: { type: 'interval', intervalMinutes: 60 },
      nextRunAt: '2025-01-01T00:00:00.000Z'
    };
    controllerMock.get.mockResolvedValue(mission);

    const spies = createSpies();
    const result = await executeMissions({ action: 'inspect', positionalArgs: ['m-1'] }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(spies.outputs[0]).toContain('Nightly Sync');
    expect(spies.errors).toHaveLength(0);
  });

  it('runs a mission via scheduler', async () => {
    const mission = { id: 'm-1', name: 'Nightly Sync' };
    controllerMock.get.mockResolvedValue(mission);
    schedulerMock.runMission.mockResolvedValue({ success: true });

    const spies = createSpies();
    const result = await executeMissions({ action: 'run', positionalArgs: ['m-1'] }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(schedulerMock.runMission).toHaveBeenCalledWith(mission, { forced: true });
  });

  it('triggers scheduler tick', async () => {
    const spies = createSpies();
    const result = await executeMissions({ action: 'tick' }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(schedulerMock.trigger).toHaveBeenCalled();
  });

  it('lists mission templates', async () => {
    templatesRepositoryMock.listTemplates.mockResolvedValue([
      {
        slug: 'weekly-digest',
        name: 'Weekly Digest',
        schedule: { intervalMinutes: 10080 },
        tags: ['research'],
        enable: true
      }
    ]);

    const spies = createSpies();
    const result = await executeMissions({ action: 'templates' }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(spies.outputs[0]).toContain('weekly-digest');
    expect(templatesRepositoryMock.listTemplates).toHaveBeenCalled();
  });

  it('shows template details', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValue({
      slug: 'sample',
      name: 'Sample Mission',
      schedule: { intervalMinutes: 30 },
      tags: ['ops'],
      priority: 4,
      enable: true,
      payload: null,
      description: 'demo'
    });

    const spies = createSpies();
    const result = await executeMissions({ action: 'templates', positionalArgs: ['show', 'sample'] }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(templatesRepositoryMock.getTemplate).toHaveBeenCalledWith('sample');
    expect(spies.outputs[0]).toContain('Sample Mission');
  });

  it('saves template updates using existing schedule', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValue({
      slug: 'sample',
      name: 'Sample Mission',
      schedule: { intervalMinutes: 30 },
      tags: ['ops'],
      priority: 2,
      enable: true
    });
    templatesRepositoryMock.saveTemplate.mockResolvedValue({
      slug: 'sample',
      name: 'Sample Mission',
      schedule: { intervalMinutes: 30 },
      tags: ['ops', 'cron'],
      priority: 5,
      enable: true
    });

    const spies = createSpies();
    const result = await executeMissions({
      action: 'templates',
      positionalArgs: ['save', 'sample'],
      flags: { priority: '5', tags: 'ops,cron' }
    }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(templatesRepositoryMock.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'sample',
      priority: 5,
      tags: ['ops', 'cron']
    }));
  });

  it('saves a new template when provided name and schedule', async () => {
    templatesRepositoryMock.getTemplate.mockResolvedValue(null);
    templatesRepositoryMock.saveTemplate.mockResolvedValue({
      slug: 'fresh-template',
      name: 'Fresh Template',
      schedule: { intervalMinutes: 15 },
      tags: [],
      priority: 0,
      enable: true
    });

    const spies = createSpies();
    const result = await executeMissions({
      action: 'templates',
      positionalArgs: ['save'],
      flags: { name: 'Fresh Template', 'interval-minutes': '15' }
    }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(templatesRepositoryMock.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Fresh Template',
      schedule: { intervalMinutes: 15 }
    }));
  });

  it('deletes a template by slug', async () => {
    templatesRepositoryMock.deleteTemplate.mockResolvedValue(true);

    const spies = createSpies();
    const result = await executeMissions({
      action: 'templates',
      positionalArgs: ['delete', 'sample']
    }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(templatesRepositoryMock.deleteTemplate).toHaveBeenCalledWith('sample');
  });

  it('scaffolds a mission and persists by default', async () => {
    const draft = {
      name: 'Weekly Digest',
      description: 'desc',
      schedule: { intervalMinutes: 60 },
      tags: ['ops'],
      priority: 3,
      payload: null,
      enable: true
    };
    templatesRepositoryMock.createDraftFromTemplate.mockResolvedValue(draft);
    controllerMock.create.mockResolvedValue({ id: 'mission-123', ...draft });

    const spies = createSpies();
    const result = await executeMissions({ action: 'scaffold', positionalArgs: ['weekly-digest'] }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(templatesRepositoryMock.createDraftFromTemplate).toHaveBeenCalledWith('weekly-digest', expect.any(Object));
    expect(controllerMock.create).toHaveBeenCalledWith(draft);
    expect(spies.outputs[0]).toContain('Created mission mission-123');
  });

  it('supports dry-run scaffold output', async () => {
    const draft = {
      name: 'Weekly Digest',
      description: 'desc',
      schedule: { intervalMinutes: 60 },
      tags: ['ops'],
      priority: 3,
      payload: null,
      enable: true
    };
    templatesRepositoryMock.createDraftFromTemplate.mockResolvedValue(draft);

    const spies = createSpies();
    const result = await executeMissions({ action: 'scaffold', positionalArgs: ['weekly-digest'], flags: { 'dry-run': true } }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(controllerMock.create).not.toHaveBeenCalled();
    expect(spies.outputs[0]).toContain("Draft ready from template 'weekly-digest'");
  });

  it('blocks sync commands when disabled', async () => {
    missionConfigMock.github.enabled = false;
    const spies = createSpies();
    const result = await executeMissions({ action: 'sync', positionalArgs: ['status'] }, spies.output, spies.error);

    expect(result.success).toBe(false);
    expect(spies.errors[0]).toMatch(/disabled/);
    missionConfigMock.github.enabled = true;
  });

  it('returns sync status summary', async () => {
    githubSyncControllerMock.status.mockResolvedValue({
      status: 'ok',
      message: 'Mission GitHub status captured.',
      statusReport: {
        ahead: 0,
        behind: 1,
        conflicts: [],
        staged: ['missions.json'],
        modified: [],
        clean: false
      }
    });

    const spies = createSpies();
    const result = await executeMissions({ action: 'sync', positionalArgs: ['status'] }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(spies.outputs.join('\n')).toContain('Repo:');
    expect(githubSyncControllerMock.status).toHaveBeenCalled();
  });

  it('requires content for sync push', async () => {
    const spies = createSpies();
    const result = await executeMissions({ action: 'sync', positionalArgs: ['push'] }, spies.output, spies.error);

    expect(result.success).toBe(false);
    expect(spies.errors[0]).toMatch(/Provide --content/);
  });

  it('pushes manifest with inline content', async () => {
    githubSyncControllerMock.save.mockResolvedValue({ status: 'ok', message: 'synced', statusReport: {} });

    const spies = createSpies();
    const result = await executeMissions({ action: 'sync', positionalArgs: ['push'], flags: { content: '{"missions":[]}' } }, spies.output, spies.error);

    expect(result.success).toBe(true);
    expect(githubSyncControllerMock.save).toHaveBeenCalledWith(expect.any(Object), { content: '{"missions":[]}' });
    expect(spies.outputs[0]).toContain('synced');
  });
});
