/**
 * Research Preferences Controller
 *
 * Contract
 * Inputs:
 *   - storageDir?: string – override persistence directory (tests)
 *   - updates?: { defaults?: { depth?: number|string; breadth?: number|string; isPublic?: boolean|string } }
 * Outputs:
 *   - ResearchPreferences snapshot containing defaults + updatedAt timestamp
 * Error modes:
 *   - ValidationError when payload is not an object or no valid fields supplied
 *   - Propagates IO failures from underlying service
 * Performance:
 *   - Single service read/write per operation; service caches snapshots in-memory
 * Side effects:
 *   - Reads/writes research preferences JSON file on disk
 */

import {
  getResearchPreferences,
  updateResearchPreferences,
  replaceResearchPreferences,
  resetResearchPreferences,
  getDefaultResearchPreferences,
} from './research-preferences.service.mjs';

const INTEGER_RANGE = Object.freeze({
  depth: Object.freeze({ min: 1, max: 6 }),
  breadth: Object.freeze({ min: 1, max: 6 })
});

const TRUE_SET = new Set(['1', 'true', 'yes', 'on']);
const FALSE_SET = new Set(['0', 'false', 'no', 'off']);

function clampInteger(value, { min, max }) {
  if (value == null) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, min), max);
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_SET.has(normalized)) {
    return true;
  }
  if (FALSE_SET.has(normalized)) {
    return false;
  }
  return undefined;
}

function sanitizePatch(input = {}) {
  if (input == null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ValidationError: Research preference updates must be an object.');
  }

  const patch = {};

  if (input.defaults && typeof input.defaults === 'object' && !Array.isArray(input.defaults)) {
    const defaultsPatch = {};

    if (Object.prototype.hasOwnProperty.call(input.defaults, 'depth')) {
      const depth = clampInteger(input.defaults.depth, INTEGER_RANGE.depth);
      if (depth !== undefined) {
        defaultsPatch.depth = depth;
      }
    }

    if (Object.prototype.hasOwnProperty.call(input.defaults, 'breadth')) {
      const breadth = clampInteger(input.defaults.breadth, INTEGER_RANGE.breadth);
      if (breadth !== undefined) {
        defaultsPatch.breadth = breadth;
      }
    }

    if (Object.prototype.hasOwnProperty.call(input.defaults, 'isPublic')) {
      const isPublic = coerceBoolean(input.defaults.isPublic);
      if (isPublic !== undefined) {
        defaultsPatch.isPublic = isPublic;
      }
    }

    if (Object.keys(defaultsPatch).length > 0) {
      patch.defaults = defaultsPatch;
    }
  }

  return patch;
}

export function createResearchPreferencesController(options = {}) {
  const { storageDir, logger = console } = options;

  return Object.freeze({
    async get(context = {}) {
      const refresh = Boolean(context.refresh);
      return getResearchPreferences({ storageDir, refresh });
    },

    async update(updates = {}, context = {}) {
      const patch = sanitizePatch(updates);
      if (!patch.defaults) {
        throw new Error('ValidationError: No valid research preference fields provided for update.');
      }
      const preferences = await updateResearchPreferences(patch, { storageDir });
      logger.info?.('[ResearchPreferences] Updated research defaults.', { patch });
      return preferences;
    },

    async replace(nextPreferences, context = {}) {
      if (typeof nextPreferences !== 'object' || nextPreferences == null || Array.isArray(nextPreferences)) {
        throw new Error('ValidationError: Research preference replacement payload must be an object.');
      }
      const preferences = await replaceResearchPreferences(nextPreferences, { storageDir });
      logger.info?.('[ResearchPreferences] Replaced research preferences.');
      return preferences;
    },

    async reset(context = {}) {
      const preferences = await resetResearchPreferences({ storageDir });
      logger.info?.('[ResearchPreferences] Reset research preferences to defaults.');
      return preferences;
    },

    async defaults(context = {}) {
      return getDefaultResearchPreferences();
    }
  });
}

let singletonController = null;

export function getResearchPreferencesController(options = {}) {
  if (!singletonController) {
    singletonController = createResearchPreferencesController(options);
  }
  return singletonController;
}

export function resetResearchPreferencesController() {
  singletonController = null;
}
