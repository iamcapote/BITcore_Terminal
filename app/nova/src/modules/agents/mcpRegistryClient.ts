/**
 * Why: Provide typed access to MCP registry endpoints for Nova agent surfaces.
 * What: Lists servers, toggles server status, reconnects servers, and reads server tools.
 * How: Issues credentialed fetch requests, validates minimal response shape, and throws typed errors.
 */

import type { MCPServerRow } from "@/modules/data/mockWorkspace";

interface McpFeature {
  readonly enabled: boolean;
  readonly mode: string;
  readonly wiring: string;
}

interface McpServerSnapshot {
  readonly source: string;
  readonly feature: McpFeature;
  readonly servers: readonly MCPServerRow[];
  readonly updatedAt: string;
}

interface McpServerMutation {
  readonly source: string;
  readonly server: MCPServerRow;
  readonly updatedAt: string;
}

export interface McpOAuthState {
  readonly required: boolean;
  readonly status: "not_required" | "disconnected" | "pending" | "connected";
  readonly hasRefreshToken: boolean;
  readonly state: string | null;
  readonly authorizationUrl: string | null;
  readonly expiresAt: string | null;
  readonly lastConnectedAt: string | null;
  readonly updatedAt: string;
}

interface McpOAuthMutation {
  readonly source: string;
  readonly serverId: string;
  readonly oauth: McpOAuthState;
  readonly updatedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const payload = await response.json();
    if (isObject(payload) && typeof payload.error === "string" && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // noop
  }
  throw new Error(message);
}

function normalizeServer(server: unknown): MCPServerRow | null {
  if (!isObject(server)) {
    return null;
  }
  const id = typeof server.id === "string" ? server.id : "";
  const name = typeof server.name === "string" ? server.name : "";
  const status = server.status === "offline" ? "offline" : "online";
  const endpoints = Array.isArray(server.endpoints)
    ? server.endpoints.filter((value): value is string => typeof value === "string")
    : [];
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    status,
    endpoints,
  };
}

function normalizeFeature(feature: unknown): McpFeature {
  if (!isObject(feature)) {
    return {
      enabled: true,
      mode: "mock",
      wiring: "fallback",
    };
  }
  return {
    enabled: Boolean(feature.enabled),
    mode: typeof feature.mode === "string" ? feature.mode : "mock",
    wiring: typeof feature.wiring === "string" ? feature.wiring : "fallback",
  };
}

function normalizeSnapshot(payload: unknown, fallback: readonly MCPServerRow[]): McpServerSnapshot {
  if (!isObject(payload)) {
    return {
      source: "fallback",
      feature: {
        enabled: true,
        mode: "mock",
        wiring: "fallback",
      },
      servers: fallback,
      updatedAt: new Date().toISOString(),
    };
  }

  const source = typeof payload.source === "string" ? payload.source : "fallback";
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();
  const feature = normalizeFeature(payload.feature);
  const servers = Array.isArray(payload.servers)
    ? payload.servers.map(normalizeServer).filter((item): item is MCPServerRow => item !== null)
    : [...fallback];

  return {
    source,
    feature,
    servers,
    updatedAt,
  };
}

function normalizeMutation(payload: unknown): McpServerMutation {
  if (!isObject(payload)) {
    throw new Error("Invalid MCP server payload.");
  }
  const server = normalizeServer(payload.server);
  if (!server) {
    throw new Error("Invalid MCP server payload.");
  }
  const source = typeof payload.source === "string" ? payload.source : "mock";
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();
  return {
    source,
    server,
    updatedAt,
  };
}

function normalizeOAuthState(oauth: unknown): McpOAuthState {
  if (!isObject(oauth)) {
    return {
      required: false,
      status: "not_required",
      hasRefreshToken: false,
      state: null,
      authorizationUrl: null,
      expiresAt: null,
      lastConnectedAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const status =
    oauth.status === "connected" || oauth.status === "pending" || oauth.status === "disconnected" || oauth.status === "not_required"
      ? oauth.status
      : "not_required";

  return {
    required: Boolean(oauth.required),
    status,
    hasRefreshToken: Boolean(oauth.hasRefreshToken),
    state: typeof oauth.state === "string" ? oauth.state : null,
    authorizationUrl: typeof oauth.authorizationUrl === "string" ? oauth.authorizationUrl : null,
    expiresAt: typeof oauth.expiresAt === "string" ? oauth.expiresAt : null,
    lastConnectedAt: typeof oauth.lastConnectedAt === "string" ? oauth.lastConnectedAt : null,
    updatedAt: typeof oauth.updatedAt === "string" ? oauth.updatedAt : new Date().toISOString(),
  };
}

function normalizeOAuthMutation(payload: unknown): McpOAuthMutation {
  if (!isObject(payload) || typeof payload.serverId !== "string") {
    throw new Error("Invalid MCP OAuth payload.");
  }
  return {
    source: typeof payload.source === "string" ? payload.source : "mock",
    serverId: payload.serverId,
    oauth: normalizeOAuthState(payload.oauth),
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
  };
}

export async function fetchMcpServers(fallback: readonly MCPServerRow[]): Promise<McpServerSnapshot> {
  try {
    const response = await fetch("/api/tools/mcp/servers", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return normalizeSnapshot(null, fallback);
    }
    const payload = await response.json();
    return normalizeSnapshot(payload, fallback);
  } catch {
    return normalizeSnapshot(null, fallback);
  }
}

export async function toggleMcpServer(serverId: string, enabled: boolean): Promise<McpServerMutation> {
  const response = await fetch(`/api/tools/mcp/servers/${encodeURIComponent(serverId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeMutation(payload);
}

export async function reconnectMcpServer(serverId: string): Promise<McpServerMutation> {
  const response = await fetch(`/api/tools/mcp/servers/${encodeURIComponent(serverId)}/reconnect`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeMutation(payload);
}

export async function fetchMcpOAuthState(serverId: string): Promise<McpOAuthMutation> {
  const response = await fetch(`/api/tools/mcp/servers/${encodeURIComponent(serverId)}/oauth`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeOAuthMutation(payload);
}

export async function initiateMcpOAuth(serverId: string): Promise<McpOAuthMutation> {
  const response = await fetch(`/api/tools/mcp/servers/${encodeURIComponent(serverId)}/oauth/initiate`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeOAuthMutation(payload);
}

export async function completeMcpOAuth(serverId: string, code: string, state: string): Promise<McpOAuthMutation> {
  const response = await fetch(`/api/tools/mcp/servers/${encodeURIComponent(serverId)}/oauth/callback`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, state }),
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeOAuthMutation(payload);
}

export async function disconnectMcpOAuth(serverId: string): Promise<McpOAuthMutation> {
  const response = await fetch(`/api/tools/mcp/servers/${encodeURIComponent(serverId)}/oauth`, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeOAuthMutation(payload);
}
