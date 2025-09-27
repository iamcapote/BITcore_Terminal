import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { executeChat, exitMemory, generateResearchQueries, startResearchFromChat } from '../commands/chat.cli.mjs';
import { output } from '../utils/research.output-manager.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { resetChatPersonaController } from '../features/chat/index.mjs';
let tempDir;
let originalStorageDir;

beforeEach(async () => {
  if (!tempDir) {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'app-chat-tests-'));
  }
  originalStorageDir = process.env.BITCORE_STORAGE_DIR;
  process.env.BITCORE_STORAGE_DIR = tempDir;
  resetChatPersonaController();
});

afterEach(async () => {
  resetChatPersonaController();
  if (originalStorageDir === undefined) {
    delete process.env.BITCORE_STORAGE_DIR;
  } else {
    process.env.BITCORE_STORAGE_DIR = originalStorageDir;
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

vi.mock('../features/auth/user-manager.mjs', () => ({
  userManager: {
    getUserData: vi.fn().mockResolvedValue({ username: 'operator', role: 'admin' }),
    getCurrentUser: vi.fn(() => ({ username: 'operator', role: 'admin' })),
    getApiKey: vi.fn().mockResolvedValue(null)
  }
}));

const baseResearchResult = {
  learnings: ['Learning 1', 'Learning 2'],
  sources: ['Source 1', 'Source 2'],
  summary: 'Summary'
};

vi.mock('../infrastructure/research/research.engine.mjs', () => {
  const ctor = vi.fn().mockImplementation(() => ({
    research: vi.fn().mockResolvedValue({ ...baseResearchResult })
  }));
  return { ResearchEngine: ctor, default: ctor };
});

describe('Chat Command', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(output, 'log');
    errorSpy = vi.spyOn(output, 'error');
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('starts a chat session with default handlers when none are provided', async () => {
    const result = await executeChat({});

    expect(result.success).toBe(true);
    expect(result.session?.isChatActive).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Chat session ready'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('bitcore'));
  });

  it('sends a chat-ready event when used over WebSocket', async () => {
    const send = vi.fn();
    const session = {};
    const result = await executeChat({ session, webSocketClient: { send }, isWebSocket: true });

    expect(result.success).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('"chat-ready"'));
  });

  it('returns structured error information when chat setup fails', async () => {
    const faultyClient = { send: () => { throw new Error('boom'); } };
    const result = await executeChat({ webSocketClient: faultyClient, isWebSocket: true });

    expect(result.success).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send chat-ready message'));
  });

  it('exitMemory reports helpful error when memory mode is not active', async () => {
    const outcome = await exitMemory({});
    expect(outcome.success).toBe(false);
    expect(outcome.error).toBe('Memory mode not enabled');
  });
});

describe('Chat Research helpers', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(output, 'log');
    errorSpy = vi.spyOn(output, 'error');
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('generateResearchQueries returns deterministic queries when no API key is available', async () => {
    const chatHistory = [
      { role: 'user', content: 'Tell me about quantum computing' },
      { role: 'assistant', content: 'Quantum computing uses qubits.' }
    ];

    const queries = await generateResearchQueries(chatHistory);

    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
    queries.forEach(q => expect(typeof q.original).toBe('string'));
  });

  it('generateResearchQueries throws for insufficient chat history', async () => {
    await expect(generateResearchQueries([])).rejects.toThrow(/too short/i);
  });

  it('startResearchFromChat auto-generates queries and runs the engine', async () => {
    const chatHistory = [
      { role: 'user', content: 'Summarize the benefits of serverless architectures.' },
      { role: 'assistant', content: 'Serverless reduces operational overhead.' }
    ];

    const result = await startResearchFromChat({ chatHistory, depth: 2, breadth: 3 });

    expect(result.success).toBe(true);
    expect(ResearchEngine).toHaveBeenCalledTimes(1);
    const engineConfig = ResearchEngine.mock.calls[0][0];
    expect(engineConfig.overrideQueries.length).toBeGreaterThan(0);
    const instance = ResearchEngine.mock.results[0].value;
    expect(instance.research).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ original: expect.any(String) }),
      depth: 2,
      breadth: 3
    }));
  });

  it('startResearchFromChat surfaces engine errors', async () => {
    ResearchEngine.mockImplementationOnce(() => ({
      research: vi.fn().mockRejectedValue(new Error('Research failed'))
    }));

    const chatHistory = [
      { role: 'user', content: 'Explain edge computing basics.' },
      { role: 'assistant', content: 'Edge computing processes data closer to the source.' }
    ];

    const result = await startResearchFromChat({ chatHistory });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Research failed');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Research failed'));
  });

  it('startResearchFromChat rejects empty chat history', async () => {
    const result = await startResearchFromChat({ chatHistory: [] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/chat history is required/i);
  });
});