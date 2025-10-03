import { LLMClient } from '../../infrastructure/ai/venice.llm-client.mjs';
import { safeSend } from '../../utils/websocket.utils.mjs';
import { cleanChatResponse } from '../../infrastructure/ai/venice.response-processor.mjs';
import { wsErrorHelper } from '../research/error-helper.mjs';
import { getDefaultChatCharacterSlug } from '../../infrastructure/ai/venice.characters.mjs';
import { getChatHistoryController } from '../chat-history/index.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('chat.routes');

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

/**
 * Handle incoming chat messages from WebSocket clients.
 * This function is called by the WebSocket routes when a message of type 'chat-message' is received.
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Parsed message object
 * @param {Object} session - Session object containing user data and chat state
 * @returns {Promise<boolean>} - Returns true if input should be enabled after processing
 */
export async function handleChatMessage(ws, message, session) {
    if (!session.isChatActive) {
        wsErrorHelper(ws, 'Chat mode is not active. Start chat with /chat command.', true);
        return true; // Enable input after error
    }

    // Use quiet error handler for debug logging without showing to user
    const quietError = (msg, meta) => moduleLogger.error(msg, meta);
    
    try {
        const userMessage = message.message;
        
        // Special command handling in chat mode
        if (userMessage.startsWith('/')) {
            // Handle any special in-chat commands here - pass to command handler
            // This will be handled by the main router passing to handleCommandMessage
            return true;
        }
        
        // Store the user message in chat history
        if (!session.chatHistory) {
            session.chatHistory = [];
        }
        
        session.chatHistory.push({ role: 'user', content: userMessage });
        if (session.chatHistoryConversationId) {
            try {
                const chatHistoryController = getChatHistoryController();
                await chatHistoryController.recordMessage(session.chatHistoryConversationId, {
                    role: 'user',
                    content: userMessage
                });
            } catch (error) {
                quietError(`Failed to persist user message: ${error.message}`);
            }
        }
        
        // Retrieve and store memory context when enabled
        const memoryManager = session.memoryManager ?? null;
        let retrievedMemories = [];
        if (memoryManager) {
            try {
                retrievedMemories = await memoryManager.retrieveRelevantMemories(userMessage);
                if (retrievedMemories.length > 0) {
                    safeSend(ws, {
                        type: 'memory_context',
                        data: serializeMemoriesForEvent(retrievedMemories)
                    });
                }
            } catch (memoryError) {
                moduleLogger.warn('Failed to retrieve memories during chat message.', {
                    message: memoryError?.message || String(memoryError)
                });
            }

            try {
                await memoryManager.storeMemory(userMessage, 'user');
            } catch (storeError) {
                moduleLogger.warn('Failed to store user chat memory.', {
                    message: storeError?.message || String(storeError)
                });
            }
        }

        // Initialize LLM client
        const llm = new LLMClient();
        
        // Get model and character from session or use defaults
        const model = session.sessionModel || 'qwen3-235b';
        const character = session.sessionCharacter || getDefaultChatCharacterSlug();
        
        // Construct system message based on character
        let systemMessage = 'You are a helpful assistant.';
        if (character) {
            systemMessage = `You are ${character}. ${systemMessage}`;
        }
        
        // Build message history for the LLM
        const messages = [
            { role: 'system', content: systemMessage }
        ];

        const memoryContextMessage = buildMemoryContextMessage(retrievedMemories);
        if (memoryContextMessage) {
            messages.push({ role: 'system', content: memoryContextMessage });
        }
        
        // Add previous messages from chat history (limited to last 10 for context window)
        const historyLimit = 10;
        const recentHistory = session.chatHistory.slice(-historyLimit);
        messages.push(...recentHistory);
        
        // Call the LLM
        moduleLogger.info('Calling LLM for chat response.', {
            model,
            character
        });
        const result = await llm.completeChat({
            messages: messages,
            model: model,
            temperature: 0.7,
            maxTokens: 2048,
            venice_parameters: { character_slug: character }
        });
        
        // Process and clean the response
        const assistantResponse = cleanChatResponse(result.content);
        
        // Store assistant response in history
        session.chatHistory.push({ role: 'assistant', content: assistantResponse });
        if (session.chatHistoryConversationId) {
            try {
                const chatHistoryController = getChatHistoryController();
                await chatHistoryController.recordMessage(session.chatHistoryConversationId, {
                    role: 'assistant',
                    content: assistantResponse
                });
            } catch (error) {
                quietError(`Failed to persist assistant message: ${error.message}`);
            }
        }

        if (memoryManager) {
            try {
                await memoryManager.storeMemory(assistantResponse, 'assistant');
            } catch (assistantStoreError) {
                moduleLogger.warn('Failed to store assistant chat memory.', {
                    message: assistantStoreError?.message || String(assistantStoreError)
                });
            }
        }
        
        // Send response back to client
        safeSend(ws, {
            type: 'chat-response',
            message: assistantResponse
        });
        
        return true; // Enable input after response
    } catch (error) {
        moduleLogger.error('Error processing chat message.', {
            message: error?.message || String(error),
            stack: error?.stack || null
        });
        wsErrorHelper(ws, `Error generating chat response: ${error.message}`, true);
        return true; // Enable input after error
    }
}
