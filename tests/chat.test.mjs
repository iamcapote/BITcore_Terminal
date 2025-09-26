import { beforeAll, describe, expect, it, vi } from 'vitest';
import { executeChat, exitMemory } from '../app/commands/chat.cli.mjs';
import { MemoryManager } from '../app/infrastructure/memory/memory.manager.mjs';
import { LLMClient } from '../app/infrastructure/ai/venice.llm-client.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';

vi.mock('../app/infrastructure/ai/venice.llm-client.mjs');

describe('Chat system basics', () => {
  beforeAll(async () => {
    await userManager.initialize();

    // Provide deterministic LLM responses for memory workflows
    LLMClient.prototype.complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        score: 0.9,
        tags: ['test'],
        summary: 'mock summary'
      })
    });
  });

  it('starts a chat session without authentication hurdles', async () => {
    const output = vi.fn();
    const result = await executeChat({ output });

    expect(result.success).toBe(true);
    expect(result.session?.isChatActive).toBe(true);
    expect(output).toHaveBeenCalledWith('Chat session ready. Type /exit to leave.');
  });

  it('stores and retrieves memories for the global user', async () => {
    const manager = new MemoryManager({
      depth: 'medium',
      user: userManager.getCurrentUser()
    });

    await manager.storeMemory('First memory about testing', 'user');
    await manager.storeMemory('Assistant reply recorded for context', 'assistant');

    const memories = await manager.retrieveRelevantMemories('testing context');

    expect(manager.ephemeralMemories.length).toBe(2);
    expect(memories).toBeInstanceOf(Array);
    expect(memories.length).toBeGreaterThanOrEqual(0);
  });

  it('provides a helpful message when exitMemory is used without session', async () => {
    const result = await exitMemory({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Memory mode not enabled');
  });
});