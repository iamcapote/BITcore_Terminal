import { generateQueries, processResults } from '../../features/ai/providers.mjs';
import { suggestSearchProvider } from '../search/providers.mjs';

export class ResearchPath {
  constructor(config, progress) {
    this.config = config;
    this.progress = progress;
  }

  async search(query) {
    return await suggestSearchProvider({ type: 'web' }).search(query);
  }

  async processQuery(query) {
    const searchResults = await this.search(query);
    const content = searchResults.map(item => item.content).filter(Boolean);
    return processResults({ query, content });
  }

  async research() {
    const queries = await generateQueries({ query: this.config.query });
    const results = [];
    for (const q of queries) {
      const processed = await this.processQuery(q.query);
      results.push(processed);
    }
    return {
      learnings: [...new Set(results.flatMap(r => r.learnings))],
      sources: [...new Set(results.flatMap(r => r.followUpQuestions))],
    };
  }
}