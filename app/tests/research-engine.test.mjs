import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { ResearchPath } from '../infrastructure/research/research.path.mjs';
import { output } from '../utils/research.output-manager.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { generateSummary, generateQueries } from '../features/ai/research.providers.mjs';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn()
}));

vi.mock('../utils/research.ensure-dir.mjs', () => ({
  ensureDir: vi.fn().mockResolvedValue(true)
}));

vi.mock('../utils/research.output-manager.mjs', () => ({
  output: {
    log: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    commandStart: vi.fn(),
    commandSuccess: vi.fn(),
    commandError: vi.fn()
  }
}));

vi.mock('../infrastructure/ai/venice.llm-client.mjs', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    config: { model: 'mock-model' },
    complete: vi.fn(),
    completeChat: vi.fn()
  }))
}));

vi.mock('../features/ai/research.providers.mjs', () => ({
  generateQueries: vi.fn(),
  generateSummary: vi.fn(),
  generateQueriesLLM: vi.fn().mockResolvedValue([{ original: 'llm query', metadata: null }]),
  generateSummaryLLM: vi.fn().mockResolvedValue('Generated summary'),
  processResults: vi.fn()
}));

vi.mock('../infrastructure/research/research.path.mjs', () => ({
  ResearchPath: vi.fn()
}));

const buildMockPath = (overrides = {}) => ({
  research: vi.fn().mockResolvedValue({
    learnings: ['Learning 1'],
    sources: ['Source 1'],
    followUpQueries: []
  }),
  updateProgress: vi.fn(),
  ...overrides
});

describe('ResearchEngine', () => {
  let pathInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    pathInstance = buildMockPath();
    ResearchPath.mockImplementation(() => pathInstance);
    generateSummary.mockResolvedValue('Test summary');
    generateQueries.mockResolvedValue([{ original: 'fallback query', metadata: null }]);
  });

  it('runs standard research flow when no override queries provided', async () => {
    const engine = new ResearchEngine({
      braveApiKey: 'brave',
      veniceApiKey: 'venice',
      query: { original: 'test query' }
    });

    const result = await engine.research({
      query: { original: 'test query' },
      depth: 2,
      breadth: 2
    });

    expect(ResearchPath).toHaveBeenCalledTimes(1);
    expect(pathInstance.research).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ original: 'test query' }),
      depth: 2,
      breadth: 2
    }));
    expect(result.summary).toBe('Test summary');
  });

  it('processes override queries when supplied', async () => {
    const overrideQueries = [
      { original: 'Override 1' },
      { original: 'Override 2' }
    ];
    const engine = new ResearchEngine({
      overrideQueries,
      query: { original: 'placeholder' }
    });

    await engine.research({
      query: { original: 'placeholder' },
      depth: 1,
      breadth: 1
    });

    expect(pathInstance.research).toHaveBeenCalledTimes(overrideQueries.length);
  });

  it('returns a structured error result when research path throws', async () => {
    ResearchPath.mockImplementation(() => buildMockPath({
      research: vi.fn().mockRejectedValue(new Error('boom'))
    }));

    const engine = new ResearchEngine({ query: { original: 'test' } });
    const result = await engine.research({
      query: { original: 'test' },
      depth: 1,
      breadth: 1
    });

    expect(result.error).toBe('boom');
    expect(result.summary).toContain('Error');
  });

  it('generateQueriesFromChatContext produces fallback queries without a Venice key', async () => {
    const engine = new ResearchEngine({ query: { original: 'topic' } });

    const chatHistory = [
      { role: 'user', content: 'Explain the basics of edge computing.' },
      { role: 'assistant', content: 'Edge computing processes data close to the source.' }
    ];

    const queries = await engine.generateQueriesFromChatContext(chatHistory, [], 2);

    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0]).toHaveProperty('original');
  });
});
