/**
 * Contract verification for WebSocket chat memory integration.
 * Ensures memory context retrieval precedes LLM calls and that chat turns are persisted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const safeSendMock = vi.fn();
const resolveServiceApiKeyMock = vi.fn().mockResolvedValue(null);
const recordMessageMock = vi.fn();
const completeChatMock = vi.fn().mockResolvedValue({ content: 'Assistant reply' });
const llmConstructorMock = vi.fn(() => ({ completeChat: completeChatMock }));

vi.mock('ws', () => ({
  WebSocket: class {
    static OPEN = 1;
  },
}));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend: (...args) => safeSendMock(...args),
}));

vi.mock('../app/utils/api-keys.mjs', () => ({
  resolveServiceApiKey: (...args) => resolveServiceApiKeyMock(...args),
}));

vi.mock('../app/features/chat-history/index.mjs', () => ({
  getChatHistoryController: () => ({
    recordMessage: (...args) => recordMessageMock(...args),
  }),
}));

vi.mock('../app/infrastructure/ai/venice.llm-client.mjs', () => ({
  LLMClient: (...args) => llmConstructorMock(...args),
}));

describe.skip('handleChatMessage memory orchestration', () => {
  beforeEach(() => {
    safeSendMock.mockClear();
    resolveServiceApiKeyMock.mockClear();
    recordMessageMock.mockClear();
    completeChatMock.mockClear();
    llmConstructorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves memory context before LLM call and stores both turns', async () => {
    const retrieveRelevantMemories = vi.fn().mockResolvedValue([
      { id: 'm1', content: 'Reminder about deployment checklist', similarity: 0.8 },
    ]);
    const storeMemory = vi.fn().mockResolvedValue();

    const session = {
      sessionId: 'session-42',
      isChatActive: true,
      sessionModel: 'qwen3-235b',
      sessionCharacter: 'bitcore',
      chatHistory: [],
      memoryManager: { retrieveRelevantMemories, storeMemory },
      currentUser: { username: 'tester' },
    };
    const ws = { readyState: 1 };

    let enableInput;
    const { handleChatMessage } = await import('../app/features/research/websocket/chat-handler.mjs');
    enableInput = await handleChatMessage(ws, { message: 'What is pending for deployment?' }, session);

    expect(enableInput).toBe(true);
    expect(retrieveRelevantMemories).toHaveBeenCalledWith('What is pending for deployment?');
    expect(storeMemory).toHaveBeenNthCalledWith(1, 'What is pending for deployment?', 'user');
    expect(storeMemory).toHaveBeenNthCalledWith(2, 'Assistant reply', 'assistant');

    expect(completeChatMock).toHaveBeenCalledTimes(1);
    const [{ messages }] = completeChatMock.mock.calls[0];
    const memoryContextMessage = messages.find((entry) => entry.role === 'system' && entry.content.includes('Relevant memory context'));
    expect(memoryContextMessage).toBeTruthy();

    const safeSendPayloads = safeSendMock.mock.calls.map(([, payload]) => payload);
    expect(safeSendPayloads).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'memory_context' }),
      expect.objectContaining({ type: 'chat-response', message: 'Assistant reply' }),
    ]));
  });

  it('continues gracefully when memory manager is absent', async () => {
    const session = {
      sessionId: 'session-99',
      isChatActive: true,
      sessionModel: 'qwen3-235b',
      sessionCharacter: 'bitcore',
      chatHistory: [],
      currentUser: { username: 'tester' },
    };
    const ws = { readyState: 1 };

    let enableInput;
    const { handleChatMessage } = await import('../app/features/research/websocket/chat-handler.mjs');
    enableInput = await handleChatMessage(ws, { message: 'Give me today\'s status.' }, session);

    expect(enableInput).toBe(true);
    expect(completeChatMock).toHaveBeenCalled();
    expect(safeSendMock).toHaveBeenCalledWith(ws, expect.objectContaining({ type: 'chat-response' }));
  });
});
