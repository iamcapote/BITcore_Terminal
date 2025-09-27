import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEncryptedConfigStore } from '../app/infrastructure/config/encrypted-config.store.mjs';
import { validateSecureConfigPayload } from '../app/features/config/config.schema.mjs';

async function createTempDir(prefix = 'config-loader-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('config loader with secure overlay', () => {
  const secret = 'loader-secret';
  let originalStorageDir;
  let originalSecret;
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
    originalStorageDir = process.env.BITCORE_STORAGE_DIR;
    originalSecret = process.env.BITCORE_CONFIG_SECRET;
    process.env.BITCORE_STORAGE_DIR = tempDir;
    process.env.BITCORE_CONFIG_SECRET = secret;
    vi.resetModules();
  });

  afterEach(async () => {
    process.env.BITCORE_STORAGE_DIR = originalStorageDir;
    process.env.BITCORE_CONFIG_SECRET = originalSecret;
    vi.resetModules();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('applies overlay values to base config', async () => {
    const store = createEncryptedConfigStore({
      storageDir: tempDir,
      secret,
      validator: validateSecureConfigPayload,
    });

    await store.save({
      venice: { apiKey: 'secure-venice-key' },
      github: { token: 'secure-github-token' },
    });

    const { default: config } = await import('../app/config/index.mjs');

    expect(config.venice.apiKey).toBe('secure-venice-key');
    expect(config.github.token).toBe('secure-github-token');
    expect(config.__secureOverlay?.loaded).toBe(true);
  });

  it('sets overlay metadata when secure store empty', async () => {
    const store = createEncryptedConfigStore({
      storageDir: tempDir,
      secret,
      validator: validateSecureConfigPayload,
    });

    await store.clear();

    const { default: config } = await import('../app/config/index.mjs');
    expect(config.__secureOverlay?.loaded).toBe(false);
  });
});
