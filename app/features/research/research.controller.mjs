import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';

/**
 * Fetches research data based on a query
 */
export async function getResearchData(query = 'default research topic', depth = 2, breadth = 3) {
  try {
    const engine = new ResearchEngine({ query, depth, breadth });
    return await engine.research();
  } catch (error) {
    console.error('Error in getResearchData:', error);
    return {
      learnings: [`Error researching: ${query}`],
      sources: [],
      error: error.message
    };
  }
}

/**
 * Fetches preexisting research data by path
 */
export async function getResearchByPath(path) {
  // This would be implemented to fetch research from a saved location
  throw new Error('Not implemented yet');
}
