/**
 * Chat Feature Entry Point
 *
 * Exposes persona and workbench controller accessors for reuse across CLI, HTTP, and UI flows.
 */

import { createChatPersonaController } from './chat-persona.controller.mjs';
import { createChatWorkbenchController } from './chat-workbench.controller.mjs';

let singletonPersonaController = null;
let singletonWorkbenchController = null;

function buildPersonaController(overrides = {}) {
  return createChatPersonaController(overrides);
}

function buildWorkbenchController(overrides = {}) {
  const personaController = overrides.personaController || getChatPersonaController();
  return createChatWorkbenchController({ ...overrides, personaController });
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

export function getChatWorkbenchController(overrides = {}) {
  if (overrides.forceNew) {
    return buildWorkbenchController(overrides);
  }
  if (!singletonWorkbenchController) {
    singletonWorkbenchController = buildWorkbenchController(overrides);
  }
  return singletonWorkbenchController;
}

export function resetChatWorkbenchController() {
  singletonWorkbenchController = null;
}

export default {
  getChatPersonaController,
  resetChatPersonaController,
  getChatWorkbenchController,
  resetChatWorkbenchController,
};
