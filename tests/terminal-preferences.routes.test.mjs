import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTerminalPreferencesRoutes } from '../app/features/preferences/terminal-preferences.routes.mjs';

const controllerMock = {
  get: vi.fn(),
  update: vi.fn(),
  reset: vi.fn(),
};

const preferencesSnapshot = Object.freeze({
  widgets: { telemetryPanel: true, memoryPanel: true, modelBrowser: false },
  terminal: { retainHistory: true, autoScroll: true },
  updatedAt: 1748265600000,
});

let app;

beforeEach(() => {
  controllerMock.get.mockReset().mockResolvedValue(preferencesSnapshot);
  controllerMock.update.mockReset().mockResolvedValue(preferencesSnapshot);
  controllerMock.reset.mockReset().mockResolvedValue(preferencesSnapshot);

  app = express();
  app.use(express.json());
  setupTerminalPreferencesRoutes(app, {
    controller: controllerMock,
    enabled: true,
    logger: { info: vi.fn(), warn: vi.fn() },
  });
});

describe('terminal preferences routes', () => {
  it('returns current preferences via GET', async () => {
    const response = await request(app).get('/api/preferences/terminal').expect(200);
    expect(response.body.widgets.telemetryPanel).toBe(true);
    expect(controllerMock.get).toHaveBeenCalledWith({ refresh: false });
  });

  it('updates preferences via PATCH', async () => {
    const response = await request(app)
      .patch('/api/preferences/terminal')
      .send({ widgets: { telemetryPanel: false } })
      .expect(200);

    expect(controllerMock.update).toHaveBeenCalledWith({ widgets: { telemetryPanel: false } });
    expect(response.body.widgets.telemetryPanel).toBe(true);
  });

  it('rejects invalid payloads', async () => {
    const response = await request(app)
      .patch('/api/preferences/terminal')
      .send('nope')
      .expect(400);

    expect(response.body.error).toContain('ValidationError');
    expect(controllerMock.update).not.toHaveBeenCalled();
  });

  it('resets preferences via POST', async () => {
    await request(app).post('/api/preferences/terminal/reset').expect(200);
    expect(controllerMock.reset).toHaveBeenCalledTimes(1);
  });
});
