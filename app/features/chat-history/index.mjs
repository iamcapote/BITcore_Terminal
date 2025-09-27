/**
 * Chat history feature entrypoint exposing singleton controller accessors.
 */

import config from '../../config/index.mjs';
import { ChatHistoryController } from './chat-history.controller.mjs';
import { ChatHistoryService } from './chat-history.service.mjs';
import { ChatHistoryRepository } from './chat-history.repository.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

let singletonController = null;

function buildController(overrides = {}) {
  const logger = overrides.logger || noopLogger;
  const chatConfig = config?.chat?.history || {};
  const repository = overrides.repository || new ChatHistoryRepository({
    logger,
    dataDir: overrides.dataDir || chatConfig.dataDir
  });
  const service = overrides.service || new ChatHistoryService({
    repository,
    retentionDays: overrides.retentionDays ?? chatConfig.retentionDays ?? undefined,
    maxMessagesPerConversation: overrides.maxMessagesPerConversation ?? chatConfig.maxMessagesPerConversation ?? undefined,
    clock: overrides.clock,
    logger
  });
  return new ChatHistoryController({ service });
}

export function getChatHistoryController(overrides = {}) {
  if (overrides.forceNew) {
    return buildController(overrides);
  }
  if (!singletonController) {
    singletonController = buildController(overrides);
  }
  return singletonController;
}

export function resetChatHistoryController() {
  singletonController = null;
}

export {
  ChatHistoryController,
  ChatHistoryService,
  ChatHistoryRepository
};
