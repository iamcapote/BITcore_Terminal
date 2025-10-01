/**
 * Contract
 * Why: Maintain authoritative lookup tables for research WebSocket sessions and telemetry channels.
 * What: Stores session metadata keyed by id and socket references, plus per-user telemetry channels; exposes helpers for mutation and inspection.
 * How: Encapsulates Maps/WeakMaps with small CRUD utilities so connection handlers can coordinate lifecycle events without duplicating bookkeeping.
 */

const activeChatSessions = new Map();
const wsSessionMap = new WeakMap();
const telemetryRegistry = new Map();

export function registerSession(sessionId, sessionData, ws) {
  activeChatSessions.set(sessionId, sessionData);
  if (ws) {
    wsSessionMap.set(ws, sessionId);
  }
}

export function getSessionById(sessionId) {
  return activeChatSessions.get(sessionId) ?? null;
}

export function hasSession(sessionId) {
  return activeChatSessions.has(sessionId);
}

export function getSessionIdBySocket(ws) {
  return wsSessionMap.get(ws) ?? null;
}

export function unregisterSession(sessionId) {
  const session = activeChatSessions.get(sessionId) ?? null;
  if (session) {
    activeChatSessions.delete(sessionId);
    const { webSocketClient } = session;
    if (webSocketClient) {
      wsSessionMap.delete(webSocketClient);
    }
  }
  return session;
}

export function unregisterSessionBySocket(ws) {
  const sessionId = wsSessionMap.get(ws);
  if (!sessionId) {
    return null;
  }
  wsSessionMap.delete(ws);
  const session = activeChatSessions.get(sessionId) ?? null;
  if (session) {
    activeChatSessions.delete(sessionId);
  }
  return session;
}

export function forEachSession(callback) {
  activeChatSessions.forEach(callback);
}

export function sessionCount() {
  return activeChatSessions.size;
}

export function getTelemetryChannel(key) {
  return telemetryRegistry.get(key) ?? null;
}

export function setTelemetryChannel(key, channel) {
  telemetryRegistry.set(key, channel);
}

export function deleteTelemetryChannel(key) {
  telemetryRegistry.delete(key);
}

export { activeChatSessions, wsSessionMap, telemetryRegistry };
