import { generateQueries, processResults, trimPrompt } from '../../features/ai/research.providers.mjs';
import { output } from '../../utils/research.output-manager.mjs';
import { suggestSearchProvider, SearchError } from '../search/search.providers.mjs';

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
      const searchResults = await this.search(query);

      if (!searchResults || searchResults.length === 0) {
        output.log(`[processQuery] No results found for "${query}".`);
        return { learnings: [`No search results found for: ${query}`], sources: [] };
      }

      const content = searchResults
        .map(item => item.content)
        .filter(Boolean)
        .map(text => trimPrompt(text, 25000));

      if (content.length === 0) {
        output.log(`[processQuery] No meaningful content for "${query}".`);
        return { learnings: [`No meaningful content found for: ${query}`], sources: searchResults.map(item => item.source).filter(Boolean) };
      }

      const results = await processResults({
        query,
        content,
        numFollowUpQuestions: Math.ceil(breadth / 2),
        metadata: this.config.query.metadata || null,
      });

      const allLearnings = [...learnings, ...results.learnings];
      const allSources = [...sources, ...searchResults.map(item => item.source).filter(Boolean)];

      if (depth > 1 && results.followUpQuestions?.length) {
        const nextQuery = results.followUpQuestions[0] || `Tell me more about ${query}`;
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
      return { learnings: [`Error researching: ${query}`], sources: [] };
    }
  }

  async research() {
    const { query, breadth, depth } = this.config;
    const processedQuery = `${query.original.trim()} ${query.metadata || ''}`.trim();

    output.log(`[research] Generating queries for: "${processedQuery}" (breadth=${breadth})`);
    const queries = await generateQueries({
      query: processedQuery,
      numQueries: breadth,
      metadata: query.metadata || null,
    });

    const results = [];
    for (const serpQuery of queries) {
      const result = await this.processQuery(serpQuery.query, depth, breadth);
      results.push(result);
    }

    const finalLearnings = [...new Set(results.flatMap(r => r.learnings))];
    const finalSources = [...new Set(results.flatMap(r => r.sources))];
    return { learnings: finalLearnings, sources: finalSources };
  }
}