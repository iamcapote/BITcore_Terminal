import readline from 'readline';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import { MemoryManager } from '../infrastructure/memory/memory.manager.mjs';
import {
  handleCliError,
  ErrorTypes,
  logCommandStart,
  logCommandSuccess
} from '../utils/cli-error-handler.mjs';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { cleanChatResponse } from '../infrastructure/ai/venice.response-processor.mjs';
// Import the singleton instance for default parameters in exitMemory if needed
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs';
// --- FIX: Import wsPrompt and PROMPT_TIMEOUT_MS if needed within executeExitResearch ---
// (Need to check if wsPrompt is available here or needs to be passed differently)
// For now, assume it's passed via options or handled within startResearchFromChat
import { safeSend } from '../utils/websocket.utils.mjs'; // Needed for sending messages in executeExitResearch
import { callVeniceWithTokenClassifier } from '../utils/token-classifier.mjs'; // Import the classifier utility
// --- FIX: Import generateQueries ---
import { generateQueries as generateResearchQueriesLLM } from '../features/ai/research.providers.mjs';
// --- FIX: Import config to get public key ---
import config from '../config/index.mjs';


/**
 * CLI command for executing the chat interface with memory capabilities.
 * Accepts a single options object.
 *
 * @param {Object} options - Command options including args, flags, session, output/error handlers.
 * @param {boolean} options.memory - Enable memory mode (default: false)
 * @param {string} options.depth - Memory depth level: 'short', 'medium', 'long' (default: 'medium')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {string} [options.password] - Password provided via args/payload/cache
 * @param {boolean} [options.isWebSocket=false] - Indicates if called via WebSocket
 * @param {object} [options.session] - WebSocket session object
 * @param {Function} options.output - Output function (log or WebSocket send)
 * @param {Function} options.error - Error function (error or WebSocket send)
 * @param {object} [options.currentUser] - User data object if authenticated.
 * @returns {Promise<Object>} Chat session results
 */
export async function executeChat(options = {}) {
    const {
        model = 'qwen3-235b',
        character = 'bitcore',
        session,
        output,
        error,
        webSocketClient,
        isWebSocket
    } = options;

    const sessionRef = session ?? {};
    if (!session) {
        options.session = sessionRef;
    }

    const outputFn = typeof output === 'function' ? output : outputManagerInstance.log;
    const errorFn = typeof error === 'function' ? error : outputManagerInstance.error;

    try {
        sessionRef.isChatActive = true;
        sessionRef.chatHistory = [];
        sessionRef.sessionModel = model;
        sessionRef.sessionCharacter = character;
        
        // Send chat-ready event for WebSocket clients
        if (isWebSocket && webSocketClient) {
            const chatReadyMessage = {
                type: 'chat-ready',
                prompt: '[chat] > ',
                model: model,
                character: character
            };
            try {
                webSocketClient.send(JSON.stringify(chatReadyMessage));
            } catch (err) {
                errorFn(`Failed to send chat-ready message: ${err.message}`);
            }
        }

        outputFn('Chat session ready. Type /exit to leave.');
        return { success: true, keepDisabled: false, session: sessionRef };
    } catch (err) {
        errorFn(`Failed to start chat: ${err.message}`);
        return { success: false, keepDisabled: false, session: sessionRef };
    }
}

/**
 * Get password input from console securely (CLI specific).
 * Creates its own temporary readline interface.
 * @param {string} query - The prompt message.
 * @returns {Promise<string>} Password
 */
