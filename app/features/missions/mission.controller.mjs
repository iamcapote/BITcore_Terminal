/**
 * MissionController is the boundary for CLI/HTTP adapters. It enforces guard
 * logic and delegates to MissionService for persistence and scheduling
 * calculations.
 *
 * Contract
 * Inputs:
 *   - Requests from CLI/HTTP layers containing mission drafts, patches, or
 *     lifecycle events.
 * Outputs:
 *   - Frozen mission objects as returned by MissionService.
 * Error modes:
 *   - Propagates validation and repository errors surfaced by the service.
 * Performance:
 *   - Thin orchestration; negligible overhead.
 * Side effects:
 *   - None directly. MissionService handles persistence.
 */

import { MissionService } from './mission.service.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class MissionController {
  constructor({ service = new MissionService(), logger = noopLogger } = {}) {
    this.service = service;
    this.logger = logger;
  }

  async list(filter = {}) {
    return this.service.listMissions(filter);
  }

  async get(id) {
    return this.service.getMissionById(id);
  }

  async create(draft, options = {}) {
    const mission = await this.service.createMission(draft, options);
    this.logger.info?.(`[MissionController] Created mission ${mission.id}`);
    return mission;
  }

  async update(id, patch) {
    const mission = await this.service.updateMission(id, patch);
    this.logger.info?.(`[MissionController] Updated mission ${mission.id}`);
    return mission;
  }

  async remove(id) {
    const mission = await this.service.deleteMission(id);
    this.logger.info?.(`[MissionController] Removed mission ${mission.id}`);
    return mission;
  }

  async markRunning(id, startedAt) {
    return this.service.recordRunStart(id, startedAt);
  }

  async markResult(id, result) {
    return this.service.recordRunResult(id, result);
  }
}
