/**
 * Why: Ensure the /storage command can list, fetch, save, and delete research artefacts safely.
 * What: Exercises CLI execution paths with mocked GitHub controllers and research caches.
 * How: Uses the shared CLI harness to invoke subcommands while asserting controller interactions and side effects.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';
import { createCliTestContext } from './helpers/cli-test-context.mjs';
import { executeStorage } from '../app/commands/storage.cli.mjs';

const uploadFileMock = vi.hoisted(() => vi.fn());
const listEntriesMock = vi.hoisted(() => vi.fn());
const fetchFileMock = vi.hoisted(() => vi.fn());
const deleteFileMock = vi.hoisted(() => vi.fn());

vi.mock('../app/features/research/research.github-sync.controller.mjs', () => ({
  getGitHubResearchSyncController: vi.fn(() => ({
    uploadFile: uploadFileMock,
    listEntries: listEntriesMock,
    fetchFile: fetchFileMock,
    deleteFile: deleteFileMock
  }))
}));

const getCliResearchResultMock = vi.hoisted(() => vi.fn());
const clearCliResearchResultMock = vi.hoisted(() => vi.fn());

vi.mock('../app/commands/research/state.mjs', () => ({
  getCliResearchResult: getCliResearchResultMock,
  clearCliResearchResult: clearCliResearchResultMock
}));

const getUserDataMock = vi.hoisted(() => vi.fn(async () => ({ username: 'operator', role: 'admin' })));

vi.mock('../app/features/auth/user-manager.mjs', async () => {
  const actual = await vi.importActual('../app/features/auth/user-manager.mjs');
  const userManagerInstance = actual.userManager;
  userManagerInstance.getUserData = getUserDataMock;
  userManagerInstance.storageDir = path.join(os.tmpdir(), 'bitcore-storage-test');
  return {
    ...actual,
    userManager: userManagerInstance
  };
});

const ctx = createCliTestContext({ autoInitialize: true });

function withTempFile(fn) {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bitcore-storage-')).then(async (dir) => {
    try {
      return await fn(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

describe('/storage command (CLI)', () => {
  beforeEach(async () => {
    uploadFileMock.mockReset();
    listEntriesMock.mockReset();
    fetchFileMock.mockReset();
    deleteFileMock.mockReset();
    getCliResearchResultMock.mockReset();
    clearCliResearchResultMock.mockReset();
    getUserDataMock.mockClear();
    await ctx.initialize();
    ctx.flushOutput();
  });

  afterEach(() => {
    ctx.flushOutput();
  });

  test('uploads cached research content via save', async () => {
    getCliResearchResultMock.mockReturnValue({
      content: '# Research\nResult',
      filename: 'research/sample.md',
      query: 'Sample topic',
      generatedAt: '2025-10-03T00:00:00Z'
    });
    uploadFileMock.mockResolvedValue({
      ok: true,
      summary: {
        path: 'research/sample.md',
        commitUrl: 'https://github.com/example/commit/123',
        fileUrl: 'https://github.com/example/file'
      }
    });

    const { result, output } = await ctx.runCommand(executeStorage, {
      positionalArgs: ['save', 'research/sample.md']
    });

    expect(result.success).toBe(true);
    expect(uploadFileMock).toHaveBeenCalledWith({
      path: 'research/sample.md',
      content: '# Research\nResult',
      message: expect.stringContaining('Sample topic'),
      branch: null
    });
    expect(clearCliResearchResultMock).toHaveBeenCalled();
    expect(output.join('\n')).toMatch(/Stored research result/);
  });

  test('reports when no cached research result is available on save', async () => {
    getCliResearchResultMock.mockReturnValue(null);

    const { result, output } = await ctx.runCommand(executeStorage, {
      positionalArgs: ['save', 'research/missing.md']
    });

    expect(result.success).toBe(false);
    expect(output.join('\n')).toMatch(/No cached research result/i);
  });

  test('lists stored artefacts', async () => {
    listEntriesMock.mockResolvedValue({
      path: 'research',
      ref: 'main',
      entries: [
        { type: 'file', path: 'research/alpha.md', size: 1200 },
        { type: 'dir', path: 'research/archive' }
      ]
    });

    const { result, output } = await ctx.runCommand(executeStorage, {
      positionalArgs: ['list']
    });

    expect(result.success).toBe(true);
    const transcript = output.join('\n');
    expect(transcript).toMatch(/alpha\.md/);
    expect(transcript).toMatch(/archive/);
  });

  test('downloads a file to disk when using get with --out', async () => {
    fetchFileMock.mockResolvedValue({
      path: 'research/latest.md',
      content: '# Latest summary'
    });

    await withTempFile(async (dir) => {
      const target = path.join(dir, 'latest.md');
      const { result } = await ctx.runCommand(executeStorage, {
        positionalArgs: ['get', 'research/latest.md'],
        flags: { out: target, overwrite: true }
      });

      expect(result.success).toBe(true);
      const contents = await fs.readFile(target, 'utf8');
      expect(contents).toContain('# Latest summary');
    });
  });

  test('removes a stored artefact via delete', async () => {
    deleteFileMock.mockResolvedValue({
      ok: true,
      summary: {
        path: 'research/sample.md',
        commitUrl: 'https://github.com/example/commit/456'
      }
    });

    const { result, output } = await ctx.runCommand(executeStorage, {
      positionalArgs: ['delete', 'research/sample.md']
    });

    expect(result.success).toBe(true);
    expect(deleteFileMock).toHaveBeenCalledWith({
      path: 'research/sample.md',
      branch: null,
      message: null
    });
    expect(output.join('\n')).toMatch(/Deleted/);
  });
});
