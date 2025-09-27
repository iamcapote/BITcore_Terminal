/**
 * ChatHistoryService orchestrates persisted chat transcripts with retention
 * policies and privacy safeguards.
 *
 * Contract
 * Inputs:
 *   - startConversation(context): { user?, origin?, tags? }.
 *   - appendMessage(conversationId, message): message { role, content, createdAt? }.
 *   - closeConversation(conversationId, options?): { reason? }.
 * Outputs:
 *   - Conversation records persisted via repository; accessor helpers return
 *     frozen snapshots for callers.
 * Error modes:
 *   - Throws when conversations are missing or inputs invalid.
 * Performance:
 *   - O(n) in message count per append (trim + serialization) with maxMessages
 *     safeguards to maintain predictable bounds.
 * Side effects:
 *   - Relies on ChatHistoryRepository for disk IO.
 */

import { randomUUID } from 'crypto';
import { ChatHistoryRepository } from './chat-history.repository.mjs';
import { normalizeMessage, summarizeConversation } from './chat-history.schema.mjs';

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_MESSAGES = 500;

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function isoNow(clock) {
  return new Date(clock()).toISOString();
}

function cutoffFromDays(days, clock) {
  if (!Number.isFinite(days) || days <= 0) return null;
  const ms = clock() - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export class ChatHistoryService {
  constructor({
    repository,
    retentionDays = DEFAULT_RETENTION_DAYS,
    maxMessagesPerConversation = DEFAULT_MAX_MESSAGES,
    clock = () => Date.now(),
    logger
  } = {}) {
    this.repository = repository || new ChatHistoryRepository({ logger });
    this.retentionDays = retentionDays;
    this.maxMessagesPerConversation = maxMessagesPerConversation;
    this.clock = clock;
    this.logger = logger || noopLogger;
  }

  async startConversation({ user, origin = 'unknown', tags = [] } = {}) {
    const now = isoNow(this.clock);
    const conversation = {
      id: randomUUID(),
      startedAt: now,
      updatedAt: now,
      endedAt: null,
      origin,
      user: user ? this.#stripUser(user) : null,
      tags: Array.isArray(tags) ? [...new Set(tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))] : [],
      messageCount: 0,
      messages: []
    };
    await this.repository.saveConversation(conversation);
    await this.#pruneRetention();
    return Object.freeze({ ...conversation, messages: undefined });
  }

  async appendMessage(conversationId, message) {
    const conversation = await this.#requireConversation(conversationId);
    const normalized = normalizeMessage(
      {
        ...message,
        createdAt: message?.createdAt ?? isoNow(this.clock)
      },
      { maxLength: this.#maxLengthPerMessage() }
    );
    conversation.messages.push(normalized);
    if (this.maxMessagesPerConversation && conversation.messages.length > this.maxMessagesPerConversation) {
      const trimmed = conversation.messages.slice(-this.maxMessagesPerConversation);
      conversation.messages = trimmed;
    }
    conversation.messageCount = conversation.messages.length;
    conversation.updatedAt = normalized.createdAt;
    await this.repository.saveConversation(conversation);
    await this.#pruneRetention();
    return normalized;
  }

  async closeConversation(conversationId, { reason } = {}) {
    const conversation = await this.#requireConversation(conversationId);
    if (!conversation.endedAt) {
      conversation.endedAt = isoNow(this.clock);
      if (reason) {
        conversation.closeReason = String(reason);
      }
      await this.repository.saveConversation(conversation);
    }
    await this.#pruneRetention();
    return summarizeConversation(conversation);
  }

  async listConversations() {
    const summaries = await this.repository.listConversations();
    return summaries.map(entry => Object.freeze({ ...entry }));
  }

  async getConversation(conversationId) {
    const conversation = await this.repository.loadConversation(conversationId);
    if (!conversation) {
      return null;
    }
    return Object.freeze({
      ...conversation,
      messages: Array.isArray(conversation.messages)
        ? conversation.messages.map(message => Object.freeze({ ...message }))
        : []
    });
  }

  async removeConversation(conversationId) {
    return this.repository.removeConversation(conversationId);
  }

  async clearConversations({ olderThanDays } = {}) {
    if (Number.isFinite(olderThanDays) && olderThanDays > 0) {
      const cutoffIso = cutoffFromDays(olderThanDays, this.clock);
      if (!cutoffIso) return 0;
      return this.repository.pruneOlderThan(cutoffIso);
    }
    await this.repository.clearConversations();
    return true;
  }

  async exportConversation(conversationId) {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return null;
    return JSON.stringify(conversation, null, 2);
  }

  async #requireConversation(conversationId) {
    if (!conversationId) {
      throw new TypeError('Conversation id is required.');
    }
    const conversation = await this.repository.loadConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation '${conversationId}' not found.`);
    }
    if (!Array.isArray(conversation.messages)) {
      conversation.messages = [];
    }
    return conversation;
  }

  async #pruneRetention() {
    if (!Number.isFinite(this.retentionDays) || this.retentionDays <= 0) {
      return 0;
    }
    const cutoffIso = cutoffFromDays(this.retentionDays, this.clock);
    if (!cutoffIso) return 0;
    return this.repository.pruneOlderThan(cutoffIso);
  }

  #stripUser(user) {
    if (!user) return null;
    const { id, username, role } = user;
    return {
      id: id ?? null,
      username: username ?? null,
      role: role ?? null
    };
  }

  #maxLengthPerMessage() {
    return Math.min(32_000, this.maxMessagesPerConversation * 1_024);
  }
}
