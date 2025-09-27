import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupLogRoutes } from '../app/features/logs/routes.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { logChannel } from '../app/utils/log-channel.mjs';

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

let app;
let userSpy;

beforeEach(() => {
  logChannel.clear();
  logChannel.configure({ bufferSize: 500 });
  userSpy = vi.spyOn(userManager, 'getCurrentUser').mockReturnValue({ username: 'operator', role: 'admin' });

  app = express();
  app.use(express.json());
  setupLogRoutes(app, { logger: loggerMock });
});

afterEach(() => {
  userSpy?.mockRestore();
  vi.clearAllMocks();
});

describe('logs routes', () => {
  it('rejects non-admin requests', async () => {
    userSpy.mockReturnValue({ username: 'guest', role: 'viewer' });

    const response = await request(app).get('/api/logs/recent').expect(403);
    expect(response.body.error).toMatch(/requires admin/i);
  });

  it('rejects non-admin retention updates', async () => {
    userSpy.mockReturnValue({ username: 'guest', role: 'viewer' });

    await request(app)
      .post('/api/logs/retention')
      .send({ bufferSize: 600 })
      .set('Content-Type', 'application/json')
      .expect(403);
  });

  it('rejects non-admin purge requests', async () => {
    userSpy.mockReturnValue({ username: 'guest', role: 'viewer' });

    await request(app)
      .delete('/api/logs')
      .expect(403);
  });

  it('returns recent logs for admins', async () => {
    logChannel.push({ level: 'info', message: 'Boot complete', timestamp: 1735689600000 });

    const response = await request(app).get('/api/logs/recent').expect(200);
    expect(response.body.logs).toHaveLength(1);
    expect(response.body.logs[0].message).toBe('Boot complete');
  });

  it('exposes current settings', async () => {
    const response = await request(app).get('/api/logs/settings').expect(200);
    expect(response.body.bufferSize).toBe(500);
    expect(response.body.availableLevels).toContain('info');
  });

  it('updates buffer retention size', async () => {
    await request(app)
      .post('/api/logs/retention')
      .send({ bufferSize: 800 })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(logChannel.getBufferSize()).toBe(800);
  });

  it('accepts numeric strings for buffer retention size', async () => {
    await request(app)
      .post('/api/logs/retention')
      .send({ bufferSize: '650' })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(logChannel.getBufferSize()).toBe(650);
  });

  it('rejects invalid retention payloads', async () => {
    const response = await request(app)
      .post('/api/logs/retention')
      .send({ bufferSize: 'invalid' })
      .set('Content-Type', 'application/json')
      .expect(400);
    expect(response.body.error).toMatch(/bufferSize must be a finite integer/i);
    expect(logChannel.getBufferSize()).toBe(500);
  });

  it('rejects retention payloads outside allowed range', async () => {
    const response = await request(app)
      .post('/api/logs/retention')
      .send({ bufferSize: 100000 })
      .set('Content-Type', 'application/json')
      .expect(422);
    expect(response.body.error).toMatch(/between 50 and 5000/i);
    expect(logChannel.getBufferSize()).toBe(500);
  });

  it('requires application/json content type for retention updates', async () => {
    await request(app)
      .post('/api/logs/retention')
      .send('bufferSize=700')
      .expect(415);
    expect(logChannel.getBufferSize()).toBe(500);
  });

  it('purges the log buffer', async () => {
    logChannel.push({ level: 'warn', message: 'Something happened', timestamp: 1735689605000 });

    await request(app).delete('/api/logs').expect(200);
    const snapshot = logChannel.getSnapshot({ limit: 10 });
    expect(snapshot).toHaveLength(0);
  });
});
