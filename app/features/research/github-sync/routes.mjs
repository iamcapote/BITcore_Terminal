/**
 * Routes: GitHub Research Sync API
 * POST /api/research/github-sync { action, repo, files }
 */
import { githubSyncHandler } from './controller.mjs';

export function setupGithubSyncRoutes(app) {
  app.post('/api/research/github-sync', githubSyncHandler);
}
