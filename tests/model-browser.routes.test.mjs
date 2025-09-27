import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupModelBrowserRoutes } from '../app/features/ai/model-browser/model-browser.routes.mjs';

const controllerMock = {
  getCatalog: vi.fn(),
};

const snapshot = Object.freeze({
  models: Object.freeze([
    Object.freeze({
      id: 'alpha-model',
      label: 'Alpha Model',
      badges: Object.freeze([]),
      recommendations: Object.freeze({ chat: true, research: false, coding: false, vision: false, reasoning: false, uncensored: false, speed: false }),
      categories: Object.freeze(['general', 'chat']),
      contextTokens: 4096,
    }),
  ]),
  defaults: Object.freeze({
    global: 'alpha-model',
    chat: 'alpha-model',
    research: 'alpha-model',
    token: 'alpha-model',
  }),
  categories: Object.freeze({
    general: Object.freeze(['alpha-model']),
  }),
  meta: Object.freeze({ total: 1, generatedAt: 1_735_000_000_000, categoryMetadata: Object.freeze({}) }),
  feature: Object.freeze({ enabled: true, profileEnabled: true, requiresApiKey: true, hasApiKey: true }),
  updatedAt: 1_735_000_000_000,
});

let app;

beforeEach(() => {
  controllerMock.getCatalog.mockReset().mockResolvedValue(snapshot);
  app = express();
  setupModelBrowserRoutes(app, { controller: controllerMock, enabled: true, logger: { info: vi.fn(), warn: vi.fn() } });
});

describe('model browser routes', () => {
  it('returns the catalog snapshot', async () => {
    const response = await request(app).get('/api/models/venice').expect(200);
    expect(controllerMock.getCatalog).toHaveBeenCalledWith({ refresh: false });
    expect(response.body.models).toHaveLength(1);
    expect(response.body.defaults.global).toBe('alpha-model');
  });

  it('supports refresh query flag', async () => {
    await request(app).get('/api/models/venice?refresh=1').expect(200);
    expect(controllerMock.getCatalog).toHaveBeenCalledWith({ refresh: true });
  });

  it('maps feature-disabled errors to 403', async () => {
    controllerMock.getCatalog.mockRejectedValueOnce(new Error('FeatureDisabled: disabled'));
    const response = await request(app).get('/api/models/venice').expect(403);
    expect(response.body.error).toContain('FeatureDisabled');
  });
});
