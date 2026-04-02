import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupChatHistoryRoutes } from '../app/features/chat-history/routes.mjs';

const controllerMock = {
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  exportConversation: vi.fn(),
  removeConversation: vi.fn(),
  clearConversations: vi.fn(),
  linkWorkspaceBranch: vi.fn(),
  appendWorkspaceSnapshot: vi.fn(),
  listWorkspaceSnapshots: vi.fn(),
};

const gitServiceMock = {
  createBranch: vi.fn(),
  checkoutBranch: vi.fn(),
};

let app;

beforeEach(() => {
  controllerMock.listConversations.mockReset().mockResolvedValue([]);
  controllerMock.getConversation.mockReset().mockResolvedValue(null);
  controllerMock.exportConversation.mockReset().mockResolvedValue(null);
  controllerMock.removeConversation.mockReset().mockResolvedValue(false);
  controllerMock.clearConversations.mockReset().mockResolvedValue(true);
  controllerMock.linkWorkspaceBranch.mockReset().mockResolvedValue({ branchName: 'chat/a', baseBranch: 'semantic', linkedAt: '2026-01-01T00:00:00.000Z', snapshotCount: 1 });
  controllerMock.appendWorkspaceSnapshot.mockReset().mockResolvedValue({ id: 's1', type: 'branch-linked-created', branchName: 'chat/a', createdAt: '2026-01-01T00:00:00.000Z' });
  controllerMock.listWorkspaceSnapshots.mockReset().mockResolvedValue([]);

  gitServiceMock.createBranch.mockReset().mockResolvedValue(undefined);
  gitServiceMock.checkoutBranch.mockReset().mockResolvedValue(undefined);

  app = express();
  app.use(express.json());
  setupChatHistoryRoutes(app, {
    controller: controllerMock,
    gitService: gitServiceMock,
    logger: { error: vi.fn() },
  });
});

describe('chat history routes', () => {
  it('links a conversation to a workspace branch', async () => {
    const response = await request(app)
      .post('/api/chat/history/convo-1/workspace/link')
      .send({ branchName: 'chat/a', baseBranch: 'semantic', createBranch: true, checkout: true })
      .expect(200);

    expect(gitServiceMock.createBranch).toHaveBeenCalledWith('chat/a', 'semantic');
    expect(gitServiceMock.checkoutBranch).toHaveBeenCalledWith('chat/a');
    expect(controllerMock.linkWorkspaceBranch).toHaveBeenCalledWith('convo-1', {
      branchName: 'chat/a',
      baseBranch: 'semantic',
    });
    expect(response.body.success).toBe(true);
    expect(response.body.workspace.branchName).toBe('chat/a');
  });

  it('returns 400 when branch name is missing', async () => {
    const response = await request(app)
      .post('/api/chat/history/convo-1/workspace/link')
      .send({ branchName: '' })
      .expect(400);

    expect(response.body.error).toContain('branchName is required');
  });

  it('lists workspace snapshots for a conversation', async () => {
    controllerMock.listWorkspaceSnapshots.mockResolvedValueOnce([
      { id: 's1', type: 'branch-linked', branchName: 'chat/a', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);

    const response = await request(app)
      .get('/api/chat/history/convo-1/workspace/snapshots')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.snapshots).toHaveLength(1);
    expect(controllerMock.listWorkspaceSnapshots).toHaveBeenCalledWith('convo-1');
  });
});
