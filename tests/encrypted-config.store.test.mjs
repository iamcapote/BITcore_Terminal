import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEncryptedConfigStore, loadEncryptedConfigSync } from '../app/infrastructure/config/encrypted-config.store.mjs';
import { validateSecureConfigPayload } from '../app/features/config/config.schema.mjs';

async function createTempDir(prefix = 'enc-config-store-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('encrypted config store', () => {
  const secret = 'test-secret-key';
  let tempDir;
  let store;

  beforeEach(async () => {
    tempDir = await createTempDir();
    store = createEncryptedConfigStore({
      storageDir: tempDir,
      secret,
      validator: validateSecureConfigPayload,
    });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('saves and loads encrypted payloads', async () => {
    const payload = {
      venice: { apiKey: 'venice-123' },
      github: { token: 'ghp_abc123' },
    };

    await store.save(payload);

    const loaded = await store.load();
    expect(loaded).toEqual(payload);
  });

  it('merges payloads via patch', async () => {
    await store.save({ venice: { apiKey: 'venice-123' } });
    await store.patch({ github: { token: 'ghp_456' } });

    const loaded = await store.load();
    expect(loaded).toEqual({
      venice: { apiKey: 'venice-123' },
      github: { token: 'ghp_456' },
    });
  });

  it('rejects unexpected fields via validator', async () => {
    await expect(store.save({ invalid: { key: 'value' } })).rejects.toThrow(/unexpected field/i);
  });

  it('fails to decrypt with incorrect secret', async () => {
    await store.save({ venice: { apiKey: 'venice-123' } });

    const mismatchedStore = createEncryptedConfigStore({
      storageDir: tempDir,
      secret: 'wrong-secret',
      validator: validateSecureConfigPayload,
    });

    await expect(mismatchedStore.load()).rejects.toThrow(/Unable to decrypt/);
  });

  it('supports synchronous loading for config bootstrap', async () => {
    const payload = { brave: { apiKey: 'brave-xyz' } };
    await store.save(payload);

    const loaded = loadEncryptedConfigSync({
      storageDir: tempDir,
      secret,
      validator: validateSecureConfigPayload,
    });

    expect(loaded).toEqual(payload);
  });
});
