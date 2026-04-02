/**
 * Unit tests for mcp-auth.service — OAuth lifecycle state machine.
 * Pattern derived from: LibreChat MCP OAuth route test mock strategy + anything-llm state guard pattern.
 * Tests: not-required servers, initiate, complete (valid/invalid state/expired), disconnect, token state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMcpAuthService,
  resetMcpAuthServiceSingleton,
} from '../app/infrastructure/mcp-auth.service.mjs';

let now = 100_000;
const tick = (ms = 100) => { now += ms; return now; };
const timeProvider = () => now;

beforeEach(() => {
  now = 100_000;
  resetMcpAuthServiceSingleton();
});

function makeService(extra = {}) {
  return createMcpAuthService({
    timeProvider,
    oauthRequiredServerIds: ['mcp-browser'],
    authorizationBaseUrl: 'https://auth.test/oauth/authorize',
    ...extra,
  });
}

describe('getOAuthState — non-required server', () => {
  it('returns not_required status for servers outside the required set', () => {
    const svc = makeService();
    const snap = svc.getOAuthState('mcp-fs');
    expect(snap.oauth.required).toBe(false);
    expect(snap.oauth.status).toBe('not_required');
    expect(Object.isFrozen(snap)).toBe(true);
  });
});

describe('getOAuthState — required server, no flow, no token', () => {
  it('returns disconnected for a required server with no token', () => {
    const svc = makeService();
    const snap = svc.getOAuthState('mcp-browser');
    expect(snap.oauth.required).toBe(true);
    expect(snap.oauth.status).toBe('disconnected');
    expect(snap.oauth.hasRefreshToken).toBe(false);
    expect(snap.oauth.authorizationUrl).toBeNull();
  });
});

describe('initiateOAuth', () => {
  it('creates a pending flow with state and authorizationUrl', () => {
    const svc = makeService();
    const snap = svc.initiateOAuth('mcp-browser');
    expect(snap.oauth.status).toBe('pending');
    expect(typeof snap.oauth.state).toBe('string');
    expect(snap.oauth.state).toMatch(/^mcp-/);
    expect(snap.oauth.authorizationUrl).toContain('https://auth.test/oauth/authorize');
    expect(snap.oauth.authorizationUrl).toContain('server=mcp-browser');
  });

  it('is a no-op (returns not_required) for non-required servers', () => {
    const svc = makeService();
    const snap = svc.initiateOAuth('mcp-exec');
    expect(snap.oauth.status).toBe('not_required');
  });
});

describe('completeOAuth — validation guards', () => {
  it('throws ValidationError when code or state missing', () => {
    const svc = makeService();
    svc.initiateOAuth('mcp-browser');
    expect(() => svc.completeOAuth('mcp-browser', { code: '', state: 'abc' })).toThrow('ValidationError: code and state are required');
    expect(() => svc.completeOAuth('mcp-browser', { code: 'abc', state: '' })).toThrow('ValidationError: code and state are required');
  });

  it('throws ValidationError when no flow has been initiated', () => {
    const svc = makeService();
    expect(() => svc.completeOAuth('mcp-browser', { code: 'mycode', state: 'mystate' })).toThrow('ValidationError: OAuth flow has not been initiated');
  });

  it('throws ValidationError on state mismatch', () => {
    const svc = makeService();
    svc.initiateOAuth('mcp-browser');
    expect(() => svc.completeOAuth('mcp-browser', { code: 'mycode', state: 'wrong-state' })).toThrow('ValidationError: OAuth state mismatch');
  });

  it('throws ValidationError when flow is expired', () => {
    const svc = makeService();
    svc.initiateOAuth('mcp-browser');
    // advance past 10-minute expiry
    tick(10 * 60 * 1000 + 1);
    expect(() => svc.completeOAuth('mcp-browser', { code: 'mycode', state: 'any' })).toThrow('ValidationError: OAuth flow expired');
  });
});

describe('completeOAuth — happy path', () => {
  it('transitions to connected and clears the flow', () => {
    const svc = makeService();
    const initiated = svc.initiateOAuth('mcp-browser');
    const flowState = initiated.oauth.state;
    tick();
    const snap = svc.completeOAuth('mcp-browser', { code: 'authcode123', state: flowState });
    expect(snap.oauth.status).toBe('connected');
    expect(snap.oauth.hasRefreshToken).toBe(true);
    expect(snap.oauth.state).toBeNull();
    expect(snap.oauth.authorizationUrl).toBeNull();
  });

  it('subsequent getOAuthState returns connected', () => {
    const svc = makeService();
    const initiated = svc.initiateOAuth('mcp-browser');
    tick();
    svc.completeOAuth('mcp-browser', { code: 'c', state: initiated.oauth.state });
    const snap = svc.getOAuthState('mcp-browser');
    expect(snap.oauth.status).toBe('connected');
  });
});

describe('disconnectOAuth', () => {
  it('clears token and returns to disconnected', () => {
    const svc = makeService();
    const initiated = svc.initiateOAuth('mcp-browser');
    tick();
    svc.completeOAuth('mcp-browser', { code: 'x', state: initiated.oauth.state });
    tick();
    const snap = svc.disconnectOAuth('mcp-browser');
    expect(snap.oauth.status).toBe('disconnected');
    expect(snap.oauth.hasRefreshToken).toBe(false);
  });
});

describe('ValidationError — bad serverId', () => {
  it('throws on empty serverId for all operations', () => {
    const svc = makeService();
    expect(() => svc.getOAuthState('')).toThrow('ValidationError: serverId is required');
    expect(() => svc.initiateOAuth('')).toThrow('ValidationError: serverId is required');
    expect(() => svc.disconnectOAuth('')).toThrow('ValidationError: serverId is required');
  });
});
