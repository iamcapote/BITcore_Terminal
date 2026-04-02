/**
 * Tests for notification center routes (Pass 13 — Agent Zero notification manager).
 * Covers: list (with filters), enqueue, dismiss, dismiss-all, clear-history; validates 400/404 guards.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupNotificationRoutes, resetNotificationRoutes } from '../app/features/status/notifications.routes.mjs';

let app;
let serviceMock;

function makeRecordMock(overrides = {}) {
  return {
    id: 'notif-abc123',
    severity: 'info',
    category: 'general',
    title: 'Test notification',
    description: null,
    data: null,
    dismissed: false,
    autoDismissMs: null,
    timestamp: 1712000000000,
    source: 'system',
    ...overrides,
  };
}

function makeListMock(queue = [], history = []) {
  return { source: 'mock', total: queue.length, queue, history, items: [...queue, ...history], updatedAt: new Date().toISOString() };
}

beforeEach(() => {
  resetNotificationRoutes();
  serviceMock = {
    enqueue: vi.fn().mockReturnValue(makeRecordMock()),
    list: vi.fn().mockReturnValue(makeListMock([makeRecordMock()])),
    dismiss: vi.fn().mockReturnValue({ id: 'notif-abc123', dismissed: true, source: 'mock' }),
    dismissAll: vi.fn().mockReturnValue({ dismissed: 1, source: 'mock' }),
    clearHistory: vi.fn().mockReturnValue({ cleared: 3, source: 'mock' }),
  };
  app = express();
  app.use(express.json());
  setupNotificationRoutes(app, { service: serviceMock, logger: { info: vi.fn(), warn: vi.fn() } });
});

describe('GET /api/notifications', () => {
  it('returns notification list', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('mock');
    expect(Array.isArray(res.body.queue)).toBe(true);
  });

  it('passes severity filter to service', async () => {
    await request(app).get('/api/notifications?severity=error');
    expect(serviceMock.list).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('passes category filter to service', async () => {
    await request(app).get('/api/notifications?category=mission');
    expect(serviceMock.list).toHaveBeenCalledWith(expect.objectContaining({ category: 'mission' }));
  });

  it('passes dismissed=false filter to service', async () => {
    await request(app).get('/api/notifications?dismissed=false');
    expect(serviceMock.list).toHaveBeenCalledWith(expect.objectContaining({ dismissed: false }));
  });
});

describe('POST /api/notifications', () => {
  it('enqueues a notification and returns 201', async () => {
    const res = await request(app).post('/api/notifications').send({ title: 'Mission complete', severity: 'success' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('notif-abc123');
    expect(serviceMock.enqueue).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mission complete' }));
  });

  it('returns 400 when enqueue throws validation error', async () => {
    serviceMock.enqueue.mockImplementation(() => { throw new Error('ValidationError: title is required.'); });
    const res = await request(app).post('/api/notifications').send({});
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notifications/:id/dismiss', () => {
  it('dismisses a notification', async () => {
    const res = await request(app).patch('/api/notifications/notif-abc123/dismiss');
    expect(res.status).toBe(200);
    expect(res.body.dismissed).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    serviceMock.dismiss.mockImplementation(() => { throw new Error('NotFound: notification \'no-such\' does not exist.'); });
    const res = await request(app).patch('/api/notifications/no-such/dismiss');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/notifications/dismiss-all', () => {
  it('dismisses all notifications', async () => {
    const res = await request(app).post('/api/notifications/dismiss-all');
    expect(res.status).toBe(200);
    expect(res.body.dismissed).toBe(1);
  });
});

describe('DELETE /api/notifications/history', () => {
  it('clears notification history', async () => {
    const res = await request(app).delete('/api/notifications/history');
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(3);
  });
});
