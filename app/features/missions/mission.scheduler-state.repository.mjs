/**
 * MissionSchedulerStateRepository persists lightweight scheduler metrics to
 * disk so CLI and web surfaces can surface reliable status even after process
 * restarts.
 *
 * Contract
 * Inputs:
 *   - state: SchedulerStateSnapshot { running, intervalMs, destroyed,
 *       activeRuns, lastTickStartedAt, lastTickCompletedAt,
 *       lastTickDurationMs, lastTickError, lastTickEvaluated,
 *       lastTickLaunched, lastPersistedAt?, reason? }.
 * Outputs:
 *   - loadState(): Promise<SchedulerStateSnapshot|null>.
 *   - saveState(state): Promise<void>.
 * Error modes:
 *   - Propagates fs errors; returns null when file missing or malformed.
 * Performance:
 *   - Small JSON payload; writes overwrite entire file.
 * Side effects:
 *   - Reads/writes `${dataDir}/${fileName}`.
 */

import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), '.data', 'missions');
const DEFAULT_FILE_NAME = 'scheduler-state.json';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function normalizeState(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  return Object.freeze({
    running: Boolean(raw.running),
    intervalMs: Number.isFinite(raw.intervalMs) ? raw.intervalMs : null,
    destroyed: Boolean(raw.destroyed),
    activeRuns: Number.isFinite(raw.activeRuns) ? raw.activeRuns : 0,
    lastTickStartedAt: raw.lastTickStartedAt ?? null,
    lastTickCompletedAt: raw.lastTickCompletedAt ?? null,
    lastTickDurationMs: Number.isFinite(raw.lastTickDurationMs) ? raw.lastTickDurationMs : null,
    lastTickError: raw.lastTickError ?? null,
    lastTickEvaluated: Number.isFinite(raw.lastTickEvaluated) ? raw.lastTickEvaluated : 0,
    lastTickLaunched: Number.isFinite(raw.lastTickLaunched) ? raw.lastTickLaunched : 0,
    lastPersistedAt: raw.lastPersistedAt ?? null,
    reason: raw.reason ?? null
  });
}

export class MissionSchedulerStateRepository {
  constructor({ dataDir = DEFAULT_DATA_DIR, fileName = DEFAULT_FILE_NAME, fsModule = fs, logger = noopLogger } = {}) {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.fs = fsModule;
    this.logger = logger;
    this.ensureDir = ensureDir;
  }

  async loadState() {
    try {
      await this.ensureDir(this.dataDir);
      const payload = await this.fs.readFile(this.#filePath, 'utf8');
      if (!payload.trim()) return null;
      const parsed = JSON.parse(payload);
      return normalizeState(parsed);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.debug?.('[MissionSchedulerStateRepository] State file missing; returning null.');
        return null;
      }
      this.logger.warn?.(`[MissionSchedulerStateRepository] Failed to read state: ${error.message}`);
      return null;
    }
  }

  async saveState(state) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('MissionSchedulerStateRepository.saveState expects a state object.');
    }
    await this.ensureDir(this.dataDir);
    const serialized = `${JSON.stringify(state, null, 2)}\n`;
    await this.fs.writeFile(this.#filePath, serialized, 'utf8');
  }

  get #filePath() {
    return path.join(this.dataDir, this.fileName);
  }
}

export { normalizeState as normalizeSchedulerState };
