/**
 * Why: Provide the orchestrated chat session bootstrap for CLI and WebSocket entrypoints.
 * What: Routes persona subcommands, initialises chat metadata, and coordinates chat history conversations.
 * How: Export `executeChat` alongside helpers for starting and finalising chat conversations.
 */

import { userManager } from '../../features/auth/user-manager.mjs';
import { getChatHistoryController } from '../../features/chat-history/index.mjs';
import { getChatPersonaController } from '../../features/chat/index.mjs';
import { MemoryManager } from '../../infrastructure/memory/memory.manager.mjs';
import { MEMORY_DEPTHS, MEMORY_SETTINGS } from '../../infrastructure/memory/memory.settings.mjs';
import { ensureValidDepth } from '../../infrastructure/memory/memory.validators.mjs';
import { output as outputManagerInstance } from '../../utils/research.output-manager.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';
import { handlePersonaCommand } from './persona.mjs';

const moduleLogger = createModuleLogger('commands.chat.session');
const DEFAULT_MEMORY_DEPTH = MEMORY_DEPTHS.MEDIUM;

function normalizeBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }
  return Boolean(value);
}

function resolveMemoryDepth(depthCandidate, outputFn) {
  if (!depthCandidate) {
    return DEFAULT_MEMORY_DEPTH;
  }

  const normalized = String(depthCandidate).trim().toLowerCase();

  try {
    const { depth } = ensureValidDepth(normalized, MEMORY_SETTINGS);
    return depth;
  } catch (error) {
    outputFn?.(`Unsupported memory depth "${depthCandidate}". Falling back to "${DEFAULT_MEMORY_DEPTH}".`);
    return DEFAULT_MEMORY_DEPTH;
  }
}

/**
 * Contract
 * Inputs:
 *   - options: {
 *       positionalArgs?: string[];
 *       flags?: Record<string, string | boolean>;
 *       action?: string;
 *       session?: object;
 *       output?: (line: string | object) => void;
 *       error?: (line: string | object) => void;
 *       webSocketClient?: { send: Function };
 *       currentUser?: { username: string; role: string };
 *       isWebSocket?: boolean;
 *     }
 * Outputs:
 *   - Promise<{ success: boolean; handled?: boolean; keepDisabled?: boolean; session?: object }>
 * Error modes:
 *   - Persona validation errors bubble up as handled responses.
 *   - Chat bootstrap failures log via errorFn and return { success: false }.
 * Performance:
 *   - time: <200ms (controller IO only); memory: negligible per invocation.
 * Side effects:
 *   - Mutates the provided session object with chat state and emits readiness events over WebSocket.
 */
