import { generateQueries, processResults, trimPrompt } from '../../features/ai/research.providers.mjs';
import { output } from '../../utils/research.output-manager.mjs';
import { suggestSearchProvider, SearchError } from '../../infrastructure/search/search.providers.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';
// Fix: Import trimPrompt from venice.models.mjs instead of importing it twice
import { trimPrompt as trimModelPrompt } from '../../infrastructure/ai/venice.models.mjs';

/**
 * Handles a single research path, managing its progress and results
 */
export class ResearchPath {
  constructor(config, progress) {
    this.config = config;
    this.progress = progress;
    this.totalQueriesAtDepth = Array(config.depth).fill(0);
    let queriesAtDepth = config.breadth;
    for (let i = 0; i < config.depth; i++) {
      this.totalQueriesAtDepth[i] = queriesAtDepth;
      queriesAtDepth = Math.ceil(queriesAtDepth / 2);
    }
    this.progress.totalQueries = this.totalQueriesAtDepth.reduce((a, b) => a + b, 0);
  }

  async search(query, attempt = 0) {
    try {
      output.log(`[search] Attempting query: "${query}" (attempt ${attempt + 1})`);
      const provider = suggestSearchProvider({ type: 'web' });
      const results = await provider.search(query);
      output.log(`[search] Found ${results.length} results for "${query}"`);
      return results;
    } catch (error) {
      if (error instanceof SearchError && error.code === 'RATE_LIMIT' && attempt < 3) {
        const delay = 10000 * Math.pow(2, attempt); // Exponential backoff
        output.log(`Rate limited for "${query}". Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.search(query, attempt + 1);
      }
      output.log(`[search] Error for query "${query}": ${error.message || error}`);
      throw error;
    }
  }

  async processQuery(query, depth, breadth, learnings = [], sources = []) {
    output.log(`[processQuery] Depth=${depth}, Breadth=${breadth}, Query="${query}"`);
    try {
      // Search for content using privacy-focused provider
      const cleanedQuery = query.replace(/^\d+\.\s*/, '').trim();
      const searchResults = await this.search(cleanedQuery);
      
      if (!searchResults || searchResults.length === 0) {
        output.log(`[processQuery] No results found for "${cleanedQuery}".`);
        return { learnings: [`No search results found for: ${query}`], sources: [] };
      }

      const content = searchResults
        .map(item => item.content)
        .filter(Boolean)
        .map(text => trimModelPrompt(text, 25000));

      output.log(`[processQuery] Found ${content.length} content items for "${cleanedQuery}"`);

      if (content.length === 0) {
        output.log(`[processQuery] No meaningful content for "${cleanedQuery}".`);
        return { 
          learnings: [`No meaningful content found for: ${query}`], 
          sources: searchResults.map(item => item.source).filter(Boolean) 
        };
      }

      // Extract and track sources
      const newSources = searchResults
        .map(item => item.source)
        .filter(Boolean);

      // Calculate next iteration parameters
      const newBreadth = Math.ceil(breadth / 2);
      const newDepth = depth - 1;

      // Process results using AI to extract insights
      const results = await processResults({
        query: cleanedQuery,
        content,
        numFollowUpQuestions: newBreadth,
        // Add metadata to processResults call
        metadata: this.config.query.metadata || null
      });

      output.log(`[processQuery] Found ${results.learnings.length} learnings, ${results.followUpQuestions.length} questions.`);

      // Combine new findings with existing ones
      const allLearnings = [...learnings, ...results.learnings];
      const allSources = [...sources, ...newSources];

      // Update progress tracking
      this.updateProgress({
        currentDepth: depth,
        currentBreadth: breadth,
        completedQueries: this.progress.completedQueries + 1,
        currentQuery: query,
      });

      // Continue research if we haven't reached max depth
      if (newDepth > 0 && results.followUpQuestions?.length) {
        output.log(`[processQuery] Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);

        // Use AI-generated follow-up question or create a related query
        const nextQuery = results.followUpQuestions[0] || `Tell me more about ${cleanQuery(cleanedQuery)}`;

        return this.processQuery(
          nextQuery,
          newDepth,
          newBreadth,
          allLearnings,
          allSources
        );
      }

      return {
        learnings: allLearnings,
        sources: allSources,
      };
    } catch (error) {
      if (error instanceof SearchError && error.code === 'RATE_LIMIT') {
        // Let the rate limit error propagate up to be handled by the retry mechanism
        throw error;
      }

      output.log(`[processQuery] Error: ${error.message || error}`);
      return { learnings: [`Error researching: ${query}`], sources: [] };
    }
  }

  updateProgress(update) {
    Object.assign(this.progress, update);
    this.config.onProgress?.(this.progress);
  }

  async research() {
    const { query, breadth, depth } = this.config;

    // Ensure we always end up with a valid string query
    let processedQuery;
    if (typeof query === 'string') {
      processedQuery = query.trim();
    } else if (
      query &&
      typeof query === 'object' &&
      typeof query.original === 'string'
    ) {
      processedQuery = query.original.trim();
    } else {
      throw new Error(
        'Invalid query: must be a string or an object with a non-empty "original" property.'
      );
    }

    // Now processedQuery is guaranteed to be a string
    output.log(`[research] Generating queries for: "${processedQuery}" (breadth=${breadth})`);
    const queries = await generateQueries({ 
      query: processedQuery, 
      numQueries: breadth,
      // If we have metadata, pass it to the query generator
      metadata: typeof query === 'object' ? query.metadata : null 
    });

    this.updateProgress({ currentQuery: queries[0]?.query });

    const results = [];
    for (const serpQuery of queries) {
      output.log(`[research] Processing top-level query: "${serpQuery.query}"`);
      const result = await this.processQuery(serpQuery.query, depth, breadth);

      this.updateProgress({
        completedQueries: (this.progress.completedQueries || 0) + 1,
        currentQuery: serpQuery.query,
      });

      results.push(result);

      // Add delay between queries to respect rate limits
      if (queries.indexOf(serpQuery) < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const finalLearnings = [...new Set(results.flatMap(r => r.learnings))];
    const finalSources = [...new Set(results.flatMap(r => r.sources))];
    return { learnings: finalLearnings, sources: finalSources };
  }
}
