/**
 * MissionService orchestrates mission persistence, scheduling metadata, and
 * lifecycle updates. It does not execute missions itself; instead it provides
 * the primitives that schedulers, CLIs, and HTTP handlers can call.
 *
 * Contract
 * Inputs:
 *   - Mission drafts produced by controllers/CLI commands.
 *   - Mission update patches (partial objects) and lifecycle events
 *     (recordRunStart, recordRunResult).
 * Outputs:
 *   - Frozen mission objects persisted via MissionRepository.
 * Error modes:
 *   - Throws when missions are missing, validation fails, or persistence
 *     encounters unrecoverable errors.
 * Performance:
 *   - Mission counts expected <1k; repository writes rewrite the entire file.
 * Side effects:
 *   - Delegates persistence to MissionRepository (disk writes under `.data/missions`).
 */

import { CronExpressionParser } from 'cron-parser';
import { MissionRepository } from './mission.repository.mjs';
import {
  MISSION_STATUSES,
  SCHEDULE_TYPES,
  applyMissionPatch,
  createMissionEntity,
  freezeMission
} from './mission.schema.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class MissionService {
  constructor({ repository, clock = () => Date.now(), logger } = {}) {
    this.repository = repository || new MissionRepository({ logger });
    this.clock = clock;
    this.logger = logger || noopLogger;
  }

  async listMissions(filter = {}) {
    const missions = await this.repository.listMissions();
    if (!filter || Object.keys(filter).length === 0) {
      return missions;
    }

    const statuses = this.#normalizeStatusFilter(filter.status);
    const tag = filter.tag ? String(filter.tag).trim().toLowerCase() : null;
    const includeDisabled = filter.includeDisabled === true;

    return missions.filter(mission => {
      if (!includeDisabled && mission.status === MISSION_STATUSES.DISABLED) {
        return false;
      }
      if (statuses && !statuses.has(mission.status)) {
        return false;
      }
      if (tag && !mission.tags.includes(tag)) {
        return false;
      }
      return true;
    });
  }

  async getMissionById(id) {
    return this.repository.getMission(id);
  }

  async createMission(draft, options = {}) {
    const now = this.clock();
    let mission = createMissionEntity(draft, { id: options.id, now });
    mission = this.#withNextRun(mission, { baseline: now });
    await this.repository.upsertMission(mission);
    return mission;
  }

  async updateMission(id, patch = {}) {
    const existing = await this.#requireMission(id);
    const now = this.clock();
    let mission = applyMissionPatch(existing, patch, { now });
    const shouldRecalc =
      patch.schedule !== undefined ||
      patch.enable !== undefined ||
      patch.status !== undefined ||
      patch.nextRunAt !== undefined ||
      patch.lastRunAt !== undefined ||
      patch.lastFinishedAt !== undefined;

    if (shouldRecalc) {
      mission = this.#withNextRun(mission, { baseline: patch.lastRunAt ?? now, preserveWhenDisabled: true });
    }
    await this.repository.upsertMission(mission);
    return mission;
  }

  async deleteMission(id) {
    const removed = await this.repository.removeMission(id);
    if (!removed) {
      throw new Error(`Mission '${id}' not found`);
    }
    return removed;
  }

  async recordRunStart(id, startedAt = this.clock()) {
    const mission = await this.#requireMission(id);
    const isoStarted = new Date(startedAt).toISOString();
    const updated = applyMissionPatch(mission, {
      status: MISSION_STATUSES.RUNNING,
      lastRunAt: isoStarted,
      lastRunError: null
    }, { now: startedAt });
    await this.repository.upsertMission(updated);
    return updated;
  }

  async recordRunResult(id, { finishedAt = this.clock(), success = true, error } = {}) {
    const mission = await this.#requireMission(id);
    const isoFinished = new Date(finishedAt).toISOString();
    const status = success
      ? (mission.enable ? MISSION_STATUSES.IDLE : MISSION_STATUSES.DISABLED)
      : MISSION_STATUSES.FAILED;
    const patch = {
      status,
      lastFinishedAt: isoFinished,
      lastRunError: success ? null : this.#stringifyError(error)
    };
    let updated = applyMissionPatch(mission, patch, { now: finishedAt });
    if (success) {
      updated = this.#withNextRun(updated, { baseline: finishedAt });
    } else {
      updated = freezeMission({ ...updated, nextRunAt: null });
    }
    await this.repository.upsertMission(updated);
    return updated;
  }

  #normalizeStatusFilter(input) {
    if (!input) return null;
    const values = Array.isArray(input) ? input : [input];
    const set = new Set();
    for (const value of values) {
      if (!value) continue;
      const normalized = String(value).trim().toLowerCase();
      for (const entry of Object.values(MISSION_STATUSES)) {
        if (entry === normalized) {
          set.add(entry);
        }
      }
    }
    return set.size ? set : null;
  }

  #withNextRun(mission, { baseline, preserveWhenDisabled = false } = {}) {
    if (!mission.schedule) {
      return mission;
    }
    if (!mission.enable || mission.status === MISSION_STATUSES.DISABLED) {
      if (preserveWhenDisabled) {
        return mission;
      }
      return freezeMission({ ...mission, nextRunAt: null });
    }
    const baseDate = baseline ? new Date(baseline) : new Date(this.clock());
    const computed = this.#computeNextRun(mission.schedule, baseDate);
    return freezeMission({ ...mission, nextRunAt: computed });
  }

  #computeNextRun(schedule, baseDate) {
    if (!schedule) return null;
    if (schedule.type === SCHEDULE_TYPES.INTERVAL) {
      const intervalMinutes = Number(schedule.intervalMinutes);
      if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
        return null;
      }
      const next = new Date(baseDate.getTime() + intervalMinutes * 60_000);
      return next.toISOString();
    }
    if (schedule.type === SCHEDULE_TYPES.CRON) {
      try {
        const expression = CronExpressionParser.parse(schedule.cron, {
          currentDate: baseDate,
          tz: schedule.timezone || 'UTC'
        });
        const next = expression.next();
        return typeof next.toISOString === 'function'
          ? next.toISOString()
          : next.toDate().toISOString();
      } catch (error) {
        this.logger.warn?.(`[MissionService] Failed to compute cron next run: ${error.message}`);
        return null;
      }
    }
    return null;
  }

  #stringifyError(error) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) {
      return error.message;
    }
    return JSON.stringify(error);
  }

  async #requireMission(id) {
    const mission = await this.repository.getMission(id);
    if (!mission) {
      throw new Error(`Mission '${id}' not found`);
    }
    return mission;
  }
}
