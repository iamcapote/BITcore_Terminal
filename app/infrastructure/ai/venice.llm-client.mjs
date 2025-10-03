import fetch from 'node-fetch';
import { VENICE_MODELS, isValidModel } from './venice.models.mjs';
import { VENICE_CHARACTERS, getDefaultChatCharacterSlug, getDefaultResearchCharacterSlug, getDefaultTokenClassifierCharacterSlug } from './venice.characters.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const logger = createModuleLogger('venice.llm-client');

export class LLMError extends Error {
  constructor(code, message, originalError) {
    super(message);
    this.code = code;
    this.originalError = originalError;
    this.name = 'LLMError';
  }
}

function isRetryableError(error) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = error.status;
    if (status === 429 || status >= 500) return true;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = error.code;
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT') return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const defaultRetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // milliseconds
  useExponentialBackoff: true,
  maxDelay: 30000, // Maximum delay of 30 seconds
};

const defaultConfig = {
  baseUrl: 'https://api.venice.ai/api/v1',
  timeout: 30000, // Default request timeout: 30 seconds
  retry: defaultRetryConfig,
};

export class LLMClient {
  constructor(config = {}) {
    // Use API key from config first, then environment variable
    const apiKey = config.apiKey || process.env.VENICE_API_KEY;
    if (!apiKey) {
      // Throw specific error if key is missing
      throw new LLMError(
        'ConfigError',
        'API key is required. Provide it in LLMClient config or set VENICE_API_KEY environment variable.',
      );
    }

    // Use model from config first, then environment variable, then default
    // UPDATED DEFAULT MODEL
    const model = config.model || process.env.VENICE_MODEL || 'llama-3.3-70b'; // Changed default from 'mistral-large'
    if (!isValidModel(model)) {
      // Throw specific error for invalid model
      // console.warn(`Invalid model specified: ${model}. Falling back to default 'llama-3.3-70b'. Check available models.`);
      // Allow fallback for now, but log warning. Could throw error instead.
      // throw new LLMError('ConfigError', `Invalid model specified: ${model}. Valid models are: ${Object.keys(VENICE_MODELS).join(', ')}`);
      // Ensure the fallback is also a potentially valid model
  logger.warn(`Invalid or unsupported model specified: ${model}. Falling back to default 'llama-3.3-70b'. Check available models via Venice API or documentation.`);
      this.model = 'llama-3.3-70b'; // Fallback model
    } else {
        this.model = model;
    }

  this.outputFn = config.outputFn || ((message, meta) => logger.info(message, meta));
  this.errorFn = config.errorFn || ((message, meta) => logger.error(message, meta));

    this.config = {
      ...defaultConfig,
      ...config,
      apiKey, // Store the resolved API key
      model: this.model, // Store the resolved model
      retry: { ...defaultRetryConfig, ...config.retry },
    };
     // Validate retry config
     if (this.config.retry.maxAttempts < 1) this.config.retry.maxAttempts = 1;
     if (this.config.retry.initialDelay < 100) this.config.retry.initialDelay = 100;
  }

  /**
   * Internal fetch method with timeout and retry logic.
   * @param {string} url - The URL to fetch.
   * @param {object} options - Fetch options (method, headers, body).
   * @returns {Promise<Response>} - The fetch Response object.
   */
  async _fetchWithRetry(url, options) {
    const retryConfig = this.config.retry;
    let attempt = 0;
    let lastError = null;

    while (attempt < retryConfig.maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId); // Clear timeout if fetch completes

        // If response is OK, return it
        if (response.ok) {
          return response;
        }

        // If response is not OK, create an error object
        const errorBody = await response.text();
        lastError = new LLMError(
            `APIError_${response.status}`,
            `API request failed with status ${response.status}: ${response.statusText}. Body: ${errorBody.substring(0, 200)}`, // Include part of body
            { status: response.status, statusText: response.statusText, body: errorBody }
        );
        lastError.status = response.status; // Attach status for retry check

        // Check if this error is retryable
        if (!isRetryableError(lastError) || attempt >= retryConfig.maxAttempts) {
          throw lastError; // Not retryable or max attempts reached
        }

        // Is retryable, log and wait
        this.errorFn(`[LLMClient] Attempt ${attempt} failed with status ${response.status}. Retrying...`);

      } catch (error) {
        clearTimeout(timeoutId); // Clear timeout on any fetch error
        lastError = error; // Store the error

        // Check if the error is retryable (network error, timeout, specific HTTP status)
        if (!isRetryableError(error) || attempt >= retryConfig.maxAttempts) {
            // If AbortError (timeout), wrap it
            if (error.name === 'AbortError') {
                 throw new LLMError('TimeoutError', `API request timed out after ${this.config.timeout / 1000}s.`, error);
            }
            // If already an LLMError, re-throw
            if (error instanceof LLMError) throw error;
            // Otherwise, wrap generic error
            throw new LLMError('NetworkError', `Network or unexpected error during API request: ${error.message}`, error);
        }

        // Is retryable, log and wait
        this.errorFn(`[LLMClient] Attempt ${attempt} failed with error: ${error.message}. Retrying...`);
      }

