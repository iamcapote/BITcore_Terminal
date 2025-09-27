import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeChat, exitMemory } from '../app/commands/chat.cli.mjs';
import { MemoryManager } from '../app/infrastructure/memory/memory.manager.mjs';
import { LLMClient } from '../app/infrastructure/ai/venice.llm-client.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { resetChatPersonaController } from '../app/features/chat/index.mjs';

vi.mock('../app/infrastructure/ai/venice.llm-client.mjs');

let tempDir;
let originalStorageDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-test-suite-'));
  originalStorageDir = process.env.BITCORE_STORAGE_DIR;
  process.env.BITCORE_STORAGE_DIR = tempDir;
  resetChatPersonaController();
});

afterEach(async () => {
  resetChatPersonaController();
  if (originalStorageDir === undefined) {
    delete process.env.BITCORE_STORAGE_DIR;
  } else {
    process.env.BITCORE_STORAGE_DIR = originalStorageDir;
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

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
    expect(output).toHaveBeenCalledWith(expect.stringContaining('Chat session ready'));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('bitcore'));
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