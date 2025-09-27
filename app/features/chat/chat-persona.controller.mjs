/**
 * Chat Persona Controller
 *
 * Coordinates chat persona catalog access and persistence for CLI, HTTP, and WebSocket callers.
 */

import { createChatPersonaService } from './chat-persona.service.mjs';

function sanitizeActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return null;
  }
  const username = actor.username || actor.user || actor.name || null;
  const role = actor.role || null;
  return username || role ? { username, role } : null;
}

export function createChatPersonaController({ service, logger = console, storageDir, now } = {}) {
  const personaService = service || createChatPersonaService({ storageDir, now });

  if (!personaService || typeof personaService.list !== 'function') {
    throw new TypeError('createChatPersonaController requires a chat persona service instance.');
  }

  async function list(options = {}) {
    const [personas, defaults] = await Promise.all([
      personaService.list(),
      options.includeDefault ? personaService.getDefault() : Promise.resolve(null),
    ]);

    if (options.includeDefault && defaults) {
      return {
        personas,
        default: defaults.persona,
        updatedAt: defaults.updatedAt,
      };
    }

    return personas;
  }

  async function describe(identifier) {
    return personaService.describe(identifier);
  }

  async function getDefault() {
    const data = await personaService.getDefault();
    return {
      persona: data.persona,
      updatedAt: data.updatedAt,
    };
  }

  async function setDefault(identifier, context = {}) {
    const actor = sanitizeActor(context.actor);
    const result = await personaService.setDefault(identifier);
    logger.info?.('[ChatPersona] Default persona updated.', {
      slug: result.persona.slug,
      actor,
    });
    return {
      persona: result.persona,
      updatedAt: result.updatedAt,
    };
  }

  async function reset(context = {}) {
    const actor = sanitizeActor(context.actor);
    const result = await personaService.reset();
    logger.info?.('[ChatPersona] Default persona reset.', {
      slug: result.persona.slug,
      actor,
    });
    return {
      persona: result.persona,
      updatedAt: result.updatedAt,
    };
  }

  return {
    list,
    describe,
    getDefault,
    setDefault,
    reset,
  };
}

export default { createChatPersonaController };
