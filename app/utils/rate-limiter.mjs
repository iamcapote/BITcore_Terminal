/**
 * Contract
 * Why: Provide a lightweight, reusable async rate limiter for WebSocket command handlers.
 * What: Exposes a token bucket limiter that allows N executions per interval, rejecting excess with structured errors.
 * How: Maintains per-key state in memory, resets counts on interval boundaries, and returns a guard function for awaited operations.
 */

const DEFAULT_INTERVAL_MS = 1000;

class RateLimitExceededError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Creates a simple token bucket limiter.
 * @param {object} options
 * @param {number} options.maxTokens
 * @param {number} [options.intervalMs]
 * @returns {(key: string) => Promise<void>}
 */
export function createRateLimiter({ maxTokens, intervalMs = DEFAULT_INTERVAL_MS }) {
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw new Error('maxTokens must be a positive integer.');
  }

  const buckets = new Map();

  const consume = async (key) => {
    const now = Date.now();
    const bucket = buckets.get(key) || { tokens: maxTokens, resetAt: now + intervalMs };

    if (now >= bucket.resetAt) {
      bucket.tokens = maxTokens;
      bucket.resetAt = now + intervalMs;
    }

    if (bucket.tokens <= 0) {
      const retryAfterMs = Math.max(bucket.resetAt - now, 0);
      throw new RateLimitExceededError('Rate limit exceeded for this action.', retryAfterMs);
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
  };

  return consume;
}

export { RateLimitExceededError };