async function promptHiddenFixed(query) {
  return new Promise((resolve) => {
    // Create a temporary interface for this prompt only
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    const queryDisplayed = query;
    let password = '';

    const cleanupAndResolve = (value) => {
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isRaw) process.stdin.setRawMode(false);
        process.stdin.pause(); // Ensure stdin is paused after use
        rl.close(); // Close the temporary interface
        process.stdout.write('\n');
        resolve(value);
    };

    const onKeypress = (chunk, key) => {
      if (key) {
        if (key.name === 'return' || key.name === 'enter') {
          cleanupAndResolve(password);
        } else if (key.name === 'backspace') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
          process.stdout.write('\nCancelled.\n'); // Write cancel message before resolving
          cleanupAndResolve(''); // Resolve with empty string on cancel
        } else if (!key.ctrl && !key.meta && chunk) {
          password += chunk;
          process.stdout.write('*');
        }
      } else if (chunk) { // Handle paste or other non-key input
        password += chunk;
        process.stdout.write('*'.repeat(chunk.length));
      }
    };

    rl.setPrompt('');
    rl.write(queryDisplayed);

    if (process.stdin.isRaw) process.stdin.setRawMode(false); // Ensure not already raw
    process.stdin.setRawMode(true);
    process.stdin.resume(); // Resume stdin for this prompt
    process.stdin.on('keypress', onKeypress);

    // Handle potential errors on the temporary interface
    rl.on('error', (err) => {
        console.error("Readline error during password prompt:", err);
        cleanupAndResolve(''); // Resolve with empty on error to avoid hanging
    });
  });
}

/**
 * Start interactive chat mode (CLI specific).
 * Creates its own readline interface and resolves when it closes.
 *
 * @param {LLMClient} llmClient - Initialized LLM client instance.
 * @param {MemoryManager|null} memoryManager - Memory manager instance if memory mode is enabled
 * @param {boolean} verbose - Enable verbose logging
 * @param {Function} outputFn - Output function (bound cmdOutput)
 * @param {Function} errorFn - Error output function (bound cmdError)
 * @param {string} model - Chat model to use
 * @param {string|null} character - Chat character to use
 * @returns {Promise<Object>} Chat session results
 */
