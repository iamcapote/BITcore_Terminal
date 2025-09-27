/**
 * Chat Feature Entry Point
 *
 * Currently exposes persona controller accessors for reuse across CLI, HTTP, and UI flows.
 */

import { createChatPersonaController } from './chat-persona.controller.mjs';

let singletonPersonaController = null;

function buildPersonaController(overrides = {}) {
  return createChatPersonaController(overrides);
}

export function getChatPersonaController(overrides = {}) {
  if (overrides.forceNew) {
    return buildPersonaController(overrides);
  }
  if (!singletonPersonaController) {
    singletonPersonaController = buildPersonaController(overrides);
  }
  return singletonPersonaController;
}

export function resetChatPersonaController() {
  singletonPersonaController = null;
}

export default {
  getChatPersonaController,
  resetChatPersonaController,
};
