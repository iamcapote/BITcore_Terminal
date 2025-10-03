/**
 * Contract
 * Why: Ensure the `/research` CLI module maintains WebSocket session state and wiring when running interactively.
 * What: Mocks the heavy research dependencies to exercise the happy-path WebSocket flow and assert session fields, socket messages, and return flags.
 * How: Stubs key helpers, injects a fake session/websocket, and verifies `executeResearch` stores markdown, filenames, and trimmed queries while keeping input disabled until post-action.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeSendMock = vi.fn();
const researchCallMock = vi.fn();
const resolveResearchKeysMock = vi.fn();
const enrichResearchQueryMock = vi.fn();
const prepareMemoryContextMock = vi.fn();
const ensureResearchPasswordMock = vi.fn();
const createResearchEmitterMock = vi.fn();

vi.mock('ws', () => ({
  default: class WebSocketMock {
    static OPEN = 1;
  }
}));

vi.mock('../app/utils/cli-error-handler.mjs', () => ({
  logCommandStart: vi.fn(),
}));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend: (...args) => safeSendMock(...args),
}));

vi.mock('../app/utils/research.output-manager.mjs', () => ({
  output: {
    log: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../app/utils/research.prompt.mjs', () => ({
  singlePrompt: vi.fn(),
}));

vi.mock('../app/features/memory/memory.service.mjs', () => ({
  createMemoryService: vi.fn(() => ({})),
}));

vi.mock('../app/features/research/research.defaults.mjs', () => ({
  resolveResearchDefaults: vi.fn(async ({ depth, breadth, isPublic } = {}) => ({
    depth: depth ?? 2,
    breadth: breadth ?? 3,
    isPublic: isPublic ?? false,
  })),
}));

vi.mock('../app/commands/research/memory-context.mjs', () => ({
  prepareMemoryContext: (...args) => prepareMemoryContextMock(...args),
}));

vi.mock('../app/commands/research/keys.mjs', () => {
  class MissingResearchKeysError extends Error {}
  class ResearchKeyResolutionError extends Error {}
  return {
    resolveResearchKeys: (...args) => resolveResearchKeysMock(...args),
    MissingResearchKeysError,
    ResearchKeyResolutionError,
  };
});

vi.mock('../app/commands/research/query-classifier.mjs', () => ({
  enrichResearchQuery: (...args) => enrichResearchQueryMock(...args),
}));

vi.mock('../app/utils/logger.mjs', () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../app/commands/research/emitters.mjs', () => ({
  createResearchEmitter: (...args) => createResearchEmitterMock(...args),
}));

vi.mock('../app/commands/research/passwords.mjs', () => ({
  ensureResearchPassword: (...args) => ensureResearchPasswordMock(...args),
}));

vi.mock('../app/infrastructure/research/research.engine.mjs', () => {
  const ResearchEngine = vi.fn().mockImplementation((config) => {
    ResearchEngine.__lastConfig = config;
    return { research: (...args) => researchCallMock(...args) };
  });
  return { ResearchEngine };
});

import { executeResearch } from '../app/commands/research.cli.mjs';
import { ResearchEngine } from '../app/infrastructure/research/research.engine.mjs';

function createSocket() {
  return { readyState: 1, sent: [] };
}

function attachSafeSendRecorder() {
  safeSendMock.mockImplementation((socket, payload) => {
    if (socket && socket.sent) {
      socket.sent.push(payload);
    }
  });
}

describe('executeResearch – WebSocket session state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attachSafeSendRecorder();

    resolveResearchKeysMock.mockResolvedValue({ braveKey: 'brave-key', veniceKey: 'venice-key' });
    enrichResearchQueryMock.mockResolvedValue({ original: 'fresh topic', metadata: null });
    prepareMemoryContextMock.mockResolvedValue({ overrideQueries: [] });
    ensureResearchPasswordMock.mockResolvedValue({ password: 'cached', result: null });
    createResearchEmitterMock.mockImplementation(({ handler }) => (message) => {
      if (typeof handler === 'function') handler(message);
    });
    researchCallMock.mockResolvedValue({
      success: true,
      markdownContent: '# Findings',
      suggestedFilename: 'fresh-topic.md',
      summary: 'Summary text',
    });
  });

  it('stores query and markdown on the session and keeps input disabled until post-action', async () => {
    const ws = createSocket();
    const telemetry = {
      emitStatus: vi.fn(),
      emitThought: vi.fn(),
      emitProgress: vi.fn(),
      emitComplete: vi.fn(),
      updateSender: vi.fn(),
      clearHistory: vi.fn(),
    };

    const session = {
      sessionId: 'session-web-1',
      currentResearchResult: 'stale',
      currentResearchFilename: 'old.md',
      currentResearchQuery: 'outdated',
      researchTelemetry: telemetry,
    };

    const wsPrompt = vi.fn();

    const result = await executeResearch({
      positionalArgs: ['fresh topic'],
      isWebSocket: true,
      session,
      webSocketClient: ws,
      wsPrompt,
      output: vi.fn(),
      error: vi.fn(),
      currentUser: { username: 'operator', role: 'admin' },
      telemetry,
    });

    expect(resolveResearchKeysMock).toHaveBeenCalledWith(expect.objectContaining({ session }));
    expect(enrichResearchQueryMock).toHaveBeenCalledWith(expect.objectContaining({ query: 'fresh topic' }));
    expect(session.currentResearchQuery).toBe('fresh topic');
    expect(session.currentResearchResult).toBe('# Findings');
    expect(session.currentResearchFilename).toBe('fresh-topic.md');
    expect(result).toEqual(expect.objectContaining({ success: true, keepDisabled: true }));

    expect(ws.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'research_start', keepDisabled: true }),
        expect.objectContaining({ type: 'research_complete', suggestedFilename: 'fresh-topic.md', keepDisabled: true }),
      ]),
    );

    expect(ResearchEngine).toHaveBeenCalled();
    expect(researchCallMock).toHaveBeenCalledWith({
      query: { original: 'fresh topic', metadata: null },
      depth: 2,
      breadth: 3,
    });

    expect(session.currentResearchResult).toBe('# Findings');
    expect(wsPrompt).toHaveBeenCalledWith(
      ws,
      session,
      expect.stringContaining('fresh-topic.md'),
      expect.any(Number),
      false,
      'post_research_action',
    );
  });
});
