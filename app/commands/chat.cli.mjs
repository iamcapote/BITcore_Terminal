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
    memory = false,
    depth = 'medium',
    verbose = false,
    password, // Password from handleCommandMessage (payload/cache/prompt)
    isWebSocket = false,
    session, // WebSocket session object
    output: cmdOutput, // Renamed for clarity within function
    error: cmdError,   // Renamed for clarity within function
    currentUser, // User data from handleCommandMessage
    _testMode = false // Internal flag for testing
  } = options;

  const timeoutMs = options.timeout || 30000; // Example timeout

  try {
    // Use cmdOutput for logging
    cmdOutput(`[CMD START] chat: Memory=${memory}, Depth=${depth}, Verbose=${verbose}`);

    // --- Authentication Check ---
    // Use currentUser passed in options
    const isAuthenticated = !!currentUser && currentUser.role !== 'public';
    const currentUsername = currentUser ? currentUser.username : 'public';

    if (!isAuthenticated) {
      cmdError('You must be logged in to use the /chat command.');
      return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
    }

    // --- API Key Check ---
    const hasVeniceKeyConfigured = await userManager.hasApiKey('venice', currentUsername);
    if (!hasVeniceKeyConfigured) {
      cmdError('Missing Venice API key required for chat. Use /keys set to configure.');
      return { success: false, error: 'Venice API key not configured', handled: true, keepDisabled: false };
    }

    // --- Password Handling & Key Decryption ---
    // Password should already be handled by handleCommandMessage (prompted if needed)
    // and passed in options.password
    let userPassword = options.password;

    // If somehow password is still missing (should not happen if handleCommandMessage is correct)
    if (!userPassword) {
        // This indicates a logic error in the calling function (handleCommandMessage)
        cmdError('Internal Error: Password required for API keys but was not provided or prompted.');
        return { success: false, error: 'Password required but missing', handled: true, keepDisabled: false };
    }

    // --- Get API Key ---
    const veniceKey = await userManager.getApiKey('venice', userPassword, currentUsername);

    if (!veniceKey) {
      // Clear cached password in session if decryption fails
      if (session) session.password = null;
      cmdError('Failed to decrypt Venice API key with the provided password.');
      return { success: false, error: 'API key decryption failed', handled: true, keepDisabled: false };
    }

    // --- Test Mode Handling ---
    if (_testMode) {
      cmdOutput("Running in test mode, skipping interactive chat");
      return {
        success: true,
        testMode: true,
        memoryEnabled: memory,
        keepDisabled: false // Ensure input enabled after test mode message
      };
    }

    // --- Initialize Memory Manager (if needed) ---
    let memoryManagerInstance = null;
    if (memory) {
      try {
        memoryManagerInstance = new MemoryManager({
          depth,
          user: currentUsername // Use username from currentUser
        });
        cmdOutput('Memory mode enabled. Use /exitmemory to finalize and exit memory mode.');
      } catch (error) {
        cmdError(`Failed to initialize memory system: ${error.message}`);
        return { success: false, error: `Memory init failed: ${error.message}`, handled: true, keepDisabled: false };
      }
    }

    // --- Start Chat Session ---
    if (isWebSocket) {
      // For WebSocket, signal readiness and let handleChatMessage manage the interaction
      cmdOutput('Chat session started. Type /exit to end.'); // Use cmdOutput
      return {
        success: true,
        type: 'chat-ready', // Signal to handleCommandMessage
        memoryEnabled: memory,
        memoryManager: memoryManagerInstance, // Pass instance to session
        keepDisabled: false // Let handleCommandMessage enable input for chat prompt
      };
    } else {
      // For Console CLI, start the interactive loop
      // NOTE: Console CLI needs separate password handling if not passed via args
      if (!userPassword && !isWebSocket) { // Re-prompt specifically for console if needed
          userPassword = await promptHiddenFixed('Please enter your password to decrypt API keys: ');
          if (!userPassword) {
              cmdError('Password is required to decrypt API keys.');
              return { success: false, error: 'Password required', handled: true };
          }
          // Optionally cache for CLI session if userManager supports it
          // userManager.cliSessionPassword = userPassword;
      }
      // Re-fetch key if prompted in CLI mode
      const cliVeniceKey = await userManager.getApiKey('venice', userPassword, currentUsername);
      if (!cliVeniceKey) {
          cmdError('Failed to decrypt Venice API key for CLI session.');
          return { success: false, error: 'API key decryption failed', handled: true };
      }

      process.env.VENICE_API_KEY = cliVeniceKey; // Set for CLI LLMClient usage
      const llmClient = new LLMClient({ apiKey: cliVeniceKey });
      // Pass cmdOutput and cmdError directly to startInteractiveChat
      const chatResult = await startInteractiveChat(llmClient, memoryManagerInstance, verbose, cmdOutput, cmdError); // Pass bound methods
      delete process.env.VENICE_API_KEY; // Clean up env var
      cmdOutput(`[CMD SUCCESS] chat: Completed successfully.`);
      return chatResult; // Return result from interactive session
    }

  } catch (error) {
    // Use cmdError for logging
    cmdError(`Error during chat command: ${error.message}`);
    // Return a result suitable for handleCommandMessage or CLI handler
    return { success: false, error: error.message, handled: true, keepDisabled: false };
  } finally {
    // Ensure env var is cleaned up in CLI mode, even if errors occur
    if (!options.isWebSocket) {
      delete process.env.VENICE_API_KEY;
    }
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
 * @returns {Promise<Object>} Chat session results
 */
async function startInteractiveChat(llmClient, memoryManager, verbose = false, outputFn, errorFn) { // Renamed params for clarity
  // Return a promise that resolves when the chat session ends (rl closes)
  return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        prompt: '[user] '
      });

      let chatEnded = false; // Flag to prevent multiple resolves

      rl.on('line', async (line) => {
        // If chat already ended, ignore further input (shouldn't happen often)
        if (chatEnded) return;

        const userInput = line.trim();

        if (userInput.toLowerCase() === '/exit') {
          outputFn('Exiting chat session...'); // Use passed outputFn
          chatEnded = true; // Set flag
          rl.close(); // This triggers the 'close' event below
          return;
        }

        // Ignore empty lines
        if (!userInput) {
            rl.prompt();
            return;
        }

        try {
          // TODO: Integrate memoryManager.retrieveRelevantMemories and pass context
          const response = await llmClient.completeChat({ messages: [{ role: 'user', content: userInput }] });
          // TODO: Integrate memoryManager.storeMemory for user input and AI response
          outputFn(`[AI] ${response.content}`); // Use passed outputFn
        } catch (error) {
          errorFn(`Error: ${error.message}`); // Use passed errorFn
        } finally {
          // Only prompt again if chat hasn't ended
          if (!chatEnded) {
              rl.prompt();
          }
        }
      });

      rl.on('close', () => {
        if (!chatEnded) { // Ensure message is logged even if closed externally (e.g., Ctrl+C)
            outputFn('Chat session ended.'); // Use passed outputFn
        }
        resolve({ success: true, message: "Chat session ended." }); // Resolve the promise
      });

      // Handle Ctrl+C during chat
      rl.on('SIGINT', () => {
          outputFn('\nChat interrupted. Type /exit to leave cleanly.');
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
async function generateResearchQueriesFromContext(chatHistory, memoryBlocks = [], numQueries = 3, veniceApiKey, metadata = null, outputFn = console.log, errorFn = console.error) {
    if (!veniceApiKey) throw new Error("Venice API key not available for query generation.");
    if (!chatHistory || chatHistory.length === 0) {
        errorFn("Chat history is empty, cannot generate queries.");
        return [];
    }

    // Combine history into a single string for context
    const contextString = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n---\n');

    try {
        outputFn("Generating focused research queries from chat history...");
        // Use the imported generateQueries function from research.providers.mjs
        const generatedQueries = await generateResearchQueriesLLM({
            apiKey: veniceApiKey,
            query: contextString, // Use the history string as the base "query" for context
            numQueries: numQueries,
            learnings: [], // No prior learnings when starting from history
            metadata: metadata // Pass classification metadata
        });
        outputFn(`Generated ${generatedQueries.length} queries.`);
        return generatedQueries; // Returns array of { original: string, metadata?: any }
    } catch (error) {
        errorFn(`Error generating research queries from context: ${error.message}`);
        return []; // Return empty array on failure
    }
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
export async function startResearchFromChat(chatHistory, memoryBlocks = [], options = {}, outputFn = console.log, errorFn = console.error) {
  try {
    const {
        // query: researchQuery, // Original query (long history) - No longer the primary input for engine.research
        depth = 2,
        breadth = 3,
        verbose = false,
        password, // Password needed for keys
        username, // Username needed for keys
        isWebSocket,
        webSocketClient,
        classificationMetadata, // Added classification metadata
        overrideQueries // --- NEW: Expect pre-generated queries ---
    } = options;

    // --- FIX: Validate overrideQueries instead of researchQuery ---
    if (!Array.isArray(overrideQueries) || overrideQueries.length === 0) {
      throw new Error("Research requires generated queries (overrideQueries).");
    }
    if (!password) {
        throw new Error("Password is required to retrieve API keys for research.");
    }
     if (!username) {
        throw new Error("Username is required to retrieve API keys for research.");
    }

    // --- Get API Keys ---
    let braveKey, veniceKey;
    try {
        braveKey = await userManager.getApiKey('brave', password, username);
        veniceKey = await userManager.getApiKey('venice', password, username);
        if (!braveKey || !veniceKey) {
            throw new Error("Failed to retrieve one or both required API keys (Brave, Venice).");
        }
    } catch (keyError) {
        throw new Error(`API key retrieval failed: ${keyError.message}`);
    }


    // --- Prepare Context for Research Engine ---
    // Use the first generated query as the representative topic for logging/summary context
    const representativeQuery = overrideQueries[0]?.original || "Research from chat history";
    const contextSummary = `Research initiated from chat context. Main focus derived from: "${representativeQuery}"`;

    // User info for the engine
    const userInfo = { username: username, role: options.currentUser?.role || 'client' }; // Get role from options if available

    outputFn('Initializing research engine...'); // Use provided outputFn

    // --- FIX: Pass overrideQueries to the engine config ---
    const engine = new ResearchEngine({
      braveApiKey: braveKey, // Pass decrypted key
      veniceApiKey: veniceKey, // Pass decrypted key
      verbose: verbose,
      user: userInfo,
      outputHandler: outputFn, // Pass provided output function
      errorHandler: errorFn,   // Pass provided error function
      debugHandler: (msg) => { if (verbose) outputFn(`[DEBUG] ${msg}`); }, // Simple debug handler
      progressHandler: (progress) => { // Define progress handler inline or pass one
          if (isWebSocket && webSocketClient) {
              safeSend(webSocketClient, { type: 'progress', data: progress });
          } else {
              // Basic console progress
              outputFn(`Progress: ${progress.status} (${progress.completedQueries}/${progress.totalQueries || '?'})`);
          }
      },
      isWebSocket: isWebSocket,
      webSocketClient: webSocketClient,
      overrideQueries: overrideQueries // Pass the generated queries here
    });

    outputFn(`Starting research based on ${overrideQueries.length} generated queries (derived from chat history).`);

    // --- FIX: Call engine.research with a placeholder query object ---
    // The actual queries used will be the overrideQueries.
    // We still need a query object for summary generation context etc.
    const placeholderQueryObj = {
        original: representativeQuery, // Use representative query
        metadata: classificationMetadata // Pass metadata for summary generation
    };

    const results = await engine.research({
        query: placeholderQueryObj, // Pass placeholder object
        depth: depth, // Depth might be applied differently with overrideQueries, check engine logic
        breadth: breadth // Breadth might be applied differently with overrideQueries, check engine logic
    });

    return {
      success: true,
      topic: representativeQuery, // Use representative query as topic
      results
    };

  } catch (error) {
    errorFn(`Error during research from chat: ${error.message}`); // Use the caught error object
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Exits the chat session and starts a research task using the entire chat history as the query.
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

    // --- FIX: Define PROMPT_TIMEOUT_MS locally or import ---
    const PROMPT_TIMEOUT_MS = 2 * 60 * 1000; // Define timeout here

    // --- FIX: Need access to wsPrompt function ---
    // This is tricky as wsPrompt is defined in routes.mjs.
    // Best approach: Pass wsPrompt function itself in the options from handleChatMessage.
    const wsPrompt = options.wsPrompt; // *** Retrieve wsPrompt from options ***
    if (isWebSocket && !wsPrompt) {
        errorFn('Internal Error: wsPrompt function not provided for executeExitResearch.');
        // Clean up session state before returning
        if (session) {
            session.isChatActive = false;
            session.chatHistory = [];
            session.memoryManager = null;
        }
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'chat-exit' });
            safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
        }
        return { success: false, keepDisabled: false }; // Enable input after error
    }
    // --- End FIX ---


    const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
    const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

    // --- FIX: Check isChatActive *before* proceeding ---
    if (!session || !session.isChatActive) {
        effectiveError('Not currently in an active chat session.');
        return { success: false, keepDisabled: false }; // Enable input after error
    }
    // --- End FIX ---

    const chatHistory = session.chatHistory || [];
    if (chatHistory.length === 0) {
        effectiveError('Chat history is empty. Cannot start research.');
        // Exit chat mode even if history is empty
        session.isChatActive = false;
        session.memoryManager = null; // Clear memory manager too
        session.chatHistory = [];
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'chat-exit' });
            safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
        }
        return { success: false, keepDisabled: false }; // Enable input
    }

    effectiveOutput('Exiting chat and starting research based on conversation history...');
    // --- FIX: Send research_start message ---
    if (isWebSocket && webSocketClient) {
        safeSend(webSocketClient, { type: 'research_start' });
    }
    // --- End FIX ---


    // Format chat history into a query string (used for context, not direct search)
    const researchContextString = chatHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n---\n'); // Use a separator

    let researchResult = { success: false, error: 'Research initialization failed' };
    let userPassword = providedPassword || session.password; // Use provided, then cached
    let researchBreadth = 3; // Default for query generation
    let researchDepth = 2; // Default for research execution
    let useClassification = false;
    let classificationMetadata = null;
    let generatedQueries = []; // To store generated queries

    try {
        // --- Password/Key Check ---
        if (!userPassword) {
            try {
                // Prompt for password if WebSocket and not provided/cached
                if (isWebSocket && webSocketClient && wsPrompt) { // Check wsPrompt exists
                    effectiveOutput('Password required for research API keys.');
                    // Input is already disabled by the calling handler (handleChatMessage)
                    userPassword = await wsPrompt(webSocketClient, session, "Password needed for research API key: ", PROMPT_TIMEOUT_MS, true);
                    if (!userPassword) throw new Error("Password prompt cancelled or failed."); // Check if password was actually provided
                    session.password = userPassword; // Cache password
                    // Input remains disabled after prompt resolution
                } else if (!isWebSocket) {
                    // Handle CLI password prompt if needed (though this command is likely WS only)
                    effectiveError("Password required for API keys. Cannot prompt in this context.");
                    throw new Error("Password required and cannot prompt.");
                } else {
                    // Should not happen if wsPrompt check passed
                    throw new Error("Password required but prompting mechanism unavailable.");
                }
            } catch (promptError) {
                // wsPrompt error handler should enable input, but we catch here too
                throw new Error(`Password prompt failed: ${promptError.message}`); // Propagate error
            }
        }

        // --- Interactive Prompts for Research Parameters (WebSocket only) ---
        if (isWebSocket && webSocketClient && wsPrompt) {
            try {
                // Prompt for Breadth (used for query generation count)
                const breadthInput = await wsPrompt(webSocketClient, session, `Enter query generation breadth [1-5, default: ${researchBreadth}]: `, PROMPT_TIMEOUT_MS);
                const parsedBreadth = parseInt(breadthInput, 10);
                if (!isNaN(parsedBreadth) && parsedBreadth >= 1 && parsedBreadth <= 5) {
                    researchBreadth = parsedBreadth;
                } else if (breadthInput.trim() !== '') {
                    effectiveOutput(`Invalid breadth input. Using default: ${researchBreadth}`);
                }

                // Prompt for Depth (used for research execution)
                const depthInput = await wsPrompt(webSocketClient, session, `Enter research depth [1-3, default: ${researchDepth}]: `, PROMPT_TIMEOUT_MS);
                const parsedDepth = parseInt(depthInput, 10);
                if (!isNaN(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 3) {
                    researchDepth = parsedDepth;
                } else if (depthInput.trim() !== '') {
                    effectiveOutput(`Invalid depth input. Using default: ${researchDepth}`);
                }

                // Prompt for Token Classification
                const classifyInput = await wsPrompt(webSocketClient, session, `Use token classification? [y/n, default: n]: `, PROMPT_TIMEOUT_MS);
                if (classifyInput.trim().toLowerCase() === 'y') {
                    useClassification = true;
                    effectiveOutput('Token classification enabled.');
                }

            } catch (promptError) {
                // Handle prompt errors (e.g., timeout, cancellation)
                effectiveError(`Research parameter prompt failed: ${promptError.message}. Using defaults.`);
                // Continue with default parameters
            }
        } else if (!isWebSocket) {
            // Handle CLI parameter input if needed, or just use defaults
            effectiveOutput(`Using default research parameters: Query Breadth=${researchBreadth}, Depth=${researchDepth}, Classification=${useClassification}`);
        }

        // --- Get Venice Key (needed for classification and query generation) ---
        let veniceKey;
        try {
            if (!userPassword) throw new Error("Password required for Venice API key.");
            veniceKey = await userManager.getApiKey('venice', userPassword, session.username);
            if (!veniceKey) throw new Error("Failed to get/decrypt Venice API key.");
        } catch (keyError) {
            throw new Error(`Venice API key retrieval failed: ${keyError.message}`);
        }

        // --- Token Classification (if enabled) ---
        if (useClassification) {
            try {
                effectiveOutput('Performing token classification on chat history...');
                classificationMetadata = await callVeniceWithTokenClassifier(researchContextString, veniceKey);
                if (!classificationMetadata) {
                    effectiveOutput('Token classification returned no metadata.');
                } else {
                     effectiveOutput('Token classification successful.');
                     // Log metadata for debugging
                     effectiveOutput(`Metadata: ${JSON.stringify(classificationMetadata).substring(0, 200)}...`);
                }
            } catch (classifyError) {
                effectiveError(`Token classification failed: ${classifyError.message}. Proceeding without classification.`);
                classificationMetadata = null; // Ensure it's null on failure
            }
        }

        // --- Generate Focused Queries ---
        // Use the generateResearchQueriesFromContext helper function defined above
        generatedQueries = await generateResearchQueriesFromContext(
            chatHistory,
            [], // Pass memory blocks if available/relevant
            researchBreadth, // Use the prompted breadth for number of queries
            veniceKey, // Pass the decrypted Venice key
            classificationMetadata, // Pass metadata
            effectiveOutput,
            effectiveError
        );

        if (generatedQueries.length === 0) {
            throw new Error("Failed to generate research queries from chat history.");
        }

        // --- Prepare Options for startResearchFromChat ---
        const researchOptions = {
            // query: researchContextString, // No longer pass the raw history here
            depth: researchDepth, // Use gathered depth for execution
            breadth: researchBreadth, // Pass breadth (might be used by engine/path differently now)
            password: userPassword,
            username: session.username,
            currentUser: currentUser, // Pass fetched user data
            isWebSocket: isWebSocket,
            webSocketClient: webSocketClient,
            classificationMetadata: classificationMetadata, // Pass metadata for summary
            overrideQueries: generatedQueries // --- Pass the generated queries ---
            // verbose: options.verbose // Add if needed
        };

        // --- Retrieve Relevant Memories (Optional Enhancement) ---
        // Could retrieve memories based on the generated queries or the whole context
        let relevantMemories = [];
        if (session.memoryManager) {
            try {
                // Retrieve based on the context string for simplicity
                relevantMemories = await session.memoryManager.retrieveRelevantMemories(researchContextString, 5);
            } catch (memError) {
                console.error(`[WebSocket] Error retrieving memory for exitResearch: ${memError.message}`);
                effectiveOutput(`[System] Warning: Could not retrieve relevant memories - ${memError.message}`);
            }
        }

        // --- Execute Research ---
        // Use the same handlers passed to executeExitResearch
        researchResult = await startResearchFromChat(
            chatHistory, // Pass history for logging/context if needed by startResearchFromChat
            relevantMemories,
            researchOptions, // Pass options including overrideQueries
            effectiveOutput, // Pass the output handler
            effectiveError   // Pass the error handler
        );

        // --- FIX: Send research_complete message on success ---
        if (researchResult.success && isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_complete', summary: researchResult.results?.summary });
        } else if (!researchResult.success && isWebSocket && webSocketClient) {
            // Send research_complete even on failure from startResearchFromChat
             safeSend(webSocketClient, { type: 'research_complete', error: researchResult.error });
        }
        // --- End FIX ---
        // effectiveOutput("Research based on chat history complete."); // Message sent by research_complete handler

    } catch (error) {
        effectiveError(`Error during exitResearch: ${error.message}`);
        researchResult = { success: false, error: error.message };
        // Clear potentially bad password cache on key/decryption errors
        if (error.message.toLowerCase().includes('password') || error.message.toLowerCase().includes('api key')) {
             if (session) session.password = null;
        }
        // --- FIX: Send research_complete message on caught error ---
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_complete', error: error.message });
        }
        // --- End FIX ---
    } finally {
        // --- Clean up session state regardless of research success/failure ---
        if (session) {
            session.isChatActive = false;
            session.chatHistory = []; // Clear history
            if (session.memoryManager) {
                // Decide whether to finalize or just clear. Let's just clear for now.
                // Use /exitmemory for explicit finalization.
                console.log(`[WebSocket] Clearing memory manager on /exitresearch for session ${session.sessionId}.`);
                session.memoryManager = null;
            }
            // Don't clear session.password here, might be needed for subsequent commands. Clear on failure was handled above.
        }
        // Inform client about chat exit and mode change
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'chat-exit' });
            safeSend(webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
        }
    }

    // Return success status, always enable input after completion/error
    // The calling function (handleChatMessage) will use this return value.
    // Since research_complete and mode_change messages handle enabling input on the client,
    // we can return keepDisabled: false here.
    return { success: researchResult.success, keepDisabled: false };
}