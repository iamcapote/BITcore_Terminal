import { beforeEach, describe, expect, it } from 'vitest';
import { executeMcp, getMcpHelpText } from '../app/commands/mcp.cli.mjs';
import { resetMcpController } from '../app/features/tools/index.mjs';
import { resetToolRegistryServiceSingleton } from '../app/infrastructure/tool-registry.service.mjs';
import { resetMcpAuthServiceSingleton } from '../app/infrastructure/mcp-auth.service.mjs';

beforeEach(() => {
  resetMcpController();
  resetToolRegistryServiceSingleton();
  resetMcpAuthServiceSingleton();
});

describe('mcp cli command', () => {
  it('exposes help text', () => {
    const help = getMcpHelpText();
    expect(help).toContain('/mcp status');
    expect(help).toContain('/mcp reconnect');
  });

  it('returns status snapshot by default', async () => {
    const result = await executeMcp({ flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.snapshot.feature.mode).toBe('mock');
  });

  it('toggles one server', async () => {
    const result = await executeMcp({
      action: 'toggle',
      positionalArgs: ['mcp-fs'],
      flags: { enabled: false },
    });
    expect(result.success).toBe(true);
    expect(result.payload.server.status).toBe('offline');
  });

  it('validates missing server id for tools', async () => {
    const result = await executeMcp({ action: 'tools', positionalArgs: [] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ValidationError');
  });

  it('runs oauth lifecycle for browser server', async () => {
    const initiate = await executeMcp({
      action: 'oauth-initiate',
      positionalArgs: ['mcp-browser'],
      flags: { json: true },
    });
    expect(initiate.success).toBe(true);
    expect(initiate.payload.oauth.status).toBe('pending');

    const complete = await executeMcp({
      action: 'oauth-complete',
      positionalArgs: ['mcp-browser'],
      flags: { code: 'mock-code', state: initiate.payload.oauth.state },
    });
    expect(complete.success).toBe(true);
    expect(complete.payload.oauth.status).toBe('connected');

    const disconnect = await executeMcp({
      action: 'oauth-disconnect',
      positionalArgs: ['mcp-browser'],
    });
    expect(disconnect.success).toBe(true);
    expect(disconnect.payload.oauth.status).toBe('disconnected');
  });
});
