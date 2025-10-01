/**
 * Research Preferences Service
 *
 * Contract
 * Inputs:
 *   - storageDir?: string – override storage root for persistence (primarily for tests)
 *   - patch?: { defaults?: { depth?: number; breadth?: number; isPublic?: boolean } }
 * Outputs:
 *   - ResearchPreferences { defaults: { depth: number; breadth: number; isPublic: boolean }; updatedAt: number | null }
 * Error modes:
 *   - Propagates IO failures from fs/promises when reading or writing preferences.
 *   - Swallows JSON parse errors by logging and returning defaults.
 * Performance:
 *   - Single JSON read/write per operation; snapshots cached in-memory between calls.
 * Side effects:
 *   - Reads and writes `research-preferences.json` under the BITCORE storage directory.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

const DEFAULT_STORAGE_DIR = process.env.BITCORE_STORAGE_DIR
  || path.join(os.homedir(), '.bitcore-terminal');
const PREFERENCES_FILE_NAME = 'research-preferences.json';

const RANGE = Object.freeze({
  depth: Object.freeze({ min: 1, max: 6, fallback: 2 }),
  breadth: Object.freeze({ min: 1, max: 6, fallback: 3 })
});

const DEFAULT_RESEARCH_PREFERENCES = Object.freeze({
  defaults: Object.freeze({
    depth: RANGE.depth.fallback,
    breadth: RANGE.breadth.fallback,
    isPublic: false
  }),
  updatedAt: null
});

let cachedPreferences = null;
let cachedPreferencesPath = null;

function resolvePreferencesPath(storageDir = DEFAULT_STORAGE_DIR) {
  return path.resolve(storageDir, PREFERENCES_FILE_NAME);
}

function clampInteger(value, { min, max, fallback }) {
  if (value == null) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const clamped = Math.min(Math.max(parsed, min), max);
  return clamped;
}

function coerceBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function cloneDefaults(defaults = DEFAULT_RESEARCH_PREFERENCES.defaults) {
  return {
    depth: defaults.depth,
    breadth: defaults.breadth,
    isPublic: defaults.isPublic
  };
}

function clonePreferences(preferences = DEFAULT_RESEARCH_PREFERENCES) {
  return {
    defaults: cloneDefaults(preferences.defaults),
    updatedAt: preferences.updatedAt
  };
}

function normalizeDefaults(input = {}) {
  const current = cloneDefaults();
  return {
    depth: clampInteger(input.depth, RANGE.depth),
    breadth: clampInteger(input.breadth, RANGE.breadth),
    isPublic: coerceBoolean(input.isPublic, current.isPublic)
  };
}

function normalizePreferences(raw = {}) {
  const defaults = normalizeDefaults(raw.defaults || {});
  const updatedAt = Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : null;
  return {
    defaults,
    updatedAt
  };
}

async function readPreferencesFromDisk(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizePreferences(parsed);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[ResearchPreferences] Failed to read preferences, using defaults:', error.message);
    }
    return normalizePreferences();
  }
}

async function writePreferencesToDisk(preferences, storageDir = DEFAULT_STORAGE_DIR) {
  const dir = path.resolve(storageDir);
  await ensureDir(dir);
  const filePath = resolvePreferencesPath(dir);
  const payload = JSON.stringify(preferences, null, 2);
  await fs.writeFile(filePath, payload, 'utf8');
  cachedPreferences = clonePreferences(preferences);
  cachedPreferencesPath = filePath;
  return filePath;
}

function mergePreferences(base, patch = {}) {
  const next = clonePreferences(base);

  if (patch.defaults && typeof patch.defaults === 'object' && !Array.isArray(patch.defaults)) {
    const defaultsPatch = patch.defaults;
    const defaultClone = cloneDefaults(next.defaults);

    if (Object.prototype.hasOwnProperty.call(defaultsPatch, 'depth')) {
      defaultClone.depth = clampInteger(defaultsPatch.depth, RANGE.depth);
    }
    if (Object.prototype.hasOwnProperty.call(defaultsPatch, 'breadth')) {
      defaultClone.breadth = clampInteger(defaultsPatch.breadth, RANGE.breadth);
    }
    if (Object.prototype.hasOwnProperty.call(defaultsPatch, 'isPublic')) {
      defaultClone.isPublic = coerceBoolean(defaultsPatch.isPublic, next.defaults.isPublic);
    }

    next.defaults = defaultClone;
  }

  return normalizePreferences(next);
}

export function clearResearchPreferencesCache() {
  cachedPreferences = null;
  cachedPreferencesPath = null;
}

export function getDefaultResearchPreferences() {
  return clonePreferences(DEFAULT_RESEARCH_PREFERENCES);
}

export async function getResearchPreferences({ storageDir, refresh = false } = {}) {
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

export async function updateResearchPreferences(patch = {}, { storageDir } = {}) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('ValidationError: Research preference updates must be an object.');
  }

  const current = await getResearchPreferences({ storageDir, refresh: true });
  const merged = mergePreferences(current, patch);
  merged.updatedAt = Date.now();
  await writePreferencesToDisk(merged, storageDir);
  return clonePreferences(merged);
}

export async function replaceResearchPreferences(preferences, { storageDir } = {}) {
  if (preferences == null || typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new Error('ValidationError: Research preferences replacement payload must be an object.');
  }

  const normalized = normalizePreferences(preferences);
  normalized.updatedAt = Date.now();
  await writePreferencesToDisk(normalized, storageDir);
  return clonePreferences(normalized);
}

export async function resetResearchPreferences({ storageDir } = {}) {
  clearResearchPreferencesCache();
  const defaults = clonePreferences(DEFAULT_RESEARCH_PREFERENCES);
  defaults.updatedAt = Date.now();
  await writePreferencesToDisk(defaults, storageDir);
  return clonePreferences(defaults);
}
