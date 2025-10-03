/**
 * Why: Mirror chat history administration between the terminal and web console without diverging behavior.
 * What: Provides list/show/export/clear subcommands that operate on persisted transcripts with optional JSON output.
 * How: Delegates to the chat-history controller, streams responses through logger-backed emitters, and maintains WebSocket parity.
 */

import fs from 'fs/promises';
import path from 'path';
import { getChatHistoryController } from '../features/chat-history/index.mjs';
import { ensureDir } from '../utils/research.ensure-dir.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.chat-history.cli', { emitToStdStreams: false });

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function logJson(outputFn, payload) {
  outputFn(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
    moduleLogger[level](message, payloadMeta);
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

function sendWsAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

function formatConversationLine(conversation) {
  const tags = Array.isArray(conversation.tags) && conversation.tags.length
    ? conversation.tags.join(', ') : 'none';
  const user = conversation.user?.username || conversation.user?.id || 'anonymous';
  const updated = conversation.updatedAt || conversation.startedAt || 'unknown';
  const origin = conversation.origin || 'unknown';
  return `${conversation.id} | ${conversation.messageCount} msgs | user=${user} | origin=${origin} | updated=${updated} | tags=${tags}`;
}

function formatMessageLine(message) {
  return `${message.createdAt} :: ${message.role}> ${message.content}`;
}

export function getChatHistoryHelpText() {
  return [
    '/chat-history list [--json] [--limit=20]             List recent conversations.',
    '/chat-history show <id> [--json] [--limit=20]       Inspect a conversation.',
    '/chat-history export <id> [--file=path]             Export conversation to stdout or file.',
    '/chat-history clear [--id=<id>] [--older-than-days=] [--json]  Clear single or multiple conversations.'
  ].join('\n');
}

export async function executeChatHistory(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(options.output || wsOutput, 'info');
  const errorFn = createEmitter(options.error || wsError, 'error');
  const positionalArgs = Array.isArray(options.positionalArgs)
    ? [...options.positionalArgs]
    : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || (positionalArgs.shift()?.toLowerCase()) || 'list';
  const jsonOutput = isTruthy(flags.json ?? options.json);
  const controller = getChatHistoryController();

  moduleLogger.info('Executing chat-history command.', {
    subcommand,
    jsonOutput,
    hasWebSocketOutput: typeof wsOutput === 'function',
    hasWebSocketError: typeof wsError === 'function'
  });

  try {
    switch (subcommand) {
      case 'list': {
        const limitRaw = flags.limit ?? flags.top;
        const limit = limitRaw != null ? Number(limitRaw) : undefined;
        const conversations = await controller.listConversations();
        const sliced = Number.isFinite(limit) && limit > 0
          ? conversations.slice(0, limit)
          : conversations;
        if (jsonOutput) {
          logJson(outputFn, sliced);
        } else if (sliced.length === 0) {
          outputFn('No chat conversations stored.');
        } else {
          sliced.forEach(conv => outputFn(formatConversationLine(conv)));
        }
        sendWsAck(wsOutput);
        moduleLogger.info('Chat-history list completed.', {
          count: sliced.length,
          limit,
          jsonOutput
        });
        return { success: true, conversations: sliced };
      }

      case 'show':
      case 'get':
      case 'inspect': {
        const conversationId = positionalArgs.shift() || flags.id;
        if (!conversationId) {
          const message = 'Usage: /chat-history show <conversationId>';
          errorFn(message);
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        const conversation = await controller.getConversation(conversationId);
        if (!conversation) {
          const message = `Conversation '${conversationId}' not found.`;
          errorFn(message);
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        const limitRaw = flags.limit ?? flags.top;
        const limit = limitRaw != null ? Number(limitRaw) : undefined;
        if (jsonOutput) {
          logJson(outputFn, conversation);
        } else {
          outputFn(`Conversation ${conversation.id}`);
          outputFn(`  Started: ${conversation.startedAt}`);
          outputFn(`  Updated: ${conversation.updatedAt}`);
          if (conversation.endedAt) {
            outputFn(`  Ended: ${conversation.endedAt}`);
          }
          if (conversation.closeReason) {
            outputFn(`  Close Reason: ${conversation.closeReason}`);
          }
          if (conversation.user) {
            outputFn(`  User: ${conversation.user.username || conversation.user.id || 'anonymous'} (${conversation.user.role || 'unknown-role'})`);
          }
          outputFn(`  Origin: ${conversation.origin || 'unknown'}`);
          outputFn(`  Tags: ${(conversation.tags || []).join(', ') || 'none'}`);
          const messages = Array.isArray(conversation.messages)
            ? conversation.messages
            : [];
          const slicedMessages = Number.isFinite(limit) && limit > 0
            ? messages.slice(-limit)
            : messages;
          if (slicedMessages.length === 0) {
            outputFn('Messages: none');
          } else {
            outputFn('Messages:');
            slicedMessages.forEach(message => outputFn(`  ${formatMessageLine(message)}`));
            if (messages.length > slicedMessages.length) {
              outputFn(`  … (${messages.length - slicedMessages.length} older messages truncated)`);
            }
          }
        }
        sendWsAck(wsOutput);
        moduleLogger.info('Chat-history show completed.', {
          id: conversationId,
          messages: conversation.messages?.length ?? 0,
          jsonOutput
        });
        return { success: true, conversation };
      }

      case 'export': {
        const conversationId = positionalArgs.shift() || flags.id;
        if (!conversationId) {
          const message = 'Usage: /chat-history export <conversationId> [--file=path]';
          errorFn(message);
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        const payload = await controller.exportConversation(conversationId);
        if (!payload) {
          const message = `Conversation '${conversationId}' not found.`;
          errorFn(message);
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        const filePath = flags.file || flags.output;
        if (filePath) {
          const resolvedPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);
          await ensureDir(path.dirname(resolvedPath));
          await fs.writeFile(resolvedPath, payload, 'utf8');
          if (!jsonOutput) {
            outputFn(`Conversation exported to ${resolvedPath}`);
          } else {
            logJson(outputFn, { success: true, path: resolvedPath });
          }
        } else if (jsonOutput) {
          logJson(outputFn, JSON.parse(payload));
        } else {
          outputFn(payload);
        }
        sendWsAck(wsOutput);
        moduleLogger.info('Chat-history export completed.', {
          id: conversationId,
          filePath: filePath || null,
          jsonOutput
        });
        return { success: true, exported: true };
      }

      case 'clear':
      case 'delete': {
        const conversationId = positionalArgs.shift() || flags.id;
        const olderThanDaysRaw = flags['older-than-days'] ?? flags.older;
        if (conversationId) {
          const removed = await controller.removeConversation(conversationId);
          if (!removed) {
            const message = `Conversation '${conversationId}' not found.`;
            errorFn(message);
            sendWsAck(wsOutput);
            return { success: false, error: message, handled: true };
          }
          if (jsonOutput) {
            logJson(outputFn, { success: true, removed: conversationId });
          } else {
            outputFn(`Conversation '${conversationId}' removed.`);
          }
          sendWsAck(wsOutput);
          moduleLogger.warn('Chat-history conversation removed.', {
            id: conversationId,
            jsonOutput
          });
          return { success: true, removed: conversationId };
        }
        const olderThanDays = olderThanDaysRaw != null ? Number(olderThanDaysRaw) : undefined;
        if (!isTruthy(flags.all) && !Number.isFinite(olderThanDays)) {
          const message = 'Usage: /chat-history clear --id=<conversationId> | --all | --older-than-days=<n>';
          errorFn(message);
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }
        const result = await controller.clearConversations({ olderThanDays });
        if (jsonOutput) {
          logJson(outputFn, { success: true, cleared: result });
        } else {
          if (Number.isFinite(olderThanDays)) {
            outputFn(`Conversations older than ${olderThanDays} day(s) cleared (${result} removed).`);
          } else {
            outputFn('All chat conversations cleared.');
          }
        }
        sendWsAck(wsOutput);
        moduleLogger.warn('Chat-history bulk clear completed.', {
          olderThanDays: Number.isFinite(olderThanDays) ? olderThanDays : null,
          cleared: result,
          jsonOutput
        });
        return { success: true, cleared: result };
      }

      default: {
        const message = `Unknown chat-history action '${subcommand}'.`;
        errorFn(message, { code: 'unknown_chat_history_action', subcommand });
        sendWsAck(wsOutput);
        moduleLogger.warn('Chat-history command received unknown action.', { subcommand });
        return { success: false, error: message, handled: true };
      }
    }
  } catch (error) {
    moduleLogger.error('Chat-history command failed.', {
      subcommand,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    errorFn(error.message, { code: 'chat_history_command_failed' });
    sendWsAck(wsOutput);
    return { success: false, error: error.message };
  }
}
