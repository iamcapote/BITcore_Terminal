/**
 * Why: Offer a LangChain-based query generation pipeline that mirrors the legacy Venice prompt flow so we can toggle migrations incrementally.
 * What: Builds a LangChain runnable (prompt → VeniceChatModel), executes it, and returns structured output/usage metadata for downstream parsing.
 * How: Guard inputs, hydrate prompt variables, invoke the chain (with dependency injection seams), and normalise LangChain message payloads into our standard usage envelope.
 */

import { createModuleLogger } from '../../../../utils/logger.mjs';
import { VeniceChatModel } from '../venice-chat-model.mjs';
import {
  createQueryGenerationPromptTemplate,
  buildQueryGenerationVariables
} from '../prompts/research.prompts.mjs';

const moduleLogger = createModuleLogger('ai.langchain.chains.query-generation');

export async function runQueryGenerationChain({
  query,
  learnings = [],
  apiKey,
  temperature = 0.7,
  maxTokens = 500,
  veniceParameters = {},
  promptTemplate = null,
  model = null,
  chain = null,
  signal,
  logger = moduleLogger
} = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new TypeError('runQueryGenerationChain requires a non-empty query string.');
  }

  if (!chain && !(model instanceof VeniceChatModel) && !apiKey) {
    throw new TypeError('runQueryGenerationChain requires an apiKey when no chain or model is provided.');
  }

  const effectivePrompt = promptTemplate ?? createQueryGenerationPromptTemplate();
  const variables = buildQueryGenerationVariables({ query, learnings });
  const runnable = chain ?? createRunnable({
    prompt: effectivePrompt,
    model,
    apiKey,
    temperature,
    maxTokens,
    veniceParameters,
    logger
  });

  const response = await runnable.invoke(
    {
      topic: variables.topic,
      learningsSection: variables.learningsSection
    },
    signal ? { signal } : undefined
  );

  const content = extractContent(response);
  if (!content.trim()) {
    logger.warn('LangChain query generation returned empty content.', {
      topicLength: variables.topic.length,
      learningsCount: Array.isArray(learnings) ? learnings.length : 0
    });
  }

  return Object.freeze({
    content,
    usage: extractUsage(response),
    model: extractModel(response),
    raw: response
  });
}

function createRunnable({ prompt, model, apiKey, temperature, maxTokens, veniceParameters, logger }) {
  const effectiveModel = model instanceof VeniceChatModel
    ? model
    : new VeniceChatModel({
        apiKey,
        temperature,
        maxTokens,
        veniceParameters,
        logger
      });
  return prompt.pipe(effectiveModel);
}

function extractContent(message) {
  if (!message) {
    return '';
  }
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map((entry) => extractContent(entry)).filter(Boolean).join('\n');
  }
  const content = message.content ?? message.text ?? '';
  if (Array.isArray(content)) {
    return content
      .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'string') {
    return content;
  }
  return typeof content === 'object' ? JSON.stringify(content) : '';
}

function extractUsage(message) {
  const source = message?.additional_kwargs?.usage
    || message?.additional_kwargs?.metadata?.usage
    || message?.kwargs?.usage
    || message?.usage
    || null;

  if (!source || typeof source !== 'object') {
    return null;
  }

  const promptTokens = coerceUsageNumber(source.promptTokens ?? source.prompt_tokens);
  const completionTokens = coerceUsageNumber(source.completionTokens ?? source.completion_tokens);
  const totalTokensInput = source.totalTokens ?? source.total_tokens ?? addIfNumbers(promptTokens, completionTokens);
  const totalTokens = coerceUsageNumber(totalTokensInput);

  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    model: extractModel(message)
  };
}

function extractModel(message) {
  const model = message?.additional_kwargs?.model
    || message?.additional_kwargs?.metadata?.model
    || message?.kwargs?.model
    || message?.model
    || null;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
}

function coerceUsageNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num);
}

function addIfNumbers(a, b) {
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return a + b;
  }
  return null;
}
