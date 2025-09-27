/**
 * Deep freeze utility to enforce immutability at module boundaries.
 */

export function freezeDeep(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  const entries = Array.isArray(value) ? value : Object.values(value);
  for (const child of entries) {
    freezeDeep(child);
  }

  return value;
}