async function startInteractiveChat(llmClient, memoryManager, verbose = false, outputFn, errorFn, model, character) {
  // Return a promise that resolves when the chat session ends (rl closes)
  return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        prompt: '[user] '
      });

      let chatHistory = []; // Maintain history for CLI session

      // Construct system prompt based on character and new formatting rules
      const personaName = character || 'Bitcore'; // Default to Bitcore if no character specified
      const systemMessageContent = `You are ${personaName}, an AI assistant powering the /chat command.

✦ Formatting rules ✦
1. Your answer MUST consist of **two distinct parts** in a single message:
   a) Your private reasoning, wrapped in a <thinking> … </thinking> tag.
   b) Your final user-visible reply, which comes immediately after the closing </thinking> tag with **no tag** around it.
2. Do **not** write “[AI] ...thinking...” or any other extra markers—the tags alone are sufficient.
3. If you have no private reasoning to share, simply omit the <thinking> block; everything you send will then be treated as the reply.
4. Keep the language of both sections consistent with the user’s language, unless the user explicitly requests otherwise.

Example
-------
User: hi

Assistant (one message):
<thinking>
Okay, the user just said “hi”. I should greet them warmly and invite a follow-up question.
</thinking>
Hello! How can I assist you today?`;

      // Add system message to history if it's not empty
      if (systemMessageContent.trim()) {
        chatHistory.push({ role: 'system', content: systemMessageContent });
      }

      let chatEnded = false; // Flag to prevent multiple resolves
      const endChat = () => {
        if (!chatEnded) {
          chatEnded = true;
          outputFn('Exiting chat mode.');
          rl.close();
        }
      };

      rl.on('line', async (line) => {
        // If chat already ended, ignore further input (shouldn't happen often)
        if (chatEnded) return;

        const userInput = line.trim();

        // --- NEW: Intercept in-chat commands starting with '/' ---
        if (userInput.startsWith('/')) {
          const [cmd, ...args] = userInput.slice(1).split(/\s+/);
          const command = cmd.toLowerCase();

          if (command === 'exit') {
            outputFn('Exiting chat session...'); // Use passed outputFn
            chatEnded = true; // Set flag
            rl.close(); // This triggers the 'close' event below
            return;
          }
          // Optionally handle other in-chat commands here (e.g., /exitmemory, /help, etc.)
          outputFn(`Unknown in-chat command: /${command}`);
          rl.prompt();
          return;
        }
        // --- END NEW ---

        // Ignore empty lines
        if (!userInput) {
            rl.prompt();
            return;
        }

        try {
          // Store user input
          chatHistory.push({ role: 'user', content: userInput });
          if (memoryManager) {
              await memoryManager.storeMemory(userInput, 'user');
          }

          // Retrieve context if memory enabled
          let retrievedMemoryContext = '';
          if (memoryManager) {
              const relevantMemories = await memoryManager.retrieveRelevantMemories(userInput);
              if (relevantMemories && relevantMemories.length > 0) {
                  retrievedMemoryContext = "Relevant information from memory:\n" + relevantMemories.map(mem => `- ${mem.content}`).join('\n') + "\n";
              }
          }
          // The main system prompt with formatting rules is already at the start of chatHistory.
          // For subsequent turns, we might add memory context if available.
          // We need to ensure the LLM gets the full history including the initial system prompt.

          // Prepare history for LLM (limit context window, but ensure system prompt is included)
          const maxHistoryLength = 10; // Example, adjust as needed
          let llmHistory = [];
          if (chatHistory.length > 0 && chatHistory[0].role === 'system') {
            llmHistory.push(chatHistory[0]); // Always include the initial system prompt
            // Add recent messages, excluding the initial system prompt if already added
            llmHistory.push(...chatHistory.slice(Math.max(1, chatHistory.length - maxHistoryLength + 1)));
          } else {
            llmHistory = chatHistory.slice(-maxHistoryLength);
          }
          
          // If memory context exists and isn't already part of a complex system prompt,
          // we could prepend it to the user's latest message or as a separate system message.
          // For simplicity, let's insert it before the last user message if not already handled.
          // This part needs careful consideration based on how LLM best uses such context.
          // The current system prompt is about formatting. Memory context is different.
          // A simple approach:
          if (messagesForLlm.length > 1 && messagesForLlm[messagesForLlm.length -1].role === 'user') {
              messagesForLlm.splice(messagesForLlm.length -1, 0, {role: 'system', content: "Relevant information from memory:\n" + retrievedMemoryContext});
          } else {
               messagesForLlm.push({role: 'system', content: "Relevant information from memory:\n" + retrievedMemoryContext});
          }

          // Call LLM
          const response = await llmClient.completeChat({ messages: messagesForLlm, model: model, temperature: 0.7, maxTokens: 2048 });
          const assistantResponse = cleanChatResponse(response.content);

          // Store assistant response
          chatHistory.push({ role: 'assistant', content: assistantResponse });
          if (memoryManager) {
              await memoryManager.storeMemory(assistantResponse, 'assistant');
          }

          outputFn(`[AI] ${assistantResponse}`); // Use passed outputFn
        } catch (error) {
          errorFn(`Error: ${error.message}`); // Use passed errorFn
        } finally {
          // Only prompt again if chat hasn't ended
          if (!chatEnded) {
              rl.prompt();
          }
        }
      });

      rl.on('close', async () => { // Make close handler async
        if (!chatEnded) { // Ensure message is logged even if closed externally (e.g., Ctrl+C)
            outputFn('Chat session ended.'); // Use passed outputFn
        }

        // Finalize memory if enabled
        if (memoryManager) {
            outputFn('Finalizing memory...');
            try {
                const conversationText = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
                const finalizationResult = await memoryManager.summarizeAndFinalize(conversationText);
                if (finalizationResult?.commitSha) {
                    outputFn(`Memory committed to GitHub: ${finalizationResult.commitSha}`);
                } else {
                    outputFn('Memory finalized (local storage or commit failed/disabled).');
                }
            } catch (memError) {
                errorFn(`Error finalizing memory: ${memError.message}`);
            }
        }

        resolve({ success: true, message: "Chat session ended." }); // Resolve the promise
      });

      // Handle Ctrl+C during chat
      rl.on('SIGINT', () => {
          outputFn('\nChat interrupted. Type /exit to leave cleanly, or Ctrl+C again to force exit.');
          // Don't close here, let user type /exit or Ctrl+C again in main loop
          rl.prompt(); // Show prompt again
      });

      outputFn('Chat session started. Type /exit to end.'); // Use passed outputFn
      rl.prompt();
  });
}

