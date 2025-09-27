/**
 * ChatHistoryRepository persists chat transcripts to disk under a dedicated
 * `.data/chat-history` folder. The repository is deliberately simple and keeps
 * payloads as JSON files for transparency and portability.
 *
 * Contract
 * Inputs:
 *   - Conversation records { id, startedAt, updatedAt, messages[] } supplied
 *     by the ChatHistoryService.
 * Outputs:
 *   - listConversations(): Promise<ConversationSummary[]>.
 *   - loadConversation(id): Promise<Conversation|null>.
 *   - saveConversation(conversation): Promise<void>.
 *   - removeConversation(id): Promise<boolean>.
 *   - clearConversations(): Promise<void>.
 *   - pruneOlderThan(cutoffIso): Promise<number> (deleted count).
 * Error modes:
 *   - Propagates fs errors; gracefully returns null on missing files.
 * Performance:
 *   - File system access O(n) in conversation count (<1k expected).
 * Side effects:
 *   - Reads/writes `${dataDir}/conversation-<id>.json`.
 */

import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), '.data', 'chat-history');
const FILE_PREFIX = 'conversation-';
const FILE_SUFFIX = '.json';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function serializeConversation(conversation) {
  return `${JSON.stringify(conversation, null, 2)}\n`;
}

async function safeReadJson(fsModule, filePath, logger) {
  try {
    const payload = await fsModule.readFile(filePath, 'utf8');
    if (!payload.trim()) {
      return null;
    }
    return JSON.parse(payload);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    logger?.warn?.(`[ChatHistoryRepository] Failed to read ${filePath}: ${error.message}`);
    return null;
  }
}

export class ChatHistoryRepository {
  constructor({ dataDir = DEFAULT_DATA_DIR, fsModule = fs, ensureDirFn = ensureDir, logger = noopLogger } = {}) {
    this.dataDir = dataDir;
    this.fs = fsModule;
    this.ensureDir = ensureDirFn;
    this.logger = logger;
  }

  async listConversations() {
    await this.ensureDir(this.dataDir);
    const entries = await this.fs.readdir(this.dataDir, { withFileTypes: true }).catch(error => {
      this.logger.warn?.(`[ChatHistoryRepository] Failed to read directory: ${error.message}`);
      return [];
    });
    const summaries = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith(FILE_PREFIX) || !entry.name.endsWith(FILE_SUFFIX)) continue;
      const conversation = await safeReadJson(this.fs, path.join(this.dataDir, entry.name), this.logger);
      if (!conversation) continue;
      summaries.push({
        id: conversation.id,
        startedAt: conversation.startedAt,
        updatedAt: conversation.updatedAt,
        endedAt: conversation.endedAt ?? null,
        messageCount: Array.isArray(conversation.messages) ? conversation.messages.length : conversation.messageCount ?? 0,
        user: conversation.user ?? null,
        origin: conversation.origin ?? 'unknown',
        tags: Array.isArray(conversation.tags) ? conversation.tags : []
      });
    }
    summaries.sort((a, b) => {
      const timeA = Date.parse(a.updatedAt || a.startedAt || 0) || 0;
      const timeB = Date.parse(b.updatedAt || b.startedAt || 0) || 0;
      return timeB - timeA;
    });
    return summaries;
  }

  async loadConversation(id) {
    if (!id) {
      throw new TypeError('ChatHistoryRepository.loadConversation requires an id.');
    }
    await this.ensureDir(this.dataDir);
    const filePath = this.#filePathFor(id);
    return safeReadJson(this.fs, filePath, this.logger);
  }

  async saveConversation(conversation) {
    if (!conversation || typeof conversation !== 'object' || !conversation.id) {
      throw new TypeError('ChatHistoryRepository.saveConversation requires a conversation with an id.');
    }
    await this.ensureDir(this.dataDir);
    const filePath = this.#filePathFor(conversation.id);
    const serialized = serializeConversation(conversation);
    await this.fs.writeFile(filePath, serialized, 'utf8');
  }

  async removeConversation(id) {
    if (!id) {
      throw new TypeError('ChatHistoryRepository.removeConversation requires an id.');
    }
    const filePath = this.#filePathFor(id);
    try {
      await this.fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      this.logger.warn?.(`[ChatHistoryRepository] Failed to remove ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async clearConversations() {
    await this.ensureDir(this.dataDir);
    const entries = await this.fs.readdir(this.dataDir, { withFileTypes: true }).catch(() => []);
    await Promise.all(entries.map(entry => {
      if (!entry.isFile()) return Promise.resolve();
      if (!entry.name.startsWith(FILE_PREFIX) || !entry.name.endsWith(FILE_SUFFIX)) return Promise.resolve();
      return this.fs.unlink(path.join(this.dataDir, entry.name)).catch(error => {
        if (error.code !== 'ENOENT') {
          this.logger.warn?.(`[ChatHistoryRepository] Failed to clear ${entry.name}: ${error.message}`);
        }
      });
    }));
  }

  async pruneOlderThan(cutoffIso) {
    if (!cutoffIso) return 0;
    const cutoff = Date.parse(cutoffIso);
    if (!Number.isFinite(cutoff)) {
      throw new TypeError('ChatHistoryRepository.pruneOlderThan expects an ISO date string.');
    }
    await this.ensureDir(this.dataDir);
    const entries = await this.fs.readdir(this.dataDir, { withFileTypes: true }).catch(() => []);
    let deleted = 0;
    await Promise.all(entries.map(async entry => {
      if (!entry.isFile()) return;
      if (!entry.name.startsWith(FILE_PREFIX) || !entry.name.endsWith(FILE_SUFFIX)) return;
      const filePath = path.join(this.dataDir, entry.name);
      const conversation = await safeReadJson(this.fs, filePath, this.logger);
      if (!conversation) return;
      const reference = Date.parse(conversation.updatedAt || conversation.startedAt || 0) || 0;
      if (reference < cutoff) {
        try {
          await this.fs.unlink(filePath);
          deleted += 1;
        } catch (error) {
          if (error.code !== 'ENOENT') {
            this.logger.warn?.(`[ChatHistoryRepository] Failed to prune ${entry.name}: ${error.message}`);
          }
        }
      }
    }));
    return deleted;
  }

  #filePathFor(id) {
    return path.join(this.dataDir, `${FILE_PREFIX}${id}${FILE_SUFFIX}`);
  }
}
