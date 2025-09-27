import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'buffer';
import { GitHubResearchSyncService } from '../app/features/research/research.github-sync.service.mjs';

function createStubOctokit() {
  return {
    repos: {
      get: vi.fn().mockResolvedValue({
        data: {
          name: 'research',
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/acme/research'
        }
      }),
      getBranch: vi.fn().mockResolvedValue({
        data: {
          name: 'main',
          protected: false,
          commit: { sha: 'branch-sha' }
        }
      }),
      getContent: vi.fn(),
      createOrUpdateFileContents: vi.fn()
    }
  };
}

describe('GitHubResearchSyncService', () => {
  let config;
  let configLoader;
  let octokit;
  let octokitFactory;
  let service;

  beforeEach(() => {
    config = { owner: 'acme', repo: 'research', branch: 'main', token: 'token-123' };
    configLoader = vi.fn().mockResolvedValue(config);
    octokit = createStubOctokit();
    octokitFactory = vi.fn(() => octokit);
    service = new GitHubResearchSyncService({ configLoader, octokitFactory });
  });

  it('verifies repository and branch metadata', async () => {
    const result = await service.verify();

    expect(result.ok).toBe(true);
    expect(result.repository.name).toBe('research');
    expect(result.branch.commitSha).toBe('branch-sha');
    expect(octokit.repos.get).toHaveBeenCalledWith({ owner: 'acme', repo: 'research' });
    expect(octokit.repos.getBranch).toHaveBeenCalledWith({ owner: 'acme', repo: 'research', branch: 'main' });
  });

  it('propagates verification failure when branch is missing', async () => {
    octokit.repos.getBranch.mockRejectedValueOnce({ status: 404, message: 'Not Found' });

    await expect(service.verify()).rejects.toThrow(/GitHub verification failed/i);
  });

  it('returns directory listings with normalized entries', async () => {
    octokit.repos.getContent.mockResolvedValueOnce({
      data: [
        {
          type: 'file',
          name: 'summary.md',
          path: 'research/summary.md',
          sha: 'file-sha',
          size: 120,
          download_url: 'https://example.com/summary.md'
        }
      ]
    });

    const listing = await service.pullDirectory({ path: '' });

    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0]).toMatchObject({
      type: 'file',
      name: 'summary.md',
      path: 'research/summary.md'
    });
    expect(octokit.repos.getContent).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'research',
      path: 'research',
      ref: 'main'
    });
  });

  it('returns an empty listing when directory is missing', async () => {
    octokit.repos.getContent.mockRejectedValueOnce({ status: 404, message: 'Not Found' });

    const listing = await service.pullDirectory({ path: 'reports' });

    expect(listing.entries).toEqual([]);
  });

  it('pulls and decodes a file', async () => {
    octokit.repos.getContent.mockResolvedValueOnce({
      data: {
        type: 'file',
        path: 'research/notes.md',
        sha: 'file-sha',
        size: 12,
        encoding: 'base64',
        content: Buffer.from('Hello world').toString('base64'),
        download_url: 'https://example.com/notes.md'
      }
    });

    const file = await service.pullFile({ path: 'notes.md' });

    expect(file.content).toBe('Hello world');
    expect(file.path).toBe('research/notes.md');
    expect(octokit.repos.getContent).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'research',
      path: 'research/notes.md',
      ref: 'main'
    });
  });

  it('pushes files and returns commit summaries', async () => {
    octokit.repos.getContent.mockResolvedValueOnce({ data: { sha: 'existing-sha' } });
    octokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({
      data: {
        commit: { sha: 'commit-sha', html_url: 'https://example.com/commit' },
        content: { sha: 'file-sha', html_url: 'https://example.com/file' }
      }
    });

    const summaries = await service.pushFiles({
      files: [{ path: 'notes.md', content: '# Notes' }],
      message: 'Update notes'
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      path: 'research/notes.md',
      commitSha: 'commit-sha',
      fileSha: 'file-sha'
    });
    expect(octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'research',
      path: 'research/notes.md',
      message: 'Update notes',
      branch: 'main',
      content: Buffer.from('# Notes', 'utf8').toString('base64'),
      sha: 'existing-sha'
    });
  });

  it('uploads a single file via uploadFile()', async () => {
    octokit.repos.getContent.mockRejectedValueOnce({ status: 404, message: 'Not Found' });
    octokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({
      data: {
        commit: { sha: 'commit-1', html_url: 'https://example.com/commit' },
        content: { sha: 'file-1', html_url: 'https://example.com/file' }
      }
    });

    const summary = await service.uploadFile({ path: 'reports/week.md', content: 'Weekly summary' });

    expect(summary.commitSha).toBe('commit-1');
    expect(summary.fileUrl).toBe('https://example.com/file');
  });
});
