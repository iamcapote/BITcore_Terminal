import { createGitHubResearchSyncService } from '../features/research/research.github-sync.service.mjs';

/**
 * @deprecated Use `GitHubResearchSyncService.uploadFile` instead.
 * Thin wrapper retained temporarily for compatibility with older scripts.
 */
export async function uploadToGitHub(config, repoPath, content, commitMessage) {
  const service = createGitHubResearchSyncService({
    configLoader: async () => config
  });

  const summary = await service.uploadFile({ path: repoPath, content, message: commitMessage });
  return {
    commitUrl: summary?.commitUrl ?? null,
    fileUrl: summary?.fileUrl ?? null
  };
}