/**
 * Implementation of the /exitmemory command logic.
 * Can be called from CLI or WebSocket handler.
 *
 * @param {Object} options - Context object containing session, output/error handlers.
 * @param {object} options.session - The WebSocket session object containing memoryManager and chatHistory.
 * @param {Function} options.output - Function to handle output messages.
 * @param {Function} options.error - Function to handle error messages.
 * @returns {Promise<Object>} Command result potentially including commitSha
 */
export async function exitMemory(options = {}) {
    const { session, output: outputFn, error: errorFn } = options;

    // Ensure output/error functions are valid, provide fallbacks if necessary (though they should always be passed)
    const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
    const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

    const memoryManager = session?.memoryManager;
    const chatHistory = session?.chatHistory || [];

    if (!memoryManager) {
        effectiveError('Memory mode is not enabled. Cannot finalize memories.');
        // For WebSocket, ensure input is re-enabled after this error
        if (options.isWebSocket) {
             return { success: false, error: 'Memory mode not enabled', handled: true, keepDisabled: false };
        }
        return { success: false, error: 'Memory mode not enabled', handled: true };
    }

    effectiveOutput('Finalizing memories...');
    try {
        const conversationText = chatHistory
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n\n');

        const finalizationResult = await memoryManager.summarizeAndFinalize(conversationText);
        let commitSha = null;
        if (finalizationResult && finalizationResult.success && finalizationResult.summary && finalizationResult.summary.commitSha) {
          commitSha = finalizationResult.summary.commitSha;
        } else if (finalizationResult && finalizationResult.commitSha) {
          commitSha = finalizationResult.commitSha;
        }

        effectiveOutput('Memory finalization complete.');
        if (commitSha) {
          effectiveOutput(`Memories committed to GitHub. Commit SHA: ${commitSha}`);
          return { success: true, commitSha: commitSha, keepDisabled: false }; // Enable input after success
        } else {
          effectiveOutput('Memory finalized (local storage or GitHub commit failed/disabled).');
          return { success: true, keepDisabled: false }; // Enable input after success
        }
    } catch (error) {
        effectiveError(`Error during memory finalization: ${error.message}`);
        return { success: false, error: error.message, handled: true, keepDisabled: false }; // Enable input after error
    } finally {
        // Clean up memory manager from session after finalization attempt (success or fail)
        if (session) {
            session.memoryManager = null;
            console.log(`[WebSocket] Memory manager removed from session ${session.sessionId} after exitMemory.`);
        }
    }
}

/**
 * Generate research queries based on chat conversation context using LLM.
 * Renamed from original generateResearchQueries to avoid conflict with the export below.
 * ... JSDoc ...
 */
function buildFallbackQueries(contextString, numQueries) {
    const lines = contextString.split('\n').map(line => line.trim()).filter(Boolean);
    const firstUserLine = lines.find(line => line.toLowerCase().startsWith('user:')) || lines.find(Boolean);
    let topic = firstUserLine ? firstUserLine.replace(/^user:\s*/i, '') : 'the topic';
    if (topic.length > 80) {
        topic = `${topic.slice(0, 80)}...`;
    }

    const baseQueries = [
        { original: `What is ${topic}?`, metadata: { goal: `Understand the fundamentals of ${topic}` } },
        { original: `How does ${topic} work?`, metadata: { goal: `Explore how ${topic} functions` } },
        { original: `Why is ${topic} important?`, metadata: { goal: `Assess the significance of ${topic}` } }
    ];

    while (baseQueries.length < numQueries) {
        baseQueries.push({
            original: `Which key challenges exist with ${topic}?`,
            metadata: { goal: `Identify challenges for ${topic}` }
        });
    }

    return baseQueries.slice(0, numQueries);
}

