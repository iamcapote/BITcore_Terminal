import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupGithubActivityRoutes } from '../app/features/research/github-activity.routes.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import {
  recordGitHubActivity,
  clearGitHubActivityFeed
} from '../app/features/research/github-activity.channel.mjs';

let app;
let authSpy;
let userSpy;

beforeEach(() => {
  clearGitHubActivityFeed();
  authSpy = vi.spyOn(userManager, 'isAuthenticated').mockReturnValue(true);
  userSpy = vi.spyOn(userManager, 'getCurrentUser').mockReturnValue({ username: 'operator', role: 'admin' });

  app = express();
  app.use(express.json());
  setupGithubActivityRoutes(app, { logger: console });
});

afterEach(() => {
  authSpy?.mockRestore();
  userSpy?.mockRestore();
  vi.clearAllMocks();
  clearGitHubActivityFeed();
});

describe('github activity routes', () => {
  it('rejects unauthenticated access', async () => {
    authSpy.mockReturnValue(false);

    const response = await request(app)
      .get('/api/research/github-activity/snapshot')
      .expect(401);

    expect(response.body.error).toMatch(/authentication required/i);
  });

  it('returns recent activity snapshot with defaults', async () => {
    recordGitHubActivity({ message: 'verify repo start', level: 'info' });
    recordGitHubActivity({ message: 'push complete', level: 'info' });

    const response = await request(app)
      .get('/api/research/github-activity/snapshot')
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.limit).toBe(40);
    expect(response.body.meta.sample).toBe(1);
  });

  it('filters by level and limit', async () => {
  recordGitHubActivity({ message: 'info entry', level: 'info' });
  recordGitHubActivity({ message: 'warn entry', level: 'warn' });
  recordGitHubActivity({ message: 'error entry', level: 'error' });

    const response = await request(app)
      .get('/api/research/github-activity/snapshot')
      .query({ levels: 'warn,error', limit: 1 })
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].level).toBe('error');
  });

  it('applies since and search filters', async () => {
    const baseTime = Date.now();
  recordGitHubActivity({ message: 'old event', level: 'info', timestamp: baseTime - 10_000 });
  recordGitHubActivity({ message: 'matching event', level: 'info', timestamp: baseTime });

    const response = await request(app)
      .get('/api/research/github-activity/snapshot')
      .query({ since: baseTime - 1_000, search: 'matching' })
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].message).toMatch(/matching event/);
  });

  it('returns stats with optional since filter', async () => {
    const baseTime = Date.now();
  recordGitHubActivity({ message: 'history', level: 'info', timestamp: baseTime - 10_000 });
  recordGitHubActivity({ message: 'recent', level: 'warn', timestamp: baseTime });

    const response = await request(app)
      .get('/api/research/github-activity/stats')
      .query({ since: baseTime - 1 })
      .expect(200);

    expect(response.body.data.total).toBeGreaterThanOrEqual(0);
    expect(response.body.meta.since).toBeDefined();
  });

  it('rejects invalid parameters', async () => {
    const response = await request(app)
      .get('/api/research/github-activity/snapshot')
      .query({ limit: 0 })
      .expect(400);

    expect(response.body.error).toMatch(/limit/i);
  });
});
