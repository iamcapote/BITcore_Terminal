import { ResearchEngine } from '../app/infrastructure/research/research-engine.mjs';
import assert from 'assert';

describe('ResearchEngine', () => {
  it('should return results for a valid query', async () => {
    const engine = new ResearchEngine({ query: 'AI privacy', depth: 2, breadth: 3 });
    const result = await engine.research();
    assert(result.learnings.length > 0, 'Learnings should not be empty');
  });
});
