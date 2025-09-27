import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeChat } from '../app/commands/chat.cli.mjs';
import { resetChatPersonaController, getChatPersonaController } from '../app/features/chat/index.mjs';

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'chat-persona-cli-'));
}

describe('chat persona CLI subcommands', () => {
  let tempDir;
  let originalStorageDir;
  let output;
  let error;

  beforeEach(async () => {
    tempDir = await createTempDir();
    originalStorageDir = process.env.BITCORE_STORAGE_DIR;
    process.env.BITCORE_STORAGE_DIR = tempDir;
    resetChatPersonaController();
    output = vi.fn();
    error = vi.fn();
  });

  afterEach(async () => {
    resetChatPersonaController();
    process.env.BITCORE_STORAGE_DIR = originalStorageDir;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('lists available personas with default marker', async () => {
    const result = await executeChat({ positionalArgs: ['persona', 'list'], output, error });
    expect(result.success).toBe(true);
    expect(output).toHaveBeenCalledWith(expect.stringContaining('--- Available Chat Personas ---'));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('Bitcore'));
    expect(error).not.toHaveBeenCalled();
  });

  it('updates the default persona via set', async () => {
    const setResult = await executeChat({ positionalArgs: ['persona', 'set', 'archon'], output, error });
    expect(setResult.success).toBe(true);
    expect(output).toHaveBeenCalledWith(expect.stringContaining('archon'));

    const controller = getChatPersonaController({ forceNew: true, storageDir: tempDir });
    const current = await controller.getDefault();
    expect(current.persona.slug).toBe('archon');
  });

  it('reports helpful message for invalid persona', async () => {
    const result = await executeChat({ positionalArgs: ['persona', 'set', 'unknown'], output, error });
    expect(result.success).toBe(false);
    expect(error).toHaveBeenCalled();
  });
});
