/**
 * Secure configuration schema utilities.
 *
 * Contract
 * Inputs:
 *   - payload: object describing secure configuration overrides sourced from the encrypted store
 * Outputs:
 *   - Sanitised, schema-compliant copy of the payload with trimmed strings and nulls preserved
 * Error modes:
 *   - TypeError when payload or nested entries are not objects
 *   - RangeError when unexpected sections/keys appear or values violate constraints
 * Performance:
 *   - Pure synchronous validation over a small, bounded object graph
 * Side effects:
 *   - None
 */

const SECURE_STRING = 'string';
const SECURE_BOOLEAN = 'boolean';

const SECURE_CONFIG_SCHEMA = Object.freeze({
  venice: {
    apiKey: SECURE_STRING,
  },
  brave: {
    apiKey: SECURE_STRING,
  },
  github: {
    owner: SECURE_STRING,
    repo: SECURE_STRING,
    branch: SECURE_STRING,
    token: SECURE_STRING,
  },
  memory: {
    github: {
      token: SECURE_STRING,
    },
  },
  terminal: {
    experimental: {
      allowConfigWrites: SECURE_BOOLEAN,
    },
  },
});

function assertObject(candidate, path) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError(`ValidationError: ${path} must be an object.`);
  }
}

function normalizeString(value, path) {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new RangeError(`ValidationError: ${path} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RangeError(`ValidationError: ${path} cannot be empty.`);
  }
  return trimmed;
}

function normalizeBoolean(value, path) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  throw new RangeError(`ValidationError: ${path} must be a boolean value.`);
}

function traverseAndValidate(payload, schema, pathSegments = []) {
  assertObject(payload, pathSegments.join('.') || 'payload');
  const result = {};
  const allowedKeys = Object.keys(schema);
  const receivedKeys = Object.keys(payload);

  for (const key of receivedKeys) {
    if (!allowedKeys.includes(key)) {
      const path = [...pathSegments, key].join('.') || key;
      throw new RangeError(`ValidationError: unexpected field "${path}".`);
    }
  }

  for (const key of allowedKeys) {
    if (!(key in payload)) {
      continue;
    }

    const value = payload[key];
    const schemaEntry = schema[key];
    const path = [...pathSegments, key].join('.') || key;

    if (schemaEntry === SECURE_STRING) {
      result[key] = normalizeString(value, path);
      continue;
    }

    if (schemaEntry === SECURE_BOOLEAN) {
      result[key] = normalizeBoolean(value, path);
      continue;
    }

    // Nested object
    if (value == null) {
      result[key] = null;
      continue;
    }

    result[key] = traverseAndValidate(value, schemaEntry, [...pathSegments, key]);
  }

  return result;
}

export function validateSecureConfigPayload(payload) {
  if (payload == null) {
    return {};
  }
  return traverseAndValidate(payload, SECURE_CONFIG_SCHEMA);
}

export function mergeSecureConfig(base, overlay) {
  if (!overlay || typeof overlay !== 'object') {
    return base;
  }

  const result = { ...base };

  for (const [section, value] of Object.entries(overlay)) {
    if (value == null) {
      continue;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      result[section] = value;
      continue;
    }

    const current = base[section] && typeof base[section] === 'object'
      ? base[section]
      : {};

    result[section] = mergeSecureConfig(current, value);
  }

  return result;
}

export const SECURE_CONFIG_FIELDS = Object.freeze(SECURE_CONFIG_SCHEMA);

export default {
  validateSecureConfigPayload,
  mergeSecureConfig,
  SECURE_CONFIG_FIELDS,
};