async function generateResearchQueriesFromContext(chatHistory, memoryBlocks = [], numQueries = 3, veniceApiKey = null, metadata = null, outputFn = outputManagerInstance.log, errorFn = outputManagerInstance.error) {
    const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
    const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
        throw new Error('Chat history too short to generate research queries.');
    }

    let effectiveKey = veniceApiKey;
    if (!effectiveKey) {
        try {
            effectiveKey = await userManager.getApiKey('venice');
        } catch (err) {
            effectiveError(`[generateResearchQueriesFromContext] Unable to read stored Venice key: ${err.message}`);
        }
    }
    if (!effectiveKey && process.env.VENICE_API_KEY) {
        effectiveKey = process.env.VENICE_API_KEY;
    }

    const memoryContext = Array.isArray(memoryBlocks) && memoryBlocks.length > 0
        ? '\n---\nMemories:\n' + memoryBlocks.map(block => `memory: ${block.content || block}`).join('\n')
        : '';

    const contextString = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n---\n') + memoryContext;

    try {
        if (effectiveKey) {
            effectiveOutput('Generating focused research queries from chat history...');
        } else {
            effectiveOutput('[generateResearchQueriesFromContext] No Venice API key available; using deterministic fallback queries.');
        }

        const generatedQueries = await generateResearchQueriesLLM({
            apiKey: effectiveKey,
            query: contextString,
            numQueries,
            learnings: [],
            metadata
        });

        if (Array.isArray(generatedQueries) && generatedQueries.length > 0) {
            effectiveOutput(`Generated ${generatedQueries.length} queries.`);
            return generatedQueries;
        }

        effectiveError('[generateResearchQueriesFromContext] LLM returned no queries. Falling back to heuristic queries.');
        return buildFallbackQueries(contextString, numQueries);
    } catch (error) {
        effectiveError(`Error generating research queries from context: ${error.message}`);
        return buildFallbackQueries(contextString, numQueries);
    }
}

export async function generateResearchQueries(chatHistory = [], memoryBlocks = [], options = {}) {
    const {
        numQueries = 3,
        metadata = null,
        veniceApiKey = null,
        output = outputManagerInstance.log,
        error = outputManagerInstance.error
    } = options;

    return generateResearchQueriesFromContext(
        chatHistory,
        memoryBlocks,
        numQueries,
        veniceApiKey,
        metadata,
        output,
        error
    );
}

/**
 * Start a research session based on chat context.
 * MODIFIED: Now accepts pre-generated queries via options.overrideQueries.
 * ... JSDoc ...
 * @param {Array} chatHistory - Current chat history (used for context/logging).
 * @param {Array} memoryBlocks - Relevant memory blocks.
 * @param {Object} options - Command options including depth, breadth, password, username, isWebSocket, webSocketClient, classificationMetadata, and overrideQueries.
 * @param {Function} outputFn - Function to handle output (e.g., console.log or WebSocket send)
 * @param {Function} errorFn - Function to handle errors (e.g., console.error or WebSocket send)
 * @returns {Promise<Object>} Research result object
 */
