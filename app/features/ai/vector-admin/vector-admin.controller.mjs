/**
 * Vector Admin Controller
 * Why: Guard and normalize the HTTP/CLI contract for vector admin operations.
 * What: Delegates overview, accepted MIME, and document process calls to the vector admin service.
 * How: Validates request payloads at boundaries and returns stable response shapes.
 */

import { getVectorAdminService } from '../../../infrastructure/ai/vector-admin.service.mjs';

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

let singletonController = null;

export function createVectorAdminController(options = {}) {
  const {
    service = getVectorAdminService(),
  } = options;

  return Object.freeze({
    async getOverview(query = {}) {
      const backend = typeof query.backend === 'string' ? query.backend : undefined;
      return service.getOverview({ backend });
    },

    async getAcceptedMimes() {
      return Object.freeze({ acceptedMimes: service.getAcceptedMimes() });
    },

    async processDocument(payload = {}) {
      ensureObject(payload, 'ValidationError: Process payload must be an object.');
      return service.processDocument(payload);
    },
  });
}

export function getVectorAdminController(options = {}) {
  if (!singletonController) {
    singletonController = createVectorAdminController(options);
  }
  return singletonController;
}

export function resetVectorAdminController() {
  singletonController = null;
}
