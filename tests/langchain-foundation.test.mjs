/**
 * Contract
 * Why: Ensure the foundational LangChain bridge matches existing LLM behaviour and prompt semantics before deeper migration work.
 * What: Exercises the VeniceChatModel wrapper and research prompt utilities to verify message conversion, defaults, and formatting.
 * How: Mocks the Venice client, feeds LangChain message objects through the bridge, and asserts generated prompts retain legacy structure.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

vi.mock('../app/infrastructure/ai/venice.llm-client.mjs', () => {
  class FakeLLMError extends Error {
    constructor(code, message, originalError) {
      super(message);
      this.code = code;
      this.originalError = originalError;
    }
  }

  class FakeLLMClient {
    constructor(config = {}) {
      this.config = config;
      this.model = config.model ?? 'llama-3.3-70b';
      this.completeChat = vi.fn(async () => ({
        content: 'Assistant reply',
        model: this.model,
        timestamp: '2025-10-17T19:35:00.000Z',
        usage: { promptTokens: 10, completionTokens: 25 }
      }));
    }
  }

  return { LLMClient: FakeLLMClient, LLMError: FakeLLMError };
});

const { VeniceChatModel, VENICE_CHAT_MODEL_DEFAULTS } = await import('../app/infrastructure/ai/langchain/venice-chat-model.mjs');
const { createQueryGenerationPromptTemplate, buildQueryGenerationVariables, RESEARCH_SYSTEM_PROMPT } = await import('../app/infrastructure/ai/langchain/prompts/research.prompts.mjs');

describe('VeniceChatModel', () => {
  let model;

  beforeEach(() => {
    model = new VeniceChatModel({ apiKey: 'test-key', model: 'custom-model' });
  });

  it('exposes LangChain metadata and delegates to LLM client', async () => {
    const messages = [
      new SystemMessage('System guidance'),
      new HumanMessage('Explain quantum tunnelling')
    ];

    const result = await model._generate(messages, {});

    expect(result.generations).toHaveLength(1);
    expect(result.generations[0].message.content).toBe('Assistant reply');
    expect(result.llmOutput.model).toBe('custom-model');

    const client = model.client;
    expect(client.completeChat).toHaveBeenCalledTimes(1);
    expect(client.completeChat.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        temperature: VENICE_CHAT_MODEL_DEFAULTS.temperature,
        maxTokens: VENICE_CHAT_MODEL_DEFAULTS.maxTokens
      })
    );
    expect(client.completeChat.mock.calls[0][0].messages).toEqual([
      { role: 'system', content: 'System guidance' },
      { role: 'user', content: 'Explain quantum tunnelling' }
    ]);
  });
});

describe('LangChain research prompt templates', () => {
  it('formats query generation prompts with learnings preserved', async () => {
    const template = createQueryGenerationPromptTemplate();
    const variables = buildQueryGenerationVariables({
      query: 'AI privacy impacts',
      learnings: ['Learning 1', 'Learning 2']
    });

    const messages = await template.formatMessages({
      topic: variables.topic,
      learningsSection: variables.learningsSection
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain('adaptive research engine assistant');
    expect(messages[1].content).toContain('Learning 1');
    expect(messages[1].content).toContain('Learning 2');
    expect(messages[1].content).toContain('variable A compare to variable B');
    expect(messages[1].content).not.toContain('{system/process}');
    expect(RESEARCH_SYSTEM_PROMPT).toContain('adaptive research engine assistant');
  });

  it('omits learnings block when none provided', () => {
    const variables = buildQueryGenerationVariables({ query: 'Edge computing' });
    expect(variables.learningsSection).toBe('');
  });
});
