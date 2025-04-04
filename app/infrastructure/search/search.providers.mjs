import axios from 'axios';
import { RateLimiter } from '../../utils/research.rate-limiter.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';

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
    
    // Make sure we're getting the API key directly from process.env
    this.apiKey = process.env.BRAVE_API_KEY;
    
    if (!this.apiKey) {
      throw new SearchError('ConfigError', 'Missing BRAVE_API_KEY', 'Brave');
    }
    
    console.log(`[BraveSearchProvider] API Key length: ${this.apiKey.length}`);
    console.log(`[BraveSearchProvider] API Key first 4 chars: ${this.apiKey.substring(0, 4)}...`);
    
    this.rateLimiter = new RateLimiter(5000); // 5 seconds base delay
    this.retryDelay = 2000; // Start with 2 seconds for retries
    this.maxRetries = 3;
  }

  async makeRequest(query) {
    try {
      await this.rateLimiter.waitForNextSlot();
      console.log(`[BraveSearchProvider] Searching for: "${query}"`);
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

      if (!response.data?.web?.results) {
        console.error('[BraveSearchProvider] Unexpected response shape:', response.data);
        return [];
      }

      return response.data.web.results.map((r) => ({
        title: r.title || 'Untitled',
        content: r.description || 'No description available',
        source: r.url || '',
        type: this.type,
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        console.warn('[BraveSearchProvider] Rate-limited by Brave.');
        throw new SearchError('RATE_LIMIT', 'Rate-limited by Brave', 'Brave');
      } else if (error.response?.status === 422) {
        console.error('[BraveSearchProvider] Received HTTP 422 from Brave. Check query parameters:', error.response?.data || error.message);
        throw new SearchError('API_ERROR', 'Received HTTP 422 from Brave.', 'Brave');
      }
      console.error('[BraveSearchProvider] Unhandled Brave error:', error.message);
      throw new SearchError('API_ERROR', error.message || 'Brave request failed', 'Brave');
    }
  }

  async search(originalQuery) {
    console.log(`[BraveSearchProvider] Original query: "${originalQuery}"`);
    // We're using a less aggressive cleaning here - keeping more of the original query intact
    const sanitizedQuery = originalQuery.trim();
    if (!sanitizedQuery || sanitizedQuery.length < 3) {
      console.warn('[BraveSearchProvider] Query too short, skipping search.');
      return [];
    }

    let retryCount = 0;
    while (retryCount <= this.maxRetries) {
      try {
        return await this.makeRequest(sanitizedQuery);
      } catch (error) {
        if (error instanceof SearchError && error.code === 'RATE_LIMIT') {
          const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
          console.warn(`[BraveSearchProvider] Rate-limited, waiting ${delay / 1000}s before retry (attempt ${retryCount + 1}).`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    console.error('[BraveSearchProvider] Exceeded maximum retries - returning empty result set.');
    return [];
  }
}

export function suggestSearchProvider({ type }) {
  if (type === 'web') {
    return new BraveSearchProvider();
  }
  throw new SearchError('UnsupportedProvider', `No provider for type: ${type}`, '');
}
