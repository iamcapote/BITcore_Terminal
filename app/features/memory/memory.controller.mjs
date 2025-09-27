/**
 * Contract
 * Inputs:
 *   - Dependency bag { service?: MemoryService, logger?: LoggerLike, enricher?: Function, telemetry?: Function }
 *   - MemoryStoreRequest / MemoryRecallRequest payloads routed from CLI, HTTP, or WebSocket layers.
 * Outputs:
 *   - Delegates to MemoryService and returns its frozen results.
 * Error modes:
 *   - Propagates validation errors from schema/service, wraps enrichment failures with context.
 * Performance:
 *   - Thin orchestration; negligible overhead beyond enrichment callback.
 * Side effects:
 *   - None directly; service handles IO.
 */

import { createMemoryService } from './memory.service.mjs';
import {
  DEFAULT_LAYER,
  normalizeRecallPayload,
  normalizeStorePayload
} from './memory.schema.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const noopTelemetry = () => {};

export class MemoryController {
  constructor({ service = createMemoryService(), logger = noopLogger, enricher, telemetry } = {}) {
    this.service = service;
    this.logger = logger;
    this.enricher = typeof enricher === 'function' ? enricher : async () => ({ tags: [], metadata: {} });
    this.telemetry = typeof telemetry === 'function' ? telemetry : noopTelemetry;
  }

  async store(request, options = {}) {
    const normalized = normalizeStorePayload(request);
    const enrichment = await this.#safeEnrich(normalized, options);

    const payload = {
      content: normalized.content,
      role: normalized.role,
      layer: normalized.layer,
      source: normalized.source,
      tags: Array.isArray(normalized.tags) ? [...normalized.tags] : [],
      metadata: { ...normalized.metadata }
    };

    if (Array.isArray(enrichment.tags) && enrichment.tags.length) {
      payload.tags = Array.from(new Set([...(payload.tags || []), ...enrichment.tags]));
    }

    if (enrichment.metadata && typeof enrichment.metadata === 'object') {
      payload.metadata = { ...payload.metadata, ...enrichment.metadata };
    }

    if (enrichment.source && typeof enrichment.source === 'string') {
      payload.source = enrichment.source;
    }

    const record = await this.service.store(payload, options);

    this.#emitTelemetry('store', {
      layer: normalized.layer,
      record,
      githubEnabled: Boolean(options.githubEnabled ?? options.enableGithub)
    });

    return record;
  }

  async recall(request, options = {}) {
    const normalized = normalizeRecallPayload(request);
    const payload = {
      query: normalized.query,
      layer: normalized.layer,
      limit: normalized.limit,
      includeShortTerm: normalized.includeShortTerm,
      includeLongTerm: normalized.includeLongTerm,
      includeMeta: normalized.includeMeta
    };
    const results = await this.service.recall(payload, options);

    this.#emitTelemetry('recall', {
      layer: normalized.layer,
      query: normalized.query,
      results
    });

    return results;
  }

  async stats(options = {}) {
    const stats = await this.service.stats(options);

    this.#emitTelemetry('stats', {
      layer: options.layer ?? null,
      totals: stats?.totals
    });

    return stats;
  }

  async summarize(options = {}) {
    const layer = options.layer ?? DEFAULT_LAYER;
    const result = await this.service.summarize({ ...options, layer });

    this.#emitTelemetry('summarize', {
      layer,
      success: true
    });

    return result;
  }

  reset() {
    this.service.clearCache();
    this.#emitTelemetry('reset');
  }

  async #safeEnrich(normalized, options) {
    try {
      const enrichment = await this.enricher(normalized, options);
      if (!enrichment || typeof enrichment !== 'object') {
        return { tags: [], metadata: {} };
      }
      const tags = Array.isArray(enrichment.tags)
        ? enrichment.tags
            .map(tag => String(tag || '').trim().toLowerCase())
            .filter(Boolean)
        : [];
      const metadata = enrichment.metadata && typeof enrichment.metadata === 'object' && !Array.isArray(enrichment.metadata)
        ? { ...enrichment.metadata }
        : {};
      const source = enrichment.source && typeof enrichment.source === 'string'
        ? enrichment.source.trim()
        : undefined;
      return { tags, metadata, source };
    } catch (error) {
      this.logger.warn?.(`[MemoryController] enrichment failed: ${error.message}`);
      return { tags: [], metadata: {} };
    }
  }

  #emitTelemetry(event, payload) {
    try {
      this.telemetry(event, payload);
    } catch (error) {
      this.logger.warn?.(`[MemoryController] telemetry emit failed for ${event}: ${error.message}`);
    }
  }
}

export function createMemoryController(overrides = {}) {
  return new MemoryController(overrides);
}
