/**
 * Memory feature entrypoint.
 *
 * Exposes helpers to obtain the shared MemoryController instance used by
 * CLI, HTTP routes, and WebSocket commands while ensuring enrichment and
 * services are wired consistently.
 */

import { createMemoryController } from './memory.controller.mjs';
import { createMemoryService } from './memory.service.mjs';
import { createVeniceMemoryEnricher } from './memory.enricher.mjs';
import { createMemoryTelemetry } from './memory.telemetry.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

let singletonController = null;

function buildDefaultController(overrides = {}) {
  const logger = overrides.logger || noopLogger;
  const service = overrides.service || createMemoryService();
  const enricher = overrides.hasOwnProperty('enricher')
    ? overrides.enricher
    : createVeniceMemoryEnricher({ logger });
  const telemetry = overrides.hasOwnProperty('telemetry')
    ? overrides.telemetry
    : createMemoryTelemetry({
        logger,
        broadcast: overrides.outputManager?.broadcast || overrides.broadcast
      });

  return createMemoryController({ service, logger, enricher, telemetry });
}

export function getMemoryController(overrides = {}) {
  if (overrides.forceNew) {
    return buildDefaultController(overrides);
  }

  if (!singletonController) {
    singletonController = buildDefaultController(overrides);
  }

  return singletonController;
}

export function resetMemoryController() {
  if (singletonController) {
    singletonController.reset?.();
  }
  singletonController = null;
}

export { createVeniceMemoryEnricher };
