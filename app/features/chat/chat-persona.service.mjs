/**
 * Chat Persona Service
 *
 * Contract
 * Inputs:
 *   - storageDir?: override directory for persona state persistence (defaults to BITCORE storage dir)
 *   - identifier?: persona slug or display name depending on the operation
 * Outputs:
 *   - Persona catalog snapshots, default persona record, and persistence metadata
 * Error modes:
 *   - RangeError for unknown personas
 *   - TypeError when persistence payloads are malformed
 * Performance:
 *   - Reads/writes at most once per operation; file cached only via filesystem semantics
 * Side effects:
 *   - Reads and writes `chat-persona.json` under the BITCORE storage directory
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  getPersonaCatalog,
  resolvePersonaRecord,
  normalizePersonaSlug,
  getDefaultPersonaRecord,
} from './chat-persona.schema.mjs';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

function resolveDefaultStorageDir() {
  return process.env.BITCORE_STORAGE_DIR
    || path.join(os.homedir(), '.bitcore-terminal');
}

const PERSONA_FILE_NAME = 'chat-persona.json';

function clonePersona(persona) {
  return { ...persona };
}

function resolvePersonaFile(storageDir) {
  const dir = storageDir ? path.resolve(storageDir) : resolveDefaultStorageDir();
  return path.join(dir, PERSONA_FILE_NAME);
}

async function readPersonaState(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new TypeError('Persona file must contain an object.');
    }
    const slugCandidate = parsed.defaultSlug ?? parsed.slug ?? parsed.persona;
    const defaultSlug = normalizePersonaSlug(slugCandidate ?? getDefaultPersonaRecord().slug);
    const updatedAt = Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : null;
    return { defaultSlug, updatedAt };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const fallback = getDefaultPersonaRecord();
      return { defaultSlug: fallback.slug, updatedAt: null };
    }
    if (error.name === 'SyntaxError' || error instanceof SyntaxError) {
      return { defaultSlug: getDefaultPersonaRecord().slug, updatedAt: null };
    }
    throw error;
  }
}

async function writePersonaState(filePath, state) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('Persona state must be an object.');
  }
  const payload = {
    defaultSlug: normalizePersonaSlug(state.defaultSlug),
    updatedAt: Number.isFinite(state.updatedAt) ? Number(state.updatedAt) : Date.now(),
  };
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
  return payload;
}

export function createChatPersonaService({ storageDir, now = () => Date.now() } = {}) {
  const filePath = resolvePersonaFile(storageDir);

  async function list() {
    return getPersonaCatalog().map(clonePersona);
  }

  async function getDefault() {
    const state = await readPersonaState(filePath);
    const persona = resolvePersonaRecord(state.defaultSlug);
    return {
      persona: clonePersona(persona),
      updatedAt: state.updatedAt,
    };
  }

  async function setDefault(identifier) {
    const persona = resolvePersonaRecord(identifier);
    const updatedState = await writePersonaState(filePath, {
      defaultSlug: persona.slug,
      updatedAt: now(),
    });
    return {
      persona: clonePersona(persona),
      updatedAt: updatedState.updatedAt,
    };
  }

  async function reset() {
    const persona = getDefaultPersonaRecord();
    const updatedState = await writePersonaState(filePath, {
      defaultSlug: persona.slug,
      updatedAt: now(),
    });
    return {
      persona: clonePersona(persona),
      updatedAt: updatedState.updatedAt,
    };
  }

  async function describe(identifier) {
    const persona = resolvePersonaRecord(identifier);
    return clonePersona(persona);
  }

  return {
    list,
    getDefault,
    setDefault,
    reset,
    describe,
  };
}

export default { createChatPersonaService };