export async function startResearchFromChat(...args) {
  let options;
  if (Array.isArray(args[0])) {
    const [chatHistory, memoryBlocks = [], legacyOptions = {}] = args;
    options = { chatHistory, memoryBlocks, ...legacyOptions };
  } else {
    options = args[0] || {};
  }

  const {
    chatHistory = [],
    memoryBlocks = [],
    depth = 2,
    breadth = 3,
    verbose = false,
    classificationMetadata = null,
    overrideQueries,
    output: outputFn,
    error: errorFn,
    progressHandler,
    isWebSocket = false,
    webSocketClient = null,
    user: providedUser
  } = options;

  const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
  const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

  try {
    const hasPrebuiltQueries = Array.isArray(overrideQueries) && overrideQueries.length > 0;
    if (!hasPrebuiltQueries && (!Array.isArray(chatHistory) || chatHistory.length === 0)) {
        throw new Error('Chat history is required to start research.');
    }

    let queries = overrideQueries;
    if (!Array.isArray(queries) || queries.length === 0) {
        queries = await generateResearchQueries(chatHistory, memoryBlocks, {
            numQueries: Math.max(3, breadth),
            metadata: classificationMetadata,
            output: effectiveOutput,
            error: effectiveError
        });
    }

    if (!Array.isArray(queries) || queries.length === 0) {
        throw new Error('Research requires generated queries (overrideQueries).');
    }

    const representativeQuery = queries[0]?.original || 'Research from chat history';

    let userInfo = providedUser;
    if (!userInfo) {
        try {
            userInfo = await userManager.getUserData();
        } catch (err) {
            effectiveOutput(`[startResearchFromChat] Unable to read stored user profile: ${err.message}. Using defaults.`);
            userInfo = null;
        }
    }
    userInfo = userInfo || userManager.getCurrentUser();

    let braveKey = null;
    let veniceKey = null;
    try {
        braveKey = await userManager.getApiKey('brave');
    } catch (err) {
        effectiveOutput(`[startResearchFromChat] Unable to read stored Brave key: ${err.message}`);
    }
    try {
        veniceKey = await userManager.getApiKey('venice');
    } catch (err) {
        effectiveOutput(`[startResearchFromChat] Unable to read stored Venice key: ${err.message}`);
    }

    if (!braveKey && process.env.BRAVE_API_KEY) {
        braveKey = process.env.BRAVE_API_KEY;
    }
    if (!veniceKey && process.env.VENICE_API_KEY) {
        veniceKey = process.env.VENICE_API_KEY;
    }

    effectiveOutput('Initializing research engine...');
    const engine = new ResearchEngine({
        braveApiKey: braveKey,
        veniceApiKey: veniceKey,
        verbose,
        user: {
            username: userInfo?.username || 'operator',
            role: userInfo?.role || 'admin'
        },
        outputHandler: effectiveOutput,
        errorHandler: effectiveError,
        debugHandler: (msg) => {
            if (verbose) {
                effectiveOutput(`[DEBUG] ${msg}`);
            }
        },
        progressHandler,
        isWebSocket,
        webSocketClient,
        overrideQueries: queries
    });

    effectiveOutput(`Starting research based on ${queries.length} generated queries (derived from chat history).`);

    const placeholderQueryObj = {
        original: representativeQuery,
        metadata: classificationMetadata
    };

    const results = await engine.research({
        query: placeholderQueryObj,
        depth,
        breadth
    });

    return {
        success: true,
        topic: representativeQuery,
        results
    };
  } catch (error) {
    effectiveError(`Error during research from chat: ${error.message}`);
    return {
        success: false,
        error: error.message
    };
  }
}

/**
 * Exits the chat session and starts a research task using the entire chat history or last message as the query.
 * Called by handleChatMessage when /exitresearch is detected.
 * @param {Object} options - Command options.
 * @param {object} options.session - The WebSocket session object.
 * @param {Function} options.output - Function to handle output messages.
 * @param {Function} options.error - Function to handle error messages.
 * @param {object} options.currentUser - Data for the currently logged-in user.
 * @param {string} [options.password] - User password if already available/cached.
 * @param {boolean} options.isWebSocket - Flag indicating WebSocket context.
 * @param {WebSocket} options.webSocketClient - WebSocket client instance.
 * @param {Function} [options.wsPrompt] - The wsPrompt function (passed from routes.mjs).
 * @returns {Promise<Object>} Command result indicating success/failure and input state.
 */
