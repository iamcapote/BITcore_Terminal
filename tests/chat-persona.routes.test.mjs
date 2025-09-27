/**
 * Chat persona route contract tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { controllerMock, userManagerMock } = vi.hoisted(() => {
  return {
    controllerMock: {
      list: vi.fn(),
      getDefault: vi.fn(),
      setDefault: vi.fn(),
      reset: vi.fn(),
    },
    userManagerMock: {
      getCurrentUser: vi.fn(),
    },
  };
});

vi.mock('../app/features/chat/index.mjs', () => ({
  getChatPersonaController: () => controllerMock,
}));

vi.mock('../app/features/auth/user-manager.mjs', () => ({
  userManager: userManagerMock,
}));

import { setupChatPersonaRoutes } from '../app/features/chat/chat-persona.routes.mjs';

describe('chat persona HTTP routes', () => {
  let app;
  let logger;
  let currentUser;

  beforeEach(() => {
    controllerMock.list.mockReset().mockResolvedValue({
      personas: [
        { name: 'Bitcore', slug: 'bitcore', description: 'Primary operator persona.' },
      ],
      default: { name: 'Bitcore', slug: 'bitcore' },
      updatedAt: null,
    });
    controllerMock.getDefault.mockReset().mockResolvedValue({
      persona: { name: 'Bitcore', slug: 'bitcore' },
      updatedAt: null,
    });
    controllerMock.setDefault.mockReset().mockResolvedValue({
      persona: { name: 'Bitcore', slug: 'bitcore' },
      updatedAt: Date.now(),
    });
    controllerMock.reset.mockReset().mockResolvedValue({
      persona: { name: 'Bitcore', slug: 'bitcore' },
      updatedAt: Date.now(),
    });

    currentUser = { username: 'operator', role: 'admin' };
    userManagerMock.getCurrentUser.mockImplementation(() => currentUser);

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    app = express();
    app.use(express.json());
    setupChatPersonaRoutes(app, { logger });
  });

  it('lists personas and default state', async () => {
    const response = await request(app).get('/api/chat/personas').expect(200);
    expect(response.body.personas).toHaveLength(1);
    expect(controllerMock.list).toHaveBeenCalledWith({ includeDefault: true });
  });

  it('returns the default persona', async () => {
    const response = await request(app).get('/api/chat/personas/default').expect(200);
    expect(response.body.persona.slug).toBe('bitcore');
    expect(controllerMock.getDefault).toHaveBeenCalled();
  });

  it('updates the default persona with validated payload', async () => {
    await request(app)
      .post('/api/chat/personas/default')
      .send({ slug: 'bitcore' })
      .expect(200);

    expect(controllerMock.setDefault).toHaveBeenCalledWith('bitcore', { actor: currentUser });
  });

  it('rejects persona updates with unexpected fields', async () => {
    await request(app)
      .post('/api/chat/personas/default')
      .send({ slug: 'bitcore', extra: 'nope' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toContain('unexpected fields');
      });

    expect(controllerMock.setDefault).not.toHaveBeenCalled();
  });

  it('rejects persona updates when slug is unknown', async () => {
    await request(app)
      .post('/api/chat/personas/default')
      .send({ slug: 'unknown-persona' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.toLowerCase()).toContain('unknown persona');
      });

    expect(controllerMock.setDefault).not.toHaveBeenCalled();
  });

  it('requires authentication for persona mutations', async () => {
    currentUser = null;

    await request(app)
      .post('/api/chat/personas/default')
      .send({ slug: 'bitcore' })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error).toContain('Authentication required');
      });

    expect(controllerMock.setDefault).not.toHaveBeenCalled();
  });

  it('resets persona when authenticated', async () => {
    await request(app).post('/api/chat/personas/reset').expect(200);
    expect(controllerMock.reset).toHaveBeenCalledWith({ actor: currentUser });
  });
});
