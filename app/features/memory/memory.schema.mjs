/**
 * Contract
 * Inputs:
 *   - Layer identifiers (string) provided by callers; optional casing/alias support.
 *   - MemoryStoreRequest { content: string; role?: 'user'|'assistant'|'system'; layer?: string; source?: string; tags?: string[]; metadata?: Record<string,unknown> }
 *   - MemoryRecallRequest { query: string; layer?: string; limit?: number; includeShortTerm?: boolean; includeLongTerm?: boolean; includeMeta?: boolean }
 * Outputs:
 *   - Normalized payloads with canonical layer names, validated roles, sanitized strings, frozen metadata.
 * Error modes:
 *   - TypeError for non-object payloads, RangeError for invalid enums, Error with descriptive message for constraint violations.
 * Performance:
 *   - pure synchronous guards; < 1ms for typical payloads, no allocations beyond small objects/arrays.
 * Side effects:
 *   - None. Pure module.
 */

const ROLE_SET = new Set(['user', 'assistant', 'system']);

const RAW_LAYER_ALIASES = {
  working: 'working',
  short: 'working',
  episodic: 'episodic',
  medium: 'episodic',
  story: 'episodic',
  semantic: 'semantic',
  long: 'semantic',
  archive: 'semantic'
};

export const MEMORY_LAYERS = Object.freeze({
  WORKING: 'working',
  EPISODIC: 'episodic',
  SEMANTIC: 'semantic'
});

export const DEFAULT_LAYER = MEMORY_LAYERS.EPISODIC;

export const LAYER_TO_DEPTH = Object.freeze({
  [MEMORY_LAYERS.WORKING]: 'short',
  [MEMORY_LAYERS.EPISODIC]: 'medium',
  [MEMORY_LAYERS.SEMANTIC]: 'long'
});

export function normalizeLayer(layerLike) {
  if (layerLike == null || layerLike === '') {
    return DEFAULT_LAYER;
  }
  const normalizedKey = String(layerLike).trim().toLowerCase();
  const mapped = RAW_LAYER_ALIASES[normalizedKey];
  if (!mapped) {
    const valid = Object.values(MEMORY_LAYERS).join(', ');
    throw new RangeError(`Invalid memory layer '${layerLike}'. Expected one of: ${valid}`);
  }
  return mapped;
}

export function normalizeRole(roleLike) {
  if (roleLike == null || roleLike === '') {
    return 'user';
  }
  const role = String(roleLike).trim().toLowerCase();
  if (!ROLE_SET.has(role)) {
    throw new RangeError(`Invalid memory role '${roleLike}'. Expected one of: ${Array.from(ROLE_SET).join(', ')}`);
  }
  return role;
}

export function normalizeTags(tagsLike) {
  if (tagsLike == null) {
    return [];
  }
  if (!Array.isArray(tagsLike)) {
    throw new TypeError('tags must be an array of strings when provided');
  }
  const tags = tagsLike
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
    .map(tag => tag.toLowerCase());
  const unique = Array.from(new Set(tags));
  return unique;
}

export function normalizeMetadata(metadataLike) {
  if (metadataLike == null) {
    return Object.freeze({});
  }
  if (typeof metadataLike !== 'object' || Array.isArray(metadataLike)) {
    throw new TypeError('metadata must be an object when provided');
  }
  return Object.freeze({ ...metadataLike });
}

export function normalizeStorePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('Memory store payload must be an object');
  }
  const { content, role, layer, source = null, tags, metadata } = payload;
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error('content is required and must be a non-empty string');
  }
  const normalized = {
    content: content.trim(),
    role: normalizeRole(role),
    layer: normalizeLayer(layer),
    source: source == null ? null : String(source).trim() || null,
    tags: normalizeTags(tags),
    metadata: normalizeMetadata(metadata)
  };
  return Object.freeze(normalized);
}

export function normalizeRecallPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('Memory recall payload must be an object');
  }
  const { query, layer, limit = null, includeShortTerm = true, includeLongTerm = true, includeMeta = true } = payload;
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('query is required and must be a non-empty string');
  }
  let normalizedLimit = null;
  if (limit != null) {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new RangeError('limit must be a positive number when provided');
    }
    normalizedLimit = Math.floor(parsed);
  }
  return Object.freeze({
    query: query.trim(),
    layer: normalizeLayer(layer),
    limit: normalizedLimit,
    includeShortTerm: Boolean(includeShortTerm),
    includeLongTerm: Boolean(includeLongTerm),
    includeMeta: Boolean(includeMeta)
  });
}

export function deriveDepthFromLayer(layerLike) {
  const layer = normalizeLayer(layerLike);
  const depth = LAYER_TO_DEPTH[layer];
  if (!depth) {
    throw new Error(`Unsupported depth mapping for layer '${layer}'`);
  }
  return depth;
}

export function freezeMemoryRecord(record, extras = {}) {
  if (!record || typeof record !== 'object') {
    throw new TypeError('record must be an object');
  }
  const frozen = Object.freeze({
    ...record,
    ...extras,
    metadata: record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? Object.freeze({ ...record.metadata })
      : Object.freeze({})
  });
  return frozen;
}
