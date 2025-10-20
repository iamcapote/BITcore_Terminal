/**
 * Why: Provide a LangChain-compatible chat model so existing Venice API integrations can participate in chain and agent pipelines without rewriting the transport.
 * What: Wraps the legacy `LLMClient` with the LangChain `BaseChatModel` contract, normalises LangChain messages into Venice payloads, and surfaces structured usage metadata.
 * How: Guard incoming configuration, adapt message types to Venice roles, invoke `LLMClient.completeChat`, and translate results into LangChain `ChatGeneration` structures.
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { LLMClient, LLMError } from '../venice.llm-client.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1000;

export class VeniceChatModel extends BaseChatModel {
  constructor({
    apiKey,
    client,
    model,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    veniceParameters = {},
    retry,
    logger = createModuleLogger('ai.langchain.venice-chat-model')
  } = {}) {
    super({});

    this.logger = logger;

    // Guard → resolve client configuration up front.
    this.client = client instanceof LLMClient
      ? client
      : new LLMClient({ apiKey, model, retry });

    this.baseModel = model ?? this.client.model;
    this.temperature = Number.isFinite(temperature) ? temperature : DEFAULT_TEMPERATURE;
    this.maxTokens = Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
    this.defaultVeniceParameters = Object.freeze({ ...veniceParameters });
  }

  _llmType() {
    return 'venice-chat-model';
  }

  async _generate(messages, options, runManager) {
    const normalizedMessages = this.#normalizeMessages(messages);
    const resolvedTemperature = this.#resolveTemperature(options);
    const resolvedMaxTokens = this.#resolveMaxTokens(options);
    const veniceParameters = this.#resolveVeniceParameters(options);

    try {
      const result = await this.client.completeChat({
        messages: normalizedMessages,
        temperature: resolvedTemperature,
        maxTokens: resolvedMaxTokens,
        venice_parameters: veniceParameters
      });

      if (runManager?.handleLLMNewToken) {
        await runManager.handleLLMNewToken(result.content ?? '');
      }

      const message = new AIMessage(result.content ?? '', {
        model: result.model ?? this.baseModel,
        usage: result.usage ?? null,
        timestamp: result.timestamp ?? null
      });

      return {
        generations: [
          {
            text: result.content ?? '',
            message
          }
        ],
        llmOutput: {
          model: result.model ?? this.baseModel,
          usage: result.usage ?? null
        }
      };
    } catch (error) {
      this.logger.error('VeniceChatModel call failed.', {
        message: error?.message ?? 'Unknown error',
        code: error?.code ?? null
      });

      if (error instanceof LLMError) {
        throw error;
      }

      throw new LLMError('LangChainBridgeError', 'Unexpected error inside LangChain VeniceChatModel bridge.', error);
    }
  }

  async _call(messages, options, runManager) {
    const generation = await this._generate(messages, options, runManager);
    return generation.generations[0].text;
  }

  #normalizeMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new LLMError('InputError', 'VeniceChatModel requires at least one message.');
    }

    return messages.map((message) => {
      const type = typeof message?._getType === 'function' ? message._getType() : (message?.lc_kwargs?.type ?? message?.type);
      const role = this.#mapMessageTypeToRole(type);
      const content = this.#coerceContent(message?.content);

      if (!role) {
        throw new LLMError('InputError', `Unsupported LangChain message type: ${type}`);
      }

      return Object.freeze({
        role,
        content
      });
    });
  }

  #mapMessageTypeToRole(type) {
    switch (type) {
      case 'system':
        return 'system';
      case 'human':
      case 'function':
      case 'tool':
        return 'user';
      case 'ai':
      case 'assistant':
        return 'assistant';
      default:
        return null;
    }
  }

  #coerceContent(content) {
    if (Array.isArray(content)) {
      return content.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n');
    }

    if (content && typeof content === 'object') {
      if ('text' in content && typeof content.text === 'string') {
        return content.text;
      }
      return JSON.stringify(content);
    }

    return typeof content === 'string' ? content : '';
  }

  #resolveTemperature(options) {
    if (options && Number.isFinite(options.temperature)) {
      return options.temperature;
    }
    return this.temperature;
  }

  #resolveMaxTokens(options) {
    if (options && Number.isInteger(options.maxTokens) && options.maxTokens > 0) {
      return options.maxTokens;
    }
    return this.maxTokens;
  }

  #resolveVeniceParameters(options) {
    if (!options?.veniceParameters) {
      return this.defaultVeniceParameters;
    }

    return { ...this.defaultVeniceParameters, ...options.veniceParameters };
  }
}

export const VENICE_CHAT_MODEL_DEFAULTS = Object.freeze({
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS
});
