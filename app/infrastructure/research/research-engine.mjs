import { generateQueries, processResults } from '../../features/ai/providers.mjs';
import { suggestSearchProvider } from '../search/providers.mjs';
import { output } from '../../utils/output-manager.mjs';
import { ResearchPath } from './research-path.mjs';

export class ResearchEngine {
  constructor(config) {
    this.config = config;
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
    try {
      const progress = {
        currentDepth: this.config.depth,
        totalDepth: this.config.depth,
        currentBreadth: this.config.breadth,
        totalBreadth: this.config.breadth,
        totalQueries: 0,
        completedQueries: 0,
      };

      const path = new ResearchPath(this.config, progress);
      return await path.research();
    } catch (error) {
      output.log('Error in research:', error);
      return {
        learnings: [`Research attempted on: ${this.config.query}`],
        sources: [],
      };
    }
  }

  async performResearch(query) {
    return { data: 'Mock research results' }; // Replace with actual logic
  }
}

export async function fetchResearch() {
  return [
    { id: 1, title: 'Research Paper 1' },
    { id: 2, title: 'Research Paper 2' },
  ];
}
