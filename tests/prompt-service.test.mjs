import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptService } from '../app/features/prompts/prompt.service.mjs';
import { normalizePromptDefinition } from '../app/features/prompts/prompt.schema.mjs';

const baseNow = () => new Date('2024-06-01T00:00:00.000Z');

function createRecord(payload) {
  return normalizePromptDefinition(payload, { now: baseNow });
}

describe('PromptService', () => {
  let repository;
  let service;
  let logger;
  let records;

  beforeEach(() => {
    records = [
      createRecord({
        id: 'daily-check-in',
        title: 'Daily Check-In',
        body: 'Ask the user how their day is going.',
        description: 'Quick daily mood check.',
        tags: ['daily', 'check-in']
      }),
      createRecord({
        id: 'status-update',
        title: 'Status Update',
        body: 'Collect blockers and progress.',
        description: 'Weekly sync prompt.',
        tags: ['weekly', 'status']
      }),
      createRecord({
        id: 'incident-review',
        title: 'Incident Review',
        body: 'Gather timeline, impact, and remediation steps.',
        description: 'Used after major incidents.',
        tags: ['incident', 'postmortem']
      })
    ];

    repository = {
      listSummaries: vi.fn(async () =>
        records.map((record) => ({
          id: record.id,
          title: record.title,
          description: record.description,
          tags: record.tags,
          version: record.version,
          updatedAt: record.updatedAt
        }))
      ),
      listRecords: vi.fn(async () => records),
      get: vi.fn(async (id) => records.find((record) => record.id === id)),
      save: vi.fn(async (payload) => ({ ...payload })),
      delete: vi.fn(async () => {}),
      exists: vi.fn(async (id) => records.some((record) => record.id === id))
    };

    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    service = new PromptService({ repository, logger });
  });

  it('lists summaries filtered by tags', async () => {
    const summaries = await service.listSummaries({ tags: ['daily'] });

    expect(repository.listSummaries).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe('daily-check-in');
  });

  it('searches prompts by text with includeBody enabled', async () => {
    const results = await service.searchPrompts({ query: 'timeline', includeBody: true });

    expect(repository.listRecords).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('incident-review');
  });

  it('saves prompt through repository with normalized payload', async () => {
    const saved = await service.savePrompt({
      title: 'Retro Guide',
      body: 'Lead the team through a blameless retro.',
      tags: 'retro, team'
    }, { actor: 'tester' });

    expect(repository.save).toHaveBeenCalledTimes(1);
    const payload = repository.save.mock.calls[0][0];
    expect(payload.id).toBe('retro-guide');
    expect(payload.tags).toContain('retro');
    expect(saved.id).toBe('retro-guide');
  });

  it('deletes prompt and logs action', async () => {
    await service.deletePrompt('status-update', { actor: 'admin' });

    expect(repository.delete).toHaveBeenCalledWith('status-update');
  });
});
