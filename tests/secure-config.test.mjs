import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';

const USER_FILE = 'global-user.json';

describe('secure configuration integration', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitcore-secure-'));
    process.env.BITCORE_STORAGE_DIR = tmpDir;
    process.env.BITCORE_CONFIG_SECRET = 'unit-test-secret';
    process.env.BITCORE_ALLOW_CONFIG_WRITES = '1';
    delete process.env.BRAVE_API_KEY;
    delete process.env.VENICE_API_KEY;
    delete process.env.GITHUB_TOKEN;
    vi.resetModules();
  });

  afterEach(async () => {
    vi.resetModules();
    delete process.env.BITCORE_STORAGE_DIR;
    delete process.env.BITCORE_CONFIG_SECRET;
    delete process.env.BITCORE_ALLOW_CONFIG_WRITES;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('API keys persist in encrypted config and are redacted from user file', async () => {
    const { userManager } = await import('../app/features/auth/user-manager.mjs');
    await userManager.initialize();

    await userManager.setApiKey('venice', 'venice-secret');

    expect(await userManager.getApiKey('venice')).toBe('venice-secret');

    const persisted = JSON.parse(await fs.readFile(path.join(tmpDir, USER_FILE), 'utf8'));
    expect(persisted.apiKeys.venice).toBeNull();

    const { loadSecureConfig } = await import('../app/features/config/secure-config.service.mjs');
    const overlay = await loadSecureConfig();
    expect(overlay.venice.apiKey).toBe('venice-secret');
  });

  test('GitHub token lives in encrypted config and clearing updates overlay', async () => {
    const { userManager } = await import('../app/features/auth/user-manager.mjs');
    await userManager.initialize();

    await userManager.setGitHubConfig({
      owner: 'octo-org',
      repo: 'central',
      branch: 'trunk',
      token: 'ghp_unitsecret',
    });

    expect(await userManager.hasGitHubToken()).toBe(true);
    const { loadSecureConfig } = await import('../app/features/config/secure-config.service.mjs');
    const overlayAfterSet = await loadSecureConfig();
    expect(overlayAfterSet.github.token).toBe('ghp_unitsecret');

    const persisted = JSON.parse(await fs.readFile(path.join(tmpDir, USER_FILE), 'utf8'));
    expect(persisted.github.token).toBeNull();

    await userManager.setGitHubConfig({
      owner: 'octo-org',
      repo: 'central',
      branch: 'trunk',
      token: null,
    });

    const overlayAfterClear = await loadSecureConfig();
    expect(overlayAfterClear.github.token).toBeNull();
    expect(await userManager.hasGitHubToken()).toBe(false);
  });
});
