import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ChatHistoryService } from '../app/features/chat-history/chat-history.service.mjs';
import { ChatHistoryRepository } from '../app/features/chat-history/chat-history.repository.mjs';

function createTempDir() {
  const prefix = path.join(os.tmpdir(), 'chat-history-test-');
  return fs.mkdtemp(prefix);
}

describe('ChatHistoryService', () => {
  let tempDir;
  let service;
  let now;

  beforeEach(async () => {
    tempDir = await createTempDir();
    now = Date.parse('2025-01-01T00:00:00.000Z');
    service = new ChatHistoryService({
      repository: new ChatHistoryRepository({ dataDir: tempDir }),
      retentionDays: 30,
      maxMessagesPerConversation: 3,
      clock: () => now
    });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists sanitized chat messages and enforces max message count', async () => {
    const conversation = await service.startConversation({
      user: { id: 'user-123', username: 'test-user', role: 'operator' },
      origin: 'web'
    });

    await service.appendMessage(conversation.id, { role: 'user', content: 'Hello there' });
    await service.appendMessage(conversation.id, { role: 'assistant', content: 'Hi! apiKey=secret-1234567890' });
    await service.appendMessage(conversation.id, { role: 'user', content: 'Another message' });
    await service.appendMessage(conversation.id, { role: 'assistant', content: 'Fourth message should trim oldest.' });

    const persisted = await service.getConversation(conversation.id);
    expect(persisted.messages.length).toBe(3);
    expect(persisted.messages[0].content).toContain('apiKey=***');
    expect(persisted.messages.some(message => message.content.includes('Hello there'))).toBe(false);
  });

  it('prunes conversations older than retention window', async () => {
    const convoA = await service.startConversation({ origin: 'web' });
    await service.appendMessage(convoA.id, { role: 'user', content: 'Recent conversation' });

    const olderClock = () => Date.parse('2024-01-01T00:00:00.000Z');
    const oldService = new ChatHistoryService({
      repository: new ChatHistoryRepository({ dataDir: tempDir }),
      retentionDays: 30,
      clock: olderClock
    });
  const convoB = await oldService.startConversation({ origin: 'cli' });
  await oldService.appendMessage(convoB.id, { role: 'assistant', content: 'Old data' });

  // Trigger retention pruning from the perspective of the fresh clock.
  await service.appendMessage(convoA.id, { role: 'assistant', content: 'Recent follow-up' });

    const conversations = await service.listConversations();
    const ids = conversations.map(entry => entry.id);
    expect(ids).toContain(convoA.id);
    expect(ids).not.toContain(convoB.id);
  });
});
