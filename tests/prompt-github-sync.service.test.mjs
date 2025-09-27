import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyRepoMock = vi.fn();
const pullRepoMock = vi.fn();
const pushRepoMock = vi.fn();
const statusRepoMock = vi.fn();

vi.mock('../app/infrastructure/missions/github-sync.mjs', () => ({
  verifyRepo: verifyRepoMock,
  pullRepo: pullRepoMock,
  pushRepo: pushRepoMock,
  statusRepo: statusRepoMock
}));

const mkdirMock = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock
  },
  mkdir: mkdirMock
}));

const execMock = vi.fn();

vi.mock('child_process', () => ({
  exec: execMock
}));

const { PromptGitHubSyncService } = await import('../app/features/prompts/prompt.github-sync.service.mjs');

describe('PromptGitHubSyncService', () => {
  const defaults = {
    repoPath: '/repo/prompts',
    directory: 'prompts',
    branch: 'main',
    remote: 'origin',
    commitMessage: 'chore(prompts): sync'
  };

  beforeEach(() => {
    verifyRepoMock.mockReset();
    pullRepoMock.mockReset();
    pushRepoMock.mockReset();
    statusRepoMock.mockReset();
    mkdirMock.mockReset();
    execMock.mockReset();

    verifyRepoMock.mockResolvedValue({ success: true, message: 'ok' });
    pullRepoMock.mockResolvedValue({ success: true, message: 'pulled' });
    pushRepoMock.mockResolvedValue({ success: true, message: 'pushed' });
    statusRepoMock.mockResolvedValue({
      success: true,
      message: 'clean',
      clean: true,
      staged: [],
      modified: [],
      conflicts: []
    });
    mkdirMock.mockResolvedValue();
    execMock.mockImplementation((command, options, callback) => {
      callback?.(null, { stdout: '', stderr: '' });
    });
  });

  it('reports decorated status for prompt directory', async () => {
    statusRepoMock.mockResolvedValue({
      success: true,
      message: 'status ok',
      clean: false,
      staged: ['prompts/sample.prompt.json', 'README.md'],
      modified: ['prompts/another.prompt.json'],
      conflicts: ['prompts/conflict.prompt.json']
    });

    const service = new PromptGitHubSyncService({ defaults });
    const result = await service.status();

    expect(result.status).toBe('ok');
    expect(result.statusReport.prompts.staged).toEqual(['prompts/sample.prompt.json']);
    expect(result.statusReport.prompts.modified).toEqual(['prompts/another.prompt.json']);
    expect(result.statusReport.prompts.conflicts).toEqual(['prompts/conflict.prompt.json']);
  });

  it('pulls prompts and ensures directory exists', async () => {
    const service = new PromptGitHubSyncService({ defaults });
    const result = await service.pull();

    expect(result.status).toBe('ok');
    expect(mkdirMock).toHaveBeenCalledWith('/repo/prompts/prompts', { recursive: true });
    expect(pullRepoMock).toHaveBeenCalledWith('/repo/prompts', { remote: 'origin', branch: 'main' });
  });

  it('pushes prompt changes and triggers git commands', async () => {
    const service = new PromptGitHubSyncService({ defaults });

    const result = await service.push();

    expect(result.status).toBe('ok');
    expect(execMock).toHaveBeenNthCalledWith(1, "git add -A prompts", { cwd: '/repo/prompts' }, expect.any(Function));
    expect(execMock).toHaveBeenNthCalledWith(2, "git commit -m 'chore(prompts): sync'", { cwd: '/repo/prompts' }, expect.any(Function));
    expect(pushRepoMock).toHaveBeenCalledWith('/repo/prompts', { remote: 'origin', branch: 'main' });
  });

  it('interprets missing changes as noop without pushing', async () => {
    execMock.mockImplementationOnce((command, options, callback) => callback?.(null, { stdout: '', stderr: '' }))
      .mockImplementationOnce((command, options, callback) => callback?.(new Error('nothing to commit, working tree clean')));

    const service = new PromptGitHubSyncService({ defaults });
    const result = await service.push();

    expect(result.status).toBe('ok');
    expect(result.message).toContain('No prompt changes');
    expect(pushRepoMock).not.toHaveBeenCalled();
  });
});
