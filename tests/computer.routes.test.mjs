import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupComputerRoutes } from '../app/features/tools/index.mjs';

const controllerMock = {
  getRuntime: vi.fn(),
  patchRuntime: vi.fn(),
};

let app;

beforeEach(() => {
  controllerMock.getRuntime.mockReset().mockResolvedValue({
    source: 'mock',
    feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' },
    runtime: {
      shellInterface: 'local',
      codeExecSshEnabled: false,
      codeExecSshAddr: 'localhost',
      codeExecSshPort: 55022,
      codeExecSshUser: 'root',
      codeExecSshHasPassword: false,
      updatedAt: '2026-02-17T00:00:00.000Z',
    },
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.patchRuntime.mockReset().mockResolvedValue({
    source: 'mock',
    feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' },
    runtime: {
      shellInterface: 'ssh',
      codeExecSshEnabled: true,
      codeExecSshAddr: 'localhost',
      codeExecSshPort: 55022,
      codeExecSshUser: 'root',
      codeExecSshHasPassword: false,
      updatedAt: '2026-02-17T00:00:00.000Z',
    },
    updatedAt: '2026-02-17T00:00:00.000Z',
  });

  app = express();
  app.use(express.json());
  setupComputerRoutes(app, { controller: controllerMock, logger: { info: vi.fn(), warn: vi.fn() }, enabled: true });
});

describe('computer runtime routes', () => {
  it('returns runtime snapshot', async () => {
    const response = await request(app).get('/api/tools/computer/runtime').expect(200);
    expect(response.body.runtime.shellInterface).toBe('local');
    expect(controllerMock.getRuntime).toHaveBeenCalledTimes(1);
  });

  it('patches runtime payload', async () => {
    const response = await request(app)
      .patch('/api/tools/computer/runtime')
      .send({ shellInterface: 'ssh' })
      .expect(200);
    expect(response.body.runtime.shellInterface).toBe('ssh');
    expect(controllerMock.patchRuntime).toHaveBeenCalledWith({ shellInterface: 'ssh' });
  });

  it('maps validation errors to 400', async () => {
    controllerMock.patchRuntime.mockRejectedValueOnce(new Error('ValidationError: bad payload'));
    const response = await request(app)
      .patch('/api/tools/computer/runtime')
      .send({ shellInterface: 'bad' })
      .expect(400);
    expect(response.body.error).toContain('ValidationError');
  });
});
