/**
 * MCP Auth Service
 * Why: Provide a mock-first OAuth lifecycle seam for MCP servers before live provider auth wiring lands.
 * What: Tracks OAuth flow state, token-state recovery, and connect/disconnect transitions per MCP server.
 * How: Maintains bounded in-memory flow/token maps and returns immutable status envelopes shared by CLI and GUI.
 */

function safeIso(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function createNonce(nowProvider) {
  const stamp = nowProvider().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `mcp-${stamp}-${random}`;
}

function normalizeServerId(serverId) {
  const id = typeof serverId === 'string' ? serverId.trim() : '';
  if (!id) {
    throw new Error('ValidationError: serverId is required.');
  }
  return id;
}

function freezeOAuthState(serverId, state) {
  return Object.freeze({
    source: 'mock',
    serverId,
    oauth: Object.freeze({
      required: Boolean(state.required),
      status: state.status,
      hasRefreshToken: Boolean(state.hasRefreshToken),
      state: state.state || null,
      authorizationUrl: state.authorizationUrl || null,
      expiresAt: state.expiresAt ? safeIso(state.expiresAt) : null,
      lastConnectedAt: state.lastConnectedAt ? safeIso(state.lastConnectedAt) : null,
      updatedAt: safeIso(state.updatedAt),
    }),
    updatedAt: safeIso(state.updatedAt),
  });
}

let singletonService = null;

export function createMcpAuthService(options = {}) {
  const {
    timeProvider = () => Date.now(),
    oauthRequiredServerIds = ['mcp-browser'],
    authorizationBaseUrl = 'https://auth.local.bitcore/oauth/authorize',
  } = options;

  const requiredSet = new Set(
    (Array.isArray(oauthRequiredServerIds) ? oauthRequiredServerIds : [])
      .map((value) => String(value).trim())
      .filter(Boolean),
  );

  const flows = new Map();
  const tokens = new Map();

  function snapshotFor(serverId) {
    const id = normalizeServerId(serverId);
    const now = timeProvider();
    const required = requiredSet.has(id);
    if (!required) {
      return freezeOAuthState(id, {
        required: false,
        status: 'not_required',
        hasRefreshToken: false,
        state: null,
        authorizationUrl: null,
        expiresAt: null,
        lastConnectedAt: null,
        updatedAt: now,
      });
    }

    const flow = flows.get(id);
    if (flow && flow.expiresAt <= now) {
      flows.delete(id);
    }

    const activeFlow = flows.get(id);
    if (activeFlow) {
      return freezeOAuthState(id, {
        required: true,
        status: 'pending',
        hasRefreshToken: false,
        state: activeFlow.state,
        authorizationUrl: activeFlow.authorizationUrl,
        expiresAt: activeFlow.expiresAt,
        lastConnectedAt: null,
        updatedAt: activeFlow.updatedAt,
      });
    }

    const token = tokens.get(id);
    if (!token) {
      return freezeOAuthState(id, {
        required: true,
        status: 'disconnected',
        hasRefreshToken: false,
        state: null,
        authorizationUrl: null,
        expiresAt: null,
        lastConnectedAt: null,
        updatedAt: now,
      });
    }

    return freezeOAuthState(id, {
      required: true,
      status: 'connected',
      hasRefreshToken: Boolean(token.refreshToken),
      state: null,
      authorizationUrl: null,
      expiresAt: null,
      lastConnectedAt: token.connectedAt,
      updatedAt: token.updatedAt,
    });
  }

  return Object.freeze({
    getOAuthState(serverId) {
      return snapshotFor(serverId);
    },

    initiateOAuth(serverId) {
      const id = normalizeServerId(serverId);
      if (!requiredSet.has(id)) {
        return snapshotFor(id);
      }

      const now = timeProvider();
      const expiresAt = now + (10 * 60 * 1000);
      const state = createNonce(timeProvider);
      const authorizationUrl = `${authorizationBaseUrl}?server=${encodeURIComponent(id)}&state=${encodeURIComponent(state)}`;

      flows.set(id, {
        state,
        authorizationUrl,
        expiresAt,
        updatedAt: now,
      });

      return snapshotFor(id);
    },

    completeOAuth(serverId, payload = {}) {
      const id = normalizeServerId(serverId);
      if (!requiredSet.has(id)) {
        return snapshotFor(id);
      }

      const code = typeof payload.code === 'string' ? payload.code.trim() : '';
      const state = typeof payload.state === 'string' ? payload.state.trim() : '';
      if (!code || !state) {
        throw new Error('ValidationError: code and state are required.');
      }

      const flow = flows.get(id);
      if (!flow) {
        throw new Error('ValidationError: OAuth flow has not been initiated.');
      }

      const now = timeProvider();
      if (flow.expiresAt <= now) {
        flows.delete(id);
        throw new Error('ValidationError: OAuth flow expired.');
      }
      if (flow.state !== state) {
        throw new Error('ValidationError: OAuth state mismatch.');
      }

      tokens.set(id, {
        accessToken: `access_${code.slice(-6) || 'token'}`,
        refreshToken: `refresh_${state.slice(-6) || 'token'}`,
        connectedAt: now,
        updatedAt: now,
      });
      flows.delete(id);

      return snapshotFor(id);
    },

    disconnectOAuth(serverId) {
      const id = normalizeServerId(serverId);
      flows.delete(id);
      tokens.delete(id);
      return snapshotFor(id);
    },
  });
}

export function getMcpAuthService(options = {}) {
  if (!singletonService) {
    singletonService = createMcpAuthService(options);
  }
  return singletonService;
}

export function resetMcpAuthServiceSingleton() {
  singletonService = null;
}
