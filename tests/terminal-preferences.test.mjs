import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getTerminalPreferences,
  updateTerminalPreferences,
  replaceTerminalPreferences,
  resetTerminalPreferences,
  clearTerminalPreferencesCache,
  getDefaultTerminalPreferences,
} from '../app/features/preferences/terminal-preferences.service.mjs';

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'terminal-prefs-'));
  return dir;
}

describe('terminal preferences service', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
    clearTerminalPreferencesCache();
  });

  afterEach(async () => {
    clearTerminalPreferencesCache();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when no preferences file exists', async () => {
    const prefs = await getTerminalPreferences({ storageDir: tempDir, refresh: true });
    const defaults = getDefaultTerminalPreferences();

    expect(prefs.widgets).toEqual(defaults.widgets);
    expect(prefs.terminal).toEqual(defaults.terminal);
    expect(prefs.updatedAt).toBeNull();
  });

  it('persists updates and reloads merged preferences', async () => {
    const updated = await updateTerminalPreferences(
      { widgets: { telemetryPanel: false, modelBrowser: true } },
      { storageDir: tempDir }
    );

  expect(updated.widgets.telemetryPanel).toBe(false);
  expect(updated.widgets.modelBrowser).toBe(true);
  expect(updated.widgets.memoryPanel).toBe(true);
  expect(updated.widgets.telemetryIndicator).toBe(true);
  expect(updated.widgets.logIndicator).toBe(true);
    expect(updated.updatedAt).toEqual(expect.any(Number));

    const reloaded = await getTerminalPreferences({ storageDir: tempDir, refresh: true });
    expect(reloaded.widgets).toEqual(updated.widgets);
    expect(reloaded.updatedAt).toEqual(updated.updatedAt);
  });

  it('ignores unknown widget and terminal fields on update', async () => {
    await updateTerminalPreferences(
      {
        widgets: { telemetryPanel: false, unknownFlag: true },
        terminal: { autoScroll: false, bogus: true },
      },
      { storageDir: tempDir }
    );

    const prefs = await getTerminalPreferences({ storageDir: tempDir, refresh: true });
    expect(prefs.widgets).toEqual({
      telemetryPanel: false,
      memoryPanel: true,
      modelBrowser: false,
      telemetryIndicator: true,
      logIndicator: true,
    });
    expect(prefs.terminal).toEqual({
      retainHistory: true,
      autoScroll: false,
    });
  });

  it('recovers from corrupted preference file by returning defaults', async () => {
    const filePath = path.join(tempDir, 'terminal-preferences.json');
    await fs.writeFile(filePath, '{ this is not valid JSON }', 'utf8');

    const prefs = await getTerminalPreferences({ storageDir: tempDir, refresh: true });
    const defaults = getDefaultTerminalPreferences();
    expect(prefs.widgets).toEqual(defaults.widgets);
  });

  it('allows replacing preferences wholesale', async () => {
    const nowPrefs = {
      widgets: {
        telemetryPanel: false,
        memoryPanel: false,
        modelBrowser: true,
        telemetryIndicator: false,
        logIndicator: false,
      },
      terminal: { retainHistory: false, autoScroll: false },
    };
    const saved = await replaceTerminalPreferences(nowPrefs, { storageDir: tempDir });

    expect(saved.widgets).toEqual(nowPrefs.widgets);
    expect(saved.terminal).toEqual(nowPrefs.terminal);

    const reloaded = await getTerminalPreferences({ storageDir: tempDir, refresh: true });
    expect(reloaded.widgets).toEqual(nowPrefs.widgets);
    expect(reloaded.terminal).toEqual(nowPrefs.terminal);
  });

  it('can reset preferences to defaults', async () => {
    await updateTerminalPreferences(
      { widgets: { telemetryPanel: false } },
      { storageDir: tempDir }
    );

    const reset = await resetTerminalPreferences({ storageDir: tempDir });
    const defaults = getDefaultTerminalPreferences();

    expect(reset.widgets).toEqual(defaults.widgets);
    expect(reset.terminal).toEqual(defaults.terminal);
    expect(reset.updatedAt).toEqual(expect.any(Number));
  });
});
