/**
 * Chat Persona Schema Utilities
 *
 * Contract
 * Inputs:
 *   - persona identifiers supplied via CLI flags, HTTP payloads, or UI selections. Accepts
 *     Venice character slugs (e.g. "bitcore") or display names (e.g. "Bitcore").
 * Outputs:
 *   - Immutable persona catalog entries { name, slug, description }.
 *   - Normalised persona slugs suitable for Venice character selection.
 * Error modes:
 *   - RangeError when a persona identifier does not correspond to a known character.
 * Performance:
 *   - Pure synchronous lookups over a small in-memory catalog (<10 entries).
 * Side effects:
 *   - None.
 */

import {
  VENICE_CHARACTERS,
  getDefaultChatCharacterSlug,
} from '../../infrastructure/ai/venice.characters.mjs';

function freezeRecord(record) {
  return Object.freeze({
    name: record.name,
    slug: record.slug,
    description: record.description,
  });
}

const RAW_PERSONA_CATALOG = Object.entries(VENICE_CHARACTERS).map(([name, config]) => {
  const slug = String(config.character_slug || name).trim();
  const description = String(config.description || '').trim();
  return freezeRecord({ name, slug, description });
});

const PERSONA_CATALOG = Object.freeze([...RAW_PERSONA_CATALOG]);

const SLUG_TO_PERSONA = new Map(
  PERSONA_CATALOG.map((persona) => [persona.slug.toLowerCase(), persona])
);

const NAME_TO_PERSONA = new Map(
  PERSONA_CATALOG.map((persona) => [persona.name.toLowerCase(), persona])
);

export function getPersonaCatalog() {
  return PERSONA_CATALOG.map((persona) => ({ ...persona }));
}

export function isKnownPersonaSlug(slug) {
  if (typeof slug !== 'string') {
    return false;
  }
  return SLUG_TO_PERSONA.has(slug.trim().toLowerCase());
}

export function normalizePersonaSlug(identifier) {
  if (identifier == null) {
    throw new RangeError('Persona identifier is required.');
  }

  const trimmed = String(identifier).trim();
  if (!trimmed) {
    throw new RangeError('Persona identifier cannot be empty.');
  }

  const normalized = trimmed.toLowerCase();

  if (SLUG_TO_PERSONA.has(normalized)) {
    return SLUG_TO_PERSONA.get(normalized).slug;
  }

  if (NAME_TO_PERSONA.has(normalized)) {
    return NAME_TO_PERSONA.get(normalized).slug;
  }

  throw new RangeError(`Unknown persona "${identifier}". Use /chat persona list to view available options.`);
}

export function resolvePersonaRecord(identifier) {
  const slug = normalizePersonaSlug(identifier);
  const persona = SLUG_TO_PERSONA.get(slug.toLowerCase());
  if (!persona) {
    throw new RangeError(`Unknown persona slug "${identifier}".`);
  }
  return persona;
}

export function getDefaultPersonaRecord() {
  const slug = getDefaultChatCharacterSlug();
  return resolvePersonaRecord(slug);
}

export function ensurePersonaRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new TypeError('Persona record must be an object.');
  }
  if (!record.slug || !isKnownPersonaSlug(record.slug)) {
    throw new RangeError(`Invalid persona slug "${record.slug}".`);
  }
  return resolvePersonaRecord(record.slug);
}

export function validatePersonaUpdateRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('ValidationError: request body must be a JSON object.');
  }

  const allowedKeys = new Set(['slug', 'persona', 'id', 'identifier']);
  const extraKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    throw new TypeError(`ValidationError: unexpected fields: ${extraKeys.join(', ')}`);
  }

  const identifier = payload.slug ?? payload.persona ?? payload.id ?? payload.identifier;
  if (typeof identifier !== 'string' || !identifier.trim()) {
    throw new RangeError('ValidationError: persona slug is required.');
  }

  const normalizedSlug = normalizePersonaSlug(identifier);
  return Object.freeze({ slug: normalizedSlug });
}
