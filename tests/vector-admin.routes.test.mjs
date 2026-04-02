import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupVectorAdminRoutes } from '../app/features/ai/vector-admin/vector-admin.routes.mjs';

const controllerMock = {
  getOverview: vi.fn(),
  getAcceptedMimes: vi.fn(),
  processDocument: vi.fn(),
};

let app;

beforeEach(() => {
  controllerMock.getOverview.mockReset().mockResolvedValue({
    source: 'mock',
    feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' },
    stores: [],
    acceptedMimes: ['text/markdown'],
    updatedAt: '2026-02-17T00:00:00.000Z',
  });
  controllerMock.getAcceptedMimes.mockReset().mockResolvedValue({ acceptedMimes: ['text/markdown', 'application/pdf'] });
  controllerMock.processDocument.mockReset().mockResolvedValue({ success: true, reason: 'ok', metadata: { chunks: 1 } });

  app = express();
  app.use(express.json());
  setupVectorAdminRoutes(app, { controller: controllerMock, enabled: true, logger: { info: vi.fn(), warn: vi.fn() } });
});

describe('vector admin routes', () => {
  it('returns overview snapshot', async () => {
    const response = await request(app).get('/api/ai/vectors/overview').expect(200);
    expect(response.body.source).toBe('mock');
    expect(controllerMock.getOverview).toHaveBeenCalledTimes(1);
  });

  it('returns accepted mime list', async () => {
    const response = await request(app).get('/api/ai/vectors/accepts').expect(200);
    expect(response.body.acceptedMimes).toContain('text/markdown');
    expect(controllerMock.getAcceptedMimes).toHaveBeenCalledTimes(1);
  });

  it('returns 422 when process returns non-success', async () => {
    controllerMock.processDocument.mockResolvedValueOnce({ success: false, reason: 'rejected', metadata: {} });
    const response = await request(app)
      .post('/api/ai/vectors/process')
      .send({ index: 'docs-prod', filename: 'a.md', mimeType: 'image/png' })
      .expect(422);
    expect(response.body.success).toBe(false);
  });

  it('maps validation errors to 400', async () => {
    controllerMock.processDocument.mockRejectedValueOnce(new Error('ValidationError: bad payload'));
    const response = await request(app)
      .post('/api/ai/vectors/process')
      .send({})
      .expect(400);
    expect(response.body.error).toContain('ValidationError');
  });
});
