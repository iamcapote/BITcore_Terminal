/**
 * Contract
 * Why: Process chat stream messages for the research WebSocket session.
 * What: Routes in-chat commands, persists conversation history, invokes LLM completions, and emits structured responses.
 * How: Leverages shared IO helpers, session state, and Venice adapters to maintain conversational flow with optional research exits.
 */

import { WebSocket } from 'ws';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';
import { outputManager } from '../../../utils/research.output-manager.mjs';
import { resolveServiceApiKey } from '../../../utils/api-keys.mjs';
import { getChatHistoryController } from '../../chat-history/index.mjs';
import { LLMClient } from '../../../infrastructure/ai/venice.llm-client.mjs';
import { cleanChatResponse } from '../../../infrastructure/ai/venice.response-processor.mjs';
import { wsErrorHelper, wsOutputHelper } from './client-io.mjs';
import { wsPrompt } from './prompt.mjs';
import { executeExitResearch } from '../../../commands/chat.cli.mjs';

const chatLogger = createModuleLogger('research.websocket.chat-handler');

function buildMemoryContextMessage(memories) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return null;
  }

  const lines = memories.map((memory, index) => {
    const content = typeof memory.content === 'string' ? memory.content.trim() : '';
    const truncated = content.length > 240 ? `${content.slice(0, 237)}…` : content;
    const reason = typeof memory.matchReason === 'string' && memory.matchReason.trim()
      ? ` (${memory.matchReason.trim()})`
      : '';
    return `${index + 1}. ${truncated}${reason}`;
  }).filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return `Relevant memory context:\n${lines.join('\n')}`;
}

function serializeMemoriesForEvent(memories) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return [];
  }

  return memories.map((memory) => ({
    id: memory.id,
    content: memory.content,
    similarity: memory.similarity,
    role: memory.role,
    timestamp: memory.timestamp,
    tags: memory.tags,
    matchReason: memory.matchReason,
  }));
}

