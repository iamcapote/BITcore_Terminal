import { beforeAll, describe, expect, it } from 'vitest';
import { userManager } from '../app/features/auth/user-manager.mjs';

describe('Global single-user manager', () => {
  beforeAll(async () => {
    await userManager.initialize();
  });

  it('exposes the default operator profile', async () => {
    const user = await userManager.getUserData();
    expect(user).toMatchObject({ username: 'operator', role: 'admin' });
    expect(userManager.isAuthenticated()).toBe(true);
  });

  it('persists Brave and Venice API keys without passwords', async () => {
    await userManager.setApiKey('brave', 'integration-brave-key');
    await userManager.setApiKey('venice', 'integration-venice-key');

    const braveKey = await userManager.getApiKey('brave');
    const veniceKey = await userManager.getApiKey('venice');

    expect(braveKey).toBe('integration-brave-key');
    expect(veniceKey).toBe('integration-venice-key');
  });

  it('stores GitHub configuration for downstream integrations', async () => {
    await userManager.setGitHubConfig({
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'main',
      token: 'ghp_testtoken'
    });

    const config = await userManager.getDecryptedGitHubConfig();
    expect(config).toMatchObject({
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'main',
      token: 'ghp_testtoken'
    });
  });
});
