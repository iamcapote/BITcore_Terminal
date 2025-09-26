import { beforeAll, describe, expect, it, vi } from 'vitest';
import { commands } from '../app/commands/index.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';

describe('CLI command integration (single-user mode)', () => {
  beforeAll(async () => {
    await userManager.initialize();
  });

  it('reports success for login even though authentication is a no-op', async () => {
    const result = await commands.login({ username: 'whoever' });
    expect(result.success).toBe(true);
    expect(userManager.getUsername()).toBe('operator');
  });

  it('treats logout as a no-op but still succeeds', async () => {
    const result = await commands.logout();
    expect(result.success).toBe(true);
    // No state change beyond remaining authenticated as the global user
    expect(userManager.isAuthenticated()).toBe(true);
  });

  it('stores API keys via /keys set without requiring passwords', async () => {
    const output = vi.fn();
    const result = await commands.keys({
      positionalArgs: ['set', 'brave', 'test-brave-key'],
      output
    });

    expect(result.success).toBe(true);
    expect(await userManager.getApiKey('brave')).toBe('test-brave-key');
    expect(output).toHaveBeenCalledWith('API key for brave updated.');
  });

  it('updates GitHub configuration with flag arguments', async () => {
    const output = vi.fn();
    const result = await commands.keys({
      positionalArgs: ['set', 'github'],
      flags: {
        'github-owner': 'octocat',
        'github-repo': 'hello-world',
        'github-branch': 'trunk',
        'github-token': 'ghp_testing'
      },
      output,
      error: vi.fn()
    });

    const config = await userManager.getDecryptedGitHubConfig();

    expect(result.success).toBe(true);
    expect(config).toMatchObject({
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'trunk',
      token: 'ghp_testing'
    });
  });
});
