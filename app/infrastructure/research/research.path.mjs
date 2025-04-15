import { generateQueries, processResults, trimPrompt } from '../../features/ai/research.providers.mjs';
import { output } from '../../utils/research.output-manager.mjs';
import { suggestSearchProvider, SearchError } from '../search/search.providers.mjs';
import { VENICE_CHARACTERS } from '../ai/venice.characters.mjs';

export class ResearchPath {
  constructor(config, progress) {
    this.config = config;
    this.progress = progress;

    // Enforce role-based limits
    const { role } = config.user;
    if (role === 'public') {
      this.config.depth = Math.min(this.config.depth, 2);
      this.config.breadth = Math.min(this.config.breadth, 3);
    } else if (role === 'client') {
      this.config.depth = Math.min(this.config.depth, 5);
      this.config.breadth = Math.min(this.config.breadth, 10);
    } else if (role === 'admin') {
      // Admin has the highest limits, no changes needed
    } else {
      throw new Error(`Unknown user role: ${role}`);
    }

    this.totalQueriesAtDepth = Array(config.depth).fill(0);
    let queriesAtDepth = config.breadth;
    for (let i = 0; i < config.depth; i++) {
      this.totalQueriesAtDepth[i] = queriesAtDepth;
      queriesAtDepth = Math.ceil(queriesAtDepth / 2);
    }
    this.progress.totalQueries = this.totalQueriesAtDepth.reduce((a, b) => a + b, 0);
  }

  // Helper method to extract query string from query object or string
  getQueryString(query) {
    if (typeof query === 'string') {
      return query;
    }
    
    if (typeof query === 'object' && query.original) {
      // Only return the original query without metadata
      // Metadata should only be used to generate queries with Venice, not for searching
      return query.original;
    }
    
    // Fallback for unexpected query format
    return String(query);
  }

  // Helper method to get the display version of query for logging
  getQueryDisplay(query) {
    if (typeof query === 'string') {
      return query;
    }
    
    if (typeof query === 'object' && query.original) {
      return query.original;
    }
    
    return String(query);
  }

  async search(query, attempt = 0) {
    try {
      // Get the query string using our helper method
      const queryString = this.getQueryString(query);
      const queryDisplay = this.getQueryDisplay(query);
      
      // Truncate combined query to 1000 characters before sending to search provider
      const truncatedQuery = queryString.length > 1000 ? queryString.substring(0, 1000) : queryString;
      output.log(`[search] Attempting query: "${queryDisplay}" (attempt ${attempt + 1})`);
      const provider = suggestSearchProvider({ type: 'web' });
      const results = await provider.search(truncatedQuery);
      output.log(`[search] Found ${results.length} results for "${queryDisplay}"`);
      return results;
    } catch (error) {
      if (error instanceof SearchError && error.code === 'RATE_LIMIT' && attempt < 3) {
        const delay = 10000 * Math.pow(2, attempt); // Exponential backoff
        const queryDisplay = this.getQueryDisplay(query);
        output.log(`Rate limited for "${queryDisplay}". Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.search(query, attempt + 1);
      }
      // Use queryDisplay for error logging to avoid "[object Object]"
      const queryDisplay = this.getQueryDisplay(query);
      output.log(`[search] Error for query "${queryDisplay}": ${error.message || error}`);
      throw error;
    }
  }

  async processQuery(query, depth, breadth, learnings = [], sources = []) {
    const queryDisplay = this.getQueryDisplay(query);
    output.log(`[processQuery] Depth=${depth}, Breadth=${breadth}, Query="${queryDisplay}"`);
    try {
      // Pass the query directly to search - it will handle extracting the string
      const searchResults = await this.search(query);

      if (!searchResults || searchResults.length === 0) {
        output.log(`[processQuery] No results found for "${queryDisplay}".`);
        return { learnings: [`No search results found for: ${queryDisplay}`], sources: [] };
      }

      const content = searchResults
        .map(item => item.content)
        .filter(Boolean)
        .map(text => trimPrompt(text, 25000));

      if (content.length === 0) {
        output.log(`[processQuery] No meaningful content for "${queryDisplay}".`);
        return { learnings: [`No meaningful content found for: ${queryDisplay}`], sources: searchResults.map(item => item.source).filter(Boolean) };
      }

      // Extract query string and metadata properly
      const queryString = typeof query === 'object' && query.original ? query.original : String(query);
      const metadata = typeof query === 'object' && query.metadata ? query.metadata : 
                      (this.config.query && this.config.query.metadata ? this.config.query.metadata : null);
      
      const results = await processResults({
        query: queryString,
        content,
        numFollowUpQuestions: Math.ceil(breadth / 2),
        metadata: metadata,
      });

      const allLearnings = [...learnings, ...results.learnings];
      const allSources = [...sources, ...searchResults.map(item => item.source).filter(Boolean)];

      if (depth > 1 && results.followUpQuestions?.length) {
        const nextQuery = results.followUpQuestions[0] || `Tell me more about ${queryString}`;
        const deeperResults = await this.processQuery(
          nextQuery,
          depth - 1,
          Math.ceil(breadth / 2),
          allLearnings,
          allSources
        );
        allLearnings.push(...deeperResults.learnings);
        allSources.push(...deeperResults.sources);
      }

      return { learnings: allLearnings, sources: allSources };
    } catch (error) {
      if (error instanceof SearchError && error.code === 'RATE_LIMIT') {
        throw error;
      }
      output.log(`[processQuery] Error: ${error.message || error}`);
      return { learnings: [`Error researching: ${queryDisplay}`], sources: [] };
    }
  }

  async research() {
    const { query, breadth, depth } = this.config;
    
    // Use the original query for generating further queries
    const originalQuery = typeof query === 'object' && query.original ? 
                        query.original.trim() : String(query).trim();
    
    // Ensure metadata is properly extracted
    const metadata = typeof query === 'object' && query.metadata ? query.metadata : null;
    
    // Updated log message to include both original query and metadata if available
    if (metadata) {
      output.log(`[research] Generating queries for: "${originalQuery}" with metadata: "${metadata}" (breadth=${breadth})`);
    } else {
      output.log(`[research] Generating queries for: "${originalQuery}" (breadth=${breadth})`);
    }
    
    const queries = await generateQueries({
      query: originalQuery,
      numQueries: breadth,
      metadata: metadata,
      character_slug: VENICE_CHARACTERS.Archon['character_slug'],
    });

    const results = [];
    for (const serpQuery of queries) {
      // The generated queries already incorporate insights from the metadata, 
      // so we don't need to re-attach metadata
      const result = await this.processQuery(serpQuery.query, depth, breadth);
      results.push(result);
    }

    const finalLearnings = [...new Set(results.flatMap(r => r.learnings))];
    const finalSources = [...new Set(results.flatMap(r => r.sources))];
    return { learnings: finalLearnings, sources: finalSources };
  }
}