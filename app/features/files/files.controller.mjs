/**
 * FilesController
 * Why: Keep route handlers thin while enforcing a stable explorer response contract.
 * What: Adapts query/body payloads into FilesService calls and decorates results with feature metadata.
 * How: Performs minimal normalization, delegates to the service, and returns immutable snapshots.
 */

import { createFilesService } from './files.service.mjs';

let singleton = null;

function createSnapshot(payload) {
  return Object.freeze({
    source: 'live',
    feature: Object.freeze({ enabled: true, mode: 'live', wiring: 'scaffolded' }),
    ...payload,
    updatedAt: new Date().toISOString(),
  });
}

export function createFilesController(options = {}) {
  const service = options.service ?? createFilesService(options);

  return Object.freeze({
    async listDirectory(path = '.') {
      const snapshot = await service.listDirectory(path);
      return createSnapshot(snapshot);
    },

    async getTree(path = '.', options = {}) {
      const snapshot = await service.getTree(path, options);
      return createSnapshot(snapshot);
    },

    async readFile(path, options = {}) {
      const snapshot = await service.readFile(path, options);
      return createSnapshot(snapshot);
    },

    async previewFile(path) {
      const snapshot = await service.previewFile(path);
      return createSnapshot(snapshot);
    },

    async search(query, options = {}) {
      const snapshot = await service.search(query, options);
      return createSnapshot(snapshot);
    },
  });
}

export function getFilesController(options = {}) {
  if (!singleton) {
    singleton = createFilesController(options);
  }
  return singleton;
}

export function resetFilesController() {
  singleton = null;
}
