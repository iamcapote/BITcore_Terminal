import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupPromptRoutes } from '../app/features/prompts/routes.mjs';

const controllerMock = {
  list: vi.fn(),
  search: vi.fn(),
  get: vi.fn(),
  exists: vi.fn(),
  save: vi.fn(),
  remove: vi.fn()
};

const githubControllerMock = {
  status: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  sync: vi.fn()
};

const promptRecord = {
  id: 'research-plan',
  title: 'Research Plan',
  description: 'Outline',
  body: 'Study the topic',
  tags: ['research'],
  version: 1,
  updatedAt: '2025-09-26T00:00:00.000Z'
};

let app;

beforeEach(() => {
  controllerMock.list.mockReset().mockResolvedValue([promptRecord]);
  controllerMock.search.mockReset().mockResolvedValue([promptRecord]);
  controllerMock.get.mockReset().mockResolvedValue(promptRecord);
  controllerMock.exists.mockReset().mockResolvedValue(true);
  controllerMock.save.mockReset().mockResolvedValue(promptRecord);
  controllerMock.remove.mockReset().mockResolvedValue();
  githubControllerMock.status.mockReset().mockResolvedValue({ status: 'ok', message: 'Clean', statusReport: { clean: true } });
  githubControllerMock.pull.mockReset().mockResolvedValue({ status: 'ok', message: 'Pulled' });
  githubControllerMock.push.mockReset().mockResolvedValue({ status: 'ok', message: 'Pushed' });
  githubControllerMock.sync.mockReset().mockResolvedValue({ status: 'ok', message: 'Synced' });

  app = express();
  app.use(express.json());
  setupPromptRoutes(app, {
    controller: controllerMock,
    enabled: true,
    logger: { info: vi.fn(), warn: vi.fn() },
    githubEnabled: true,
    githubController: githubControllerMock,
    promptConfig: { httpEnabled: true, github: { enabled: true } }
  });
});

describe('prompt HTTP routes', () => {
  it('lists prompt summaries', async () => {
    const response = await request(app).get('/api/prompts').expect(200);
    expect(response.body).toHaveLength(1);
    expect(controllerMock.list).toHaveBeenCalledWith({ tags: [], limit: undefined });
  });

  it('searches prompts', async () => {
    const response = await request(app).get('/api/prompts/search').query({ query: 'plan', tags: 'research', includeBody: 'false' }).expect(200);
    expect(response.body).toHaveLength(1);
    expect(controllerMock.search).toHaveBeenCalledWith({
      query: 'plan',
      tags: ['research'],
      limit: undefined,
      includeBody: false
    });
  });

  it('gets a prompt by id', async () => {
    const response = await request(app).get('/api/prompts/research-plan').expect(200);
    expect(response.body.id).toBe('research-plan');
    expect(controllerMock.get).toHaveBeenCalledWith('research-plan');
  });

  it('indicates prompt existence with HEAD', async () => {
    await request(app).head('/api/prompts/research-plan').expect(200);
    expect(controllerMock.exists).toHaveBeenCalledWith('research-plan');
  });

  it('creates or updates prompts', async () => {
    await request(app)
      .post('/api/prompts')
      .send({ id: 'research-plan', title: 'Research Plan', body: 'Study' })
      .expect(201);

    expect(controllerMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'research-plan', title: 'Research Plan', body: 'Study' }),
      expect.objectContaining({ actor: 'http' })
    );
  });

  it('deletes prompts', async () => {
    await request(app).delete('/api/prompts/research-plan').expect(204);
    expect(controllerMock.remove).toHaveBeenCalledWith('research-plan', expect.objectContaining({ actor: 'http' }));
  });

  it('returns GitHub status', async () => {
    const response = await request(app).get('/api/prompts/github/status').expect(200);
    expect(githubControllerMock.status).toHaveBeenCalled();
    expect(response.body.status).toBe('ok');
  });

  it('pulls from GitHub', async () => {
    await request(app).post('/api/prompts/github/pull').expect(200);
    expect(githubControllerMock.pull).toHaveBeenCalled();
  });

  it('pushes to GitHub', async () => {
    await request(app).post('/api/prompts/github/push').expect(200);
    expect(githubControllerMock.push).toHaveBeenCalled();
  });

  it('syncs with GitHub', async () => {
    await request(app).post('/api/prompts/github/sync').expect(200);
    expect(githubControllerMock.sync).toHaveBeenCalled();
  });
});
