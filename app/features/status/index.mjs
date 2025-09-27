/**
 * Status feature entrypoint providing a singleton controller accessor.
 */

import { createStatusController, StatusController } from './status.controller.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

let singletonController = null;

function buildDefaultController(overrides = {}) {
  const logger = overrides.logger || noopLogger;
  const serviceOverrides = overrides.service ? { service: overrides.service } : { logger };
  return createStatusController({ ...serviceOverrides, logger });
}

export function getStatusController(overrides = {}) {
  if (overrides.forceNew) {
    return buildDefaultController(overrides);
  }

  if (!singletonController) {
    singletonController = buildDefaultController(overrides);
  }

  return singletonController;
}

export function resetStatusController() {
  singletonController = null;
}

export { StatusController };
