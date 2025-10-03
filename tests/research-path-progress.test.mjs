/**
 * Why: Ensure ResearchPath emits progress updates for search and learning extraction, enabling granular telemetry.
 * What: Spins a ResearchPath instance with stubbed providers and observes progress handler calls.
 * How: Injects a fake search provider and generate/process functions while capturing emitted progress states.
 */

import { describe, test, expect, vi } from 'vitest';

const fakeSearchProvider = {
  search: vi.fn(async () => ([{
    url: 'https://example.com/doc',
    snippet: 'Example snippet about the topic.',
    content: 'Detailed content for analysis.'
  }]))
};

const fakeGenerateQueries = vi.fn(async () => []);
const fakeProcessResults = vi.fn(async () => ({
  learnings: ['Key finding'],
  followUpQuestions: []
}));

vi.mock('../app/features/ai/research.providers.mjs', () => ({
  generateQueries: fakeGenerateQueries,
  processResults: fakeProcessResults
}));

const { ResearchPath } = await import('../app/infrastructure/research/research.path.mjs');

describe('ResearchPath progress updates', () => {
  test('emits search, processing, and learning progress markers', async () => {
    const progressEvents = [];
    const telemetry = {
      emitStatus: vi.fn(),
      emitThought: vi.fn(),
      emitProgress: vi.fn()
    };

    const path = new ResearchPath({
      user: { username: 'operator', role: 'admin' },
      veniceApiKey: 'test-venice-key',
      searchProvider: fakeSearchProvider,
      output: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      progressHandler: (data) => progressEvents.push({ ...data }),
      telemetry
    }, {
      status: 'Initializing',
      completedQueries: 0,
      totalQueries: 3
    });

    await path.research({
      query: { original: 'Test query' },
      depth: 1,
      breadth: 1
    });

    const actions = progressEvents.map((event) => event.currentAction);
    expect(actions.some((line) => /Searching/.test(line))).toBe(true);
    expect(actions.some((line) => /Analyzing/.test(line))).toBe(true);
    expect(actions.some((line) => /Extracting/.test(line))).toBe(true);
    expect(progressEvents.at(-1).status).toBe('Complete');
  });
});
