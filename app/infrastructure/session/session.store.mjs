/**
 * Why: Provide durable persistence for single-user session state beyond in-memory caches.
 * What: Loads and saves session snapshots (research results, preferences) under the operator storage directory,
 *       exposing helpers to merge snapshots into runtime session objects and update the on-disk cache.
 * How: Maintains an in-memory copy synchronized with an AES-unencrypted JSON file, relying on ensureDir to
 *       guarantee filesystem paths and chaining write operations to avoid race conditions.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('session.store');

const SESSION_STATE_VERSION = 1;

const DEFAULT_STATE = Object.freeze({
  version: SESSION_STATE_VERSION,
  currentResearchResult: null,
  currentResearchFilename: null,
  currentResearchSummary: null,
  currentResearchQuery: null,
  sessionModel: null,
  sessionCharacter: null,
  memoryEnabled: false,
  memoryDepth: null,
  memoryGithubEnabled: false,
  updatedAt: null,
});

const storageRoot = process.env.BITCORE_STORAGE_DIR
  || path.join(os.homedir(), '.bitcore-terminal');
const sessionDir = path.join(storageRoot, 'sessions');
const sessionFile = path.join(sessionDir, 'session.json');

let inMemoryState = { ...DEFAULT_STATE };
let loadPromise = null;
let writeQueue = Promise.resolve();

function sanitizeSnapshot(raw = {}) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE };
  }
  const snapshot = {
    ...DEFAULT_STATE,
    ...raw,
    version: SESSION_STATE_VERSION,
  };
  // Ensure boolean coercion
  snapshot.memoryEnabled = Boolean(snapshot.memoryEnabled);
  snapshot.memoryGithubEnabled = Boolean(snapshot.memoryGithubEnabled);
  // Normalize empty strings to null
  Object.keys(snapshot).forEach((key) => {
    if (snapshot[key] === '') {
      snapshot[key] = null;
    }
  });
  return snapshot;
}

async function readFromDisk() {
  try {
    const payload = await fs.readFile(sessionFile, 'utf8');
    const parsed = JSON.parse(payload);
    return sanitizeSnapshot(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_STATE };
    }
    moduleLogger.warn('Failed to read session snapshot from disk. Using defaults.', {
      message: error.message,
    });
    return { ...DEFAULT_STATE };
  }
}

async function writeToDisk(state) {
  try {
    await ensureDir(sessionDir);
    const payload = JSON.stringify(state, null, 2);
    await fs.writeFile(sessionFile, payload, 'utf8');
  } catch (error) {
    moduleLogger.error('Failed to write session snapshot to disk.', {
      message: error.message,
    });
    throw error;
  }
}

export function getSessionFilePath() {
  return sessionFile;
}

export function getSessionStateSync() {
  return { ...inMemoryState };
}

export async function loadSessionState({ force = false } = {}) {
  if (!loadPromise || force) {
    loadPromise = (async () => {
      const snapshot = await readFromDisk();
      inMemoryState = snapshot;
      return { ...inMemoryState };
    })();
  }
  return loadPromise.then((state) => ({ ...state }));
}

export async function saveSessionState(patch = {}) {
  const nextState = sanitizeSnapshot({
    ...inMemoryState,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  });
  inMemoryState = nextState;
  writeQueue = writeQueue.then(() => writeToDisk(inMemoryState)).catch((error) => {
    moduleLogger.error('Session snapshot write failed.', { message: error?.message });
    throw error;
  });
  await writeQueue;
  return { ...inMemoryState };
}

export async function clearSessionState() {
  inMemoryState = { ...DEFAULT_STATE };
  writeQueue = writeQueue.then(() => writeToDisk(inMemoryState)).catch((error) => {
    moduleLogger.error('Session snapshot clear failed.', { message: error?.message });
    throw error;
  });
  await writeQueue;
  return { ...inMemoryState };
}

export function applySessionStateToRef(sessionRef, state = inMemoryState) {
  if (!sessionRef || typeof sessionRef !== 'object') {
    return sessionRef;
  }
  const snapshot = state || inMemoryState;
  sessionRef.currentResearchResult = snapshot.currentResearchResult;
  sessionRef.currentResearchFilename = snapshot.currentResearchFilename;
  sessionRef.currentResearchSummary = snapshot.currentResearchSummary;
  sessionRef.currentResearchQuery = snapshot.currentResearchQuery;
  sessionRef.sessionModel = snapshot.sessionModel;
  sessionRef.sessionCharacter = snapshot.sessionCharacter;
  sessionRef.memoryEnabled = snapshot.memoryEnabled;
  sessionRef.memoryDepth = snapshot.memoryDepth;
  sessionRef.memoryGithubEnabled = snapshot.memoryGithubEnabled;
  return sessionRef;
}

export function snapshotFromSession(sessionRef = {}) {
  return sanitizeSnapshot({
    ...DEFAULT_STATE,
    currentResearchResult: sessionRef.currentResearchResult ?? null,
    currentResearchFilename: sessionRef.currentResearchFilename ?? null,
    currentResearchSummary: sessionRef.currentResearchSummary ?? null,
    currentResearchQuery: sessionRef.currentResearchQuery ?? null,
    sessionModel: sessionRef.sessionModel ?? null,
    sessionCharacter: sessionRef.sessionCharacter ?? null,
    memoryEnabled: Boolean(sessionRef.memoryEnabled),
    memoryDepth: sessionRef.memoryDepth ?? null,
    memoryGithubEnabled: Boolean(sessionRef.memoryGithubEnabled),
    updatedAt: new Date().toISOString(),
  });
}

export async function persistSessionFromRef(sessionRef, patch = {}) {
  const baseSnapshot = snapshotFromSession(sessionRef);
  const merged = {
    ...baseSnapshot,
    ...patch,
    updatedAt: patch.updatedAt ?? baseSnapshot.updatedAt,
  };
  return saveSessionState(merged);
}

export async function resetSessionPersistenceForTests() {
  inMemoryState = { ...DEFAULT_STATE };
  loadPromise = Promise.resolve({ ...inMemoryState });
  writeQueue = Promise.resolve();
  try {
    await fs.rm(sessionFile, { force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      moduleLogger.warn('Failed to remove session file during test reset.', {
        message: error.message,
      });
    }
  }
}

export { SESSION_STATE_VERSION, DEFAULT_STATE as SESSION_STATE_DEFAULTS };
