/**
 * Terminal Preferences Service
 *
 * Contract
 * Inputs:
 *   - storageDir?: string (optional) - override directory used to persist preferences
 *   - patch?: TerminalPreferencePatch { widgets?: Record<string, boolean>; terminal?: Record<string, boolean> }
 *   - refresh?: boolean - when true, bypasses in-memory cache on read
 * Outputs:
 *   - TerminalPreferences { widgets: { telemetryPanel: boolean; memoryPanel: boolean; modelBrowser: boolean };
 *       terminal: { retainHistory: boolean; autoScroll: boolean }; updatedAt: number | null }
 * Error modes:
 *   - Throws when storage directory cannot be created or file cannot be written.
 *   - Corrupted preference files are logged and replaced with defaults.
 * Performance:
 *   - Reads/writes at most once per operation; preferences cached in-memory between calls.
 * Side effects:
 *   - Reads/writes JSON file under BITCORE storage directory.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

const DEFAULT_STORAGE_DIR = process.env.BITCORE_STORAGE_DIR
  || path.join(os.homedir(), '.bitcore-terminal');
const PREFERENCES_FILE_NAME = 'terminal-preferences.json';

const DEFAULT_PREFERENCES = Object.freeze({
  widgets: Object.freeze({
    telemetryPanel: true,
    memoryPanel: true,
    modelBrowser: false,
    telemetryIndicator: true,
    logIndicator: true,
  }),
  terminal: Object.freeze({
    retainHistory: true,
    autoScroll: true,
  }),
  updatedAt: null,
});

const DEFAULT_WIDGET_KEYS = Object.keys(DEFAULT_PREFERENCES.widgets);
const DEFAULT_TERMINAL_KEYS = Object.keys(DEFAULT_PREFERENCES.terminal);

let cachedPreferences = null;
let cachedPreferencesPath = null;

function cloneDefaultPreferences() {
  return {
    widgets: { ...DEFAULT_PREFERENCES.widgets },
    terminal: { ...DEFAULT_PREFERENCES.terminal },
    updatedAt: DEFAULT_PREFERENCES.updatedAt,
  };
}

function clonePreferences(preferences) {
  return {
    widgets: { ...preferences.widgets },
    terminal: { ...preferences.terminal },
    updatedAt: preferences.updatedAt,
  };
}

function resolvePreferencesPath(storageDir = DEFAULT_STORAGE_DIR) {
  return path.resolve(storageDir, PREFERENCES_FILE_NAME);
}

function coerceBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeWidgets(input = {}) {
  const defaults = cloneDefaultPreferences().widgets;
  const normalized = {};
  for (const key of DEFAULT_WIDGET_KEYS) {
    normalized[key] = coerceBoolean(input[key], defaults[key]);
  }
  return normalized;
}

function normalizeTerminal(input = {}) {
  const defaults = cloneDefaultPreferences().terminal;
  const normalized = {};
  for (const key of DEFAULT_TERMINAL_KEYS) {
    normalized[key] = coerceBoolean(input[key], defaults[key]);
  }
  return normalized;
}

function normalizePreferences(input = {}) {
  const base = cloneDefaultPreferences();
  const normalized = {
    widgets: normalizeWidgets(input.widgets || base.widgets),
    terminal: normalizeTerminal(input.terminal || base.terminal),
    updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : null,
  };
  return normalized;
}

async function readPreferencesFromDisk(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizePreferences(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return normalizePreferences();
    }
    console.warn('[TerminalPreferences] Failed to read preferences, fallback to defaults:', error.message);
    return normalizePreferences();
  }
}

async function writePreferencesToDisk(preferences, storageDir = DEFAULT_STORAGE_DIR) {
  const dir = path.resolve(storageDir);
  await ensureDir(dir);
  const filePath = resolvePreferencesPath(dir);
  const payload = JSON.stringify(preferences, null, 2);
  await fs.writeFile(filePath, payload);
  cachedPreferences = clonePreferences(preferences);
  cachedPreferencesPath = filePath;
  return filePath;
}

function mergePreferences(base, patch = {}) {
  const next = {
    widgets: { ...base.widgets },
    terminal: { ...base.terminal },
    updatedAt: base.updatedAt,
  };

  if (patch.widgets && typeof patch.widgets === 'object') {
    for (const key of DEFAULT_WIDGET_KEYS) {
      if (typeof patch.widgets[key] === 'boolean') {
        next.widgets[key] = patch.widgets[key];
      }
    }
  }

  if (patch.terminal && typeof patch.terminal === 'object') {
    for (const key of DEFAULT_TERMINAL_KEYS) {
      if (typeof patch.terminal[key] === 'boolean') {
        next.terminal[key] = patch.terminal[key];
      }
    }
  }

  return normalizePreferences(next);
}

export function clearTerminalPreferencesCache() {
  cachedPreferences = null;
  cachedPreferencesPath = null;
}

export async function getTerminalPreferences({ storageDir, refresh = false } = {}) {
  const dir = storageDir ? path.resolve(storageDir) : DEFAULT_STORAGE_DIR;
  const filePath = resolvePreferencesPath(dir);

  if (!refresh && cachedPreferences && cachedPreferencesPath === filePath) {
    return clonePreferences(cachedPreferences);
  }

  const loaded = await readPreferencesFromDisk(filePath);
  cachedPreferences = clonePreferences(loaded);
  cachedPreferencesPath = filePath;
  return clonePreferences(loaded);
}

export async function updateTerminalPreferences(patch = {}, { storageDir } = {}) {
  const current = await getTerminalPreferences({ storageDir, refresh: true });
  const merged = mergePreferences(current, patch);
  merged.updatedAt = Date.now();
  await writePreferencesToDisk(merged, storageDir);
  return clonePreferences(merged);
}

export async function replaceTerminalPreferences(preferences, { storageDir } = {}) {
  const normalized = normalizePreferences(preferences);
  normalized.updatedAt = Date.now();
  await writePreferencesToDisk(normalized, storageDir);
  return clonePreferences(normalized);
}

export async function resetTerminalPreferences({ storageDir } = {}) {
  clearTerminalPreferencesCache();
  const defaults = cloneDefaultPreferences();
  defaults.updatedAt = Date.now();
  await writePreferencesToDisk(defaults, storageDir);
  return clonePreferences(defaults);
}

export function getDefaultTerminalPreferences() {
  return cloneDefaultPreferences();
}