export async function executeExitResearch(options = {}) {
    const { session, output: outputFn, error: errorFn, currentUser, password: providedPassword, isWebSocket, webSocketClient } = options;
    const PROMPT_TIMEOUT_MS = 2 * 60 * 1000;
    const wsPrompt = options.wsPrompt;
    if (isWebSocket && !wsPrompt) {
        errorFn('Internal Error: wsPrompt function not provided for executeExitResearch.');
        if (session) {
            session.isChatActive = false;
            session.chatHistory = [];
            session.memoryManager = null;
        }
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'chat-exit' });
            safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
        }
        return { success: false, keepDisabled: false };
    }

    const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
    const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

    if (!session || !session.isChatActive) {
        effectiveError('Not currently in an active chat session.');
        return { success: false, keepDisabled: false };
    }
    const chatHistory = session.chatHistory || [];
    if (chatHistory.length === 0) {
        effectiveError('Chat history is empty. Cannot start research.');
        session.isChatActive = false;
        session.memoryManager = null;
        session.chatHistory = [];
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'chat-exit' });
            safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
        }
        return { success: false, keepDisabled: false };
    }

    effectiveOutput('Exiting chat and starting research based on chat history...');
    if (isWebSocket && webSocketClient) {
        safeSend(webSocketClient, { type: 'research_start' });
    }

    // --- NEW: Prompt user for scope: last message or entire chat ---
    let researchQueryString = '';
    try {
        let useLastMessage = false;
        if (isWebSocket && webSocketClient && wsPrompt) {
            const choice = await wsPrompt(
                webSocketClient,
                session,
                "Use (1) last message or (2) entire chat history for research? [1/2]: ",
                PROMPT_TIMEOUT_MS,
                false,
                'exitresearch_scope'
            );
            if (choice && choice.trim().startsWith('1')) {
                useLastMessage = true;
            }
        } else {
            // CLI fallback: default to entire chat
            useLastMessage = false;
        }
        if (useLastMessage) {
            // Find last user message
            const lastUserMsg = [...chatHistory].reverse().find(msg => msg.role === 'user');
            researchQueryString = lastUserMsg ? lastUserMsg.content : '';
            if (!researchQueryString) {
                effectiveError('No user message found in chat history.');
                return { success: false, keepDisabled: false };
            }
            effectiveOutput('Using last user message as research query.');
        } else {
            // Use all user and assistant messages as context
            researchQueryString = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n---\n');
            effectiveOutput('Using entire chat history as research query.');
        }
    } catch (promptError) {
        effectiveError(`Scope prompt failed: ${promptError.message}`);
        return { success: false, keepDisabled: false };
    }

    // --- Continue with research as before, but using researchQueryString as the context ---
    let researchResult = { success: false, error: 'Research initialization failed' };
    let userPassword = providedPassword || session.password;
    let researchBreadth = 3;
    let researchDepth = 2;
    let useClassification = false;
    let classificationMetadata = null;
    let generatedQueries = [];

    try {
        if (!userPassword) {
            try {
                if (isWebSocket && webSocketClient && wsPrompt) {
                    effectiveOutput('Password required for research API keys.');
                    userPassword = await wsPrompt(webSocketClient, session, "Password needed for research API key: ", PROMPT_TIMEOUT_MS, true);
                    if (!userPassword) throw new Error("Password prompt cancelled or failed.");
                    session.password = userPassword;
                } else if (!isWebSocket) {
                    effectiveError("Password required for API keys. Cannot prompt in this context.");
                    throw new Error("Password required and cannot prompt.");
                } else {
                    throw new Error("Password required but prompting mechanism unavailable.");
                }
            } catch (promptError) {
                throw new Error(`Password prompt failed: ${promptError.message}`);
            }
        }

        if (isWebSocket && webSocketClient && wsPrompt) {
            try {
                const breadthInput = await wsPrompt(webSocketClient, session, `Enter query generation breadth [1-5, default: ${researchBreadth}]: `, PROMPT_TIMEOUT_MS);
                const parsedBreadth = parseInt(breadthInput, 10);
                if (!isNaN(parsedBreadth) && parsedBreadth >= 1 && parsedBreadth <= 5) {
                    researchBreadth = parsedBreadth;
                } else if (breadthInput.trim() !== '') {
                    effectiveOutput(`Invalid breadth input. Using default: ${researchBreadth}`);
                }
                const depthInput = await wsPrompt(webSocketClient, session, `Enter research depth [1-3, default: ${researchDepth}]: `, PROMPT_TIMEOUT_MS);
                const parsedDepth = parseInt(depthInput, 10);
                if (!isNaN(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 3) {
                    researchDepth = parsedDepth;
                } else if (depthInput.trim() !== '') {
                    effectiveOutput(`Invalid depth input. Using default: ${researchDepth}`);
                }
                const classifyInput = await wsPrompt(webSocketClient, session, `Use token classification? [y/n, default: n]: `, PROMPT_TIMEOUT_MS);
                if (classifyInput.trim().toLowerCase() === 'y') {
                    useClassification = true;
                    effectiveOutput('Token classification enabled.');
                }
            } catch (promptError) {
                effectiveError(`Research parameter prompt failed: ${promptError.message}. Using defaults.`);
            }
        } else if (!isWebSocket) {
            effectiveOutput(`Using default research parameters: Query Breadth=${researchBreadth}, Depth=${researchDepth}, Classification=${useClassification}`);
        }

        let veniceKey;
        try {
            if (!userPassword) throw new Error("Password required for Venice API key.");
            veniceKey = await userManager.getApiKey({ username: session.username, password: userPassword, service: 'venice' });
            if (!veniceKey) throw new Error("Failed to get/decrypt Venice API key.");
        } catch (keyError) {
            throw new Error(`Venice API key retrieval failed: ${keyError.message}`);
        }

        if (useClassification) {
            try {
                effectiveOutput('Performing token classification on research query...');
                classificationMetadata = await callVeniceWithTokenClassifier(researchQueryString, veniceKey);
                if (!classificationMetadata) {
                    effectiveOutput('Token classification returned no metadata.');
                } else {
                    effectiveOutput('Token classification successful.');
                    effectiveOutput(`Metadata: ${JSON.stringify(classificationMetadata).substring(0, 200)}...`);
                }
            } catch (classifyError) {
                effectiveError(`Token classification failed: ${classifyError.message}. Proceeding without classification.`);
                classificationMetadata = null;
            }
        }

        generatedQueries = await generateResearchQueriesFromContext(
            [{ role: 'user', content: researchQueryString }],
            [],
            researchBreadth,
            veniceKey,
            classificationMetadata,
            effectiveOutput,
            effectiveError
        );

        if (generatedQueries.length === 0) {
            throw new Error("Failed to generate research queries from chat history.");
        }

        const researchOptions = {
            depth: researchDepth,
            breadth: researchBreadth,
            password: userPassword,
            currentUser: currentUser,
            isWebSocket: isWebSocket,
            webSocketClient: webSocketClient,
            classificationMetadata: classificationMetadata,
            overrideQueries: generatedQueries,
            output: effectiveOutput,
            error: effectiveError,
            progressHandler: options.progressHandler
        };

        let relevantMemories = [];
        if (session.memoryManager) {
            try {
                relevantMemories = await session.memoryManager.retrieveRelevantMemories(researchQueryString, 5);
            } catch (memError) {
                console.error(`[WebSocket] Error retrieving memory for exitResearch: ${memError.message}`);
                effectiveOutput(`[System] Warning: Could not retrieve relevant memories - ${memError.message}`);
            }
        }

        researchResult = await startResearchFromChat(researchOptions);

        if (researchResult.success && isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_complete', summary: researchResult.results?.summary });
        } else if (!researchResult.success && isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_complete', error: researchResult.error });
        }
    } catch (error) {
        effectiveError(`Error during exitResearch: ${error.message}`);
        researchResult = { success: false, error: error.message };
        if (error.message.toLowerCase().includes('password') || error.message.toLowerCase().includes('api key')) {
            if (session) session.password = null;
        }
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_complete', error: error.message });
        }
    } finally {
        if (session) {
            session.isChatActive = false;
            session.chatHistory = [];
            if (session.memoryManager) {
                console.log(`[WebSocket] Clearing memory manager on /exitresearch for session ${session.sessionId}.`);
                session.memoryManager = null;
            }
        }
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'chat-exit' });
            safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
        }
    }
    return { ...researchResult, keepDisabled: false };
}

/**
 * Provides help text for the /chat command.
 * @returns {string} Help text.
 */
export function getChatHelpText() {
    return `/chat [--memory=true] [--depth=short|medium|long] - Start an interactive chat session. Requires login.
    --memory=true: Enable memory persistence for the session.
    --depth=<level>: Set memory depth (short, medium, long). Requires --memory=true.
    In-chat commands: /exit, /exitmemory, /memory stats, /research <query>, /exitresearch, /help`;
}