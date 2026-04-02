/**
 * Vector Admin Service
 * Why: Provide a stable mock-first seam for vector store administration before live adapter wiring.
 * What: Exposes immutable overview snapshots, accepted MIME metadata, and mock document ingestion results.
 * How: Keeps in-memory vector store state with validated writes and deterministic response contracts.
 *
 * Contract
 * Inputs:
 *   - options.timeProvider?: () => number
 *   - options.uuidProvider?: () => string
 *   - getOverview({ backend? })
 *   - processDocument({ index, filename, mimeType, sizeBytes? })
 * Outputs:
 *   - overview { source, feature, stores[], acceptedMimes[], updatedAt }
 *   - process result { success, reason, metadata }
 * Error modes:
 *   - ValidationError on malformed ingestion payloads.
 * Performance:
 *   - O(n) over in-memory store list; memory bounded by static seed plus counters.
 * Side effects:
 *   - Mutates in-memory store counters/status only; no external IO.
 */

const ACCEPTED_MIMES = Object.freeze([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/json',
  'text/csv',
]);

const INITIAL_STORES = Object.freeze([
  Object.freeze({ id: 'vec-docs', index: 'docs-prod', backend: 'Pinecone', dimension: 1536, size: 182_441, status: 'Ready' }),
  Object.freeze({ id: 'vec-images', index: 'images', backend: 'FAISS', dimension: 1024, size: 39_210, status: 'Building' }),
]);

function safeIso(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function toPositiveInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function normalizeBackend(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateProcessPayload(input) {
  ensureObject(input, 'ValidationError: Vector document payload must be an object.');
  const index = typeof input.index === 'string' ? input.index.trim() : '';
  const filename = typeof input.filename === 'string' ? input.filename.trim() : '';
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
  const sizeBytes = toPositiveInteger(input.sizeBytes, 0);

  if (!index) {
    throw new Error('ValidationError: index is required.');
  }
  if (!filename) {
    throw new Error('ValidationError: filename is required.');
  }
  if (!mimeType) {
    throw new Error('ValidationError: mimeType is required.');
  }

  return { index, filename, mimeType, sizeBytes };
}

function cloneStores(stores) {
  return Object.freeze(
    stores.map((store) =>
      Object.freeze({
        id: store.id,
        index: store.index,
        backend: store.backend,
        dimension: store.dimension,
        size: store.size,
        status: store.status,
      }),
    ),
  );
}

function createOverview(state, backend = null) {
  const backendFilter = normalizeBackend(backend);
  const filteredStores = backendFilter
    ? state.stores.filter((store) => String(store.backend).toLowerCase() === backendFilter.toLowerCase())
    : state.stores;

  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    stores: cloneStores(filteredStores),
    acceptedMimes: ACCEPTED_MIMES,
    updatedAt: safeIso(state.updatedAt),
  });
}

let singletonService = null;

export function createVectorAdminService(options = {}) {
  const {
    timeProvider = () => Date.now(),
    uuidProvider = () => globalThis.crypto?.randomUUID?.() || `vector-${Date.now()}`,
  } = options;

  const state = {
    stores: INITIAL_STORES.map((store) => ({ ...store })),
    updatedAt: timeProvider(),
  };

  return Object.freeze({
    getOverview({ backend } = {}) {
      return createOverview(state, backend);
    },

    getAcceptedMimes() {
      return ACCEPTED_MIMES;
    },

    processDocument(input = {}) {
      const payload = validateProcessPayload(input);
      const store = state.stores.find((item) => item.index === payload.index);
      if (!store) {
        throw new Error(`ValidationError: Unknown vector index '${payload.index}'.`);
      }

      if (!ACCEPTED_MIMES.includes(payload.mimeType)) {
        return Object.freeze({
          success: false,
          reason: `Rejected mimeType '${payload.mimeType}'.`,
          metadata: Object.freeze({
            requestId: uuidProvider(),
            acceptedMimes: ACCEPTED_MIMES,
            index: store.index,
            backend: store.backend,
            filename: payload.filename,
            mimeType: payload.mimeType,
            stored: false,
          }),
        });
      }

      const chunkEstimate = Math.max(1, Math.ceil(Math.max(payload.sizeBytes, 1) / 8_192));
      store.size += chunkEstimate;
      store.status = 'Ready';
      state.updatedAt = timeProvider();

      return Object.freeze({
        success: true,
        reason: 'Document processed in mock mode.',
        metadata: Object.freeze({
          requestId: uuidProvider(),
          index: store.index,
          backend: store.backend,
          filename: payload.filename,
          mimeType: payload.mimeType,
          chunks: chunkEstimate,
          stored: true,
          updatedAt: safeIso(state.updatedAt),
        }),
      });
    },
  });
}

export function getVectorAdminService() {
  if (!singletonService) {
    singletonService = createVectorAdminService();
  }
  return singletonService;
}

export function resetVectorAdminServiceSingleton() {
  singletonService = null;
}
