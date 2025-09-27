/**
 * Contract: GitHub Research Sync Service
 * Inputs:
 *   - action: 'verify' | 'pull' | 'push' | 'upload'
 *   - repo: string (required)
 *   - files?: string[] (for upload)
 *   - signal?: AbortSignal
 * Outputs:
 *   - { success: boolean, message: string, details?: any }
 * Error modes:
 *   - ValidationError, GitError, TimeoutError
 * Performance:
 *   - time: soft 2s, hard 10s; memory: <50 MB peak
 * Side effects:
 *   - GitHub API calls, local repo IO, logs events
 */
import { verifyRepo, pushRepo, pullRepo, uploadFiles } from '../../../infrastructure/research/github-sync.mjs';

export async function githubResearchSync({ action, repo, files, signal }) {
  if (!repo || typeof repo !== 'string') throw new Error('ValidationError: repo required');
  switch (action) {
    case 'verify':
      return verifyRepo(repo, { signal });
    case 'pull':
      return pullRepo(repo, { signal });
    case 'push':
      return pushRepo(repo, { signal });
    case 'upload':
      if (!Array.isArray(files) || files.length === 0) throw new Error('ValidationError: files required for upload');
      return uploadFiles(repo, files, { signal });
    default:
      throw new Error('ValidationError: unknown action');
  }
}
