/**
 * Chat history schema utilities provide normalization and sanitization helpers
 * for persisted chat transcripts.
 *
 * Contract
 * Inputs:
 *   - Raw message objects originating from chat sessions { role, content, createdAt? }.
 * Outputs:
 *   - Frozen message records { id, role, content, createdAt } suitable for persistence.
 * Error modes:
 *   - Throws TypeError when role/content are invalid or exceed configured limits.
 * Performance:
 *   - O(n) over message length for sanitization; intended for short conversational text.
 * Side effects:
 *   - None (pure utilities).
 */

import { randomUUID } from 'crypto';

export const CHAT_MESSAGE_ROLES = Object.freeze({
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant'
});

const ALLOWED_ROLES = new Set(Object.values(CHAT_MESSAGE_ROLES));
export const DEFAULT_MAX_MESSAGE_LENGTH = 8_000;

const SECRET_PATTERNS = Object.freeze([
  { pattern: /(sk|rk|pk)-[a-z0-9]{16,}/gi, replacement: '[redacted-key]' },
  { pattern: /ghp_[a-z0-9]{36}/gi, replacement: '[redacted-key]' },
  { pattern: /(glpat|pat)_[a-z0-9]{20,}/gi, replacement: '[redacted-key]' },
  { pattern: /(?:(api[-_\s]?key|token|secret|password)\s*[:=]\s*)([^\s]+)/gi, replacement: (_, label) => `${label}=***` }
]);

function assertValidRole(role) {
  if (!ALLOWED_ROLES.has(role)) {
    throw new TypeError(`Unsupported chat role '${role}'. Expected one of: ${[...ALLOWED_ROLES].join(', ')}`);
  }
}

export function sanitizeContent(input, { maxLength = DEFAULT_MAX_MESSAGE_LENGTH } = {}) {
  if (input == null) {
    return '';
  }
  let content = String(input);
  for (const entry of SECRET_PATTERNS) {
    content = content.replace(entry.pattern, entry.replacement);
  }
  if (maxLength && content.length > maxLength) {
    content = `${content.slice(0, maxLength)}…`; // unicode ellipsis indicates truncation
  }
  return content;
}

export function normalizeMessage(raw, { maxLength = DEFAULT_MAX_MESSAGE_LENGTH } = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('normalizeMessage expects a message object.');
  }
  const role = raw.role ?? CHAT_MESSAGE_ROLES.ASSISTANT;
  assertValidRole(role);
  const sanitizedContent = sanitizeContent(raw.content, { maxLength });
  if (!sanitizedContent.trim()) {
    throw new TypeError('Chat message content cannot be empty after sanitization.');
  }
  const createdAt = raw.createdAt
    ? new Date(raw.createdAt).toISOString()
    : new Date().toISOString();
  return Object.freeze({
    id: raw.id || randomUUID(),
    role,
    content: sanitizedContent,
    createdAt
  });
}

export function summarizeConversation(conversation) {
  if (!conversation) {
    return null;
  }
  const safeConv = {
    id: conversation.id,
    startedAt: conversation.startedAt,
    updatedAt: conversation.updatedAt,
    endedAt: conversation.endedAt ?? null,
    messageCount: Array.isArray(conversation.messages) ? conversation.messages.length : conversation.messageCount ?? 0,
    user: conversation.user ?? null,
    tags: Array.isArray(conversation.tags) ? [...conversation.tags] : [],
    origin: conversation.origin ?? 'unknown'
  };
  return Object.freeze(safeConv);
}
