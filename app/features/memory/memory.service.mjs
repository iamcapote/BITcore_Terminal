/**
 * Contract
 * Inputs:
 *   - MemoryStoreRequest / MemoryRecallRequest payloads (validated via schema helpers).
 *   - Context options { user?: { username: string }, githubEnabled?: boolean } per call.
 * Outputs:
 *   - Frozen MemoryStoreResult objects and recall arrays enriched with layer metadata.
 *   - Stats snapshots per layer plus aggregated totals.
 * Error modes:
 *   - Throws on validation failures, missing user context, or underlying adapter errors.
 * Performance:
 *   - Lazily instantiates MemoryManager per layer; memoized thereafter.
 *   - Store/recall operations delegate to infrastructure with O(n) memory counts.
 * Side effects:
 *   - Creates MemoryManager instances (which may hit GitHub when githubEnabled=true).
 *   - No IO beyond delegated manager behavior.
 */

import { MemoryManager } from '../../infrastructure/memory/memory.manager.mjs';
import { userManager as defaultUserManager } from '../auth/user-manager.mjs';
import {
  DEFAULT_LAYER,
  MEMORY_LAYERS,
  deriveDepthFromLayer,
  freezeMemoryRecord,
  normalizeRecallPayload,
  normalizeStorePayload,
  normalizeLayer
} from './memory.schema.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const LAYER_LIST = Object.freeze(Object.values(MEMORY_LAYERS));

export class MemoryService {
  constructor({ userManager = defaultUserManager, managerFactory } = {}) {
    this.userManager = userManager;
    this.managerFactory = managerFactory || ((options) => new MemoryManager(options));
    this.logger = noopLogger;
    this._managers = new Map();
  }

  async store(payload, options = {}) {
    const normalized = normalizeStorePayload(payload);
    const manager = await this.#getManager(normalized.layer, options);

    const stored = await manager.storeMemory(normalized.content, normalized.role);

    const baseTags = Array.isArray(stored.tags) ? stored.tags : [];
    const tags = normalized.tags.length ? Array.from(new Set([...baseTags, ...normalized.tags])) : baseTags;

    const metadataSource = normalized.source ? { source: normalized.source } : {};
    const rawMetadata = stored.metadata && typeof stored.metadata === 'object' ? stored.metadata : {};
    const metadata = { ...rawMetadata, ...normalized.metadata, ...metadataSource };

    return freezeMemoryRecord({
      ...stored,
      tags,
      metadata,
      layer: normalized.layer
    });
  }

  async recall(payload, options = {}) {
    const normalized = normalizeRecallPayload(payload);
    const manager = await this.#getManager(normalized.layer, options);

    const results = await manager.retrieveRelevantMemories(
      normalized.query,
      normalized.includeShortTerm,
      normalized.includeLongTerm,
      normalized.includeMeta
    );

    const slice = normalized.limit == null ? results : results.slice(0, normalized.limit);
    return Object.freeze(slice.map(entry => freezeMemoryRecord({ ...entry }, { layer: normalized.layer })));
  }

  async stats(options = {}) {
    const { layer = null } = options;
    const targetLayers = layer ? [normalizeLayer(layer)] : LAYER_LIST;

    const layerSnapshots = [];
    for (const layerName of targetLayers) {
      const manager = await this.#getManager(layerName, options);
      const rawStats = manager.getStats();
      layerSnapshots.push(Object.freeze({
        layer: layerName,
        depth: deriveDepthFromLayer(layerName),
        stored: rawStats.memoriesStored ?? 0,
        retrieved: rawStats.memoriesRetrieved ?? 0,
        validated: rawStats.memoriesValidated ?? 0,
        summarized: rawStats.memoriesSummarized ?? 0,
        ephemeralCount: rawStats.ephemeralCount ?? 0,
        validatedCount: rawStats.validatedCount ?? 0,
        githubEnabled: Boolean(manager.githubIntegration)
      }));
    }

    const totals = layerSnapshots.reduce((acc, snapshot) => {
      acc.stored += snapshot.stored;
      acc.retrieved += snapshot.retrieved;
      acc.validated += snapshot.validated;
      acc.summarized += snapshot.summarized;
      acc.ephemeralCount += snapshot.ephemeralCount;
      acc.validatedCount += snapshot.validatedCount;
      acc.layers += 1;
      return acc;
    }, { stored: 0, retrieved: 0, validated: 0, summarized: 0, ephemeralCount: 0, validatedCount: 0, layers: 0 });

    return Object.freeze({
      layers: Object.freeze(layerSnapshots),
      totals: Object.freeze(totals)
    });
  }

  async summarize(options = {}) {
    const manager = await this.#getManager(options.layer ?? DEFAULT_LAYER, options);
    if (typeof manager.summarizeAndFinalize !== 'function') {
      throw new Error('Underlying memory manager does not support summarizeAndFinalize');
    }
    return manager.summarizeAndFinalize(options.conversationText ?? '');
  }

  clearCache() {
    this._managers.clear();
  }

  async #getManager(layerLike, options = {}) {
    const layer = normalizeLayer(layerLike);
    const githubEnabled = Boolean(options.githubEnabled ?? options.enableGithub);
    const cacheKey = `${layer}:${githubEnabled ? '1' : '0'}`;

    if (this._managers.has(cacheKey)) {
      return this._managers.get(cacheKey);
    }

    const user = await this.#resolveUser(options.user);
    const depth = deriveDepthFromLayer(layer);

    const manager = this.managerFactory({
      depth,
      user,
      githubEnabled
    });

    this._managers.set(cacheKey, manager);
    return manager;
  }

  async #resolveUser(candidate) {
    if (candidate && typeof candidate === 'object' && candidate.username) {
      return candidate;
    }

    if (this.userManager) {
      if (typeof this.userManager.getUserData === 'function') {
        const data = await this.userManager.getUserData();
        if (data?.username) return data;
      }
      if (typeof this.userManager.getCurrentUser === 'function') {
        const user = this.userManager.getCurrentUser();
        if (user?.username) return user;
      }
    }

    throw new Error('MemoryService requires a user context with a username');
  }
}

export function createMemoryService(overrides = {}) {
  return new MemoryService(overrides);
}
