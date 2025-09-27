/**
 * MissionRepository provides file-backed persistence for mission entities.
 *
 * Contract
 * Inputs:
 *   - Mission objects produced by `mission.schema.mjs` helpers.
 *   - Repository options { dataDir?: string, fileName?: string, logger?: ConsoleLike }.
 * Outputs:
 *   - Async CRUD primitives that return frozen mission snapshots.
 * Error modes:
 *   - Propagates fs errors (e.g., permission issues) when reading/writing.
 *   - SyntaxError when the persistence file is malformed JSON.
 * Performance:
 *   - Designed for small/medium mission counts (<1k). Full file rewrite on each mutation.
 * Side effects:
 *   - Writes to `${dataDir}/${fileName}` and creates the directory when missing.
 */

import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import { freezeMission } from './mission.schema.mjs';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), '.data', 'missions');
const DEFAULT_FILE_NAME = 'missions.json';
const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class MissionRepository {
  constructor(options = {}) {
    this.dataDir = options.dataDir || DEFAULT_DATA_DIR;
    this.fileName = options.fileName || DEFAULT_FILE_NAME;
    this.logger = options.logger || noopLogger;
    this.fs = options.fs || fs;
    this.ensureDir = options.ensureDir || ensureDir;

    this.#missions = new Map();
    this.#loaded = false;
    this.#loadingPromise = null;
    this.#writeQueue = Promise.resolve();
  }

  async listMissions() {
    await this.#ensureLoaded();
    return Array.from(this.#missions.values());
  }

  async getMission(id) {
    if (!id) return null;
    await this.#ensureLoaded();
    return this.#missions.get(id) || null;
  }

  async upsertMission(mission) {
    if (!mission || typeof mission !== 'object') {
      throw new TypeError('MissionRepository.upsertMission requires a mission object');
    }
    await this.#ensureLoaded();
    await this.#enqueueWrite(async () => {
      this.#missions.set(mission.id, freezeMission(mission));
      await this.#persist();
    });
    return this.#missions.get(mission.id);
  }

  async removeMission(id) {
    if (!id) {
      throw new TypeError('MissionRepository.removeMission requires an id');
    }
    await this.#ensureLoaded();
    let removed = null;
    await this.#enqueueWrite(async () => {
      const existing = this.#missions.get(id);
      if (!existing) {
        removed = null;
        return;
      }
      removed = existing;
      this.#missions.delete(id);
      await this.#persist();
    });
    return removed;
  }

  async replaceAll(missions) {
    if (!Array.isArray(missions)) {
      throw new TypeError('MissionRepository.replaceAll expects an array of missions');
    }
    await this.#ensureLoaded();
    await this.#enqueueWrite(async () => {
      this.#missions.clear();
      for (const mission of missions) {
        if (!mission?.id) continue;
        this.#missions.set(mission.id, freezeMission(mission));
      }
      await this.#persist();
    });
    return this.listMissions();
  }

  async #ensureLoaded() {
    if (this.#loaded) return;
    if (!this.#loadingPromise) {
      this.#loadingPromise = this.#loadFromDisk().finally(() => {
        this.#loaded = true;
      });
    }
    await this.#loadingPromise;
  }

  async #loadFromDisk() {
    await this.ensureDir(this.dataDir);
    const filePath = this.#filePath;
    try {
      const payload = await this.fs.readFile(filePath, 'utf8');
      if (!payload.trim()) {
        this.logger.debug?.('[MissionRepository] persistence file empty; starting fresh');
        return;
      }
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) {
        throw new SyntaxError('Mission persistence file must contain an array');
      }
      for (const raw of parsed) {
        if (!raw?.id) continue;
        this.#missions.set(raw.id, freezeMission({
          ...raw,
          schedule: raw.schedule ? { ...raw.schedule } : null,
          tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
          payload: raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
            ? { ...raw.payload }
            : {}
        }));
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.debug?.('[MissionRepository] persistence file missing; initializing new store');
        return;
      }
      this.logger.error?.(`[MissionRepository] Failed to read missions: ${error.message}`);
      throw error;
    }
  }

  async #persist() {
    const filePath = this.#filePath;
    const payload = Array.from(this.#missions.values()).map(mission => ({
      ...mission,
      schedule: mission.schedule ? { ...mission.schedule } : null,
      tags: Array.isArray(mission.tags) ? [...mission.tags] : [],
      payload: mission.payload && typeof mission.payload === 'object'
        ? { ...mission.payload }
        : {}
    }));
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    await this.fs.writeFile(filePath, serialized, 'utf8');
  }

  async #enqueueWrite(task) {
    this.#writeQueue = this.#writeQueue.then(() => task()).catch(error => {
      this.logger.error?.(`[MissionRepository] Write failed: ${error.message}`);
      throw error;
    });
    return this.#writeQueue;
  }

  get #filePath() {
    return path.join(this.dataDir, this.fileName);
  }

  #missions;
  #loaded;
  #loadingPromise;
  #writeQueue;
}
