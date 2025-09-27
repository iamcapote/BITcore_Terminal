/**
 * Vitest: GitHub Research Sync Service
 * Covers: verify, pull, push, upload, error handling
 */
import { describe, it, expect, vi } from 'vitest';
import * as service from '../features/research/github-sync/service.mjs';

// Mock infra
vi.mock('../infrastructure/research/github-sync.mjs', () => ({
  verifyRepo: vi.fn(async (repo) => repo === 'good' ? { success: true, message: 'ok' } : { success: false, message: 'fail' }),
  pullRepo: vi.fn(async (repo) => repo === 'good' ? { success: true, message: 'pulled' } : { success: false, message: 'fail' }),
  pushRepo: vi.fn(async (repo) => repo === 'good' ? { success: true, message: 'pushed' } : { success: false, message: 'fail' }),
  uploadFiles: vi.fn(async (repo, files) => (repo === 'good' && files.length) ? { success: true, message: 'uploaded' } : { success: false, message: 'fail' })
}));

describe('githubResearchSync', () => {
  it('verifies repo', async () => {
    const res = await service.githubResearchSync({ action: 'verify', repo: 'good' });
    expect(res.success).toBe(true);
  });
  it('pulls repo', async () => {
    const res = await service.githubResearchSync({ action: 'pull', repo: 'good' });
    expect(res.success).toBe(true);
  });
  it('pushes repo', async () => {
    const res = await service.githubResearchSync({ action: 'push', repo: 'good' });
    expect(res.success).toBe(true);
  });
  it('uploads files', async () => {
    const res = await service.githubResearchSync({ action: 'upload', repo: 'good', files: ['a.txt'] });
    expect(res.success).toBe(true);
  });
  it('throws on missing repo', async () => {
    await expect(service.githubResearchSync({ action: 'verify' })).rejects.toThrow('repo required');
  });
  it('throws on unknown action', async () => {
    await expect(service.githubResearchSync({ action: 'nope', repo: 'good' })).rejects.toThrow('unknown action');
  });
  it('throws on missing files for upload', async () => {
    await expect(service.githubResearchSync({ action: 'upload', repo: 'good' })).rejects.toThrow('files required');
  });
});
