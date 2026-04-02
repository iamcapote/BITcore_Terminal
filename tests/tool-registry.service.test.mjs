/**
 * Unit tests for tool-registry.service — server registry and tool validation.
 * Pattern derived from: anything-llm UnTooled.validFuncCall test strategy.
 * Tests: list, getServer NotFound, toggle validation, reconnect, tool listing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createToolRegistryService,
  resetToolRegistryServiceSingleton as resetToolRegistryService,
} from '../app/infrastructure/tool-registry.service.mjs';

beforeEach(() => {
  resetToolRegistryService();
});

describe('listServers', () => {
  it('returns a frozen snapshot with source=mock', () => {
    const svc = createToolRegistryService();
    const snap = svc.listServers();
    expect(snap.source).toBe('mock');
    expect(Array.isArray(snap.servers)).toBe(true);
    expect(snap.servers.length).toBeGreaterThan(0);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('each server has required shape fields', () => {
    const svc = createToolRegistryService();
    const { servers } = svc.listServers();
    for (const server of servers) {
      expect(typeof server.id).toBe('string');
      expect(typeof server.name).toBe('string');
      expect(['online', 'offline']).toContain(server.status);
      expect(typeof server.transport).toBe('string');
      expect(Array.isArray(server.endpoints)).toBe(true);
    }
  });
});

describe('getServer', () => {
  it('returns the server for a valid id', () => {
    const svc = createToolRegistryService();
    const server = svc.getServer('mcp-fs');
    expect(server.id).toBe('mcp-fs');
    expect(Object.isFrozen(server)).toBe(true);
  });

  it('throws ValidationError for empty serverId', () => {
    const svc = createToolRegistryService();
    expect(() => svc.getServer('')).toThrow('ValidationError: serverId is required');
    expect(() => svc.getServer('  ')).toThrow('ValidationError: serverId is required');
  });

  it('throws NotFound for unknown serverId', () => {
    const svc = createToolRegistryService();
    expect(() => svc.getServer('mcp-unknown')).toThrow('NotFound');
  });
});

describe('toggleServer', () => {
  it('toggles a server offline when enabled=false', () => {
    const svc = createToolRegistryService();
    const snap = svc.toggleServer('mcp-fs', false);
    expect(snap.server.status).toBe('offline');
  });

  it('toggles a server online when enabled=true', () => {
    const svc = createToolRegistryService();
    svc.toggleServer('mcp-fs', false);
    const snap = svc.toggleServer('mcp-fs', true);
    expect(snap.server.status).toBe('online');
  });

  it('accepts string "true"/"false" for enabled', () => {
    const svc = createToolRegistryService();
    const off = svc.toggleServer('mcp-fs', 'false');
    expect(off.server.status).toBe('offline');
    const on = svc.toggleServer('mcp-fs', 'true');
    expect(on.server.status).toBe('online');
  });

  it('throws ValidationError for empty serverId', () => {
    const svc = createToolRegistryService();
    expect(() => svc.toggleServer('', true)).toThrow('ValidationError');
  });

  it('throws NotFound for unknown serverId', () => {
    const svc = createToolRegistryService();
    expect(() => svc.toggleServer('mcp-fake', true)).toThrow('NotFound');
  });
});

describe('reconnectServer', () => {
  it('returns a snapshot with server and reconnectedAt', () => {
    const svc = createToolRegistryService();
    const snap = svc.reconnectServer('mcp-fs');
    expect(snap.server.id).toBe('mcp-fs');
    expect(snap.status).toBe('reconnected');
    expect(typeof snap.updatedAt).toBe('string');
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('throws NotFound for unknown server', () => {
    const svc = createToolRegistryService();
    expect(() => svc.reconnectServer('no-such')).toThrow('NotFound');
  });
});

describe('listTools', () => {
  it('returns tools for a known server', () => {
    const svc = createToolRegistryService();
    const snap = svc.listTools('mcp-fs');
    expect(snap.server.id).toBe('mcp-fs');
    expect(Array.isArray(snap.tools)).toBe(true);
    expect(snap.tools.length).toBeGreaterThan(0);
  });

  it('each tool has id and serverId', () => {
    const svc = createToolRegistryService();
    const { tools } = svc.listTools('mcp-fs');
    for (const tool of tools) {
      expect(typeof tool.id).toBe('string');
      expect(tool.serverId).toBe('mcp-fs');
      expect(typeof tool.name).toBe('string');
    }
  });

  it('throws ValidationError for empty serverId', () => {
    const svc = createToolRegistryService();
    expect(() => svc.listTools('')).toThrow('ValidationError');
  });

  it('throws NotFound for unknown serverId', () => {
    const svc = createToolRegistryService();
    expect(() => svc.listTools('mcp-unknown')).toThrow('NotFound');
  });
});
