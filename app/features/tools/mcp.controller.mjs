/**
 * MCP Controller
 * Why: Normalize the mock-first MCP registry contract for both HTTP and CLI consumers.
 * What: Validates payloads, maps service errors, and exposes list/toggle/reconnect/tool methods.
 * How: Delegates to the tool-registry service and preserves immutable response envelopes.
 */

import { getToolRegistryService } from '../../infrastructure/tool-registry.service.mjs';
import { getMcpAuthService } from '../../infrastructure/mcp-auth.service.mjs';

let singletonController = null;

function ensureServerId(serverId) {
  const id = typeof serverId === 'string' ? serverId.trim() : '';
  if (!id) {
    throw new Error('ValidationError: serverId is required.');
  }
  return id;
}

export function createMcpController(options = {}) {
  const {
    service = getToolRegistryService(),
    authService = getMcpAuthService(),
  } = options;

  async function ensureServerExists(serverId) {
    const id = ensureServerId(serverId);
    await service.getServer(id);
    return id;
  }

  return Object.freeze({
    async listServers() {
      return service.listServers();
    },

    async listTools(serverId) {
      return service.listTools(ensureServerId(serverId));
    },

    async getOAuthState(serverId) {
      const id = await ensureServerExists(serverId);
      return authService.getOAuthState(id);
    },

    async initiateOAuth(serverId) {
      const id = await ensureServerExists(serverId);
      return authService.initiateOAuth(id);
    },

    async completeOAuth(serverId, payload = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ValidationError: oauth payload must be an object.');
      }
      const id = await ensureServerExists(serverId);
      return authService.completeOAuth(id, payload);
    },

    async disconnectOAuth(serverId) {
      const id = await ensureServerExists(serverId);
      return authService.disconnectOAuth(id);
    },

    async toggleServer(serverId, payload = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ValidationError: toggle payload must be an object.');
      }
      return service.toggleServer(ensureServerId(serverId), payload.enabled);
    },

    async reconnectServer(serverId) {
      const id = await ensureServerExists(serverId);
      const payload = await service.reconnectServer(id);
      const oauth = await authService.getOAuthState(id);
      return Object.freeze({
        ...payload,
        oauth: oauth.oauth,
      });
    },
  });
}

export function getMcpController(options = {}) {
  if (!singletonController) {
    singletonController = createMcpController(options);
  }
  return singletonController;
}

export function resetMcpController() {
  singletonController = null;
}
