/**
 * Contract
 * Inputs:
 *   - emit(event, payload?): event string plus contextual payload objects.
 *   - broadcast?: function used to publish structured mission events.
 *   - logger?: Console-like for warnings when emission fails.
 * Outputs:
 *   - Mission telemetry messages broadcast via `mission_event` channel.
 * Error modes:
 *   - Never throws; logs warnings when broadcast fails.
 * Performance:
 *   - O(1) per call; payloads are shallow copies capped to key mission fields.
 * Side effects:
 *   - Emits WebSocket broadcasts through OutputManager by default.
 */

import { outputManager } from '../../utils/research.output-manager.mjs';

const noop = () => {};

function sanitizeMission(mission) {
  if (!mission || typeof mission !== 'object') {
    return null;
  }
  return {
    id: mission.id || null,
    name: mission.name || null,
    status: mission.status || null,
    priority: mission.priority ?? 0,
    enable: mission.enable !== false,
    nextRunAt: mission.nextRunAt || null,
    lastRunAt: mission.lastRunAt || null,
    lastFinishedAt: mission.lastFinishedAt || null,
    schedule: mission.schedule ? { ...mission.schedule } : null,
    tags: Array.isArray(mission.tags) ? mission.tags.slice(0, 12) : [],
    lastRunError: mission.lastRunError || null
  };
}

export function createMissionTelemetry(options = {}) {
  const {
    broadcast = outputManager.broadcast,
    logger = console
  } = options;

  if (typeof broadcast !== 'function') {
    logger?.warn?.('[MissionTelemetry] broadcast function missing; telemetry disabled.');
    return noop;
  }

  return function emit(event, payload = {}) {
    try {
      const message = {
        type: 'mission_event',
        event,
        timestamp: new Date().toISOString(),
        data: {
          ...payload,
          mission: sanitizeMission(payload.mission)
        }
      };
      broadcast(message);
    } catch (error) {
      logger?.warn?.(`[MissionTelemetry] Failed to emit ${event}: ${error.message}`);
    }
  };
}

export { sanitizeMission };
