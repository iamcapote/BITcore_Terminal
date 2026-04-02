/**
 * Computer Runtime Controller
 * Why: Expose a stable machine-runtime contract for CLI and GUI parity.
 * What: Validates request payloads and delegates to the computer runtime infrastructure service.
 * How: Wraps service methods and normalizes validation failures as typed errors.
 */

import { getComputerRuntimeService } from '../../infrastructure/computer-runtime.service.mjs';

let singletonController = null;

export function createComputerController(options = {}) {
  const { service = getComputerRuntimeService() } = options;

  return Object.freeze({
    async getRuntime() {
      return service.getRuntime();
    },

    async patchRuntime(payload = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ValidationError: runtime payload must be an object.');
      }
      return service.updateRuntime(payload);
    },
  });
}

export function getComputerController(options = {}) {
  if (!singletonController) {
    singletonController = createComputerController(options);
  }
  return singletonController;
}

export function resetComputerController() {
  singletonController = null;
}
