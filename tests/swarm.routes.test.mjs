import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupAgentSwarmRoutes } from '../app/features/ai/swarm/swarm.routes.mjs';

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
};

let app;

beforeEach(() => {
  controllerMock.getOverview.mockReset().mockResolvedValue({ source: 'mock', agents: [], activity: [], mcpServers: [], updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.getRuns.mockReset().mockResolvedValue({ source: 'mock', runs: [], updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.getClarification.mockReset().mockResolvedValue({ source: 'mock', clarification: { enabled: true, roundsUsed: 1, maxRounds: 3, isComplete: false, pendingQuestion: 'q?', lastResponse: '', updatedAt: '2026-02-17T00:00:00.000Z', history: [] }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.getGraph.mockReset().mockResolvedValue({ source: 'mock', graph: { maxRounds: 8, currentRound: 1, activeChannelId: 'channel-research', terminated: false, lastMessage: 'hello', updatedAt: '2026-02-17T00:00:00.000Z', channels: [], functions: [], events: [] }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.getCapabilities.mockReset().mockResolvedValue({ source: 'mock', capabilities: { networkAccess: false }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.patchCapabilities.mockReset().mockResolvedValue({ source: 'mock', capabilities: { networkAccess: true }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.patchClarification.mockReset().mockResolvedValue({ source: 'mock', clarification: { enabled: true, roundsUsed: 1, maxRounds: 4, isComplete: false, pendingQuestion: 'q?', lastResponse: '', updatedAt: '2026-02-17T00:00:00.000Z', history: [] }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.respondClarification.mockReset().mockResolvedValue({ source: 'mock', clarification: { enabled: true, roundsUsed: 2, maxRounds: 4, isComplete: false, pendingQuestion: '', lastResponse: 'answer', updatedAt: '2026-02-17T00:00:00.000Z', history: [] }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.patchGraph.mockReset().mockResolvedValue({ source: 'mock', graph: { maxRounds: 10, currentRound: 1, activeChannelId: 'channel-research', terminated: false, lastMessage: 'hello', updatedAt: '2026-02-17T00:00:00.000Z', channels: [], functions: [], events: [] }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.appendGraphMessage.mockReset().mockResolvedValue({ source: 'mock', graph: { maxRounds: 10, currentRound: 2, activeChannelId: 'channel-research', terminated: false, lastMessage: 'message', updatedAt: '2026-02-17T00:00:00.000Z', channels: [], functions: [], events: [] }, updatedAt: '2026-02-17T00:00:00.000Z', feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' } });
  controllerMock.delegate.mockReset().mockResolvedValue({ id: 'delegation-1', status: 'queued' });

  app = express();
  app.use(express.json());
  setupAgentSwarmRoutes(app, { controller: controllerMock, enabled: true, logger: { info: vi.fn(), warn: vi.fn() } });
});

describe('swarm routes', () => {
  it('returns overview snapshot', async () => {
    const response = await request(app).get('/api/ai/swarm/overview').expect(200);
    expect(response.body.source).toBe('mock');
    expect(controllerMock.getOverview).toHaveBeenCalledTimes(1);
  });

  it('returns capabilities snapshot', async () => {
    const response = await request(app).get('/api/ai/swarm/capabilities').expect(200);
    expect(response.body.capabilities.networkAccess).toBe(false);
    expect(controllerMock.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it('returns runs snapshot', async () => {
    const response = await request(app).get('/api/ai/swarm/runs').expect(200);
    expect(Array.isArray(response.body.runs)).toBe(true);
    expect(controllerMock.getRuns).toHaveBeenCalledTimes(1);
  });

  it('patches capabilities', async () => {
    const response = await request(app)
      .patch('/api/ai/swarm/capabilities')
      .send({ networkAccess: true })
      .expect(200);
    expect(response.body.capabilities.networkAccess).toBe(true);
    expect(controllerMock.patchCapabilities).toHaveBeenCalledWith({ networkAccess: true });
  });

  it('returns clarification snapshot', async () => {
    const response = await request(app).get('/api/ai/swarm/clarification').expect(200);
    expect(response.body.clarification.enabled).toBe(true);
    expect(controllerMock.getClarification).toHaveBeenCalledTimes(1);
  });

  it('patches clarification settings', async () => {
    const response = await request(app)
      .patch('/api/ai/swarm/clarification')
      .send({ maxRounds: 4 })
      .expect(200);
    expect(response.body.clarification.maxRounds).toBe(4);
    expect(controllerMock.patchClarification).toHaveBeenCalledWith({ maxRounds: 4 });
  });

  it('returns graph snapshot', async () => {
    const response = await request(app).get('/api/ai/swarm/graph').expect(200);
    expect(response.body.graph.activeChannelId).toBe('channel-research');
    expect(controllerMock.getGraph).toHaveBeenCalledTimes(1);
  });

  it('patches graph settings', async () => {
    const response = await request(app)
      .patch('/api/ai/swarm/graph')
      .send({ maxRounds: 10 })
      .expect(200);
    expect(response.body.graph.maxRounds).toBe(10);
    expect(controllerMock.patchGraph).toHaveBeenCalledWith({ maxRounds: 10 });
  });

  it('accepts graph message append', async () => {
    const response = await request(app)
      .post('/api/ai/swarm/graph/message')
      .send({ channelId: 'channel-research', speaker: 'agent-manager', message: 'Continue run.' })
      .expect(202);
    expect(response.body.graph.currentRound).toBe(2);
    expect(controllerMock.appendGraphMessage).toHaveBeenCalledWith({ channelId: 'channel-research', speaker: 'agent-manager', message: 'Continue run.' });
  });

  it('accepts clarification response', async () => {
    const response = await request(app)
      .post('/api/ai/swarm/clarification/respond')
      .send({ action: 'answer', response: 'Use local only.' })
      .expect(202);
    expect(response.body.clarification.lastResponse).toBe('answer');
    expect(controllerMock.respondClarification).toHaveBeenCalledWith({ action: 'answer', response: 'Use local only.' });
  });

  it('maps validation errors to 400', async () => {
    controllerMock.delegate.mockRejectedValueOnce(new Error('ValidationError: bad payload'));
    const response = await request(app)
      .post('/api/ai/swarm/delegate')
      .send({})
      .expect(400);
    expect(response.body.error).toContain('ValidationError');
  });
});
