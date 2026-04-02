/**
 * Why: Coordinate chat workbench bootstrap retrieval for HTTP and CLI entrypoints.
 * What: Exposes a minimal controller contract that can remain stable while implementation evolves from mock to live sources.
 * How: Wrap service methods and return immutable snapshots directly to callers.
 */

import { createChatWorkbenchService } from './chat-workbench.service.mjs';

export function createChatWorkbenchController({ service, personaController } = {}) {
  const workbenchService = service || createChatWorkbenchService({ personaController });

  if (!workbenchService || typeof workbenchService.listBootstrap !== 'function') {
    throw new TypeError('createChatWorkbenchController requires a valid chat workbench service.');
  }

  async function getBootstrap() {
    return workbenchService.listBootstrap();
  }

  return Object.freeze({
    getBootstrap,
  });
}

export default { createChatWorkbenchController };