export async function executeChat(options = {}) {
  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const outputFn = typeof options.output === 'function' ? options.output : outputManagerInstance.log;
  const errorFn = typeof options.error === 'function' ? options.error : outputManagerInstance.error;
  const personaController = getChatPersonaController();
  const currentUser = options.currentUser || userManager.getCurrentUser?.();

  const subcommandCandidate = declaredAction || (positionalArgs[0]?.toLowerCase() ?? null);
  if (subcommandCandidate && ['persona', 'personas'].includes(subcommandCandidate)) {
    positionalArgs.shift();
    return handlePersonaCommand({
      args: positionalArgs,
      flags,
      outputFn,
      errorFn,
      personaController,
      currentUser,
    });
  }

  const isWebSocket = Boolean(options.isWebSocket);
  const webSocketClient = options.webSocketClient;
  const sessionRef = options.session ?? {};
  if (!options.session) {
    options.session = sessionRef;
  }

  const model = String(flags.model || options.model || 'qwen3-235b').trim() || 'qwen3-235b';

  let personaRecord;
  try {
    const personaInput = flags.character ?? flags.persona ?? options.character;
    if (personaInput) {
      personaRecord = await personaController.describe(personaInput);
    } else {
      const state = await personaController.getDefault();
      personaRecord = state.persona;
    }
  } catch (error) {
    errorFn(error.message ?? String(error));
    return { success: false, handled: true, keepDisabled: false };
  }

  const shouldEnableMemory = normalizeBooleanFlag(flags.memory ?? options.memory ?? sessionRef.memoryEnabled);
  let desiredMemoryDepth = sessionRef.memoryDepth ?? DEFAULT_MEMORY_DEPTH;
  let githubMemoryFlag = normalizeBooleanFlag(flags.github ?? flags['memory-github'] ?? options.memoryGithub ?? sessionRef.memoryGithubEnabled);

  if (shouldEnableMemory && currentUser?.username) {
    desiredMemoryDepth = resolveMemoryDepth(options.memoryDepth ?? flags.depth ?? desiredMemoryDepth, outputFn);
    const existingManager = sessionRef.memoryManager;
    const depthChanged = existingManager && sessionRef.memoryDepth && sessionRef.memoryDepth !== desiredMemoryDepth;
    if (!existingManager || depthChanged) {
      try {
        const memoryManager = new MemoryManager({
          depth: desiredMemoryDepth,
          user: currentUser,
          githubEnabled: githubMemoryFlag,
        });
        await memoryManager.initialize();
        sessionRef.memoryManager = memoryManager;
        sessionRef.memoryDepth = desiredMemoryDepth;
        sessionRef.memoryGithubEnabled = githubMemoryFlag;
        sessionRef.memoryEnabled = true;
        outputFn(`Memory mode enabled (depth: ${desiredMemoryDepth}).`);
      } catch (memoryError) {
        sessionRef.memoryManager = null;
        sessionRef.memoryEnabled = false;
        errorFn(`Failed to initialize memory mode: ${memoryError.message}`);
      }
    } else {
      sessionRef.memoryEnabled = true;
      sessionRef.memoryDepth = sessionRef.memoryDepth ?? desiredMemoryDepth;
      sessionRef.memoryGithubEnabled = githubMemoryFlag;
    }
  } else if (shouldEnableMemory && !currentUser?.username) {
    errorFn('Memory mode requires an authenticated user. Start a session after logging in.');
    sessionRef.memoryEnabled = false;
  } else if (!shouldEnableMemory) {
    sessionRef.memoryEnabled = false;
    if (sessionRef.memoryManager) {
      sessionRef.memoryManager = null;
      delete sessionRef.memoryDepth;
      delete sessionRef.memoryGithubEnabled;
    }
  }

  try {
    sessionRef.isChatActive = true;
    sessionRef.chatHistory = [];
    sessionRef.sessionModel = model;
    sessionRef.sessionCharacter = personaRecord.slug;
    sessionRef.sessionPersonaName = personaRecord.name;

    const conversationContext = {
      origin: isWebSocket ? 'web' : 'cli',
      user: currentUser,
      tags: ['chat'],
    };
    await initializeChatConversationForSession(sessionRef, conversationContext);

    if (isWebSocket && webSocketClient) {
      const chatReadyMessage = {
        type: 'chat-ready',
        prompt: '[chat] > ',
        model,
        character: personaRecord.slug,
        persona: {
          slug: personaRecord.slug,
          name: personaRecord.name,
          description: personaRecord.description,
        },
      };
      try {
        webSocketClient.send(JSON.stringify(chatReadyMessage));
      } catch (err) {
        errorFn(`Failed to send chat-ready message: ${err.message}`);
      }
    }

    outputFn(`Chat session ready using persona "${personaRecord.name}" (${personaRecord.slug}). Type /exit to leave.`);
    return { success: true, keepDisabled: false, session: sessionRef };
  } catch (err) {
    errorFn(`Failed to start chat: ${err.message}`);
    return { success: false, keepDisabled: false, session: sessionRef };
  }
}

/**
 * Contract
 * Inputs: (sessionRef: object, context: object)
 * Outputs: Promise<string|null>
 * Error modes: logs and returns null on history initialisation failure.
 * Side effects: starts a conversation via chat history controller and stores ID on sessionRef.
 */
export async function initializeChatConversationForSession(sessionRef, context) {
  if (!sessionRef) return null;
  if (sessionRef.chatHistoryConversationId) {
    return sessionRef.chatHistoryConversationId;
  }
  try {
    const controller = getChatHistoryController();
    const conversation = await controller.startConversation(context);
    sessionRef.chatHistoryConversationId = conversation?.id;
    return conversation?.id || null;
  } catch (error) {
    moduleLogger.error('Failed to create chat history conversation.', {
      error: error?.message || String(error)
    });
    return null;
  }
}

/**
 * Contract
 * Inputs: (sessionRef: object, role: string, content: string)
 * Outputs: Promise<void>
 * Error modes: logs error when persistence fails; session state unaffected.
 */
export async function persistSessionChatMessage(sessionRef, role, content) {
  if (!sessionRef || !sessionRef.chatHistoryConversationId) {
    return;
  }
  try {
    const controller = getChatHistoryController();
    await controller.recordMessage(sessionRef.chatHistoryConversationId, { role, content });
  } catch (error) {
    moduleLogger.error('Failed to persist chat message.', {
      error: error?.message || String(error),
      role
    });
  }
}

/**
 * Contract
 * Inputs: (sessionRef: object, reason: string)
 * Outputs: Promise<void>
 * Error modes: logs when closing fails but ensures session is cleaned up.
 */
export async function finalizeSessionConversation(sessionRef, reason) {
  if (!sessionRef || !sessionRef.chatHistoryConversationId) {
    return;
  }
  try {
    const controller = getChatHistoryController();
    await controller.closeConversation(sessionRef.chatHistoryConversationId, { reason });
  } catch (error) {
    moduleLogger.error('Failed to finalise chat conversation.', {
      error: error?.message || String(error),
      reason
    });
  } finally {
    delete sessionRef.chatHistoryConversationId;
  }
}
