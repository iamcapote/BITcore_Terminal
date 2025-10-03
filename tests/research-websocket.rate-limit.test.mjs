/**
 * Contract
 * Why: Ensure the WebSocket research command enforces rate limits per session.
 * What: Mocks dependencies to trigger rapid `/research` calls and asserts the limiter blocks excess attempts and emits user-friendly errors.
 * How: Reuses command handler with fake sockets, stubs command registry to avoid running real research logic, and verifies retry messaging.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wsErrorHelperMock = vi.fn();
const safeSendMock = vi.fn();

vi.mock('../app/utils/research.output-manager.mjs', () => ({
  outputManager: {
    debug: vi.fn(),
  },
}));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend: (...args) => safeSendMock(...args),
}));

vi.mock('../app/features/research/websocket/client-io.mjs', () => ({
  cloneUserRecord: vi.fn((user) => (user ? { ...user } : null)),
  wsErrorHelper: (...args) => wsErrorHelperMock(...args),
  wsOutputHelper: vi.fn(),
}));

vi.mock('../app/features/research/websocket/prompt.mjs', () => ({
  wsPrompt: vi.fn(async () => 'rate limit query'),
}));

vi.mock('../app/features/auth/user-manager.mjs', () => ({
  userManager: {
    getCurrentUser: vi.fn(() => ({ username: 'operator', role: 'admin' })),
  },
}));

const commandMock = vi.fn(async () => ({ success: true }));

vi.mock('../app/commands/index.mjs', () => ({
  commands: {
    research: (...args) => commandMock(...args),
  },
  parseCommandArgs: (input) => ({
    commandName: input.trim().split(/\s+/)[0].replace('/', ''),
    positionalArgs: [],
    flags: {},
  }),
}));

const { handleCommandMessage } = await import('../app/features/research/websocket/command-handler.mjs');

function createSession() {
  return {
    sessionId: 'session-rl-1',
    currentUser: { username: 'operator', role: 'admin' },
    isChatActive: false,
    researchTelemetry: null,
  };
}

function createSocket() {
  return { readyState: 1, sent: [] };
}

describe('research command rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    commandMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows limited research commands then blocks with retry message', async () => {
    const ws = createSocket();
    const session = createSession();
    const message = { command: 'research', args: [], password: null };

    for (let i = 0; i < 3; i += 1) {
      const result = await handleCommandMessage(ws, message, session);
      expect(result).toBe(true);
    }

    wsErrorHelperMock.mockClear();
    commandMock.mockClear();

    const blocked = await handleCommandMessage(ws, message, session);
    expect(blocked).toBe(false);
    expect(commandMock).not.toHaveBeenCalled();
    expect(wsErrorHelperMock).toHaveBeenCalledWith(ws, expect.stringMatching(/too many research requests/i), true);

    vi.advanceTimersByTime(1000);
    wsErrorHelperMock.mockClear();
    commandMock.mockClear();

    const afterReset = await handleCommandMessage(ws, message, session);
    expect(afterReset).toBe(true);
    expect(commandMock).toHaveBeenCalled();
  });
});
