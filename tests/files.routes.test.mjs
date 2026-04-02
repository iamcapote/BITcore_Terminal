import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupFileRoutes } from '../app/features/files/index.mjs';

const filesControllerMock = {
  listDirectory: vi.fn(),
  getTree: vi.fn(),
  readFile: vi.fn(),
  previewFile: vi.fn(),
  search: vi.fn(),
};

const gitControllerMock = {
  getStatus: vi.fn(),
  listBranches: vi.fn(),
  createBranch: vi.fn(),
  checkoutBranch: vi.fn(),
  getFileHistory: vi.fn(),
  revertFile: vi.fn(),
};

let app;

beforeEach(() => {
  filesControllerMock.listDirectory.mockReset().mockResolvedValue({ path: '.', entries: [] });
  filesControllerMock.getTree.mockReset().mockResolvedValue({ path: '.', depth: 3, nodes: [] });
  filesControllerMock.readFile.mockReset().mockResolvedValue({ path: 'README.md', content: 'ok' });
  filesControllerMock.previewFile.mockReset().mockResolvedValue({ path: 'README.md', content: 'ok' });
  filesControllerMock.search.mockReset().mockResolvedValue({ query: 'readme', results: [] });

  gitControllerMock.getStatus.mockReset().mockResolvedValue({ branch: 'main', clean: true, files: [] });
  gitControllerMock.listBranches.mockReset().mockResolvedValue({ current: 'main', branches: [{ name: 'main', current: true }] });
  gitControllerMock.createBranch.mockReset().mockResolvedValue({ current: 'main', branches: [{ name: 'main', current: true }, { name: 'feat/a', current: false }] });
  gitControllerMock.checkoutBranch.mockReset().mockResolvedValue({ branch: 'feat/a', clean: true, files: [] });
  gitControllerMock.getFileHistory.mockReset().mockResolvedValue({ path: 'README.md', commits: [] });
  gitControllerMock.revertFile.mockReset().mockResolvedValue({ branch: 'main', clean: true, files: [] });

  app = express();
  app.use(express.json());
  setupFileRoutes(app, {
    controller: filesControllerMock,
    gitController: gitControllerMock,
    enabled: true,
    logger: { info: vi.fn(), warn: vi.fn() },
  });
});

describe('file routes', () => {
  it('returns workspace tree snapshot', async () => {
    const response = await request(app).get('/api/files/tree?path=.&depth=3').expect(200);
    expect(response.body.depth).toBe(3);
    expect(filesControllerMock.getTree).toHaveBeenCalledWith('.', { depth: '3' });
  });

  it('returns git status and branches', async () => {
    const status = await request(app).get('/api/files/git/status').expect(200);
    const branches = await request(app).get('/api/files/git/branches').expect(200);

    expect(status.body.branch).toBe('main');
    expect(branches.body.current).toBe('main');
  });

  it('creates branch and checks out branch', async () => {
    const createResponse = await request(app)
      .post('/api/files/git/branches')
      .send({ name: 'feat/a' })
      .expect(201);

    expect(createResponse.body.branches).toHaveLength(2);
    expect(gitControllerMock.createBranch).toHaveBeenCalledWith('feat/a', null);

    const checkoutResponse = await request(app)
      .post('/api/files/git/checkout')
      .send({ branch: 'feat/a' })
      .expect(200);

    expect(checkoutResponse.body.branch).toBe('feat/a');
    expect(gitControllerMock.checkoutBranch).toHaveBeenCalledWith('feat/a');
  });

  it('maps validation errors to 400 for revert endpoint', async () => {
    gitControllerMock.revertFile.mockRejectedValueOnce(new Error('ValidationError: file path is required'));

    const response = await request(app)
      .post('/api/files/git/revert')
      .send({ path: '' })
      .expect(400);

    expect(response.body.error).toContain('ValidationError');
  });
});
