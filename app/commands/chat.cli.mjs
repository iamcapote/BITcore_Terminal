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
    memory = false,
    depth: memoryDepth = 'medium', // Renamed depth to memoryDepth for clarity
    verbose = false,
    password: providedPassword, // Password from handleCommandMessage (payload/cache/prompt)
    isWebSocket = false,
    session, // WebSocket session object
    output: cmdOutput, // Renamed for clarity within function
    error: cmdError,   // Renamed for clarity within function
    currentUser, // User data from handleCommandMessage
    webSocketClient, // Added for sending messages
    _testMode = false // Internal flag for testing
  } = options;

  // --- FIX: Add check for valid output/error functions ---
  if (typeof cmdOutput !== 'function') {
      console.error("[executeChat] CRITICAL: cmdOutput is not a function.", options);
      // Cannot easily send error back, log and return failure
      return { success: false, error: "Internal server error: Output handler misconfigured.", handled: true, keepDisabled: false };
  }
  if (typeof cmdError !== 'function') {
      console.error("[executeChat] CRITICAL: cmdError is not a function.", options);
      // Log, but try to continue if possible
      // If we can't report errors, things might fail silently
      // Let's return an error here too for safety
      return { success: false, error: "Internal server error: Error handler misconfigured.", handled: true, keepDisabled: false };
  }
  // --- End FIX ---

  const timeoutMs = options.timeout || 30000; // Example timeout

  try {
    // Use cmdOutput for logging
    logCommandStart('chat', options); // Use helper for consistent logging

    const isPublicUser = currentUser && currentUser.role === 'public';
    let effectiveMemory = memory; // Use let to allow modification

    // --- Public User Handling ---
    if (isPublicUser) {
        // --- FIX: Allow chat, disable memory ---
        cmdOutput("Entering chat mode for public user.");
        cmdOutput("Memory and research features are disabled. Use /login for full features.");
        effectiveMemory = false; // Force disable memory for public users
    }
    // --- End Public User Handling ---

    // --- Authentication Check (Only for non-public users needing memory/research) ---
    // Allow public users to proceed for basic chat
    if (!isPublicUser && (!currentUser || currentUser.role === 'public')) { // Check added !isPublicUser
      cmdError('You must be logged in to use memory or research features.');
      // Don't return error here, allow basic chat for public
      // return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
    }
    // --- End Authentication Check ---

    const currentUsername = currentUser.username; // Will be 'public' for public users

    // --- API Key Check & Decryption ---
    let veniceKey = null;
    let llmClient = null; // Initialize llmClient here
    let userPassword = null; // Initialize userPassword

    if (isPublicUser) {
        // --- FIX: Use public key for public users ---
        veniceKey = config.venice.apiKey;
        if (!veniceKey) {
            cmdError('Public Venice API key is not configured in .env. Public chat disabled.');
            return { success: false, error: 'Public API key not configured', handled: true, keepDisabled: false };
        }
        cmdOutput("Using public API key for chat.");
        llmClient = new LLMClient({ apiKey: veniceKey }); // Initialize for public user
    } else {
        // --- Logged-in user key retrieval ---
        const hasVeniceKeyConfigured = await userManager.hasApiKey('venice', currentUsername);
        if (!hasVeniceKeyConfigured) {
            cmdError('Missing Venice API key required for chat. Use /keys set venice <key> to configure.');
            return { success: false, error: 'Venice API key not configured', handled: true, keepDisabled: false };
        }

        // --- Password Handling & Key Decryption ---
        userPassword = session?.password || providedPassword; // Check session cache first
        const needsPassword = !userPassword; // Only need password if not already cached/provided

        if (needsPassword) {
            cmdError('Internal Error: Password required for chat but was not provided or prompted.');
            if (session) session.password = null; // Clear potentially invalid cache
            return { success: false, error: 'Password required but missing', handled: true, keepDisabled: false };
        }

        // --- Get API Key ---
        veniceKey = await userManager.getApiKey({ username: currentUsername, password: userPassword, service: 'venice' }); // Use options object

        if (!veniceKey) {
            if (session) session.password = null;
            cmdError('Failed to decrypt Venice API key with the provided password.');
            return { success: false, error: 'API key decryption failed', handled: true, keepDisabled: false };
        } else {
            if (session && !session.password) {
                session.password = userPassword;
                console.log(`[executeChat] Cached password in session ${session.sessionId} after successful key decryption.`);
            }
            // --- Initialize LLM Client (Only if key obtained) ---
            llmClient = new LLMClient({ apiKey: veniceKey }); // Initialize for logged-in user
        }
    }
    // --- End API Key Check & Decryption ---


    // --- Test Mode Handling ---
    if (_testMode) {
      cmdOutput("Running in test mode, skipping interactive chat");
      logCommandSuccess('chat (test mode)', options);
      return {
        success: true,
        testMode: true,
        memoryEnabled: memory,
        keepDisabled: false // Ensure input enabled after test mode message
      };
    }

    // --- Initialize Memory Manager (if needed and NOT public user) ---
    let memoryManagerInstance = null;
    if (effectiveMemory && !isPublicUser) { // Check effectiveMemory and !isPublicUser
      try { // <-- Outer try for memory init
        // --- FIX: Pass LLMClient and GitHub token if available ---
        let llmApiKeyForMem = veniceKey; // Use the already decrypted key
        let githubTokenForMem = null;
        if (await userManager.hasGitHubConfig(currentUsername)) { // Check if config exists
            try { // <-- Inner try for getGitHubConfig (around line 205)
                // --- FIX: Pass password to getGitHubConfig ---
                const ghConfig = await userManager.getGitHubConfig(currentUsername, userPassword); // Pass password here
                if (ghConfig && ghConfig.token) {
                    githubTokenForMem = ghConfig.token; // Note: getGitHubConfig should return decrypted token
                }
            } catch (ghError) { // <-- ADDED CATCH for inner try
                cmdError(`Warning: Failed to get GitHub token for memory manager: ${ghError.message}`);
                // Optionally clear cached password if token decryption failed specifically
                if (ghError.message.toLowerCase().includes('password') || ghError.message.toLowerCase().includes('decrypt')) {
                    if (session) session.password = null;
                    cmdError('GitHub token decryption failed. Please check password.');
                    // Decide if this should be a fatal error for memory mode
                    // return { success: false, error: `GitHub token decryption failed: ${ghError.message}`, handled: true, keepDisabled: false };
                }
            } // <-- END ADDED CATCH for inner try
        }

        memoryManagerInstance = new MemoryManager(currentUsername, {
            output: cmdOutput, // Use command's output handler
            error: cmdError,   // Use command's error handler
            llmClient: llmApiKeyForMem ? new LLMClient({ apiKey: llmApiKeyForMem }) : null, // Pass LLM client
            githubToken: githubTokenForMem // Pass GitHub token
        });
        // --- End FIX ---
        cmdOutput(`Memory mode enabled (Depth: ${memoryDepth}). Use /exitmemory to finalize.`);
      } catch (error) { // <-- Catch for outer try (already existed)
        // Ensure this line uses correct backticks and syntax
        cmdError(`Failed to initialize memory system: ${error.message}`);
        // Clear cached password if memory init failed due to key/token issues potentially related to password
        if (error.message.toLowerCase().includes('password') || error.message.toLowerCase().includes('decrypt')) {
             if (session) session.password = null;
        }
        return { success: false, error: `Memory init failed: ${error.message}`, handled: true, keepDisabled: false };
      }
    } else if (effectiveMemory && isPublicUser) {
        // This message is now redundant as it's covered earlier
        // cmdOutput("Memory features are disabled for public users.");
    }

    // --- FIX: Remove duplicate LLMClient initialization ---
    // const llmClient = new LLMClient({ apiKey: veniceKey }); // REMOVED - Already initialized above

    // --- Update Session State (Server-side) ---
    if (session) {
        session.isChatActive = true;
        session.chatHistory = []; // Start fresh history
        session.memoryManager = memoryManagerInstance; // Assign manager instance
        session.llmClient = llmClient; // Assign LLM client instance
        session.chatVerbose = verbose; // Store verbose setting
        // session.password is already cached above if decryption succeeded
        console.log(`[WebSocket] Session ${session.sessionId} entering chat mode.`);
    } else if (!isWebSocket) {
        console.warn("[CLI] Running chat without a session object. State will not persist across commands.");
    }
    // --- End Update Session State ---

    // --- Signal Client (WebSocket) ---
    if (isWebSocket && webSocketClient) {
        const chatPrompt = memory ? `[chat:${memoryDepth}]> ` : '[chat]> ';
        // Send chat-ready and mode_change together
        safeSend(webSocketClient, { type: 'chat-ready', memoryEnabled: !!memoryManagerInstance });
        safeSend(webSocketClient, { type: 'mode_change', mode: 'chat', prompt: chatPrompt });
        // Input should be enabled by the client upon receiving mode change to 'chat'
        logCommandSuccess('chat (WebSocket session started)', options);
        // --- FIX: Return keepDisabled: false ---
        // The client will enable input based on the mode_change message.
        // The server should allow input to be enabled after this command completes.
        return { success: true, keepDisabled: false };
    }
    // --- End Signal Client ---

    // --- Start Interactive CLI Chat (Console Only) ---
    if (!isWebSocket) {
        try {
            // Pass the bound output/error functions
            await startInteractiveChat(llmClient, memoryManagerInstance, verbose, cmdOutput, cmdError);
            logCommandSuccess('chat (CLI session ended)', options);
            return { success: true, keepDisabled: false }; // Ensure input enabled after CLI chat
        } catch (cliChatError) {
            cmdError(`CLI chat session failed: ${cliChatError.message}`);
            return handleCliError(cliChatError, { command: 'chat', error: cmdError });
        }
    }

    // Fallback case (shouldn't be reached)
    cmdError("Failed to start chat session.");
    return { success: false, error: "Failed to start chat session", handled: true, keepDisabled: false };

  } catch (error) { // <-- Catch block for the main try statement
    // Use the provided error handler, or console.error as a fallback
    // --- FIX: Use the validated cmdError function ---
    cmdError(`Unhandled error during chat command execution: ${error.message}`);
    console.error(error.stack); // Log stack for debugging

    // Clear potentially bad password cache on key/decryption errors
    if (error.message.toLowerCase().includes('password') || error.message.toLowerCase().includes('api key')) {
        if (options.session) options.session.password = null;
    }

    // Ensure input is re-enabled on error for WebSocket clients
    if (options.isWebSocket && options.webSocketClient) {
        safeSend(options.webSocketClient, { type: 'mode_change', mode: 'command', prompt: '> ' });
    }

    // Return a generic error response
    return {
        success: false,
        error: `Chat command failed: ${error.message}`,
        handled: true, // Indicate the error was caught here
        keepDisabled: false // Ensure input is enabled after error
    };
  } // <-- End of catch block
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
      const chatHistory = []; // Maintain history for CLI session

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
          const systemPrompt = retrievedMemoryContext ? `${retrievedMemoryContext}Continue the conversation.` : 'You are a helpful assistant.';

          // Prepare history for LLM (limit context window)
          const maxHistoryLength = 10;
          const llmHistory = chatHistory.slice(-maxHistoryLength);

          // Call LLM
          const response = await llmClient.completeChat(llmHistory, { system: systemPrompt });
          const assistantResponse = cleanChatResponse(response);

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
export async function startResearchFromChat(options = {}) { // Removed chatHistory, memoryBlocks as direct args
  try {
    const {
        // query: researchQuery, // Original query (long history) - No longer the primary input for engine.research
        depth = 2,
        breadth = 3,
        verbose = false,
        password, // Password needed for keys
        // username, // Username needed for keys - Get from currentUser
        currentUser, // Pass currentUser object
        isWebSocket,
        webSocketClient,
        classificationMetadata, // Added classification metadata
        overrideQueries, // --- NEW: Expect pre-generated queries ---
        output: outputFn, // Get output/error from options
        error: errorFn,
        progressHandler // Get progress handler from options
    } = options;

    // --- FIX: Validate overrideQueries instead of researchQuery ---
    if (!Array.isArray(overrideQueries) || overrideQueries.length === 0) {
      throw new Error("Research requires generated queries (overrideQueries).");
    }

    if (!password) {
        throw new Error("Password is required to retrieve API keys for research.");
    }

    if (!currentUser || !currentUser.username) { // Use currentUser
        throw new Error("Username is required to retrieve API keys for research.");
    }
    const username = currentUser.username; // Get username from currentUser

    // --- Get API Keys ---
    let braveKey, veniceKey;
    try {
        braveKey = await userManager.getApiKey({ username, password, service: 'brave' }); // Use options object
        veniceKey = await userManager.getApiKey({ username, password, service: 'venice' }); // Use options object
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
    const userInfo = { username: username, role: currentUser?.role || 'client' }; // Get role from currentUser

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
      progressHandler: progressHandler, // Pass progress handler from options
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
    // Use errorFn if available, otherwise console.error
    const effectiveError = typeof options.error === 'function' ? options.error : console.error;
    effectiveError(`Error during research from chat: ${error.message}`); // Use the caught error object
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
            veniceKey = await userManager.getApiKey({ username: session.username, password: userPassword, service: 'venice' }); // Use options object
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
            // username: session.username, // Pass currentUser instead
            currentUser: currentUser, // Pass fetched user data
            isWebSocket: isWebSocket,
            webSocketClient: webSocketClient,
            classificationMetadata: classificationMetadata, // Pass metadata for summary
            overrideQueries: generatedQueries, // --- Pass the generated queries ---
            output: effectiveOutput, // Pass handlers through
            error: effectiveError,
            progressHandler: options.progressHandler // Pass progress handler from original options
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
        researchResult = await startResearchFromChat(researchOptions); // Pass single options object

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
    // --- FIX: Return researchResult which contains success status ---
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