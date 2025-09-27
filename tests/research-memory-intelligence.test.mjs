import { describe, it, expect, vi } from 'vitest';
import {
  fetchMemoryIntelligence,
  deriveMemoryFollowUpQueries
} from '../app/utils/research.memory-intelligence.mjs';

describe('fetchMemoryIntelligence', () => {
  it('returns normalized memory context for telemetry and query seeding', async () => {
    const recallMock = vi.fn(async () => ([
      {
        id: 'abc123',
        preview: '   Example memory snippet providing historical context.   ',
        tags: ['history', ''],
        score: 0.92,
        timestamp: '2024-01-01T00:00:00Z',
        metadata: { source: 'https://example.org/post' },
        layer: 'long-term'
      }
    ]));

    const statsMock = vi.fn(async () => ({
      totals: {
        stored: 10,
        retrieved: '4',
        validated: null,
        summarized: 2,
        ephemeralCount: 1,
        validatedCount: undefined
      }
    }));

    const memoryService = { recall: recallMock, stats: statsMock };

    const result = await fetchMemoryIntelligence({
      query: '  climate change policy  ',
      memoryService,
      user: { username: 'alice' },
      limit: 3
    });

    expect(result.query).toBe('climate change policy');
    expect(Array.isArray(result.records)).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(Object.isFrozen(result.records)).toBe(true);

    const [record] = result.records;
    expect(record.layer).toBe('long-term');
    expect(record.preview).toBe('Example memory snippet providing historical context.');
    expect(record.tags).toEqual(['history']);
    expect(record.source).toBe('https://example.org/post');
    expect(typeof record.timestamp === 'number' || record.timestamp === null).toBe(true);

    expect(result.stats).toMatchObject({ stored: 10, retrieved: 4, summarized: 2 });
    expect(result.telemetryPayload.records[0]).toEqual(record);

    expect(recallMock).toHaveBeenCalledWith({
      query: 'climate change policy',
      limit: 3,
      includeShortTerm: true,
      includeLongTerm: true,
      includeMeta: false
    }, { user: { username: 'alice' } });
    expect(statsMock).toHaveBeenCalledWith({ user: { username: 'alice' } });
  });

  it('short-circuits for blank queries without hitting memory service', async () => {
    const memoryService = {
      recall: vi.fn(),
      stats: vi.fn()
    };

    const result = await fetchMemoryIntelligence({
      query: '   ',
      memoryService,
      user: { username: 'sam' }
    });

    expect(result.records).toHaveLength(0);
    expect(memoryService.recall).not.toHaveBeenCalled();
    expect(memoryService.stats).not.toHaveBeenCalled();
  });
});

describe('deriveMemoryFollowUpQueries', () => {
  it('builds memory-guided follow-up queries with metadata', () => {
    const memoryContext = {
      records: [
        {
          id: 'm1',
          preview: 'AI diagnostics improved accuracy by 15% in 2024 trials',
          tags: ['diagnostics', 'healthcare'],
          layer: 'long-term',
          score: 0.88,
          timestamp: Date.now()
        },
        {
          id: 'm2',
          preview: 'Hospitals piloted federated learning for radiology triage',
          tags: ['operations'],
          layer: 'short-term',
          score: 0.73,
          timestamp: Date.now()
        }
      ]
    };

    const followUps = deriveMemoryFollowUpQueries({
      baseQuery: 'impact of AI on healthcare systems',
      memoryContext,
      maxQueries: 3
    });

    expect(followUps).toHaveLength(2);
    followUps.forEach((entry) => {
      expect(entry.original).toContain('impact of AI on healthcare systems');
      expect(entry.metadata.source).toBe('memory');
      expect(entry.metadata.baseQuery).toBe('impact of AI on healthcare systems');
    });

    expect(followUps[0].metadata.layer).toBe('long-term');
    expect(followUps[1].metadata.layer).toBe('short-term');
  });

  it('deduplicates similar memory subjects and respects max query limit', () => {
    const duplicatePreview = 'Recurring insight about the same topic';
    const memoryContext = {
      records: [
        { id: 'a', preview: duplicatePreview, tags: [], layer: 'episodic' },
        { id: 'b', preview: duplicatePreview, tags: ['ops'], layer: 'long-term' },
        { id: 'c', preview: 'Secondary topic worth exploring further', tags: [], layer: 'long-term' }
      ]
    };

    const followUps = deriveMemoryFollowUpQueries({
      baseQuery: 'test query',
      memoryContext,
      maxQueries: 1
    });

    expect(followUps).toHaveLength(1);
    expect(followUps[0].metadata.memoryId).toBe('a');
  });
});
