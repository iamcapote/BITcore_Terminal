import fetch from 'node-fetch';
import { VENICE_MODELS, isValidModel } from './venice.models.mjs';

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
  initialDelay: 1000,
  useExponentialBackoff: true,
};

const defaultConfig = {
  baseUrl: 'https://api.venice.ai/api/v1',
  retry: defaultRetryConfig,
};

export class LLMClient {
  constructor(config = {}) {
    const apiKey = config.apiKey || process.env.VENICE_API_KEY;
    if (!apiKey) {
      throw new LLMError(
        'ConfigError',
        'API key is required. Provide it or set VENICE_API_KEY.',
      );
    }

    const model = config.model || process.env.VENICE_MODEL || 'llama-3.3-70b';
    if (!isValidModel(model)) {
      throw new LLMError('ConfigError', `Invalid model: ${model}`);
    }

    this.config = {
      ...defaultConfig,
      ...config,
      apiKey,
      model,
      retry: { ...defaultRetryConfig, ...config.retry },
    };
  }

  async complete({ system, prompt, temperature = 0.7, maxTokens = 1000 }) {
    const retryConfig = this.config.retry || defaultRetryConfig;
    let attempt = 0;

    while (attempt < retryConfig.maxAttempts) {
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
          throw new LLMError('InvalidResponse', 'Invalid response format from Venice API', data);
        }

        return {
          content: data.choices[0].message.content,
          model: this.config.model,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        if (attempt === retryConfig.maxAttempts - 1) {
          throw new LLMError('MaxRetriesExceeded', `Failed after ${retryConfig.maxAttempts} attempts`, error);
        }
        attempt++;
        await sleep(retryConfig.initialDelay * Math.pow(2, attempt));
      }
    }
  }
}
