import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryManager } from '../app/infrastructure/memory/memory.manager.mjs';
import { LLMClient } from '../app/infrastructure/ai/venice.llm-client.mjs';

vi.mock('../app/infrastructure/ai/venice.llm-client.mjs');

const mockUser = { username: 'operator', role: 'admin' };

describe('Memory manager (single-user mode)', () => {
  let manager;

  beforeEach(() => {
    vi.resetAllMocks();

    LLMClient.prototype.complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        memories: [
          { id: 'mem-1', score: 0.8, tags: ['test'], action: 'retain' }
        ]
      })
    });

    manager = new MemoryManager({ depth: 'medium', user: mockUser });
  });

  it('stores memories with ids and timestamps', async () => {
    const memory = await manager.storeMemory('Remember this for later', 'user');

    expect(memory.id).toMatch(/^mem-/);
    expect(typeof memory.timestamp).toBe('string');
    expect(memory.role).toBe('user');
  });

  it('retrieves memories without requiring an authenticated session', async () => {
    await manager.storeMemory('Discuss testing strategy', 'assistant');
    const memories = await manager.retrieveRelevantMemories('testing');

    expect(Array.isArray(memories)).toBe(true);
  });

  it('validates stored memories using the LLM client', async () => {
    await manager.storeMemory('Important detail to validate', 'user');
    const result = await manager.validateMemories();

    expect(LLMClient.prototype.complete).toHaveBeenCalled();
    expect(result.validated).toBeGreaterThanOrEqual(0);
  });

  it('reports statistics about stored memories', async () => {
    await manager.storeMemory('One memory', 'user');
    const stats = manager.getStats();

    expect(stats.memoriesStored).toBeGreaterThanOrEqual(1);
    expect(stats.depthLevel).toBe('medium');
    expect(stats.ephemeralCount).toBeGreaterThanOrEqual(1);
  });

  it('returns the configured depth level', () => {
    expect(manager.getDepthLevel()).toBe('medium');
  });
});