import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupMcpRoutes } from '../app/features/tools/index.mjs';

const controllerMock = {
  listServers: vi.fn(),
  listTools: vi.fn(),
  getOAuthState: vi.fn(),
  initiateOAuth: vi.fn(),
  completeOAuth: vi.fn(),
  disconnectOAuth: vi.fn(),
  toggleServer: vi.fn(),
  reconnectServer: vi.fn(),
};

let app;

beforeEach(() => {
  controllerMock.listServers.mockReset().mockResolvedValue({
    source: 'mock',
    feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' },
    servers: [{ id: 'mcp-fs', name: 'filesystem', status: 'online', transport: 'stdio', endpoints: ['ls'] }],
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.listTools.mockReset().mockResolvedValue({
    source: 'mock',
    server: { id: 'mcp-fs', name: 'filesystem', status: 'online', transport: 'stdio', endpoints: ['ls'] },
    tools: [{ id: 'mcp-fs:ls', serverId: 'mcp-fs', name: 'ls' }],
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.toggleServer.mockReset().mockResolvedValue({
    source: 'mock',
    server: { id: 'mcp-fs', name: 'filesystem', status: 'offline', transport: 'stdio', endpoints: ['ls'] },
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.getOAuthState.mockReset().mockResolvedValue({
    source: 'mock',
    serverId: 'mcp-browser',
    oauth: {
      required: true,
      status: 'disconnected',
      hasRefreshToken: false,
      state: null,
      authorizationUrl: null,
      expiresAt: null,
      lastConnectedAt: null,
      updatedAt: '2026-02-17T00:00:00.000Z',
    },
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.initiateOAuth.mockReset().mockResolvedValue({
    source: 'mock',
    serverId: 'mcp-browser',
    oauth: {
      required: true,
      status: 'pending',
      hasRefreshToken: false,
      state: 'mock-state',
      authorizationUrl: 'https://auth.local.bitcore/oauth/authorize?server=mcp-browser&state=mock-state',
      expiresAt: '2026-02-17T00:10:00.000Z',
      lastConnectedAt: null,
      updatedAt: '2026-02-17T00:00:00.000Z',
    },
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.completeOAuth.mockReset().mockResolvedValue({
    source: 'mock',
    serverId: 'mcp-browser',
    oauth: {
      required: true,
      status: 'connected',
      hasRefreshToken: true,
      state: null,
      authorizationUrl: null,
      expiresAt: null,
      lastConnectedAt: '2026-02-17T00:00:01.000Z',
      updatedAt: '2026-02-17T00:00:01.000Z',
    },
    updatedAt: '2026-02-17T00:00:01.000Z',
  });
  controllerMock.disconnectOAuth.mockReset().mockResolvedValue({
    source: 'mock',
    serverId: 'mcp-browser',
    oauth: {
      required: true,
      status: 'disconnected',
      hasRefreshToken: false,
      state: null,
      authorizationUrl: null,
      expiresAt: null,
      lastConnectedAt: null,
      updatedAt: '2026-02-17T00:00:02.000Z',
    },
    updatedAt: '2026-02-17T00:00:02.000Z',
  });
  controllerMock.reconnectServer.mockReset().mockResolvedValue({
    source: 'mock',
    status: 'reconnected',
    server: { id: 'mcp-fs', name: 'filesystem', status: 'online', transport: 'stdio', endpoints: ['ls'] },
    updatedAt: '2026-02-17T00:00:00.000Z',
  });

  app = express();
  app.use(express.json());
  setupMcpRoutes(app, { controller: controllerMock, logger: { info: vi.fn(), warn: vi.fn() }, enabled: true });
});

describe('mcp routes', () => {
  it('returns server snapshot', async () => {
    const response = await request(app).get('/api/tools/mcp/servers').expect(200);
    expect(response.body.servers).toHaveLength(1);
    expect(controllerMock.listServers).toHaveBeenCalledTimes(1);
  });

  it('returns server tools', async () => {
    const response = await request(app).get('/api/tools/mcp/servers/mcp-fs/tools').expect(200);
    expect(response.body.tools).toHaveLength(1);
    expect(controllerMock.listTools).toHaveBeenCalledWith('mcp-fs');
  });

  it('returns oauth status', async () => {
    const response = await request(app).get('/api/tools/mcp/servers/mcp-browser/oauth').expect(200);
    expect(response.body.oauth.status).toBe('disconnected');
    expect(controllerMock.getOAuthState).toHaveBeenCalledWith('mcp-browser');
  });

  it('initiates oauth flow', async () => {
    const response = await request(app).post('/api/tools/mcp/servers/mcp-browser/oauth/initiate').expect(200);
    expect(response.body.oauth.status).toBe('pending');
    expect(controllerMock.initiateOAuth).toHaveBeenCalledWith('mcp-browser');
  });

  it('completes oauth callback', async () => {
    const response = await request(app)
      .post('/api/tools/mcp/servers/mcp-browser/oauth/callback')
      .send({ code: 'abc', state: 'mock-state' })
      .expect(200);
    expect(response.body.oauth.status).toBe('connected');
    expect(controllerMock.completeOAuth).toHaveBeenCalledWith('mcp-browser', { code: 'abc', state: 'mock-state' });
  });

  it('disconnects oauth flow', async () => {
    const response = await request(app).delete('/api/tools/mcp/servers/mcp-browser/oauth').expect(200);
    expect(response.body.oauth.status).toBe('disconnected');
    expect(controllerMock.disconnectOAuth).toHaveBeenCalledWith('mcp-browser');
  });

  it('toggles server status', async () => {
    const response = await request(app)
      .patch('/api/tools/mcp/servers/mcp-fs')
      .send({ enabled: false })
      .expect(200);
    expect(response.body.server.status).toBe('offline');
    expect(controllerMock.toggleServer).toHaveBeenCalledWith('mcp-fs', { enabled: false });
  });

  it('maps not found errors to 404', async () => {
    controllerMock.reconnectServer.mockRejectedValueOnce(new Error('NotFound: missing server'));
    const response = await request(app).post('/api/tools/mcp/servers/missing/reconnect').expect(404);
    expect(response.body.error).toContain('NotFound');
  });
});
