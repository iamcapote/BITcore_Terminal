/**
 * Terminal Preferences Controller
 *
 * Contract
 * Inputs:
 *   - context.storageDir?: string – override persistence directory (primarily for tests)
 *   - updates?: TerminalPreferencePatch – optional partial updates for widgets/terminal toggles
 *   - options.refresh?: boolean – bypass cache when reading
 * Outputs:
 *   - TerminalPreferences snapshot with widgets, terminal toggles, updatedAt timestamp
 * Error modes:
 *   - Propagates IO failures from the underlying service (directory creation, writes)
 *   - Normalizes unknown fields; rejects non-object payloads with ValidationError
 * Performance:
 *   - Single read/write per invocation; service caches snapshots in-memory
 * Side effects:
 *   - Reads/writes terminal preference JSON file on disk
 */

import {
  getTerminalPreferences,
  updateTerminalPreferences,
  replaceTerminalPreferences,
  resetTerminalPreferences,
} from './terminal-preferences.service.mjs';

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isBoolean(value) {
  return typeof value === 'boolean';
}

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function sanitizePatch(input = {}) {
  if (input == null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ValidationError: Terminal preference updates must be an object.');
  }

  const patch = {};

  if (input.widgets && typeof input.widgets === 'object' && !Array.isArray(input.widgets)) {
    patch.widgets = {};
    for (const [key, value] of Object.entries(input.widgets)) {
      if (isBoolean(value)) {
        patch.widgets[key] = value;
      } else {
        const coerced = parseBoolean(value);
        if (coerced !== undefined) {
          patch.widgets[key] = coerced;
        }
      }
    }
    if (Object.keys(patch.widgets).length === 0) {
      delete patch.widgets;
    }
  }

  if (input.terminal && typeof input.terminal === 'object' && !Array.isArray(input.terminal)) {
    patch.terminal = {};
    for (const [key, value] of Object.entries(input.terminal)) {
      if (isBoolean(value)) {
        patch.terminal[key] = value;
      } else {
        const coerced = parseBoolean(value);
        if (coerced !== undefined) {
          patch.terminal[key] = coerced;
        }
      }
    }
    if (Object.keys(patch.terminal).length === 0) {
      delete patch.terminal;
    }
  }

  return patch;
}

export function createTerminalPreferencesController(options = {}) {
  const { storageDir, logger = console } = options;

  return Object.freeze({
    async get(context = {}) {
      const refresh = Boolean(context.refresh);
      const preferences = await getTerminalPreferences({ storageDir, refresh });
      return preferences;
    },

    async update(updates = {}, context = {}) {
      const patch = sanitizePatch(updates);
      if (!patch.widgets && !patch.terminal) {
        throw new Error('ValidationError: No valid terminal preference fields provided for update.');
      }
      const preferences = await updateTerminalPreferences(patch, { storageDir });
      logger.info?.('[TerminalPreferences] Updated preferences.', { patch });
      return preferences;
    },

    async replace(nextPreferences, context = {}) {
      if (typeof nextPreferences !== 'object' || nextPreferences == null || Array.isArray(nextPreferences)) {
        throw new Error('ValidationError: Terminal preference replacement payload must be an object.');
      }
      const preferences = await replaceTerminalPreferences(nextPreferences, { storageDir });
      logger.info?.('[TerminalPreferences] Replaced preferences.');
      return preferences;
    },

    async reset(context = {}) {
      const preferences = await resetTerminalPreferences({ storageDir });
      logger.info?.('[TerminalPreferences] Reset preferences to defaults.');
      return preferences;
    },
  });
}

let singletonController = null;

export function getTerminalPreferencesController(options = {}) {
  if (!singletonController) {
    singletonController = createTerminalPreferencesController(options);
  }
  return singletonController;
}

export function resetTerminalPreferencesController() {
  singletonController = null;
}