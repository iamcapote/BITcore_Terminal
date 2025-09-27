/**
 * Status controller orchestrates status service calls for HTTP/CLI/WebSocket consumers.
 */

import { StatusService, createStatusService } from './status.service.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class StatusController {
  constructor({ service, logger = noopLogger } = {}) {
    this.service = service instanceof StatusService ? service : (service || createStatusService({ logger }));
    this.logger = logger ?? noopLogger;
  }

  async summary(options = {}) {
    return this.service.getSummary(options);
  }
}

export function createStatusController(overrides = {}) {
  return new StatusController(overrides);
}