export async function handleChatMessage(ws, message, session) {
  if (!session.isChatActive) {
    safeSend(ws, { type: 'error', error: 'Chat mode not active. Use /chat first.' });
    return true;
  }

  const userMsg = message.message?.trim();
  if (!userMsg) return true;

  if (userMsg.startsWith('/')) {
    const [cmd, ...args] = userMsg.slice(1).split(/\s+/);
    const command = cmd.toLowerCase();

    if (command === 'exit') {
      const hadMemoryEnabled = Boolean(session.memoryManager);
      session.isChatActive = false;
      if (session.chatHistoryConversationId) {
        try {
          const chatHistoryController = getChatHistoryController();
          await chatHistoryController.closeConversation(session.chatHistoryConversationId, { reason: 'exit' });
        } catch (error) {
          outputManager.warn(`[WebSocket][Chat] Failed to finalize conversation on exit: ${error.message}`);
        } finally {
          delete session.chatHistoryConversationId;
        }
      }
      safeSend(ws, { type: 'chat-exit' });
      safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
      if (hadMemoryEnabled) {
        safeSend(ws, {
          type: 'output',
          data: 'Chat session ended with memory enabled. Run /exitmemory to finalize and commit memories.',
        });
      }
      return true;
    }

    if (command === 'exitresearch') {
      const telemetry = session.researchTelemetry;
      if (telemetry) {
        telemetry.updateSender((type, payload) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            safeSend(ws, { type, data: payload });
          }
        });
        telemetry.clearHistory();
        telemetry.emitStatus({ stage: 'preparing', message: 'Preparing research from chat history.' });
      }

      const result = await executeExitResearch({
        session,
        output: (msg) => wsOutputHelper(ws, msg),
        error: (msg) => wsErrorHelper(ws, msg, true),
        currentUser: session.currentUser,
        password: session.password,
        isWebSocket: true,
        webSocketClient: ws,
        wsPrompt,
        telemetry,
        progressHandler: (progressData) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            safeSend(ws, { type: 'progress', data: progressData });
          }
        },
      });
      return !(result?.keepDisabled === true);
    }

    safeSend(ws, { type: 'output', data: `Unknown in-chat command: /${command}` });
    return true;
  }

  session.chatHistory ??= [];
  session.chatHistory.push({ role: 'user', content: userMsg });
  if (session.chatHistoryConversationId) {
    try {
      const chatHistoryController = getChatHistoryController();
      await chatHistoryController.recordMessage(session.chatHistoryConversationId, {
        role: 'user',
        content: userMsg,
      });
    } catch (error) {
      outputManager.warn(`[WebSocket][Chat] Failed to persist user message: ${error.message}`);
    }
  }

  try {
    const memoryManager = session.memoryManager ?? null;
    let retrievedMemories = [];

    if (memoryManager) {
      try {
        retrievedMemories = await memoryManager.retrieveRelevantMemories(userMsg);
        if (retrievedMemories.length > 0) {
          safeSend(ws, {
            type: 'memory_context',
            data: serializeMemoriesForEvent(retrievedMemories),
          });
        }
      } catch (memoryError) {
        chatLogger.warn('Memory retrieval failed for chat message.', {
          error: memoryError?.message || String(memoryError),
          sessionId: session.sessionId,
        });
      }

      try {
        await memoryManager.storeMemory(userMsg, 'user');
      } catch (storeError) {
        chatLogger.warn('Failed to store user message in memory.', {
          error: storeError?.message || String(storeError),
          sessionId: session.sessionId,
        });
      }
    }

    const veniceApiKey = await resolveServiceApiKey('venice', { session });
    if (veniceApiKey) {
      outputManager.debug(`[WebSocket][Chat] Venice API key resolved for ${session.currentUser.username}.`);
    } else {
      outputManager.warn('[WebSocket][Chat] Venice API key not configured. Chat will rely on environment defaults and may fail.');
    }

    const llmConfig = veniceApiKey ? { apiKey: veniceApiKey } : {};
    const llm = new LLMClient(llmConfig);
    const model = session.sessionModel || 'qwen-2.5-qwq-32b';
    const character = session.sessionCharacter === 'None' ? null : (session.sessionCharacter || 'bitcore');

    const systemMessageContent = character
      ? `You are ${character}. You are a helpful assistant.`
      : 'You are a helpful assistant.';
    const system = { role: 'system', content: systemMessageContent };

    const shortHistory = session.chatHistory.slice(-9);
    const messages = [system];

    const memoryContextMessage = buildMemoryContextMessage(retrievedMemories);
    if (memoryContextMessage) {
      messages.push({ role: 'system', content: memoryContextMessage });
    }

    messages.push(...shortHistory);

    const res = await llm.completeChat({ messages, model, temperature: 0.7, maxTokens: 2048 });
    const clean = cleanChatResponse(res.content);

    session.chatHistory.push({ role: 'assistant', content: clean });
    if (session.chatHistoryConversationId) {
      try {
        const chatHistoryController = getChatHistoryController();
        await chatHistoryController.recordMessage(session.chatHistoryConversationId, {
          role: 'assistant',
          content: clean,
        });
      } catch (error) {
        outputManager.warn(`[WebSocket][Chat] Failed to persist assistant message: ${error.message}`);
      }
    }

    if (memoryManager) {
      try {
        await memoryManager.storeMemory(clean, 'assistant');
      } catch (assistantStoreError) {
        chatLogger.warn('Failed to store assistant message in memory.', {
          error: assistantStoreError?.message || String(assistantStoreError),
          sessionId: session.sessionId,
        });
      }
    }

    safeSend(ws, { type: 'chat-response', message: clean });
  } catch (err) {
    chatLogger.error('LLM error during chat handling.', { error: err, sessionId: session.sessionId });
    if (err instanceof Error && err.message.toLowerCase().includes('api key is required')) {
      wsErrorHelper(ws, "Chat failed: Venice API key is missing or invalid. Please set it via '/keys set venice <apikey>' or ensure VENICE_API_KEY environment variable is configured.", true);
    } else {
      wsErrorHelper(ws, `Chat failed: ${err.message}`, true);
    }
  }
  return true;
}
