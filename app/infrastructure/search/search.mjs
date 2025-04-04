import { suggestSearchProvider } from './providers.mjs';
import { output } from '../../utils/research.output-manager.mjs';

/**
 * Executes a search query using the suggested search provider
 */
export async function search(query) {
  try {
    const searchQuery = String(query || '').trim();
    if (!searchQuery) {
      return [];
    }

    output.log('Starting web search...');
    const results = await suggestSearchProvider({ type: 'web' }).search(searchQuery);
    return results.map(result => ({
      content: result.content,
      source: result.source,
    }));
  } catch (error) {
    output.log('Search error:', error);
    return [];
  }
}