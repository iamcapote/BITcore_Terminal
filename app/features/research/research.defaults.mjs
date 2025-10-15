/**
 * Research Defaults Resolver
 * Why: Centralize computation of effective research defaults across CLI, WebSocket, and HTTP flows.
 * What: Parses optional overrides, loads persisted preferences, and returns sanitized depth/breadth/public flags.
 * How: Retrieves preferences via the research preferences service, clamps numeric ranges, and coerces boolean toggles.
 */

import {
  getResearchPreferences,
  getDefaultResearchPreferences,
} from '../preferences/index.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';
import config from '../../config/index.mjs';

const RANGE_LIMITS = Object.freeze({
  depth: Object.freeze({ min: 1, max: 6 }),
  breadth: Object.freeze({ min: 1, max: 6 }),
});

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'public']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'private']);

const moduleLogger = createModuleLogger('research.defaults');

const researchSecurityConfig = config?.security?.research ?? {};

function normalizeRange(range, fallback) {
  if (!range) {
    return fallback;
  }
  const min = Number.isInteger(range.min) && range.min > 0 ? range.min : fallback.min;
  const maxCandidate = Number.isInteger(range.max) && range.max >= min ? range.max : fallback.max;
  const max = maxCandidate >= min ? maxCandidate : min;
  return Object.freeze({ min, max });
}

const EFFECTIVE_RANGE_LIMITS = Object.freeze({
  depth: normalizeRange(researchSecurityConfig.depthRange, RANGE_LIMITS.depth),
  breadth: normalizeRange(researchSecurityConfig.breadthRange, RANGE_LIMITS.breadth)
});

export const RESEARCH_RANGE_LIMITS = EFFECTIVE_RANGE_LIMITS;

function parseIntegerInRange(value, { min, max }) {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return undefined;
  }

  const normalized = typeof value === 'string' ? value.trim() : value;
  if (typeof normalized === 'string' && normalized.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const clamped = Math.min(Math.max(parsed, min), max);
  return clamped;
}

function parseBoolean(value) {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return undefined;
}

export function parseDepthInput(value) {
  return parseIntegerInRange(value, EFFECTIVE_RANGE_LIMITS.depth);
}

export function parseBreadthInput(value) {
  return parseIntegerInRange(value, EFFECTIVE_RANGE_LIMITS.breadth);
}

export function parseVisibilityInput(value) {
  return parseBoolean(value);
}

function createRangeValidation(range, label) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      return { ok: true, provided: false, value: undefined };
    }
    if (typeof raw === 'boolean') {
      return { ok: false, provided: true, error: `${label} must be an integer between ${range.min} and ${range.max}.` };
    }
    const normalized = typeof raw === 'string' ? raw.trim() : raw;
    if (typeof normalized === 'string' && normalized.length === 0) {
      return { ok: true, provided: false, value: undefined };
    }
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) {
      return { ok: false, provided: true, error: `${label} must be an integer between ${range.min} and ${range.max}.` };
    }
    if (parsed < range.min || parsed > range.max) {
      return { ok: false, provided: true, error: `${label} must be between ${range.min} and ${range.max}.` };
    }
    return { ok: true, provided: true, value: parsed };
  };
}

export const validateDepthOverride = createRangeValidation(EFFECTIVE_RANGE_LIMITS.depth, 'Depth');
export const validateBreadthOverride = createRangeValidation(EFFECTIVE_RANGE_LIMITS.breadth, 'Breadth');

export function validateVisibilityOverride(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, provided: false, value: undefined };
  }
  const parsed = parseVisibilityInput(raw);
  if (parsed === undefined) {
    return {
      ok: false,
      provided: true,
      error: 'Visibility must be set using --public/--private or boolean equivalents.'
    };
  }
  return { ok: true, provided: true, value: parsed };
}

export async function resolveResearchDefaults(overrides = {}, options = {}) {
  const { storageDir, refresh = false } = options;

  let snapshot;
  try {
    snapshot = await getResearchPreferences({ storageDir, refresh });
  } catch (error) {
    moduleLogger.warn('Falling back to default preferences.', {
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    snapshot = null;
  }

  const baselineSnapshot = snapshot ?? getDefaultResearchPreferences();
  const baseline = baselineSnapshot.defaults;

  const depthOverride = parseDepthInput(overrides.depth);
  const breadthOverride = parseBreadthInput(overrides.breadth);
  const publicOverride = parseVisibilityInput(overrides.isPublic);

  return {
    depth: depthOverride ?? baseline.depth,
    breadth: breadthOverride ?? baseline.breadth,
    isPublic: publicOverride ?? baseline.isPublic,
    updatedAt: baselineSnapshot.updatedAt ?? null,
  };
}
