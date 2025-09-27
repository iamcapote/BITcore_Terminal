/**
 * Memory telemetry helper.
 *
 * Emits structured WebSocket events (via OutputManager) whenever memory
 * operations occur. The payloads are intentionally small and redacted to
 * avoid leaking full memory contents while still giving the UI enough
 * context to update dashboards in real time.
 */

import { outputManager } from '../../utils/research.output-manager.mjs';

const noop = () => {};

function toPreview(content = '', limit = 160) {
  if (!content) return '';
  return content.length > limit ? `${content.slice(0, limit)}…` : content;
}

function sanitizeRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  return {
    id: record.id || null,
    layer: record.layer || null,
    role: record.role || null,
    tags: Array.isArray(record.tags) ? record.tags.slice(0, 8) : [],
    timestamp: record.timestamp || null,
    source: record.source || record.metadata?.source || null,
    preview: toPreview(record.content)
  };
}

export function createMemoryTelemetry(options = {}) {
  const {
    broadcast = outputManager.broadcast,
    logger = console
  } = options;

  if (typeof broadcast !== 'function') {
    return noop;
  }

  return function emit(event, payload = {}) {
    try {
      const baseMessage = {
        type: 'memory_event',
        event,
        layer: payload.layer || null,
        timestamp: new Date().toISOString()
      };

      switch (event) {
        case 'store': {
          const record = sanitizeRecord(payload.record);
          broadcast({
            ...baseMessage,
            layer: record?.layer || payload.layer || null,
            data: {
              record,
              githubEnabled: Boolean(payload.githubEnabled)
            }
          });
          break;
        }
        case 'recall': {
          const topRecord = Array.isArray(payload.results) && payload.results.length
            ? sanitizeRecord(payload.results[0])
            : null;
          broadcast({
            ...baseMessage,
            layer: payload.layer || topRecord?.layer || null,
            data: {
              query: payload.query || '',
              resultsCount: Array.isArray(payload.results) ? payload.results.length : 0,
              topRecord
            }
          });
          break;
        }
        case 'stats': {
          broadcast({
            ...baseMessage,
            layer: payload.layer || null,
            data: {
              totals: payload.totals || null
            }
          });
          break;
        }
        case 'summarize': {
          broadcast({
            ...baseMessage,
            layer: payload.layer || null,
            data: {
              success: payload.success !== false
            }
          });
          break;
        }
        case 'reset': {
          broadcast({
            ...baseMessage,
            layer: null,
            data: {}
          });
          break;
        }
        default: {
          broadcast({
            ...baseMessage,
            data: payload
          });
        }
      }
    } catch (error) {
      logger?.warn?.(`[MemoryTelemetry] Failed to emit ${event}: ${error.message}`);
    }
  };
}

export { sanitizeRecord };
