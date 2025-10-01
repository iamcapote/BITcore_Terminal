/**
 * Why: Provide the orchestrated chat session bootstrap for CLI and WebSocket entrypoints.
 * What: Routes persona subcommands, initialises chat metadata, and coordinates chat history conversations.
 * How: Export `executeChat` alongside helpers for starting and finalising chat conversations.
 */

import { userManager } from '../../features/auth/user-manager.mjs';
import { getChatHistoryController } from '../../features/chat-history/index.mjs';
import { getChatPersonaController } from '../../features/chat/index.mjs';
import { output as outputManagerInstance } from '../../utils/research.output-manager.mjs';
import { handlePersonaCommand } from './persona.mjs';

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
    console.error(`[Chat] Failed to create chat history conversation: ${error.message}`);
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
    console.error(`[Chat] Failed to persist ${role} message: ${error.message}`);
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
    console.error(`[Chat] Failed to finalize chat conversation: ${error.message}`);
  } finally {
    delete sessionRef.chatHistoryConversationId;
  }
}
