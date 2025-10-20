/**
 * Contract
 * Why: Ensure `generateQueries` can consume the LangChain query chain when the feature flag or override is active.
 * What: Stubs the chain runner to return deterministic output and verifies parsing, metadata, and fallback behaviour remain intact.
 * How: Mocks module imports, toggles the flag, runs the service function, and inspects emitted queries plus telemetry payloads.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runQueryGenerationChainMock = vi.fn();
const callVeniceLLMMock = vi.fn();
const emitTokenUsageMock = vi.fn();

vi.mock('../app/infrastructure/ai/langchain/chains/query-generation.chain.mjs', () => ({
  runQueryGenerationChain: (...args) => runQueryGenerationChainMock(...args)
}));

vi.mock('../app/features/ai/research.providers.llm.mjs', () => ({
  callVeniceLLM: (...args) => callVeniceLLMMock(...args)
}));

describe('generateQueries with LangChain chain', () => {
  let generateQueries;

  beforeEach(async () => {
    vi.resetModules();
    runQueryGenerationChainMock.mockReset();
    runQueryGenerationChainMock.mockResolvedValue({
      content: 'What is AI governance?\nHow does AI impact regulation?\nWhich bodies oversee AI ethics?',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        model: 'venice-test'
      }
    });
    callVeniceLLMMock.mockReset();
    callVeniceLLMMock.mockResolvedValue({ success: false, error: 'llm disabled', isApiError: true });
    emitTokenUsageMock.mockReset();
    vi.stubEnv('RESEARCH_LANGCHAIN_QUERY_CHAIN', 'true');

    ({ generateQueries } = await import('../app/features/ai/research.providers.service.mjs'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns parsed queries from the chain and emits usage', async () => {
    const telemetry = { emitTokenUsage: emitTokenUsageMock };
    const result = await generateQueries({
      apiKey: 'valid-key',
      query: 'AI governance',
      numQueries: 3,
      learnings: ['Learning A'],
      telemetry
    });

    expect(runQueryGenerationChainMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(3);
    expect(result[0].original).toBe('What is AI governance?');
    expect(result[1].original).toBe('How does AI impact regulation?');
    expect(emitTokenUsageMock).toHaveBeenCalledWith({
      stage: 'generate-queries',
      model: 'venice-test',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      meta: expect.objectContaining({ learningsCount: 1 })
    });
    expect(callVeniceLLMMock).not.toHaveBeenCalled();
  });

  it('falls back to legacy flow when chain returns no content', async () => {
    runQueryGenerationChainMock.mockResolvedValueOnce({ content: '', usage: null });
    const result = await generateQueries({
      apiKey: 'valid-key',
      query: 'AI governance',
      numQueries: 2,
      learnings: [],
      langChainQueryChainOverride: true
    });

    expect(runQueryGenerationChainMock).toHaveBeenCalled();
    expect(callVeniceLLMMock).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('uses legacy flow when override disables LangChain chain', async () => {
    const legacyResponse = {
      success: true,
      data: {
        queries: ['What is legacy?', 'How does legacy work?']
      },
      content: 'What is legacy?\nHow does legacy work?',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
    };
    callVeniceLLMMock.mockResolvedValueOnce(legacyResponse);

    const telemetry = { emitTokenUsage: emitTokenUsageMock };
    const result = await generateQueries({
      apiKey: 'valid-key',
      query: 'Legacy feature flag',
      numQueries: 2,
      learnings: [],
      telemetry,
      langChainQueryChainOverride: false
    });

    expect(runQueryGenerationChainMock).not.toHaveBeenCalled();
    expect(callVeniceLLMMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { original: 'What is legacy?', metadata: { goal: 'Research: What is legacy?' } },
      { original: 'How does legacy work?', metadata: { goal: 'Research: How does legacy work?' } }
    ]);
    expect(emitTokenUsageMock).toHaveBeenCalledWith({
      stage: 'generate-queries',
      model: null,
      promptTokens: 5,
      completionTokens: 10,
      totalTokens: 15,
      meta: expect.objectContaining({ resultSource: 'legacy' })
    });
  });
});
