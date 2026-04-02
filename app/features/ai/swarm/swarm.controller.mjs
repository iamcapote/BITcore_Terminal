/**
 * Swarm Controller
 * Why: Protect and normalize the HTTP/CLI contract for swarm operations.
 * What: Delegates to the infrastructure swarm service for overview, capabilities, and mock delegation.
 * How: Validates inbound payloads and keeps response shapes consistent for both surfaces.
 */

import { getAgentSwarmService } from '../../../infrastructure/ai/agent-swarm.service.mjs';
import { getWorkflowCheckpointService } from '../../../infrastructure/workflow-checkpoint.service.mjs';

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

let singletonController = null;

export function createSwarmController(options = {}) {
  const {
    service = getAgentSwarmService(),
    checkpointService = getWorkflowCheckpointService(),
  } = options;

  return Object.freeze({
    async getOverview() {
      return service.getOverview();
    },

    async getRuns() {
      return service.getRuns();
    },

    async getClarification() {
      return service.getClarification();
    },

    async getGraph() {
      return service.getGraph();
    },

    async getCapabilities() {
      return service.getCapabilities();
    },

    async patchCapabilities(payload = {}) {
      ensureObject(payload, 'ValidationError: Capability patch payload must be an object.');
      return service.updateCapabilities(payload);
    },

    async patchClarification(payload = {}) {
      ensureObject(payload, 'ValidationError: Clarification patch payload must be an object.');
      return service.updateClarification(payload);
    },

    async respondClarification(payload = {}) {
      ensureObject(payload, 'ValidationError: Clarification response payload must be an object.');
      return service.respondClarification(payload);
    },

    async patchGraph(payload = {}) {
      ensureObject(payload, 'ValidationError: Graph patch payload must be an object.');
      return service.updateGraph(payload);
    },

    async appendGraphMessage(payload = {}) {
      ensureObject(payload, 'ValidationError: Graph message payload must be an object.');
      return service.appendGraphMessage(payload);
    },

    async delegate(payload = {}) {
      ensureObject(payload, 'ValidationError: Delegation payload must be an object.');
      return service.delegate(payload);
    },

    /* ── Checkpoint operations (Pass 12 / Deerflow) ──────────── */

    async listCheckpoints() {
      return checkpointService.listCheckpoints();
    },

    async getCheckpoint(workflowId) {
      const id = typeof workflowId === 'string' ? workflowId.trim() : '';
      if (!id) throw new Error('ValidationError: workflowId is required.');
      const result = checkpointService.getCheckpoint(id);
      if (!result) throw new Error(`NotFound: checkpoint '${id}' does not exist.`);
      return result;
    },

    async saveCheckpoint(workflowId, payload = {}) {
      const id = typeof workflowId === 'string' ? workflowId.trim() : '';
      if (!id) throw new Error('ValidationError: workflowId is required.');
      ensureObject(payload, 'ValidationError: Checkpoint payload must be an object.');
      return checkpointService.saveCheckpoint(id, payload);
    },

    async resumeCheckpoint(workflowId, patch) {
      const id = typeof workflowId === 'string' ? workflowId.trim() : '';
      if (!id) throw new Error('ValidationError: workflowId is required.');
      return checkpointService.resumeCheckpoint(id, patch);
    },

    async abandonCheckpoint(workflowId) {
      const id = typeof workflowId === 'string' ? workflowId.trim() : '';
      if (!id) throw new Error('ValidationError: workflowId is required.');
      return checkpointService.abandonCheckpoint(id);
    },
  });
}

export function getSwarmController(options = {}) {
  if (!singletonController) {
    singletonController = createSwarmController(options);
  }
  return singletonController;
}

export function resetSwarmController() {
  singletonController = null;
}
