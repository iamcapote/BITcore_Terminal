/**
 * Memory Store Adapter
 * Why: Keep mutable memory state and stats isolated from orchestration logic.
 * What: Provides a thin API for managing ephemeral and validated memories, generating IDs, and recording metrics.
 * How: Wraps in-memory arrays with helper methods while respecting configured retention limits.
 *
 * Contract
 * Inputs:
 *   - constructor({ depth: string, settings: MemorySettings })
 * Outputs:
 *   - MemoryStore instance exposing mutation helpers (see class definition).
 * Error modes:
 *   - Methods return booleans when removals fail; callers decide how to react.
 * Performance:
 *   - Operations are O(1) except layer organization which is O(n) over stored memories.
 * Side effects:
 *   - Maintains in-memory state only; persistence handled by higher layers.
 */

import crypto from 'crypto';

/**
 * @typedef {object} MemorySettings
 * @property {number} maxMemories
 * @property {number} retrievalLimit
 * @property {number} threshold
 * @property {number} summarizeEvery
 */

export class MemoryStore {
  /**
   * @param {{ depth: string, settings: MemorySettings }} options
   */
  constructor({ depth, settings }) {
    this.depth = depth;
    this.settings = settings;
    this.ephemeral = [];
    this.validated = [];
    this.stats = {
      memoriesStored: 0,
      memoriesRetrieved: 0,
      memoriesValidated: 0,
      memoriesSummarized: 0
    };
  }

  /**
   * Generate a unique identifier for a memory entry.
   * @returns {string}
   */
  generateMemoryId() {
    return `mem-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create and register a new ephemeral memory entry.
   * @param {{ content: string, role?: string, score?: number, tags?: string[], timestamp?: string }} memory
   * @returns {object}
   */
  createEphemeralMemory({ content, role = 'user', score = 0.5, tags = [], timestamp }) {
    const entry = {
      id: this.generateMemoryId(),
      content,
      role,
      timestamp: timestamp || new Date().toISOString(),
      tags: Array.isArray(tags) ? [...tags] : [],
      score
    };

    this.ephemeral.push(entry);
    this.#trimEphemeral();
    this.stats.memoriesStored += 1;
    return entry;
  }

  /**
   * Record a retrieval count.
   * @param {number} count
   */
  recordRetrieval(count) {
    this.stats.memoriesRetrieved += count;
  }

  /**
   * Record a validation count.
   * @param {number} count
   */
  recordValidation(count) {
    this.stats.memoriesValidated += count;
  }

  /**
   * Record a summarization count.
   * @param {number} count
   */
  recordSummaries(count) {
    this.stats.memoriesSummarized += count;
  }

  /**
   * Expose a read-only snapshot of stats.
   * @returns {{memoriesStored:number, memoriesRetrieved:number, memoriesValidated:number, memoriesSummarized:number, depthLevel:string, ephemeralCount:number, validatedCount:number}}
   */
  snapshot() {
    return {
      ...this.stats,
      depthLevel: this.depth,
      ephemeralCount: this.ephemeral.length,
      validatedCount: this.validated.length
    };
  }

  /**
   * @returns {object[]}
   */
  getEphemeral() {
    return this.ephemeral;
  }

  /**
   * @param {number} index
   * @returns {boolean}
   */
  removeEphemeralByIndex(index) {
    if (index < 0 || index >= this.ephemeral.length) {
      return false;
    }
    this.ephemeral.splice(index, 1);
    return true;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  removeEphemeralById(id) {
    const index = this.ephemeral.findIndex((memory) => memory.id === id);
    return this.removeEphemeralByIndex(index);
  }

  clearEphemeral() {
    this.ephemeral = [];
  }

  /**
   * Add or replace a validated memory entry.
   * @param {object} memory
   */
  addValidated(memory) {
    const index = this.validated.findIndex((entry) => entry.id === memory.id);
    if (index === -1) {
      this.validated.push(memory);
      return;
    }
    this.validated[index] = memory;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  removeValidatedById(id) {
    const index = this.validated.findIndex((memory) => memory.id === id);
    if (index === -1) {
      return false;
    }
    this.validated.splice(index, 1);
    return true;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  hasValidated(id) {
    return this.validated.some((memory) => memory.id === id);
  }

  /**
   * @returns {object[]}
   */
  getValidated() {
    return this.validated;
  }

  /**
   * @returns {object[]}
   */
  getAllMemories() {
    return [...this.ephemeral, ...this.validated];
  }

  /**
   * Categorize memories into layers.
   * @param {{ scoreThreshold?: number }} [options]
   * @returns {{ shortTerm: object[], longTerm: object[], meta: object[], counts: { shortTerm: number, longTerm: number, meta: number, total: number } }}
   */
  organizeLayers({ scoreThreshold = 0.7 } = {}) {
    const shortTerm = [...this.ephemeral];
    const longTerm = [];
    const meta = [];

    for (const memory of this.validated) {
      if (memory.isMeta || memory.type === 'summary') {
        meta.push(memory);
        continue;
      }
      const score = Number.isFinite(memory?.score) ? memory.score : 0;
      if (score >= scoreThreshold) {
        longTerm.push(memory);
      } else {
        shortTerm.push(memory);
      }
    }

    const counts = {
      shortTerm: shortTerm.length,
      longTerm: longTerm.length,
      meta: meta.length,
      total: shortTerm.length + longTerm.length + meta.length
    };

    return { shortTerm, longTerm, meta, counts };
  }

  #trimEphemeral() {
    if (this.ephemeral.length <= this.settings.maxMemories) {
      return;
    }
    this.ephemeral = this.ephemeral.slice(-this.settings.maxMemories);
  }
}
