/**
 * Contract
 * Why: Validate research WebSocket command handler prompts for queries and handles prompt edge cases.
 * What: Stubs dependencies to exercise interactive query acquisition and cancellation paths when `/research` is invoked without args.
 * How: Mocks command registry, prompt helper, and IO utilities to assert query propagation, error messaging, and return semantics.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const researchCommandMock = vi.fn(async () => ({ success: true }));
const chatCommandMock = vi.fn(async () => ({ success: true, keepDisabled: false }));
const parseCommandArgsMock = vi.fn((input) => {
  const trimmed = (input || '').trim();
  if (!trimmed) return { commandName: '', positionalArgs: [], flags: {} };
  const parts = trimmed.split(/\s+/);
  const commandPart = parts.shift() || '';
  const commandName = commandPart.replace(/^\//, '').toLowerCase();
  const positionalArgs = parts;
  const flags = {};
  positionalArgs.forEach((value, index) => {
    if (value.startsWith('--')) {
      const flagName = value.slice(2);
      const flagValue = positionalArgs[index + 1] && !positionalArgs[index + 1].startsWith('--')
        ? positionalArgs[index + 1]
        : true;
      flags[flagName] = flagValue;
    }
  });
  return { commandName, positionalArgs, flags };
});

const safeSendMock = vi.fn((socket, payload) => {
  if (socket && typeof socket.sent !== 'undefined') {
    socket.sent.push(payload);
  }
});

const wsPromptMock = vi.fn();
const wsErrorHelperMock = vi.fn();
const wsOutputHelperMock = vi.fn();
const cloneUserRecordMock = vi.fn((user) => (user ? { ...user } : null));

vi.mock('ws', () => ({
  WebSocket: class {
    static OPEN = 1;
  }
}));

vi.mock('../app/commands/index.mjs', () => ({
  commands: {
    research: (...args) => researchCommandMock(...args),
    chat: (...args) => chatCommandMock(...args),
  },
  parseCommandArgs: (...args) => parseCommandArgsMock(...args),
}));

vi.mock('../app/utils/research.output-manager.mjs', () => ({
  outputManager: {
    debug: vi.fn(),
  },
}));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend: (...args) => safeSendMock(...args),
}));

vi.mock('../app/features/auth/user-manager.mjs', () => ({
  userManager: {
    getCurrentUser: vi.fn(() => ({ username: 'test-user', role: 'admin' })),
  },
}));

vi.mock('../app/features/research/websocket/client-io.mjs', () => ({
  cloneUserRecord: (...args) => cloneUserRecordMock(...args),
  wsErrorHelper: (...args) => wsErrorHelperMock(...args),
  wsOutputHelper: (...args) => wsOutputHelperMock(...args),
}));

vi.mock('../app/features/research/websocket/prompt.mjs', () => ({
  wsPrompt: (...args) => wsPromptMock(...args),
}));

const originalCsrfEnv = process.env.RESEARCH_WS_CSRF_REQUIRED;

const { handleCommandMessage } = await import('../app/features/research/websocket/command-handler.mjs');

function createSocket() {
  return {
    readyState: 1,
    sent: [],
  };
}

let sessionCounter = 0;

function createSession(overrides = {}) {
  sessionCounter += 1;
  return {
    sessionId: `session-${sessionCounter}`,
    sessionModel: null,
    sessionCharacter: null,
    currentUser: { username: 'test-user', role: 'admin' },
    isChatActive: false,
    researchTelemetry: null,
    ...overrides,
  };
}

function createCommandMessage(overrides = {}) {
  return {
    command: 'research',
    args: [],
    password: null,
    ...overrides,
  };
}

describe('handleCommandMessage (research command interactive query)', () => {
  beforeEach(() => {
    researchCommandMock.mockResolvedValue({ success: true });
    chatCommandMock.mockReset();
    chatCommandMock.mockResolvedValue({ success: true, keepDisabled: false });
    wsPromptMock.mockReset();
    wsErrorHelperMock.mockReset();
    wsOutputHelperMock.mockReset();
    cloneUserRecordMock.mockClear();
    safeSendMock.mockClear();
    parseCommandArgsMock.mockClear();
    process.env.RESEARCH_WS_CSRF_REQUIRED = originalCsrfEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalCsrfEnv === undefined) {
      delete process.env.RESEARCH_WS_CSRF_REQUIRED;
    } else {
      process.env.RESEARCH_WS_CSRF_REQUIRED = originalCsrfEnv;
    }
  });

  it('prompts for a query when none provided and forwards trimmed response to command', async () => {
    const ws = createSocket();
    const session = createSession();
  const message = createCommandMessage({ args: ['topic'] });

    wsPromptMock.mockResolvedValueOnce('   Investigate AI ethics   ');

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(true);
    expect(wsPromptMock).toHaveBeenCalledTimes(1);
    const [promptSocket, promptSession, promptMessage, timeout, isPassword, context] = wsPromptMock.mock.calls[0];
    expect(promptSocket).toBe(ws);
    expect(promptSession).toBe(session);
    expect(promptMessage).toMatch(/Enter research query/i);
    expect(timeout).toBeUndefined();
    expect(isPassword).toBe(false);
    expect(context).toBe('research_query');

    expect(researchCommandMock).toHaveBeenCalledTimes(1);
    const optionsPassed = researchCommandMock.mock.calls[0][0];
    expect(optionsPassed.query).toBe('Investigate AI ethics');
    expect(optionsPassed.positionalArgs).toEqual(['Investigate AI ethics']);
    expect(wsErrorHelperMock).not.toHaveBeenCalled();
  });

  it('cancels research when prompt returns empty query and notifies client', async () => {
    const ws = createSocket();
    const session = createSession();
    const message = createCommandMessage();

    wsPromptMock.mockResolvedValueOnce('   ');

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(true);
    expect(wsErrorHelperMock).toHaveBeenCalledWith(ws, expect.stringMatching(/cannot be empty/i), true);
    expect(researchCommandMock).not.toHaveBeenCalled();
  });

  it('handles prompt rejection by stopping execution without invoking command', async () => {
    const ws = createSocket();
    const session = createSession();
    const message = createCommandMessage();

    wsPromptMock.mockRejectedValueOnce(new Error('Prompt timed out.'));

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(true);
    expect(researchCommandMock).not.toHaveBeenCalled();
    expect(wsErrorHelperMock).toHaveBeenCalledWith(ws, expect.stringMatching(/prompt timed out/i), true);
  });

  it('rejects commands when CSRF is required and token missing', async () => {
    process.env.RESEARCH_WS_CSRF_REQUIRED = 'true';

    const ws = createSocket();
    const session = createSession();
    session.csrfToken = 'abc123';

    const message = createCommandMessage();

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(false);
    expect(wsErrorHelperMock).toHaveBeenCalledWith(ws, expect.stringMatching(/csrf/i), true);
    expect(researchCommandMock).not.toHaveBeenCalled();
  });

  it('accepts commands when CSRF token matches', async () => {
    process.env.RESEARCH_WS_CSRF_REQUIRED = 'true';

    const ws = createSocket();
    const session = createSession();
    session.csrfToken = 'secure-token';

  const message = createCommandMessage({ args: [], csrfToken: 'secure-token' });
  wsPromptMock.mockResolvedValueOnce('topic query');

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(true);
    expect(researchCommandMock).toHaveBeenCalledTimes(1);
  });
});

describe('handleCommandMessage (chat command single-user flows)', () => {
  beforeEach(() => {
    chatCommandMock.mockReset();
    chatCommandMock.mockImplementation(async (options = {}) => {
      if (options.session) {
        options.session.isChatActive = true;
      }
      return { success: true, keepDisabled: false };
    });
    wsErrorHelperMock.mockReset();
    wsOutputHelperMock.mockReset();
    safeSendMock.mockClear();
    parseCommandArgsMock.mockClear();
    process.env.RESEARCH_WS_CSRF_REQUIRED = originalCsrfEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalCsrfEnv === undefined) {
      delete process.env.RESEARCH_WS_CSRF_REQUIRED;
    } else {
      process.env.RESEARCH_WS_CSRF_REQUIRED = originalCsrfEnv;
    }
  });

  it('starts chat session with default persona and model for Web clients', async () => {
    const ws = createSocket();
    const session = createSession({ sessionModel: null, sessionCharacter: null });
    const message = createCommandMessage({ command: 'chat', args: [] });

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(true);
    expect(chatCommandMock).toHaveBeenCalledTimes(1);
    const optionsPassed = chatCommandMock.mock.calls[0][0];
    expect(optionsPassed.session).toBe(session);
    expect(optionsPassed.isWebSocket).toBe(true);
    expect(optionsPassed.model).toBe('qwen3-235b');
    expect(optionsPassed.character).toBe('bitcore');
    expect(wsOutputHelperMock).toHaveBeenCalledWith(ws, expect.stringContaining('Using default model for chat'));
    expect(wsOutputHelperMock).toHaveBeenCalledWith(ws, expect.stringContaining('Using default character for chat'));
    expect(session.isChatActive).toBe(true);
  });

  it('keeps input disabled when chat handler needs exclusive control', async () => {
    chatCommandMock.mockResolvedValueOnce({ success: true, keepDisabled: true });
    const ws = createSocket();
    const session = createSession();
    const message = createCommandMessage({ command: 'chat', args: [] });

    const result = await handleCommandMessage(ws, message, session);

    expect(result).toBe(false);
    expect(chatCommandMock).toHaveBeenCalledTimes(1);
  });
});
