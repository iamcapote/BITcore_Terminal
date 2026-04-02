/**
 * Tests for workflow checkpoint routes and service (Pass 12 — Deerflow).
 * Covers: list, get, save, resume, abandon; validates 400/404 guard clauses.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupAgentSwarmRoutes, resetAgentSwarmRoutes } from '../app/features/ai/swarm/index.mjs';

const MOCK_LIST = {
  source: 'mock',
  total: 1,
  checkpoints: [
    {
      workflowId: 'wf-001',
      state: 'interrupted',
      phase: 'coordinator',
      step: 3,
      resumeCount: 0,
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
  ],
  updatedAt: '2026-04-02T00:00:00.000Z',
};

const MOCK_SNAPSHOT = {
  source: 'mock',
  workflowId: 'wf-001',
  state: 'interrupted',
  thread: { step: 3, phase: 'coordinator', variables: {}, interruptReason: 'awaiting operator approval' },
  history: [],
  resumeCount: 0,
  createdAt: '2026-04-02T00:00:00.000Z',
  updatedAt: '2026-04-02T00:00:00.000Z',
};

const MOCK_RESUMED = { ...MOCK_SNAPSHOT, state: 'running', resumeCount: 1, thread: { ...MOCK_SNAPSHOT.thread, interruptReason: null } };
const MOCK_ABANDON = { source: 'mock', workflowId: 'wf-001', abandoned: true, previousState: 'interrupted', updatedAt: '2026-04-02T00:00:00.000Z' };

const controllerMock = {
  getOverview: vi.fn(),
  getRuns: vi.fn(),
  getClarification: vi.fn(),
  getGraph: vi.fn(),
  getCapabilities: vi.fn(),
  patchCapabilities: vi.fn(),
  patchClarification: vi.fn(),
  respondClarification: vi.fn(),
  patchGraph: vi.fn(),
  appendGraphMessage: vi.fn(),
  delegate: vi.fn(),
  listCheckpoints: vi.fn(),
  getCheckpoint: vi.fn(),
  saveCheckpoint: vi.fn(),
  resumeCheckpoint: vi.fn(),
  abandonCheckpoint: vi.fn(),
};

let app;

beforeEach(() => {
  resetAgentSwarmRoutes();
  controllerMock.listCheckpoints.mockReset().mockResolvedValue(MOCK_LIST);
  controllerMock.getCheckpoint.mockReset().mockResolvedValue(MOCK_SNAPSHOT);
  controllerMock.saveCheckpoint.mockReset().mockResolvedValue(MOCK_SNAPSHOT);
  controllerMock.resumeCheckpoint.mockReset().mockResolvedValue(MOCK_RESUMED);
  controllerMock.abandonCheckpoint.mockReset().mockResolvedValue(MOCK_ABANDON);
  // Set up stubs for routes we're not testing
  controllerMock.getOverview.mockResolvedValue({ source: 'mock', agents: [], activity: [], mcpServers: [], updatedAt: '' });
  controllerMock.getRuns.mockResolvedValue({ source: 'mock', runs: [] });
  controllerMock.getClarification.mockResolvedValue({ source: 'mock', clarification: {} });
  controllerMock.getGraph.mockResolvedValue({ source: 'mock', graph: {} });
  controllerMock.getCapabilities.mockResolvedValue({ source: 'mock', capabilities: {} });

  app = express();
  app.use(express.json());
  setupAgentSwarmRoutes(app, { controller: controllerMock, logger: { info: vi.fn(), warn: vi.fn() } });
});

describe('GET /api/ai/swarm/checkpoint', () => {
  it('returns the checkpoint list', async () => {
    const res = await request(app).get('/api/ai/swarm/checkpoint');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('mock');
    expect(res.body.total).toBe(1);
    expect(res.body.checkpoints[0].workflowId).toBe('wf-001');
  });
});

describe('GET /api/ai/swarm/checkpoint/:workflowId', () => {
  it('returns a single checkpoint', async () => {
    const res = await request(app).get('/api/ai/swarm/checkpoint/wf-001');
    expect(res.status).toBe(200);
    expect(res.body.workflowId).toBe('wf-001');
    expect(res.body.state).toBe('interrupted');
  });

  it('returns 400 for validation error', async () => {
    controllerMock.getCheckpoint.mockRejectedValue(new Error('ValidationError: workflowId is required.'));
    const res = await request(app).get('/api/ai/swarm/checkpoint/%20');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown checkpoint', async () => {
    controllerMock.getCheckpoint.mockRejectedValue(new Error('NotFound: checkpoint \'no-such\' does not exist.'));
    const res = await request(app).get('/api/ai/swarm/checkpoint/no-such');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/ai/swarm/checkpoint/:workflowId', () => {
  it('saves a checkpoint and returns 201', async () => {
    const res = await request(app)
      .put('/api/ai/swarm/checkpoint/wf-001')
      .send({ state: 'interrupted', step: 3, phase: 'coordinator' });
    expect(res.status).toBe(201);
    expect(res.body.workflowId).toBe('wf-001');
    expect(controllerMock.saveCheckpoint).toHaveBeenCalledWith('wf-001', expect.objectContaining({ state: 'interrupted' }));
  });
});

describe('POST /api/ai/swarm/checkpoint/:workflowId/resume', () => {
  it('resumes a checkpoint and returns 202', async () => {
    const res = await request(app)
      .post('/api/ai/swarm/checkpoint/wf-001/resume')
      .send({});
    expect(res.status).toBe(202);
    expect(res.body.state).toBe('running');
    expect(res.body.resumeCount).toBe(1);
  });

  it('returns 404 when checkpoint does not exist', async () => {
    controllerMock.resumeCheckpoint.mockRejectedValue(new Error('NotFound: checkpoint \'missing\' does not exist.'));
    const res = await request(app).post('/api/ai/swarm/checkpoint/missing/resume').send({});
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/ai/swarm/checkpoint/:workflowId', () => {
  it('abandons a checkpoint and returns the result', async () => {
    const res = await request(app).delete('/api/ai/swarm/checkpoint/wf-001');
    expect(res.status).toBe(200);
    expect(res.body.abandoned).toBe(true);
    expect(res.body.previousState).toBe('interrupted');
  });

  it('returns 404 for unknown checkpoint on abandon', async () => {
    controllerMock.abandonCheckpoint.mockRejectedValue(new Error('NotFound: checkpoint \'missing\' does not exist.'));
    const res = await request(app).delete('/api/ai/swarm/checkpoint/missing');
    expect(res.status).toBe(404);
  });
});
