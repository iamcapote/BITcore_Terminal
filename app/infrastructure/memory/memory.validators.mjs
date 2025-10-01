/**
 * Memory Manager Validators
 * Why: Guard incoming configuration so the memory manager orchestrator only runs with supported options.
 * What: Exposes helpers that validate depth selections and user metadata before initializing memory stores.
 * How: Throws typed errors when constraints are violated and returns normalized values for downstream use.
 *
 * Contract
 * Inputs:
 *   - ensureValidDepth(depth, depthSettings)
 *       depth: string | undefined
 *       depthSettings: Record<string, object>
 *   - ensureValidUser(user)
 *       user: { username?: string } | undefined
 * Outputs:
 *   - ensureValidDepth: { depth: string, settings: object }
 *   - ensureValidUser: { username: string, [key: string]: unknown }
 * Error modes:
 *   - Throws MemoryValidationError when the input is missing or unsupported.
 * Performance:
 *   - O(1) lookups; negligible CPU/memory overhead.
 * Side effects:
 *   - None.
 */

class MemoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MemoryValidationError';
  }
}

/**
 * Ensure the requested depth exists in the configuration map.
 *
 * @param {string|undefined} depth
 * @param {Record<string, object>} depthSettings
 * @returns {{ depth: string, settings: object }}
 */
export function ensureValidDepth(depth, depthSettings) {
  const candidate = typeof depth === 'string' ? depth : undefined;
  if (!candidate || !depthSettings[candidate]) {
    const options = Object.keys(depthSettings).join(', ');
    throw new MemoryValidationError(`Invalid memory depth: ${depth}. Supported values: ${options}`);
  }
  return { depth: candidate, settings: depthSettings[candidate] };
}

/**
 * Ensure a user object with a username is provided.
 *
 * @param {{ username?: string }|undefined|null} user
 * @returns {{ username: string }}
 */
export function ensureValidUser(user) {
  if (!user || typeof user.username !== 'string' || !user.username.trim()) {
    throw new MemoryValidationError('Valid user object with username is required');
  }
  return { ...user, username: user.username.trim() };
}

export { MemoryValidationError };
