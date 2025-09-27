/**
 * ChatHistoryController exposes high-level operations for CLI and web
 * surfaces, delegating persistence and policy enforcement to the
 * ChatHistoryService.
 */

import { CHAT_MESSAGE_ROLES } from './chat-history.schema.mjs';
import { ChatHistoryService } from './chat-history.service.mjs';

export class ChatHistoryController {
  constructor({ service } = {}) {
    this.service = service || new ChatHistoryService();
  }

  async startConversation(context) {
    return this.service.startConversation(context);
  }

  async recordMessage(conversationId, { role, content, createdAt } = {}) {
    const effectiveRole = role ?? CHAT_MESSAGE_ROLES.ASSISTANT;
    return this.service.appendMessage(conversationId, {
      role: effectiveRole,
      content,
      createdAt
    });
  }

  async closeConversation(conversationId, options) {
    return this.service.closeConversation(conversationId, options);
  }

  async listConversations() {
    return this.service.listConversations();
  }

  async getConversation(conversationId) {
    return this.service.getConversation(conversationId);
  }

  async exportConversation(conversationId) {
    return this.service.exportConversation(conversationId);
  }

  async removeConversation(conversationId) {
    return this.service.removeConversation(conversationId);
  }

  async clearConversations(options) {
    return this.service.clearConversations(options);
  }
}
