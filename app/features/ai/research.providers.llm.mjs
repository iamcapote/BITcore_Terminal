/**
 * Why: Isolate Venice LLM client interactions for research providers.
 * What: Exports async wrappers for LLMClient calls and error handling.
 * How: Accepts config, prompt, and type; returns parsed or raw results.
 * Contract: Inputs are config/prompt objects; outputs are result objects. Handles errors and API key checks.
 */

import { LLMClient, LLMError } from '../../infrastructure/ai/venice.llm-client.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('ai.research.providers.llm');

function cloneArg(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null
    };
  }
  if (value == null) {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return String(value);
    }
  }
  return value;
}

function defaultOutput(message, ...rest) {
  if (rest.length === 0) {
    moduleLogger.info(message);
    return;
  }
  moduleLogger.info(message, { args: rest.map(cloneArg) });
}

function defaultError(message, ...rest) {
  if (message instanceof Error && rest.length === 0) {
    moduleLogger.error(message.message, {
      name: message.name,
      stack: message.stack || null
    });
    return;
  }
  if (rest.length === 0) {
    moduleLogger.error(message);
    return;
  }
  moduleLogger.error(message, { args: rest.map(cloneArg) });
}

export async function callVeniceLLM({ apiKey, type, system, prompt, temperature = 0.7, maxTokens = 1000, outputFn = defaultOutput, errorFn = defaultError, character_slug, llmClient = null }) {
  if (!apiKey) {
    errorFn('[callVeniceLLM] Error: API key is missing.');
    return { success: false, error: 'API key is required.', isApiError: true };
  }
  const client = llmClient && typeof llmClient.complete === 'function'
    ? llmClient
    : new LLMClient({ apiKey, outputFn, errorFn });
  try {
    const response = await client.complete({
      system,
      prompt,
      temperature,
      maxTokens,
      type,
      venice_parameters: character_slug ? { character_slug } : {}
    });
    return {
      success: true,
      content: response.content,
      usage: normalizeUsage(response, client)
    };
  } catch (error) {
    const errorMessage = error instanceof LLMError ? `${error.name}: ${error.message}` : error.message;
    return { success: false, error: `LLM API Error: ${errorMessage}`, isApiError: true };
  }
}

function normalizeUsage(response = {}, client) {
  if (!response || typeof response !== 'object') {
    return null;
  }
  const usage = response.usage && typeof response.usage === 'object' ? response.usage : null;
  if (!usage) {
    return null;
  }

  const promptTokens = coerceUsageNumber(usage.prompt_tokens ?? usage.promptTokens);
  const completionTokens = coerceUsageNumber(usage.completion_tokens ?? usage.completionTokens);
  const totalTokensRaw = usage.total_tokens ?? usage.totalTokens ?? addIfNumbers(promptTokens, completionTokens);
  const totalTokens = coerceUsageNumber(totalTokensRaw);
  const model = typeof response.model === 'string' && response.model.trim()
    ? response.model.trim()
    : safeClientModel(client);

  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    model
  };
}

function coerceUsageNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num);
}

function addIfNumbers(a, b) {
  if (typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b)) {
    return a + b;
  }
  return null;
}

function safeClientModel(client) {
  if (!client || typeof client !== 'object') {
    return null;
  }
  const model = client.config?.model || client.model;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
}