      // Calculate delay for next retry
      let delay = retryConfig.initialDelay;
      if (retryConfig.useExponentialBackoff) {
        delay = Math.min(retryConfig.initialDelay * Math.pow(2, attempt -1), retryConfig.maxDelay);
      }
      // Add jitter (e.g., +/- 10%)
      delay *= (0.9 + Math.random() * 0.2);
      await sleep(delay);
    }

    // Should not be reached if loop condition is correct, but throw last error if it does
    throw lastError || new LLMError('MaxRetriesExceeded', `Failed after ${retryConfig.maxAttempts} attempts.`);
  }


  /**
   * Simple completion with system and user prompt.
   * @param {Object} params - Completion parameters.
   * @param {string} params.system - System prompt content.
   * @param {string} params.prompt - User prompt content.
   * @param {number} [params.temperature=0.7] - Sampling temperature.
   * @param {number} [params.maxTokens=1000] - Maximum tokens to generate.
   * @param {string} [params.model] - Model to use for completion.
   * @returns {Promise<Object>} - Response object with content, model, timestamp.
   */
  async complete({ system, prompt, temperature = 0.7, maxTokens = 1000, model, venice_parameters = {}, type }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    if (prompt) messages.push({ role: 'user', content: prompt });

    if (messages.length === 0) {
        throw new LLMError('InputError', 'At least one of system or prompt message is required.');
    }

    // --- Set default character_slug based on type ---
    let character_slug = venice_parameters.character_slug;
    if (!character_slug) {
      if (type === 'chat') character_slug = getDefaultChatCharacterSlug();
      else if (type === 'research') character_slug = getDefaultResearchCharacterSlug();
      else if (type === 'token_classifier') character_slug = getDefaultTokenClassifierCharacterSlug();
    }
    const veniceParams = { ...venice_parameters, ...(character_slug ? { character_slug } : {}) };

    const payload = {
      model,
      messages: system && prompt ? [{ role: 'system', content: system }, { role: 'user', content: prompt }] : undefined,
      system,
      prompt,
      temperature,
      max_tokens: maxTokens,
      venice_parameters: veniceParams
    };

    // Use completeChat internally
    return this.completeChat(payload);
  }

  /**
   * Complete a conversation with multiple message history.
   *
   * @param {Object} options - Chat completion options
   * @param {Array<Object>} options.messages - Array of message objects with role and content. Required.
   * @param {number} [options.temperature=0.7] - Temperature parameter (0-1).
   * @param {number} [options.maxTokens=1000] - Maximum tokens to generate.
   * @param {string} [options.model] - Model to use for completion.
   * @returns {Promise<Object>} Response with content, model, timestamp, and usage info.
   */
  async completeChat({ messages, temperature = 0.7, maxTokens = 1000, model, venice_parameters = {} }) {
     if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new LLMError('InputError', 'Messages array cannot be empty.');
     }
     // Basic validation of message structure
     if (!messages.every(m => m && typeof m.role === 'string' && typeof m.content === 'string')) {
         throw new LLMError('InputError', 'Each message must be an object with string properties "role" and "content".');
     }

    // --- Ensure default character_slug for chat ---
    const character_slug = venice_parameters.character_slug || getDefaultChatCharacterSlug();
    const veniceParams = { ...venice_parameters, character_slug };

    const payload = {
      model: model || this.config.model, // Pass the resolved model
      messages: messages, // Pass the full message history
      temperature,
      max_tokens: maxTokens,
      venice_parameters: veniceParams
    };

    try {
      const response = await this._fetchWithRetry(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      // _fetchWithRetry ensures response.ok is true here
      const data = await response.json();

      // Validate response structure
      if (!data.choices?.[0]?.message?.content) {
        this.errorFn("[LLMClient] Invalid response format from Venice API:", data);
        throw new LLMError('InvalidResponse', 'Invalid or empty response format from Venice API.', data);
      }

      return {
        content: data.choices[0].message.content,
        model: data.model || this.config.model, // Use model from response if available
        timestamp: new Date().toISOString(),
        usage: data.usage || {}, // Include usage data if provided
      };
    } catch (error) {
        // Log the error before re-throwing or wrapping
        this.errorFn(`[LLMClient] Error during chat completion: ${error.message}`, error instanceof LLMError ? error.originalError || error : error);
        // If it's not already an LLMError, wrap it
        if (!(error instanceof LLMError)) {
            throw new LLMError('OperationFailed', `Chat completion failed: ${error.message}`, error);
        }
        // Otherwise, re-throw the specific LLMError
        throw error;
    }
  }
}
