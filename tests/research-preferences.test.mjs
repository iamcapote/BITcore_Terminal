import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getResearchPreferences,
  updateResearchPreferences,
  resetResearchPreferences,
  clearResearchPreferencesCache,
  getDefaultResearchPreferences,
} from '../app/features/preferences/research-preferences.service.mjs';
import { resolveResearchDefaults } from '../app/features/research/research.defaults.mjs';

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'research-prefs-'));
}

describe('research preferences service', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
    clearResearchPreferencesCache();
  });

  afterEach(async () => {
    clearResearchPreferencesCache();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when no preferences file exists', async () => {
    const prefs = await getResearchPreferences({ storageDir: tempDir, refresh: true });
    const defaults = getDefaultResearchPreferences();

    expect(prefs.defaults).toEqual(defaults.defaults);
    expect(prefs.updatedAt).toBeNull();
  });

  it('persists updates and clamps values to supported ranges', async () => {
    const updated = await updateResearchPreferences(
      { defaults: { depth: 99, breadth: -4, isPublic: 'yes' } },
      { storageDir: tempDir }
    );

    expect(updated.defaults.depth).toBe(6);
    expect(updated.defaults.breadth).toBe(1);
    expect(updated.defaults.isPublic).toBe(true);
    expect(updated.updatedAt).toEqual(expect.any(Number));

    const reloaded = await getResearchPreferences({ storageDir: tempDir, refresh: true });
    expect(reloaded.defaults).toEqual(updated.defaults);
  });

  it('resets preferences back to defaults', async () => {
    await updateResearchPreferences(
      { defaults: { depth: 4, breadth: 5, isPublic: true } },
      { storageDir: tempDir }
    );

    const reset = await resetResearchPreferences({ storageDir: tempDir });
    const defaults = getDefaultResearchPreferences();

    expect(reset.defaults).toEqual(defaults.defaults);
    expect(reset.updatedAt).toEqual(expect.any(Number));
  });
});

describe('resolveResearchDefaults helper', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
    clearResearchPreferencesCache();
  });

  afterEach(async () => {
    clearResearchPreferencesCache();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uses persisted defaults when no overrides provided', async () => {
    await updateResearchPreferences(
      { defaults: { depth: 5, breadth: 4, isPublic: true } },
      { storageDir: tempDir }
    );

    const resolved = await resolveResearchDefaults({}, { storageDir: tempDir, refresh: true });
    expect(resolved.depth).toBe(5);
    expect(resolved.breadth).toBe(4);
    expect(resolved.isPublic).toBe(true);
  });

  it('coerces string overrides and clamps out-of-range values', async () => {
    const resolved = await resolveResearchDefaults({
      depth: '8',
      breadth: '0',
      isPublic: 'false',
    });

    expect(resolved.depth).toBe(6);
    expect(resolved.breadth).toBe(1);
    expect(resolved.isPublic).toBe(false);
  });

  it('ignores invalid overrides and falls back to persisted defaults', async () => {
    await updateResearchPreferences(
      { defaults: { depth: 3, breadth: 2, isPublic: false } },
      { storageDir: tempDir }
    );

    const resolved = await resolveResearchDefaults(
      { depth: 'not-a-number', breadth: null, isPublic: 'maybe' },
      { storageDir: tempDir }
    );

    expect(resolved.depth).toBe(3);
    expect(resolved.breadth).toBe(2);
    expect(resolved.isPublic).toBe(false);
  });
});
