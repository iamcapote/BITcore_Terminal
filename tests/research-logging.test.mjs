/**
 * Why: Verify sensitive research command options are redacted before structured logging.
 * What: Exercises the sanitizeResearchOptionsForLog utility across password, session, user, and WebSocket fields.
 * How: Import the helper, feed it representative option objects, and assert that the returned copy masks sensitive data while preserving safe fields.
 */

import { describe, expect, it } from 'vitest';

const { sanitizeResearchOptionsForLog } = await import('../app/commands/research/logging.mjs');

describe('sanitizeResearchOptionsForLog', () => {
  it('masks passwords and nested user secrets', () => {
    const sanitized = sanitizeResearchOptionsForLog({
      password: 'secret',
      currentUser: {
        username: 'admin',
        role: 'admin',
        passwordHash: 'hash',
        salt: 'salt',
        encryptedApiKeys: 'blob',
        encryptedGitHubToken: 'secret-token'
      }
    });

    expect(sanitized.password).toBe('******');
    expect(sanitized.currentUser.passwordHash).toBe('******');
    expect(sanitized.currentUser.salt).toBe('******');
    expect(sanitized.currentUser.encryptedApiKeys).toBe('{...}');
    expect(sanitized.currentUser.encryptedGitHubToken).toBe('******');
    expect(sanitized.currentUser.username).toBe('admin');
  });

  it('collapses session and websocket references for logging', () => {
    const sanitized = sanitizeResearchOptionsForLog({
      session: { sessionId: 'abc123', username: 'admin' },
      webSocketClient: { fake: true }
    });

    expect(sanitized.session).toContain('sessionId: abc123');
    expect(sanitized.session).toContain('user: admin');
    expect(sanitized.webSocketClient).toBe('[WebSocket Object]');
  });

  it('returns a shallow copy without mutating the original object', () => {
    const original = {
      password: 'secret',
      currentUser: { username: 'admin', passwordHash: 'hash' }
    };

    const sanitized = sanitizeResearchOptionsForLog(original);

    expect(original.password).toBe('secret');
    expect(original.currentUser.passwordHash).toBe('hash');
    expect(sanitized).not.toBe(original);
  });
});
