import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryService } from '../app/features/memory/memory.service.mjs';
import { MEMORY_LAYERS } from '../app/features/memory/memory.schema.mjs';

const fakeUser = { username: 'tester', role: 'admin' };

class StubManager {
  constructor(options) {
    this.options = options;
    this.githubIntegration = options.githubEnabled ? {} : null;
    this._memoryCounter = 0;
    this.storeMemory = vi.fn(async (content, role) => {
      this._memoryCounter += 1;
      return {
        id: `mem-${this._memoryCounter}`,
        content,
        role,
        timestamp: new Date().toISOString(),
        tags: ['existing'],
        metadata: { existing: true }
      };
    });
    this.retrieveRelevantMemories = vi.fn(async () => ([
      { id: 'mem-1', content: 'alpha', role: 'assistant', timestamp: new Date().toISOString(), tags: [], metadata: {} },
      { id: 'mem-2', content: 'beta', role: 'user', timestamp: new Date().toISOString(), tags: [], metadata: {} }
    ]));
    this.getStats = vi.fn(() => ({
      memoriesStored: 3,
      memoriesRetrieved: 2,
      memoriesValidated: 1,
      memoriesSummarized: 0,
      ephemeralCount: 2,
      validatedCount: 1
    }));
    this.summarizeAndFinalize = vi.fn(async () => ({ success: true }));
  }
}

describe('MemoryService', () => {
  let managerFactory;
  let userManager;

  beforeEach(() => {
    managerFactory = vi.fn((options) => new StubManager(options));
    userManager = {
      getUserData: vi.fn().mockResolvedValue(fakeUser)
    };
  });

  it('stores memory with merged tags and metadata', async () => {
    const service = new MemoryService({ userManager, managerFactory });

    const result = await service.store({
      content: 'Remember the deployment window',
      tags: ['Release'],
      metadata: { ticket: 'OPS-42' },
      source: 'cli'
    });

    expect(managerFactory).toHaveBeenCalledTimes(1);
    const options = managerFactory.mock.calls[0][0];
    expect(options.depth).toBe('medium');
    expect(options.user).toEqual(fakeUser);

    expect(result.layer).toBe(MEMORY_LAYERS.EPISODIC);
    expect(result.tags.sort()).toEqual(['existing', 'release']);
    expect(result.metadata).toMatchObject({ existing: true, ticket: 'OPS-42', source: 'cli' });
  });

  it('recalls memories with limit applied', async () => {
    const service = new MemoryService({ userManager, managerFactory });

    const recalled = await service.recall({
      query: 'alpha',
      layer: MEMORY_LAYERS.WORKING,
      limit: 1
    });

    expect(managerFactory).toHaveBeenCalledTimes(1);
    const instance = managerFactory.mock.results[0].value;
    expect(instance.retrieveRelevantMemories).toHaveBeenCalledWith('alpha', true, true, true);
    expect(recalled.length).toBe(1);
    expect(recalled[0].layer).toBe(MEMORY_LAYERS.WORKING);
  });

  it('aggregates stats across layers and computes totals', async () => {
    const service = new MemoryService({ userManager, managerFactory });

    const snapshot = await service.stats();

    expect(snapshot.layers.length).toBe(Object.values(MEMORY_LAYERS).length);
    expect(snapshot.totals.layers).toBe(Object.values(MEMORY_LAYERS).length);
    expect(snapshot.totals.stored).toBeGreaterThan(0);
  });

  it('reuses manager instances per layer and github flag', async () => {
    const service = new MemoryService({ userManager, managerFactory });

    await service.store({ content: 'First' });
    await service.store({ content: 'Second' });

    expect(managerFactory).toHaveBeenCalledTimes(1);

    await service.store({ content: 'Third', layer: MEMORY_LAYERS.WORKING, metadata: {} }, { githubEnabled: true });
    expect(managerFactory).toHaveBeenCalledTimes(2);
  });

  it('delegates to summarizeAndFinalize on the manager', async () => {
    const service = new MemoryService({ userManager, managerFactory });

    const result = await service.summarize({ conversationText: 'A long session' });

    expect(result).toEqual({ success: true });
    const instance = managerFactory.mock.results[0].value;
    expect(instance.summarizeAndFinalize).toHaveBeenCalledWith('A long session');
  });
});
