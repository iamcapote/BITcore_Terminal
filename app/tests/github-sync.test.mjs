import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMock = {
  verify: vi.fn(),
  listEntries: vi.fn(),
  fetchFile: vi.fn(),
  pushBatch: vi.fn(),
  uploadFile: vi.fn()
};

const getControllerMock = vi.fn(() => controllerMock);

vi.mock('../features/research/research.github-sync.controller.mjs', () => ({
  getGitHubResearchSyncController: getControllerMock
}));

const { githubResearchSync } = await import('../features/research/github-sync/service.mjs');

describe('githubResearchSync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controllerMock.verify.mockReset();
    controllerMock.listEntries.mockReset();
    controllerMock.fetchFile.mockReset();
    controllerMock.pushBatch.mockReset();
    controllerMock.uploadFile.mockReset();
    controllerMock.verify.mockResolvedValue({
      ok: true,
      config: { owner: 'acme', repo: 'research', branch: 'main' }
    });
    controllerMock.listEntries.mockResolvedValue({
      path: 'research',
      ref: 'main',
      entries: [{ type: 'file', name: 'summary.md', size: 42 }]
    });
    controllerMock.fetchFile.mockResolvedValue({
      path: 'research/summary.md',
      size: 120,
      content: '# Summary'
    });
    controllerMock.pushBatch.mockResolvedValue({ ok: true, summaries: [{ path: 'research/summary.md', branch: 'main' }] });
    controllerMock.uploadFile.mockResolvedValue({ ok: true, summary: { path: 'research/summary.md', commitSha: 'abc123' } });
  });

  it('verifies repository via controller', async () => {
    const result = await githubResearchSync({ action: 'verify' });

    expect(controllerMock.verify).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.details.config.repo).toBe('research');
  });

  it('lists directory entries and normalizes message', async () => {
    const result = await githubResearchSync({ action: 'list', path: 'reports' });

    expect(controllerMock.listEntries).toHaveBeenCalledWith({ path: 'reports', ref: null });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Listed 1 entry/);
  });

  it('fetches a file', async () => {
    const result = await githubResearchSync({ action: 'fetch', path: 'summary.md' });

    expect(controllerMock.fetchFile).toHaveBeenCalledWith({ path: 'summary.md', ref: null });
    expect(result.details.content).toContain('# Summary');
  });

  it('pushes provided file descriptors without reading disk', async () => {
    const files = [{ path: 'summary.md', content: '# Summary' }];
    const result = await githubResearchSync({ action: 'push', files, message: 'Update summary' });

    expect(controllerMock.pushBatch).toHaveBeenCalledWith({ files, message: 'Update summary', branch: null });
    expect(result.success).toBe(true);
  });

  it('uploads content when provided directly', async () => {
    const result = await githubResearchSync({ action: 'upload', path: 'summary.md', content: '# Summary', branch: 'beta' });

    expect(controllerMock.uploadFile).toHaveBeenCalledWith({ path: 'summary.md', content: '# Summary', message: 'Upload summary.md', branch: 'beta' });
    expect(result.message).toMatch(/Uploaded summary.md to beta/);
  });

  it('throws a validation error for unknown actions', async () => {
    await expect(githubResearchSync({ action: 'invalid' })).rejects.toThrow(/unknown action/i);
  });
});
