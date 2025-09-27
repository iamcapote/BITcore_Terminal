/**
 * Why: Centralized typedefs for memory feature consumers (controllers, services, adapters).
 * What: Describes inputs/outputs to keep contracts explicit without TS.
 * How: JSDoc typedefs consumed by editors and runtime validators.
 */

/**
 * @typedef {Object} MemoryLayerConfig
 * @property {import('../../infrastructure/memory/memory.manager.mjs').MemoryManager} manager
 * @property {string} depth
 * @property {boolean} githubEnabled
 */

/**
 * @typedef {Object} MemoryStoreRequest
 * @property {string} content
 * @property {('user'|'assistant'|'system')} [role]
 * @property {string} [layer]
 * @property {string} [source]
 * @property {string[]} [tags]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} MemoryStoreResult
 * @property {string} id
 * @property {string} layer
 * @property {('user'|'assistant'|'system')} role
 * @property {string} content
 * @property {string} timestamp
 * @property {string[]} tags
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {Object} MemoryRecallRequest
 * @property {string} query
 * @property {string} [layer]
 * @property {number} [limit]
 * @property {boolean} [includeShortTerm]
 * @property {boolean} [includeLongTerm]
 * @property {boolean} [includeMeta]
 */

/**
 * @typedef {Object} MemoryStats
 * @property {string} layer
 * @property {string} depth
 * @property {number} stored
 * @property {number} retrieved
 * @property {number} validated
 * @property {number} summarized
 * @property {number} ephemeralCount
 * @property {number} validatedCount
 * @property {boolean} githubEnabled
 */
