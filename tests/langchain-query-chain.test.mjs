/**
 * Contract
 * Why: Verify the LangChain query generation chain produces normalised outputs and honours injection seams.
 * What: Mocks runnable behaviour to confirm payload wiring, usage extraction, and guard rails for invalid inputs.
 * How: Provides fake chain/model implementations, inspects invocation payloads, and asserts returned envelopes match expectations.
 */

import { describe, expect, it, vi } from 'vitest';
import { AIMessage } from '@langchain/core/messages';

const { runQueryGenerationChain } = await import('../app/infrastructure/ai/langchain/chains/query-generation.chain.mjs');

describe('runQueryGenerationChain', () => {
  it('invokes provided chain with hydrated variables and returns normalised usage', async () => {
    const invoke = vi.fn(async (input) => {
      expect(input.topic).toBe('AI governance');
      expect(input.learningsSection).toContain('Learning A');
      return new AIMessage('Query one\nQuery two', {
        usage: {
          promptTokens: 12,
          completionTokens: 24,
          totalTokens: 36
        },
        model: 'venice-test-model'
      });
    });

    const result = await runQueryGenerationChain({
      query: 'AI governance',
      learnings: ['Learning A'],
      chain: { invoke }
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.content).toContain('Query one');
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 24,
      totalTokens: 36,
      model: 'venice-test-model'
    });
  });

  it('throws for empty queries', async () => {
    await expect(runQueryGenerationChain({ query: ' ' })).rejects.toThrow(/non-empty query/);
  });

  it('requires apiKey when building its own runnable', async () => {
    await expect(runQueryGenerationChain({ query: 'AI safety' })).rejects.toThrow(/apiKey/);
  });
});
