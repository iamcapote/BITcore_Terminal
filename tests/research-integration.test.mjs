import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/infrastructure/ai/venice.llm-client.mjs', () => ({
  LLMClient: vi.fn()
}));

vi.mock('../app/features/ai/research.providers.mjs', () => ({
  generateQueries: vi.fn().mockResolvedValue([
    { original: 'LLM query 1', metadata: { goal: 'First' } },
    { original: 'LLM query 2', metadata: { goal: 'Second' } },
    { original: 'LLM query 3', metadata: { goal: 'Third' } }
  ])
}));

vi.mock('../app/infrastructure/research/research.engine.mjs', () => {
  const researchMock = vi.fn();
  const ResearchEngine = vi.fn().mockImplementation(() => ({
    research: researchMock
  }));
  ResearchEngine.__mockResearch = researchMock;
  return { ResearchEngine };
});

vi.mock('../app/features/auth/user-manager.mjs', () => ({
  userManager: {
    getUserData: vi.fn().mockResolvedValue({ username: 'operator', role: 'admin' }),
    getApiKey: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../app/utils/research.output-manager.mjs', () => ({
  output: {
    log: vi.fn(),
    error: vi.fn()
  }
}));

import { generateResearchQueries, startResearchFromChat } from '../app/commands/chat.cli.mjs';
import { ResearchEngine } from '../app/infrastructure/research/research.engine.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { output } from '../app/utils/research.output-manager.mjs';
import { generateQueries } from '../app/features/ai/research.providers.mjs';

const chatHistorySample = [
  { role: 'user', content: 'What is quantum computing?' },
  { role: 'assistant', content: 'Quantum computing uses quantum mechanics to perform calculations.' }
];

describe('Chat-driven research helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates fallback queries when no Venice key is present', async () => {
    const queries = await generateResearchQueries(chatHistorySample, []);

    expect(queries.length).toBe(3);
    expect(queries[0]).toHaveProperty('original');
  });

  it('throws when chat history is missing', async () => {
    await expect(generateResearchQueries([], [])).rejects.toThrow('Chat history too short to generate research queries.');
  });

  it('surfaces LLM failures by falling back to heuristics', async () => {
    generateQueries.mockRejectedValueOnce(new Error('LLM offline'));

    const queries = await generateResearchQueries(chatHistorySample, []);

    expect(queries.length).toBe(3);
    expect(output.error).toHaveBeenCalledWith(expect.stringContaining('LLM offline'));
  });

  it('initializes the research engine with generated queries', async () => {
    const researchResult = { summary: 'mock summary' };
    ResearchEngine.__mockResearch.mockResolvedValue(researchResult);

    const result = await startResearchFromChat(chatHistorySample, []);

    expect(ResearchEngine).toHaveBeenCalled();
    expect(ResearchEngine.__mockResearch).toHaveBeenCalled();
    expect(result).toEqual({ success: true, topic: expect.any(String), results: researchResult });
  });

  it('returns a structured error when research fails', async () => {
    ResearchEngine.__mockResearch.mockRejectedValueOnce(new Error('Engine failure'));

    const result = await startResearchFromChat(chatHistorySample, []);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Engine failure');
    expect(output.error).toHaveBeenCalledWith(expect.stringContaining('Engine failure'));
  });

  it('prefers override queries when provided', async () => {
    const overrideQueries = [{ original: 'Custom query', metadata: { goal: 'Test' } }];

    await startResearchFromChat({
      chatHistory: chatHistorySample,
      overrideQueries
    });

    expect(ResearchEngine).toHaveBeenCalledWith(expect.objectContaining({ overrideQueries }));
  });

  it('hydrates user info from the user manager', async () => {
    await startResearchFromChat(chatHistorySample, []);

    expect(userManager.getUserData).toHaveBeenCalled();
  });
});