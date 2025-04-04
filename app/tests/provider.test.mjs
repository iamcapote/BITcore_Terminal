import { generateQueries, processResults } from '../features/ai/research.providers.mjs';
import assert from 'assert';

describe('AI Providers', () => {
  it('should generate queries', async () => {
    const queries = await generateQueries({ query: 'AI privacy', numQueries: 3 });
    assert(queries.length === 3, 'Should generate 3 queries');
  });

  it('should process results', async () => {
    const results = await processResults({ query: 'AI privacy', content: ['Sample content'] });
    assert(results.learnings.length > 0, 'Learnings should not be empty');
  });
});
