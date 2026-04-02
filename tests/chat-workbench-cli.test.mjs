import { beforeEach, describe, expect, it } from 'vitest';
import { executeChatWorkbench, getChatWorkbenchHelpText } from '../app/commands/chat-workbench.cli.mjs';
import { resetChatWorkbenchController, resetChatPersonaController } from '../app/features/chat/index.mjs';

beforeEach(() => {
  resetChatWorkbenchController();
  resetChatPersonaController();
});

describe('chat-workbench cli command', () => {
  it('exposes help text', () => {
    const help = getChatWorkbenchHelpText();
    expect(help).toContain('/chat-workbench');
    expect(help).toContain('--json');
  });

  it('returns bootstrap snapshot by default', async () => {
    const result = await executeChatWorkbench({ flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.snapshot.feature.mode).toBe('mock');
    expect(Array.isArray(result.snapshot.models)).toBe(true);
  });

  it('rejects unsupported actions', async () => {
    const result = await executeChatWorkbench({ action: 'unknown' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });
});
