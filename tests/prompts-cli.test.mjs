import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMock = {
  list: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  search: vi.fn(),
  exists: vi.fn()
};

const getPromptControllerMock = vi.fn(() => controllerMock);

const githubControllerMock = {
  status: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  sync: vi.fn()
};

const getPromptGitHubSyncControllerMock = vi.fn(() => githubControllerMock);
const getPromptConfigMock = vi.fn(() => ({
  github: {
    enabled: true,
    repoPath: '/tmp/prompts-repo',
    directory: 'prompts',
    branch: 'main',
    remote: 'origin',
    commitMessage: 'chore(prompts): sync'
  },
  httpEnabled: true
}));

vi.mock('../app/features/prompts/index.mjs', () => ({
  getPromptController: getPromptControllerMock,
  getPromptGitHubSyncController: getPromptGitHubSyncControllerMock,
  getPromptConfig: getPromptConfigMock
}));

vi.mock('../app/utils/cli-error-handler.mjs', async () => {
  const actual = await vi.importActual('../app/utils/cli-error-handler.mjs');
  return {
    ...actual,
    handleCliError: vi.fn((error, type, context, errorFn) => {
      errorFn?.(error.message);
      return { success: false, error: error.message, type, context };
    })
  };
});

const promptRecord = Object.freeze({
  id: 'research-plan',
  title: 'Research Plan',
  description: 'Outline for deep dive',
  body: '1. Do research',
  tags: Object.freeze(['research', 'plan']),
  version: 2,
  updatedAt: '2025-09-26T00:00:00.000Z'
});

const { executePrompts, getPromptsHelpText } = await import('../app/commands/prompts.cli.mjs');

function createSpies() {
  const outputs = [];
  const output = vi.fn((value) => {
    outputs.push(value);
  });
  const errors = [];
  const error = vi.fn((value) => {
    errors.push(value);
  });
  return { output, error, outputs, errors };
}

beforeEach(() => {
  controllerMock.list.mockReset().mockResolvedValue([promptRecord]);
  controllerMock.get.mockReset().mockResolvedValue(promptRecord);
  controllerMock.save.mockReset().mockResolvedValue(promptRecord);
  controllerMock.remove.mockReset().mockResolvedValue();
  controllerMock.search.mockReset().mockResolvedValue([promptRecord]);
  controllerMock.exists.mockReset().mockResolvedValue(true);
  getPromptControllerMock.mockClear();
  githubControllerMock.status.mockReset().mockResolvedValue({ status: 'ok', message: 'Clean', statusReport: { clean: true } });
  githubControllerMock.pull.mockReset().mockResolvedValue({ status: 'ok', message: 'Pulled' });
  githubControllerMock.push.mockReset().mockResolvedValue({ status: 'ok', message: 'Pushed' });
  githubControllerMock.sync.mockReset().mockResolvedValue({ status: 'ok', message: 'Synced' });
  getPromptGitHubSyncControllerMock.mockClear();
  getPromptConfigMock.mockClear();
});

describe('prompts CLI help', () => {
  it('mentions core subcommands', () => {
    const help = getPromptsHelpText();
    expect(help).toContain('/prompts list');
    expect(help).toContain('/prompts save');
    expect(help).toContain('/prompts search');
    expect(help).toContain('/prompts github');
  });
});

describe('executePrompts', () => {
  it('lists prompts by default', async () => {
    const { output, error, outputs } = createSpies();
    const result = await executePrompts({}, output, error);

    expect(result.success).toBe(true);
    expect(controllerMock.list).toHaveBeenCalledWith({ tags: [], limit: undefined });
    expect(outputs.some((value) => typeof value === 'string' && value.includes('Research Plan'))).toBe(true);
    expect(outputs.at(-1)).toEqual({ type: 'output', data: '', keepDisabled: false });
    expect(error).not.toHaveBeenCalled();
  });

  it('retrieves a prompt by id', async () => {
    const { output, error } = createSpies();
    const result = await executePrompts({ positionalArgs: ['get', 'research-plan'] }, output, error);

    expect(result.success).toBe(true);
    expect(controllerMock.get).toHaveBeenCalledWith('research-plan');
    expect(error).not.toHaveBeenCalled();
  });

  it('saves a prompt using flags', async () => {
    const { output, error } = createSpies();
    const result = await executePrompts({
      positionalArgs: ['save'],
      flags: {
        id: 'research-plan',
        title: 'Research Plan',
        body: '1. Do research',
        tags: 'research,plan'
      }
    }, output, error);

    expect(result.success).toBe(true);
    expect(controllerMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'research-plan',
        title: 'Research Plan',
        body: '1. Do research',
        tags: ['research', 'plan']
      }),
      expect.objectContaining({ actor: 'cli' })
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('searches prompts with json output', async () => {
    const { output, outputs } = createSpies();
    const result = await executePrompts({
      positionalArgs: ['search'],
      flags: { query: 'plan', json: true }
    }, output, console.error);

    expect(result.success).toBe(true);
    expect(controllerMock.search).toHaveBeenCalledWith({
      query: 'plan',
      tags: [],
      limit: undefined,
      includeBody: true
    });
    const jsonLine = outputs.find((value) => typeof value === 'string' && value.trim().startsWith('['));
    expect(jsonLine).toBeDefined();
  });

  it('deletes prompts', async () => {
    const { output, error } = createSpies();
    const result = await executePrompts({ positionalArgs: ['delete', 'research-plan'] }, output, error);

    expect(result.success).toBe(true);
    expect(controllerMock.remove).toHaveBeenCalledWith('research-plan', expect.any(Object));
    expect(error).not.toHaveBeenCalled();
  });

  it('reports GitHub status', async () => {
    const { output } = createSpies();
    const result = await executePrompts({ positionalArgs: ['github', 'status'] }, output, console.error);

    expect(result.success).toBe(true);
    expect(getPromptGitHubSyncControllerMock).toHaveBeenCalled();
    expect(githubControllerMock.status).toHaveBeenCalledWith(expect.objectContaining({ repoPath: '/tmp/prompts-repo' }));
  });
});
