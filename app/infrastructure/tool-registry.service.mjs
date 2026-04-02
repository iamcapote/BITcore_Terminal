/**
 * Tool Registry Service
 * Why: Provide one mock-first MCP registry seam shared by CLI and GUI while live vendor adapters are wired incrementally.
 * What: Exposes immutable server snapshots, server tool listings, status toggles, and reconnect operations.
 * How: Stores bounded in-memory registry state and returns frozen payloads for predictable consumers.
 */

function safeIso(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function freezeServer(server) {
  return Object.freeze({
    id: String(server.id),
    name: String(server.name),
    status: server.status === 'offline' ? 'offline' : 'online',
    transport: String(server.transport || 'stdio'),
    endpoints: Object.freeze([...(Array.isArray(server.endpoints) ? server.endpoints : [])].map((item) => String(item))),
    updatedAt: safeIso(server.updatedAt),
  });
}

function freezeRegistrySnapshot(state) {
  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    servers: Object.freeze(state.servers.map((server) => freezeServer(server))),
    updatedAt: safeIso(state.updatedAt),
  });
}

function parseServerStatus(enabled, fallbackStatus) {
  if (typeof enabled === 'boolean') {
    return enabled ? 'online' : 'offline';
  }
  if (enabled == null) {
    return fallbackStatus;
  }
  const normalized = String(enabled).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'online', 'enabled'].includes(normalized)) {
    return 'online';
  }
  if (['0', 'false', 'no', 'off', 'offline', 'disabled'].includes(normalized)) {
    return 'offline';
  }
  return fallbackStatus;
}

const INITIAL_SERVERS = Object.freeze([
  Object.freeze({
    id: 'mcp-fs',
    name: 'filesystem',
    status: 'online',
    transport: 'stdio',
    endpoints: Object.freeze(['ls', 'readFile', 'writeFile']),
    updatedAt: Date.now(),
  }),
  Object.freeze({
    id: 'mcp-browser',
    name: 'browser',
    status: 'online',
    transport: 'sse',
    endpoints: Object.freeze(['navigate', 'extract', 'screenshot']),
    updatedAt: Date.now(),
  }),
  Object.freeze({
    id: 'mcp-exec',
    name: 'code-exec',
    status: 'offline',
    transport: 'stdio',
    endpoints: Object.freeze(['run', 'kill', 'status']),
    updatedAt: Date.now(),
  }),
]);

let singletonService = null;

export function createToolRegistryService(options = {}) {
  const {
    timeProvider = () => Date.now(),
  } = options;

  const state = {
    servers: INITIAL_SERVERS.map((server) => ({
      id: server.id,
      name: server.name,
      status: server.status,
      transport: server.transport,
      endpoints: [...server.endpoints],
      updatedAt: server.updatedAt,
    })),
    updatedAt: timeProvider(),
  };

  function findServerOrThrow(serverId) {
    const id = typeof serverId === 'string' ? serverId.trim() : '';
    if (!id) {
      throw new Error('ValidationError: serverId is required.');
    }
    const index = state.servers.findIndex((server) => server.id === id);
    if (index < 0) {
      throw new Error(`NotFound: MCP server \"${id}\" does not exist.`);
    }
    return index;
  }

  return Object.freeze({
    listServers() {
      return freezeRegistrySnapshot(state);
    },

    getServer(serverId) {
      const index = findServerOrThrow(serverId);
      return freezeServer(state.servers[index]);
    },

    listTools(serverId) {
      const index = findServerOrThrow(serverId);
      const server = state.servers[index];
      return Object.freeze({
        source: 'mock',
        server: freezeServer(server),
        tools: Object.freeze(server.endpoints.map((endpoint) => Object.freeze({
          id: `${server.id}:${endpoint}`,
          serverId: server.id,
          name: endpoint,
        }))),
        updatedAt: safeIso(state.updatedAt),
      });
    },

    toggleServer(serverId, enabled) {
      const index = findServerOrThrow(serverId);
      const server = state.servers[index];
      const nextStatus = parseServerStatus(enabled, server.status);
      const now = timeProvider();
      state.servers[index] = {
        ...server,
        status: nextStatus,
        updatedAt: now,
      };
      state.updatedAt = now;
      return Object.freeze({
        source: 'mock',
        server: freezeServer(state.servers[index]),
        updatedAt: safeIso(state.updatedAt),
      });
    },

    reconnectServer(serverId) {
      const index = findServerOrThrow(serverId);
      const server = state.servers[index];
      const now = timeProvider();
      state.servers[index] = {
        ...server,
        status: 'online',
        updatedAt: now,
      };
      state.updatedAt = now;
      return Object.freeze({
        source: 'mock',
        server: freezeServer(state.servers[index]),
        status: 'reconnected',
        updatedAt: safeIso(state.updatedAt),
      });
    },
  });
}

export function getToolRegistryService(options = {}) {
  if (!singletonService) {
    singletonService = createToolRegistryService(options);
  }
  return singletonService;
}

export function resetToolRegistryServiceSingleton() {
  singletonService = null;
}
