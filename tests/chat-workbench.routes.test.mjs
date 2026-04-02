/**
 * Chat workbench route contract tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const controllerMock = {
  getBootstrap: vi.fn(),
};

import { setupChatWorkbenchRoutes } from '../app/features/chat/chat-workbench.routes.mjs';

describe('chat workbench HTTP routes', () => {
  let app;

  beforeEach(() => {
    controllerMock.getBootstrap.mockReset().mockResolvedValue({
      source: 'mock',
      feature: { enabled: true, mode: 'mock', wiring: 'scaffolded' },
      models: [{ id: 'qwen3-235b', label: 'Qwen 3 235B', provider: 'venice', capability: 'reasoning' }],
      personas: [{ slug: 'bitcore', label: 'BITcore Operator', summary: 'General operations assistant.' }],
      quickPrompts: [{ id: 'incident-triage', title: 'Incident triage', prompt: 'Summarize impact.' }],
      defaults: { persona: 'bitcore', model: 'qwen3-235b' },
      updatedAt: '2026-02-17T00:00:00.000Z',
    });

    app = express();
    app.use(express.json());
    setupChatWorkbenchRoutes(app, {
      controller: controllerMock,
      enabled: true,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('returns bootstrap snapshot', async () => {
    const response = await request(app).get('/api/chat/workbench/bootstrap').expect(200);
    expect(response.body.source).toBe('mock');
    expect(response.body.defaults.model).toBe('qwen3-235b');
    expect(controllerMock.getBootstrap).toHaveBeenCalledTimes(1);
  });

  it('maps controller failures to 500', async () => {
    controllerMock.getBootstrap.mockRejectedValueOnce(new Error('boom'));
    const response = await request(app).get('/api/chat/workbench/bootstrap').expect(500);
    expect(response.body.error).toContain('Failed to load chat workbench bootstrap');
  });
});
