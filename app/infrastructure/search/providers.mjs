import axios from 'axios';
import { RateLimiter } from '../../utils/rate-limiter.mjs';

export class SearchError extends Error {
  constructor(code, message, provider) {
    super(message);
    this.code = code;
    this.provider = provider;
    this.name = 'SearchError';
  }
}

export class BraveSearchProvider {
  constructor() {
    this.type = 'web';
    this.baseUrl = 'https://api.search.brave.com/res/v1';
    this.apiKey = process.env.BRAVE_API_KEY || '';
    if (!this.apiKey) {
      throw new SearchError('ConfigError', 'Missing BRAVE_API_KEY', 'Brave');
    }
    this.rateLimiter = new RateLimiter(5000);
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async makeRequest(query) {
    await this.rateLimiter.waitForNextSlot();
    const response = await axios.get(`${this.baseUrl}/web/search`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
      params: {
        q: query,
        count: 10,
        offset: 0,
        language: 'en',
        country: 'US',
        safesearch: 'moderate',
        format: 'json',
      },
    });
    const results = response.data.web?.results || [];
    return results.map(r => ({
      title: r.title || 'Untitled',
      content: r.description || '',
      source: r.url,
      type: this.type,
    }));
  }

  async search(query) {
    let retryCount = 0;
    while (retryCount < this.maxRetries) {
      try {
        return await this.makeRequest(query);
      } catch (error) {
        retryCount++;
        if (retryCount >= this.maxRetries) {
          throw new SearchError('MaxRetriesExceeded', 'Brave search failed', 'Brave');
        }
      }
    }
  }
}

export function suggestSearchProvider({ type }) {
  if (type === 'web') {
    return new BraveSearchProvider();
  }
  throw new SearchError('UnsupportedProvider', `No provider for type: ${type}`, '');
}
