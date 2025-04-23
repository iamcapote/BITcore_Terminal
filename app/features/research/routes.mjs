import express from 'express';
import crypto from 'crypto';
import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';
// --- FIX: Remove unused displayHelp import ---
import { commands as commandFunctions } from '../../commands/index.mjs';
import { output } from '../../utils/research.output-manager.mjs';
import { userManager } from '../auth/user-manager.mjs';
import { MemoryManager } from '../../infrastructure/memory/memory.manager.mjs';
// --- FIX: Import executeExitResearch (already imported via commandFunctions) ---
import { startResearchFromChat, exitMemory, executeExitResearch } from '../../commands/chat.cli.mjs';
import { WebSocketServer, WebSocket } from 'ws';
import { LLMClient } from '../../infrastructure/ai/venice.llm-client.mjs';
import { callVeniceWithTokenClassifier } from '../../utils/token-classifier.mjs';
import os from 'os';
import { safeSend } from '../../utils/websocket.utils.mjs'; // Use utils - Removed safePing
import { cleanChatResponse } from '../../infrastructure/ai/venice.response-processor.mjs';
import { executeResearch } from '../../commands/research.cli.mjs';
// --- FIX: Removed incorrect import ---
// import { wsPrompt } from './ws-prompt.util.mjs'; // wsPrompt is defined in this file
import { uploadToGitHub } from '../../utils/github.utils.mjs'; // Import the new utility

const router = express.Router();

// Store active chat sessions with their memory managers
const activeChatSessions = new Map();
const wsSessionMap = new WeakMap(); // Maps WebSocket instance to Session ID

// Timeout for inactive sessions (e.g., 1 hour)
const SESSION_INACTIVITY_TIMEOUT = 60 * 60 * 1000;
// Timeout for pending prompts (e.g., 2 minutes)
const PROMPT_TIMEOUT_MS = 2 * 60 * 1000;

// --- NEW: Helper to explicitly control client input state ---
function enableClientInput(ws) {
  // Add check for open state before sending
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[WebSocket] Sending enable_input");
    safeSend(ws, { type: 'enable_input' }); // Use imported safeSend
  } else {
    console.warn("[WebSocket] Tried to enable input on closed/invalid socket.");
  }
}

function disableClientInput(ws) {
   // Add check for open state before sending
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[WebSocket] Sending disable_input");
    safeSend(ws, { type: 'disable_input' }); // Use imported safeSend
  } else {
     console.warn("[WebSocket] Tried to disable input on closed/invalid socket.");
  }
}
// ---

router.post('/', async (req, res) => {
  try {
    const { query, depth = 2, breadth = 3 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    // TODO: Add authentication/authorization check here if needed for HTTP endpoint
    // const engine = new ResearchEngine({ query, depth, breadth });
    // For now, assuming HTTP endpoint might be less used or secured differently
    // Placeholder:
    console.warn("[HTTP POST /api/research] Endpoint hit - consider security implications.");
    // const result = await engine.research();
    // res.json(result);
    res.status(501).json({ error: "HTTP research endpoint not fully implemented/secured." });

  } catch (error) {
    console.error("[HTTP POST /api/research] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle WebSocket connection for the research interface
 * @param {WebSocket} ws WebSocket connection
 * @param {Object} req The initial HTTP request (useful for session info if using express-session)
 */
export function handleWebSocketConnection(ws, req) {
  console.log('[WebSocket] New connection established');

  // --- Start: Added Try/Catch for Initial Setup ---
  try {
    const sessionId = crypto.randomUUID();
    const sessionData = {
      sessionId: sessionId,
      webSocketClient: ws,
      isChatActive: false,
      chatHistory: [],
      memoryManager: null,
      lastActivity: Date.now(),
      username: 'public', // Start as public
      role: 'public',     // Start as public
      pendingPromptResolve: null,
      pendingPromptReject: null,
      promptTimeoutId: null,
      promptIsPassword: false, // Added flag for prompt type
      promptContext: null, // Added flag for prompt context (e.g., 'post_research_action')
      promptData: null, // Added data associated with prompt context
      password: null, // Cached password for the session
      currentUser: null, // Cached user data (including potentially decrypted keys)
      currentResearchResult: null, // Store last research result content
      currentResearchFilename: null, // Store last research result suggested filename
    };
    activeChatSessions.set(sessionId, sessionData);
    wsSessionMap.set(ws, sessionId);
    console.log(`[WebSocket] Created session ${sessionId} for new connection. Initial user: ${sessionData.username}`);

    output.addWebSocketClient(ws);

    // Send initial messages
    safeSend(ws, { type: 'connection', connected: true });
    safeSend(ws, { type: 'output', data: 'Welcome to MCP Terminal!' });
    safeSend(ws, { type: 'output', data: `Current status: ${sessionData.role}. Use /login <username> to authenticate.` });
    safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
    enableClientInput(ws); // Explicitly enable input after initial setup

    console.log(`[WebSocket] Initial setup complete for session ${sessionId}.`);

  } catch (setupError) {
    console.error(`[WebSocket] CRITICAL ERROR during initial connection setup: ${setupError.message}`, setupError.stack);
    // Attempt to send an error message before closing, but it might fail
    safeSend(ws, { type: 'error', error: `Server setup error: ${setupError.message}` });
    // Close the connection immediately due to setup failure
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1011, "Server setup error"); // 1011: Internal Error
    }
    // Ensure cleanup happens even if session wasn't fully added
    const failedSessionId = wsSessionMap.get(ws);
    if (failedSessionId) {
        activeChatSessions.delete(failedSessionId);
        wsSessionMap.delete(ws);
        console.log(`[WebSocket] Cleaned up partially created session ${failedSessionId} after setup error.`);
    }
    output.removeWebSocketClient(ws); // Ensure client is removed from output manager
    return; // Stop further processing for this connection
  }
  // --- End: Added Try/Catch for Initial Setup ---


  ws.on('message', async (raw) => {
    const currentSessionId = wsSessionMap.get(ws);
    const currentSession = currentSessionId ? activeChatSessions.get(currentSessionId) : null;

    if (!currentSession) {
      console.error(`[WebSocket] Error: No session found for incoming message from ws.`);
      try {
        // Use wsErrorHelper but ensure input is enabled after this critical error
        wsErrorHelper(ws, 'Internal Server Error: Session not found. Please refresh.', false); // false = don't keep disabled
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, "Session lost");
        }
      } catch (sendError) {
        console.error("[WebSocket] Error sending session not found message:", sendError);
      }
      return;
    }

    currentSession.lastActivity = Date.now();
    // Disable input at the start of processing any message
    // Only disable if not currently waiting for a server-side prompt response
    if (!currentSession.pendingPromptResolve) {
        disableClientInput(ws);
    } else {
        console.log("[WebSocket] Input remains enabled for pending server-side prompt.");
    }


    let message;
    // Default: Assume input should remain disabled unless explicitly enabled later
    let enableInputAfterProcessing = false;

    try {
      message = JSON.parse(raw.toString());
      // Add more detailed logging for received messages, masking password if present
      const logPayload = { ...message };
      if (logPayload.password) logPayload.password = '******';
      if (logPayload.input && currentSession.pendingPromptResolve && currentSession.promptIsPassword) {
          logPayload.input = '******'; // Mask input if it's for a pending password prompt
      }
      // --- FIX: Use 'value' key for input messages ---
      if (logPayload.type === 'input' && logPayload.value && currentSession.pendingPromptResolve && currentSession.promptIsPassword) {
          logPayload.value = '******'; // Mask input value if it's for a pending password prompt
      }
      console.log(`[WebSocket] Received message (Session ${currentSessionId}, User: ${currentSession.username}):`, JSON.stringify(logPayload).substring(0, 250));


      if (!message.type) {
        throw new Error("Message type is missing");
      }

      // --- Route message based on session state and message type ---
      // --- FIX: Modified routing logic ---
      if (message.type === 'command') {
          // If in chat mode, let handleChatMessage decide how to process the command
          if (currentSession.isChatActive) {
              console.log("[WebSocket] Routing command message to handleChatMessage (chat active).");
              // Pass command details within the message object expected by handleChatMessage
              enableInputAfterProcessing = await handleChatMessage(ws, { message: `/${message.command} ${message.args.join(' ')}` }, currentSession);
          } else {
              // If not in chat mode, handle as a regular command
              console.log("[WebSocket] Routing command message to handleCommandMessage (chat inactive).");
              enableInputAfterProcessing = await handleCommandMessage(ws, message, currentSession);
          }
      } else if (message.type === 'chat-message') {
          // Handle chat messages ONLY when in chat mode
          if (currentSession.isChatActive) {
              console.log("[WebSocket] Routing chat message to handleChatMessage.");
              enableInputAfterProcessing = await handleChatMessage(ws, message, currentSession);
          } else {
              // Received chat message when not in chat mode - treat as error
              console.warn(`[WebSocket] Received 'chat-message' while not in chat mode (Session ${currentSessionId}).`);
              wsErrorHelper(ws, 'Cannot send chat messages when not in chat mode. Use /chat first.', true);
              enableInputAfterProcessing = false; // wsErrorHelper handles enabling
          }
      } else if (message.type === 'input') {
          // Handle responses to server-side prompts
          console.log("[WebSocket] Routing input message to handleInputMessage.");
          // --- FIX: Pass enableInputAfterProcessing by reference or handle return value ---
          // handleInputMessage now returns the desired state
          enableInputAfterProcessing = await handleInputMessage(ws, message, currentSession);
          // enableInputAfterProcessing = false; // Input state decided by the command that initiated the prompt
      } else if (message.type === 'ping') {
          console.log("[WebSocket] Handling ping.");
          safeSend(ws, { type: 'pong' });
          enableInputAfterProcessing = true; // Re-enable after simple ping/pong
      } else {
          // Handle unexpected message types
          console.warn(`[WebSocket] Unexpected message type '${message.type}' received (Session ${currentSessionId}).`);
          wsErrorHelper(ws, `Unexpected message type: ${message.type}`, true);
          enableInputAfterProcessing = false; // wsErrorHelper handles enabling
      }
      // --- End FIX: Modified routing logic ---


      // --- Final Input State Decision ---
      // Re-enable input ONLY IF the handler indicated it should be enabled
      // AND no server-side prompt became active *during* processing (or is still active).
      const sessionAfterProcessing = activeChatSessions.get(currentSessionId); // Re-fetch session state
      const isServerPromptPending = !!(sessionAfterProcessing && sessionAfterProcessing.pendingPromptResolve);

      if (enableInputAfterProcessing && !isServerPromptPending) {
        console.log("[WebSocket] Handler allows enable, no server prompt active. Enabling client input.");
        enableClientInput(ws);
      } else if (enableInputAfterProcessing && isServerPromptPending) {
        console.log("[WebSocket] Handler allows enable, but server prompt is now active. Input remains disabled.");
        // Input stays disabled because we didn't call enableClientInput(ws)
      } else {
        console.log(`[WebSocket] Handler requires input disabled (enableInputAfterProcessing=${enableInputAfterProcessing}) OR server prompt active (isServerPromptPending=${isServerPromptPending}). Input remains disabled.`);
        // Input stays disabled (already disabled at start or by handler)
      }

    } catch (error) {
      console.error(`[WebSocket] Error processing message (Session ${currentSessionId}): ${error.message}`, error.stack, raw.toString()); // Added stack trace
      try {
        // Send error message to client, decide whether to enable input
        const sessionOnError = activeChatSessions.get(currentSessionId);
        const isPromptStillPendingOnError = !!(sessionOnError && sessionOnError.pendingPromptResolve);
        // Enable input after error UNLESS a prompt is still pending
        wsErrorHelper(ws, `Error processing message: ${error.message}`, !isPromptStillPendingOnError);
      } catch (sendError) {
        console.error("[WebSocket] Error sending processing error message:", sendError);
      }
      // Ensure enableInputAfterProcessing is false if wsErrorHelper handled it
      enableInputAfterProcessing = false;
    }
  });

  ws.on('close', (code, reason) => {
    const closedSessionId = wsSessionMap.get(ws);
    const reasonString = reason ? reason.toString() : 'N/A';
    console.log(`[WebSocket] Connection closed (Session ${closedSessionId}, Code: ${code}, Reason: ${reasonString})`);
    output.removeWebSocketClient(ws);

    if (closedSessionId && activeChatSessions.has(closedSessionId)) {
      const session = activeChatSessions.get(closedSessionId);
      // Ensure pending prompt is rejected if connection closes unexpectedly
      if (session.pendingPromptReject) {
        console.log(`[WebSocket] Rejecting pending server-side prompt for closed session ${closedSessionId}.`);
        clearTimeout(session.promptTimeoutId);
        const rejectFn = session.pendingPromptReject; // Capture before clearing
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false; // Clear flag
        session.promptContext = null; // Clear context
        session.promptData = null; // Clear prompt data
        // Reject the promise to unblock any waiting async function
        rejectFn(new Error("WebSocket connection closed during prompt."));
      }
      if (session.memoryManager) {
        console.log(`[WebSocket] Nullifying memory manager for closed session ${closedSessionId}`);
        session.memoryManager = null; // Release memory manager resources if any
      }
      // --- FIX: Clear currentUser and lastResearchResult on close ---
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      activeChatSessions.delete(closedSessionId);
      wsSessionMap.delete(ws);
      console.log(`[WebSocket] Cleaned up session: ${closedSessionId}`);
    } else {
      console.warn(`[WebSocket] Could not find session to clean up for closed connection.`);
    }
  });

  ws.on('error', (error) => {
    const errorSessionId = wsSessionMap.get(ws);
    // --- Start: Enhanced Error Logging ---
    console.error(`[WebSocket] Connection error (Session ${errorSessionId || 'N/A'}):`, error.message, error.stack);
    // --- End: Enhanced Error Logging ---

    // Attempt to inform the client about the error
    wsErrorHelper(ws, `WebSocket connection error: ${error.message}`, false); // false = don't enable, connection is likely dead
    // Force close the socket server-side if it's still open after an error
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log(`[WebSocket] Force closing socket for session ${errorSessionId} due to error.`);
        ws.close(1011, "WebSocket error occurred"); // 1011: Internal Error
    }
    // Cleanup session data similar to 'close' event, as 'close' might not fire reliably after 'error'
    if (errorSessionId && activeChatSessions.has(errorSessionId)) {
        console.log(`[WebSocket] Cleaning up session ${errorSessionId} after error.`);
        const session = activeChatSessions.get(errorSessionId);

        if (session.pendingPromptReject) {
            console.log(`[WebSocket] Rejecting pending prompt for errored session ${errorSessionId}.`);
            clearTimeout(session.promptTimeoutId);
            const rejectFn = session.pendingPromptReject;
            session.pendingPromptResolve = null;
            session.pendingPromptReject = null;
            session.promptTimeoutId = null;
            session.promptIsPassword = false;
            session.promptContext = null; // Clear context
            session.promptData = null; // Clear prompt data
            rejectFn(new Error("WebSocket connection error during prompt."));
        }

        if (session.memoryManager) {
            console.log(`[WebSocket] Releasing memory manager for session ${errorSessionId}.`);
            session.memoryManager = null; // Release memory manager resources
        }
        // --- FIX: Clear currentUser and lastResearchResult on error ---
        session.currentUser = null;
        session.currentResearchResult = null;
        session.currentResearchFilename = null;

        activeChatSessions.delete(errorSessionId);
        wsSessionMap.delete(ws);
        console.log(`[WebSocket] Session ${errorSessionId} cleaned up successfully.`);
    }
     output.removeWebSocketClient(ws); // Ensure client is removed on error too
  });
}

// Helper to send structured output - REMOVED keepDisabled logic
function wsOutputHelper(ws, data) {
  let outputData = '';
  if (typeof data === 'string') {
    outputData = data;
  } else if (data && typeof data.toString === 'function') {
    // Avoid sending complex objects directly if they don't stringify well
    outputData = data.toString();
  } else {
    try {
      outputData = JSON.stringify(data); // Fallback for simple objects
    } catch (e) {
      outputData = "[Unserializable Output]";
      console.error("Failed to stringify output data:", data);
    }
  }
  safeSend(ws, { type: 'output', data: outputData });
}

// Helper to send structured errors - MODIFIED to accept enable flag
function wsErrorHelper(ws, error, enableInputAfterError = true) {
  let errorString = '';
  if (typeof error === 'string') {
    errorString = error;
  } else if (error instanceof Error) {
    // --- Start: Include stack trace in server log for better debugging ---
    console.error(`[wsErrorHelper] Sending error to client: ${error.message}`, error.stack);
    errorString = error.message; // Send only the message part of the Error object to client
    // --- End: Include stack trace in server log ---
  } else if (error && typeof error.toString === 'function') {
    errorString = error.toString();
  } else {
    try {
      errorString = JSON.stringify(error); // Fallback
    } catch (e) {
      errorString = "[Unserializable Error]";
      console.error("[wsErrorHelper] Failed to stringify error data:", error);
    }
  }
  safeSend(ws, { type: 'error', error: errorString });

  // Crucially, decide whether to re-enable input after an error
  if (enableInputAfterError) {
    console.log("[wsErrorHelper] Attempting to re-enable input after error.");
    enableClientInput(ws); // Try to enable input after sending the error
  } else {
    console.log("[wsErrorHelper] Input remains disabled after error as requested.");
  }
}

/**
 * Handles 'command' type messages from the WebSocket client.
 * Executes the command and manages client input state.
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} message - The parsed message object { type: 'command', command, args, password? }.
 * @param {object} session - The session data object.
 * @returns {Promise<boolean>} - True if input should be enabled after processing, false otherwise.
 */
async function handleCommandMessage(ws, message, session) {
  // --- FIX: Prevent top-level commands during active chat ---
  if (session.isChatActive && message.command !== 'help') { // Allow /help in chat
      console.warn(`[WebSocket] Attempted to run top-level command '/${message.command}' while chat is active (Session ${session.sessionId}).`);
      wsErrorHelper(ws, `Cannot run top-level commands while in chat mode. Use chat messages or in-chat commands (e.g., /exit).`, true); // Ensure input enabled after error
      return false; // wsErrorHelper handles enabling input by default handler (wsErrorHelper handles it)
  }
  // --- End FIX ---

  const { command, args = [], password: passwordFromPayload } = message;
  let enableInputAfter = true; // Default to enabling input after command finishes
  const commandString = `/${command} ${args.join(' ')}`; // For logging
  let isInteractiveResearch = false; // Flag for interactive flow

  // --- Argument Parsing & Options Setup ---
  const options = {
      positionalArgs: [], // Initialize positionalArgs
      // Add other default flags if necessary
      depth: 2, // Default research depth
      breadth: 3, // Default research breadth
      classify: false, // Default research classification
      verbose: false, // Default verbosity
      memory: false, // Default chat memory
      // --- Initialize output/error to null initially ---
      output: null,
      error: null,
  };

  try {
    // Simple flag/option parsing (assumes --key=value or --flag)
    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        if (value !== undefined) {
          // Handle flags with values (e.g., --depth=3)
          options[key] = !isNaN(parseInt(value)) ? parseInt(value) : value;
        } else {
          // Handle boolean flags (e.g., --memory)
          options[key] = true;
        }
      } else {
        // Collect positional arguments
        options.positionalArgs.push(arg);
      }
    }
    // Extract query from positional args for direct command call (e.g., /research topic here)
    options.query = options.positionalArgs.join(' ');
  } catch (parseError) {
    console.error(`[WebSocket] Error parsing arguments for ${commandString}:`, parseError);
    // --- FIX: Use wsErrorHelper directly if options.error isn't set yet ---
    wsErrorHelper(ws, `Error parsing arguments: ${parseError.message}`, true);
    return false; // wsErrorHelper handled enabling input
  }

  // --- Define output/error handlers ---
  const commandOutput = (data) => {
    // Send structured messages directly or use helper
    if (typeof data === 'object' && data !== null && data.type) {
      safeSend(ws, data); // Send structured message as-is
    } else {
      wsOutputHelper(ws, data); // Use helper for standard output
    }
    // Don't modify enableInputAfter here based on output data
  };
  const commandError = (data) => {
    // Errors should generally re-enable input
    console.error(`[commandError] Received error:`, data); // Log the actual error data
    wsErrorHelper(ws, data, true); // Use helper to send error and enable input
    enableInputAfter = false; // Signal that wsErrorHelper handled the input state
  };

  // --- FIX: Inject WebSocket context AND output/error handlers into options ---
  options.webSocketClient = ws;
  options.isWebSocket = true;
  options.session = session;
  options.wsPrompt = wsPrompt;
  options.output = commandOutput; // Assign defined handler
  options.error = commandError;   // Assign defined handler
  // --- End FIX ---

  // --- Special Handling for /login in WebSocket ---
  if (command === 'login') {
    // Use positionalArgs for username and password
    const username = options.positionalArgs[0];
    let providedPassword = options.positionalArgs[1] || passwordFromPayload; // Password from args or payload

    if (!username) {
      commandOutput(`Current user: ${session.username} (${session.role})`);
      return true; // Input enabled
    }

    if (session.username === username && session.role !== 'public') {
        commandOutput(`Already logged in as ${username}`);
        return true; // Input enabled
    }

    try {
        // Prompt for password if not provided
        if (!providedPassword) {
           // Input remains disabled while prompting
           enableInputAfter = false;
           // Prompt without context
           providedPassword = await wsPrompt(ws, session, `Enter password for ${username}: `, PROMPT_TIMEOUT_MS, true, null);
           // Input remains disabled, wsPrompt resolution doesn't re-enable it.
           // The rest of the login logic will determine the final state.
        }

        // Authenticate user using userManager (does not modify global state)
        const userData = await userManager.authenticateUser(username, providedPassword);
        const prevUsername = session.username;
        session.username = userData.username;
        session.role = userData.role;
        session.password = providedPassword; // Cache the successful password
        // --- FIX: Cache user data in session ---
        session.currentUser = await userManager.getUserData(session.username); // Cache full user data
        console.log(`[WebSocket] Session ${session.sessionId} updated after login. User: ${prevUsername} -> ${session.username}, Role: ${session.role}`);

        // Send success message and update client state
        safeSend(ws, {
            type: 'login_success',
            username: session.username,
            role: session.role,
            message: `Logged in as ${session.username} (${session.role})`
        });
        safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
        enableInputAfter = true; // Enable input after successful login
    } catch (error) {
        console.error(`[WebSocket] Login failed for ${username} (Session ${session.sessionId}): ${error.message}`);
        session.password = null; // Clear cached password on failure
        session.currentUser = null; // Clear cached user data on failure
        commandError(`Login failed: ${error.message}`); // commandError sets enableInputAfter = false
        enableInputAfter = false; // Explicitly ensure it's false
    }

    console.log(`[WebSocket] Returning from handleCommandMessage (/login). Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter; // Return final decision
  }
  // --- End Special Handling for /login ---

  // --- Fetch currentUser data BEFORE specific command logic ---
  try {
      // --- FIX: Use cached user data if available ---
      if (session.currentUser && session.currentUser.username === session.username) {
          options.currentUser = session.currentUser;
          console.log(`[WebSocket] Using cached user data for command execution.`);
      } else if (session.username !== 'public') {
          options.currentUser = await userManager.getUserData(session.username);
          if (!options.currentUser) {
              commandError(`Error: Could not load user data for ${session.username}.`);
              return false; // commandError handled enabling input
          }
          session.currentUser = options.currentUser; // Cache fetched data
      } else {
          options.currentUser = await userManager.getUserData('public'); // Get public user data
          session.currentUser = options.currentUser; // Cache public user data
      }
      // *** FIX: Assign fetched user data to requestingUser as expected by executeUsers ***
      options.requestingUser = options.currentUser;
      console.log(`[WebSocket] Fetched/used user data for command execution (assigned to currentUser and requestingUser): ${options.requestingUser?.username} (${options.requestingUser?.role})`);
  } catch (userError) {
      commandError(`Error fetching user data: ${userError.message}`);
      return false; // commandError handled enabling input
  }
  // --- End Fetch currentUser ---

  // --- Interactive Research Flow ---
  if (command === 'research' && !options.query) {
      isInteractiveResearch = true;
      // --- FIX: Use options.output ---
      options.output('Starting interactive research setup...');
      enableInputAfter = false; // Disable input while prompting
      try {
          // Prompt for query - NO CONTEXT NEEDED HERE
          const queryInput = await wsPrompt(ws, session, 'Please enter your research query: ', PROMPT_TIMEOUT_MS, false, null);
          if (!queryInput) throw new Error('Research query cannot be empty.');
          options.query = queryInput; // Add query to options

          // Prompt for breadth - NO CONTEXT NEEDED HERE
          const breadthInput = await wsPrompt(ws, session, `Enter research breadth (queries per level) [${options.breadth}]: `, PROMPT_TIMEOUT_MS, false, null);
          if (breadthInput && !isNaN(parseInt(breadthInput))) {
              options.breadth = parseInt(breadthInput);
          }

          // Prompt for depth - NO CONTEXT NEEDED HERE
          const depthInput = await wsPrompt(ws, session, `Enter research depth (levels) [${options.depth}]: `, PROMPT_TIMEOUT_MS, false, null);
          if (depthInput && !isNaN(parseInt(depthInput))) {
              options.depth = parseInt(depthInput);
          }

          // Prompt for classification - NO CONTEXT NEEDED HERE
          const classifyInput = await wsPrompt(ws, session, 'Use token classification? (y/n) [n]: ', PROMPT_TIMEOUT_MS, false, null);
          options.classify = classifyInput.toLowerCase() === 'y';

          // Confirm parameters before proceeding
          // --- FIX: Use options.output ---
          options.output(`Research parameters set: Query="${options.query}", Breadth=${options.breadth}, Depth=${options.depth}, Classify=${options.classify}`);
          // Input remains disabled until research command finishes
      } catch (promptError) {
          // --- FIX: Use options.error ---
          options.error(`Interactive setup failed: ${promptError.message}`);
          // --- FIX: wsPrompt error handler enables input, so return false ---
          return false; // Keep input disabled (error handler enables)
      }
  }
  // --- End Interactive Flow ---

  // --- FIX: Check commandDefinition existence *after* interactive flow might set command to 'research' ---
  // Also check if the execute function exists on the definition
  const commandDefinition = commandFunctions[command];
  // --- End FIX ---

  // --- FIX: Allow /research even if not directly in commandFunctions map (already handled) ---
  // The check below handles this.
  if (!commandDefinition || typeof commandDefinition.execute !== 'function') {
    // Special case: /research is handled differently (not directly in commandFunctions map)
    if (command !== 'research') {
        commandError(`Unknown command: /${command}. Type /help for available commands.`);
        return false; // commandError handled state
    }
    // If it IS research, proceed to the research-specific logic below
  }
  // --- End FIX ---

  // --- Password Handling (for commands other than login) ---
  let finalPassword = passwordFromPayload; // Password might come directly in the command payload
  // Check session cache if not in payload
  if (!finalPassword && session.password) {
      console.log(`[WebSocket] Using cached password for session ${session.sessionId}`);
      finalPassword = session.password;
  }

  // Determine if the command *requires* a password check server-side
  // Refined list based on command logic needing keys/admin rights
  // --- FIX: Added 'upload' to needsPasswordCheckCommands for GitHub token ---
  // 'upload' command doesn't exist, it's an action within handleInputMessage
  // --- FIX: Use helper function ---
  const requiresPasswordCheck = commandRequiresPassword(command);
  // --- End FIX ---

  let needsPasswordPrompt = false;
  // When does the SERVER need to prompt?
  // - If the command requires a password check AND
  // - We don't have a password yet (not in payload, not in cache) AND
  // - The specific command action necessitates it (refined check)
  if (requiresPasswordCheck && !finalPassword) {
      // Check if user is logged in (public users cannot trigger password prompts for these)
      if (session.role === 'public') {
          // Allow /chat and /research to proceed without password if public (they will fail later if keys are needed)
          // But block other sensitive commands.
          // --- FIX: Public users should not be able to run /chat or /research that require keys ---
          // The checks within executeChat/executeResearch handle public users now.
          // Block other sensitive commands for public users here.
          if (command !== 'chat' && command !== 'research') {
              commandError(`You must be logged in to use the /${command} command.`);
              return false; // commandError handles input state
          }
      } else {
          // Refine conditions based on command and args (using options.positionalArgs)
          const actionArg = options.positionalArgs[0]?.toLowerCase(); // Common pattern for action
          if (command === 'keys' && (actionArg === 'set' || actionArg === 'test')) {
              needsPasswordPrompt = true;
          } else if (command === 'password-change') {
              needsPasswordPrompt = true; // Always needs current password
          } else if (command === 'chat') {
              // Chat needs password if API key isn't already decrypted/available
              // Check if key exists first, prompt only if needed for retrieval
              const hasKey = await userManager.hasApiKey('venice', session.username);
              if (hasKey) needsPasswordPrompt = true; // Prompt if key exists but we don't have password
          } else if (command === 'research') {
              // ** Always prompt for research if password isn't available, as keys are required **
              const hasBraveKey = await userManager.hasApiKey('brave', session.username);
              const hasVeniceKey = await userManager.hasApiKey('venice', session.username);
              // Prompt if *either* key exists and we don't have a password
              if (hasBraveKey || hasVeniceKey) {
                  needsPasswordPrompt = true;
                  console.log(`[WebSocket] Research needs password prompt: BraveKey=${hasBraveKey}, VeniceKey=${hasVeniceKey}, PasswordAvailable=${!!finalPassword}`);
              } else {
                  // If no keys are set at all, research will fail later, but no need to prompt now.
                  console.log(`[WebSocket] Research command: No API keys found for user ${session.username}. No password prompt needed.`);
              }
          } else if (command === 'diagnose') {
              // Diagnose might need keys depending on checks performed
              needsPasswordPrompt = true; // Assume needs password for key checks
          } else if (command === 'users' && (actionArg === 'create' || actionArg === 'delete')) {
              // Admin actions might require password confirmation in future, but not just for key decryption
              // For now, admin role check is primary gate. No password prompt needed here based on current logic.
          } // If a prompt was initiated by executeResearch, keepDisabled should be true.
          // Note: 'keys check/stat' and 'users list' don't require password prompt here
      }
  }

  // If a prompt is needed server-side
  if (needsPasswordPrompt) {
    let passwordPromptText = "Enter password: ";
    if (command === 'keys' || command === 'chat' || command === 'research' || command === 'diagnose') {
      passwordPromptText = "Enter password to decrypt API keys: ";
    } else if (command === 'password-change') {
      passwordPromptText = "Enter current password: ";
    } // Add other specific prompts if needed

    try {
      console.log(`[WebSocket] Server needs password for command ${command}. Prompting client (Session ${session.sessionId})`);
      enableInputAfter = false; // Keep disabled while prompting and executing command
      // Use wsPrompt to ask the client and wait for the 'input' message - no context needed here
      const promptedPassword = await wsPrompt(ws, session, passwordPromptText, PROMPT_TIMEOUT_MS, true, null);
      // *** Assign the prompted password to finalPassword ***
      finalPassword = promptedPassword;
      // Input remains disabled, wsPrompt resolution doesn't re-enable it.
      console.log(`[WebSocket] Password received via server-side prompt for command ${command} (Session ${session.sessionId})`);
      console.log(`[WebSocket] finalPassword after prompt: ${finalPassword ? '******' : 'null or empty'}`);
      // --- Cache password in session after successful prompt ---
      if (finalPassword) {
          session.password = finalPassword;
          console.log(`[WebSocket] Cached password in session ${session.sessionId} after prompt.`);
      } else {
          // If prompt returned empty/null (e.g., cancelled), throw error
          throw new Error("Password entry cancelled or failed.");
      }
      // --- End Cache ---
    } catch (promptError) {
      console.error(`[WebSocket] Password prompt failed or timed out for command ${command} (Session ${session.sessionId}): ${promptError.message}`);
      // wsPrompt's error/timeout handler (wsErrorHelper) should have sent an error and re-enabled input.
      return false; // Stop processing the command, input state handled by wsPrompt error path.
    }
  }

  // Add the final password (if obtained) to options for the command function
  if (finalPassword) {
    console.log(`[WebSocket] Adding password to options for command /${command}`);
    options.password = finalPassword;
  } else if (requiresPasswordCheck && session.role !== 'public') {
      // If password was required (due to keys existing) but we still don't have one (e.g., prompt failed/cancelled implicitly, or wasn't needed but keys exist)
      // Let the command function handle the missing password error, but log it here.
      console.warn(`[WebSocket] Proceeding with command /${command} without a password, although it might be required.`);
  }

  // --- Command Execution ---
  try {
    // *** Crucially, check if the command is research and if a query exists NOW ***
    if (command === 'research') {
        // Ensure query exists after potential interactive flow
        if (!options.query) {
            commandError('Research query is missing. Please provide a query or use interactive mode.');
            return false; // commandError enables input
        }
        console.log(`[WebSocket] Executing research command for user ${session.username}`);
        // --- FIX: Pass progress handler to executeResearch ---
        options.progressHandler = (progressData) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                safeSend(ws, { type: 'progress', data: progressData });
            }
        };
        console.log(`[WebSocket] Options passed to executeResearch:`, JSON.stringify({ ...options, webSocketClient: '[WebSocket Object]', session: { ...session, webSocketClient: '[WebSocket Object]', currentUser: '[User Object]' }, progressHandler: '[Function]', wsPrompt: '[Function]', output: '[Function]', error: '[Function]' }).substring(0, 500)); // Log options, masking sensitive parts if needed
        // Call executeResearch and await its result
        const researchResult = await executeResearch(options);
        // --- Start: Log after executeResearch completes ---
        console.log(`[WebSocket] executeResearch completed. Success: ${researchResult?.success}, KeepDisabled: ${researchResult?.keepDisabled}, Result:`, researchResult ? JSON.stringify(researchResult).substring(0, 200) : 'undefined');
        // --- End: Log after executeResearch completes ---

        // Determine final input state based on researchResult
        // If researchResult.keepDisabled is explicitly false, allow enabling.
        // If it's true or undefined, keep disabled (or let error handler decide).
        enableInputAfter = researchResult?.keepDisabled === false;
        // --- FIX: Check researchResult.success ---
        if (researchResult.success && options.isWebSocket) {
            // Research succeeded. The result was stored in session and
            // research_result_ready was sent by executeResearch.
            // Input state (enableInputAfter) is already set based on researchResult.keepDisabled.
            // No further action needed here, handleInputMessage will process the prompt response.
            console.log(`[WebSocket] Research succeeded, prompt initiated by executeResearch. enableInputAfter=${enableInputAfter}`);
        } else if (!researchResult.success) {
            // Research explicitly failed, error should have been sent by commandError
            // commandError sets enableInputAfter = false, and wsErrorHelper enables it.
            enableInputAfter = false;
        } else {
            // Research succeeded but not WebSocket? (CLI case handled in executeResearch)
            // Or result structure issue?
            console.warn(`[WebSocket] Research succeeded but unexpected state. enableInputAfter=${enableInputAfter}`);
        }
    } else if (commandDefinition && typeof commandDefinition.execute === 'function') {
      // --- Execute other commands ---
      const commandFn = commandDefinition.execute; // Get the execute function
      console.log(`[WebSocket] Executing command /${command} for user ${session.username}`);
      // Add specific logging for chat command options
      if (command === 'chat') {
          console.log('[WebSocket] Options passed to executeChat:', JSON.stringify(options, (key, value) => (key === 'webSocketClient' || key === 'session' || key === 'currentUser' || key === 'requestingUser' || key === 'wsPrompt' || key === 'output' || key === 'error') ? `[Object ${key}]` : value, 2));
      }
      const result = await commandFn(options); // Pass options including handlers

      // --- Determine input state based on command result ---
      // Default: enable input unless command indicates otherwise
      enableInputAfter = true;
      if (typeof result === 'object' && result !== null) {
        if (result.keepDisabled === true) {
          enableInputAfter = false;
        }
        // Handle specific command results if needed (e.g., mode changes)
        if (result.modeChange) {
          safeSend(ws, { type: 'mode_change', mode: result.modeChange.mode, prompt: result.modeChange.prompt });
        }
        if (result.message) {
          commandOutput(result.message); // Use commandOutput for consistency
        }
      } else if (result === false) {
        // Some commands might return false explicitly to keep input disabled
        enableInputAfter = false;
      }

      // Special case: /logout should always enable input after success message
      if (command === 'logout') {
          session.username = 'public';
          session.role = 'public';
          session.password = null; // Clear cached password
          session.currentUser = null; // Clear cached user data
          session.currentResearchResult = null; // Clear last research result
          session.currentResearchFilename = null;
          console.log(`[WebSocket] Session ${session.sessionId} logged out. User: ${session.username}`);
          safeSend(ws, { type: 'logout_success', message: 'Logged out successfully.' });
          safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
          enableInputAfter = true; // Ensure input is enabled after logout message
      }

      // Special case: /chat command transitions state
      if (command === 'chat') {
          // If executeChat succeeded
          if (result?.success) {
              // executeChat now handles session state updates (isChatActive, memoryManager, etc.)
              // and sends chat-ready message.
              // We just need to respect the keepDisabled flag from the result.
              enableInputAfter = !(result?.keepDisabled === true);
              console.log(`[WebSocket] /chat command succeeded. enableInputAfter=${enableInputAfter}`);
          } else {
              // Chat command failed (e.g., password incorrect, public user notice)
              // executeChat should have sent an error via commandError.
              // commandError sets enableInputAfter = false, and wsErrorHelper enables it.
              enableInputAfter = false;
              console.log(`[WebSocket] /chat command failed or handled (e.g., public notice). enableInputAfter=${enableInputAfter}`);
          }
      }
    } else {
        // This case should not be reached due to the check above, but handle defensively.
        commandError(`Internal Error: Command definition not found for /${command}.`);
        enableInputAfter = false; // Keep disabled after internal error
    }

    // Final check: If an error occurred *during* execution (not caught by commandError),
    // ensure input is enabled unless explicitly kept disabled.
    // This path shouldn't be hit often if commandError is used correctly.
    if (enableInputAfter === undefined) {
        console.warn(`[WebSocket] enableInputAfter was undefined after command /${command}. Defaulting to true.`);
        enableInputAfter = true;
    }

    console.log(`[WebSocket] Returning from handleCommandMessage. Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter; // Return the final decision
  } catch (error) {
    // Catch errors during command execution itself (not argument parsing or prompting)
    console.error(`[WebSocket] Error executing command ${commandString} (Session ${session.sessionId}):`, error.message, error.stack);
    // Use commandError to send the error and enable input
    commandError(`Internal error executing command /${command}: ${error.message}`);
    return false; // commandError handled enabling input
  }
}

// Helper function to check if a command needs a password (add commands as needed)
function commandRequiresPassword(command) {
    const commands = ['keys', 'password-change', 'research', 'chat', 'exitmemory', 'exitresearch', 'diagnose', 'users']; // Added users
    return commands.includes(command);
}

/**
 * Handles 'chat-message' type messages from the WebSocket client.
 * Processes chat input, interacts with LLM/Memory, and sends responses.
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} message - The parsed message object { type: 'chat-message', message }.
 * @param {object} session - The session data object.
 * @returns {Promise<boolean>} - True if input should be enabled after processing, false otherwise.
 */
async function handleChatMessage(ws, message, session) {
    if (!session.isChatActive) {
        wsErrorHelper(ws, "Cannot process chat message: Not in chat mode.", true);
        return false;
    }

    const userInput = message.message;
    let enableInputAfter = true; // Default to enabling input

    // Define output/error handlers specific to this chat context
    const chatOutput = (data) => wsOutputHelper(ws, data);
    const chatError = (data) => {
        wsErrorHelper(ws, data, true);
        enableInputAfter = false;
    };

    // --- Public User Handling ---
    const isPublicUser = session.role === 'public';
    // Ensure chatHistory exists for all users (including public)
    if (!session.chatHistory) session.chatHistory = [];

    try {
        // --- Handle In-Chat Commands ---
        if (userInput.startsWith('/')) {
            const parts = userInput.substring(1).split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1);

            // --- Public User Command Restrictions ---
            if (isPublicUser && !['exit', 'help'].includes(command)) {
                chatError(`Command /${command} is not available for public users in chat mode. Use /login.`);
                return false; // Keep input disabled as error was sent
            }
            // --- End Public User Command Restrictions ---

            // --- FIX: Pass chatOutput/chatError as output/error ---
            const commandOptions = {
                webSocketClient: ws,
                isWebSocket: true,
                session: session,
                output: chatOutput, // Pass chatOutput
                error: chatError,   // Pass chatError
                wsPrompt: wsPrompt,
                currentUser: session.currentUser,
                requestingUser: session.currentUser,
                password: session.password,
                positionalArgs: args,
                // Parse flags
                depth: session.chatDepth || 2, // Default or from session?
                breadth: session.chatBreadth || 3, // Default or from session?
                classify: session.chatClassify || false, // Default or from session?
                verbose: session.chatVerbose || false, // Use session verbose setting
            };
            // ... existing flag parsing ...
            commandOptions.query = commandOptions.positionalArgs.join(' '); // For /research

            console.log(`[WebSocket] Processing in-chat command: /${command} (Session ${session.sessionId})`);

            let commandResult; // To store result from command execution

            switch (command) {
                case 'exit':
                    chatOutput('Exiting chat mode...');
                    session.isChatActive = false;
                    session.chatHistory = [];
                    session.llmClient = null;
                    // Finalize memory if enabled? No, use /exitmemory
                    if (session.memoryManager) {
                        // Don't output warning for public users as memory is always off
                        if (!isPublicUser) {
                            chatOutput('Note: Memory was active. Use /exitmemory before /exit to save memory.');
                        }
                        session.memoryManager = null; // Clear manager on simple exit
                    }
                    safeSend(ws, { type: 'chat-exit' });
                    safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
                    enableInputAfter = false; // Mode change handles enabling
                    break;

                case 'exitmemory':
                    // Already blocked for public users above
                    commandResult = await exitMemory(commandOptions);
                    // exitMemory sends its own output/error messages via commandOptions.output/error
                    enableInputAfter = !(commandResult?.keepDisabled === true); // Respect keepDisabled flag
                    break;

                case 'memory':
                    // Already blocked for public users above
                    if (args[0] === 'stats' && session.memoryManager) {
                        const stats = await session.memoryManager.getStats();
                        chatOutput(`Memory Stats: ${JSON.stringify(stats)}`);
                    } else if (!session.memoryManager) {
                        chatOutput('Memory mode is not currently active.');
                    } else {
                        chatOutput('Usage: /memory stats');
                    }
                    enableInputAfter = true;
                    break;

                case 'research':
                    // Already blocked for public users above
                    chatOutput(`Starting research for query: "${commandOptions.query}"...`);
                    // --- FIX: Pass progress handler ---
                    commandOptions.progressHandler = (progressData) => {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            safeSend(ws, { type: 'progress', data: progressData });
                        }
                    };
                    commandResult = await executeResearch(commandOptions);
                    // executeResearch sends its own output/error and handles prompts
                    enableInputAfter = !(commandResult?.keepDisabled === true); // Respect keepDisabled flag
                    break;

                case 'exitresearch':
                    // Already blocked for public users above
                     commandOptions.progressHandler = (progressData) => {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            safeSend(ws, { type: 'progress', data: progressData });
                        }
                    };
                    commandResult = await executeExitResearch(commandOptions);
                    // executeExitResearch handles session cleanup, mode change, and output/errors
                    enableInputAfter = !(commandResult?.keepDisabled === true); // Respect keepDisabled flag
                    break;

                case 'help':
                    // Display in-chat help (show all commands, restrictions handled above)
                    // --- FIX: Update help text for public users ---
                    if (isPublicUser) {
                        chatOutput(`Available in-chat commands (Public User):
    /exit          - Exit chat mode, return to command prompt.
    /help          - Show this help message.
    Use /login <username> to access memory and research features.`);
                    } else {
                        chatOutput(`Available in-chat commands:
    /exit          - Exit chat mode, return to command prompt.
    /exitmemory    - Finalize and save memory (if active), then exit chat mode. (Requires Login)
    /memory stats  - Show statistics about the current memory session (if active). (Requires Login)
    /research <q>  - Start a research task based on <q> within the chat context. (Requires Login)
    /exitresearch  - Exit chat, generate queries from history, and start research. (Requires Login)
    /help          - Show this help message.`);
                    }
                    // --- End FIX ---
                    enableInputAfter = true;
                    break;

                default:
                    chatOutput(`Unknown command: ${userInput}. Type /help for available commands.`);
                    enableInputAfter = true;
                    break;
            }
        } else {
            // --- Handle Regular Chat Message ---
            // --- FIX: Allow public users to proceed ---
            enableInputAfter = false; // Keep disabled during LLM call + memory ops

            // 1. Store User Message (if not public, or if memory enabled in future for public)
            if (!isPublicUser || session.memoryManager) { // Only store if logged in or memory somehow active
                session.chatHistory.push({ role: 'user', content: userInput });
                if (session.memoryManager) {
                    try {
                        await session.memoryManager.storeMemory(userInput, 'user');
                    } catch (memError) {
                        chatError(`Memory Error: ${memError.message}`);
                        // Decide if this should stop processing or just warn
                    }
                }
            }

            // 2. Retrieve Relevant Memories (only if memory enabled)
            let retrievedMemoryContext = '';
            if (session.memoryManager) {
                try {
                    const relevantMemories = await session.memoryManager.retrieveRelevantMemories(userInput);
                    if (relevantMemories && relevantMemories.length > 0) {
                        retrievedMemoryContext = "Relevant information from memory:\n" + relevantMemories.map(mem => `- ${mem.content}`).join('\n') + "\n";
                    }
                } catch (memError) {
                    chatError(`Memory Retrieval Error: ${memError.message}`);
                }
            }

            // 3. Prepare history and context for LLM
            // Use session history if logged in, otherwise just the current message for public
            let llmHistory = isPublicUser
                ? [{ role: 'user', content: userInput }] // Public users have no persistent history
                : session.chatHistory.slice(-10); // Logged-in users use session history (limited)

            const systemPromptContent = retrievedMemoryContext
                ? `${retrievedMemoryContext}Continue the conversation.`
                : 'You are a helpful assistant.';

            // Prepend system prompt if it exists and is not empty
            if (systemPromptContent) {
                llmHistory = [{ role: 'system', content: systemPromptContent }, ...llmHistory];
            }


            // 4. Call LLM
            if (!session.llmClient) { // Check if LLM client was initialized (should be for public too now)
                chatError("LLM client is not available in this session.");
                enableInputAfter = true; // Re-enable input after error
            } else {
                try {
                    chatOutput('[AI thinking...]'); // Indicate activity
                    // --- FIX: Pass messages correctly to completeChat ---
                    const response = await session.llmClient.completeChat({ messages: llmHistory });
                    const assistantResponse = cleanChatResponse(response.content); // Access content property

                    // Store assistant response (if not public, or if memory enabled)
                    if (!isPublicUser || session.memoryManager) {
                        session.chatHistory.push({ role: 'assistant', content: assistantResponse });
                        if (session.memoryManager) {
                            try {
                                await session.memoryManager.storeMemory(assistantResponse, 'assistant');
                            } catch (memError) {
                                chatError(`Memory Error: ${memError.message}`);
                            }
                        }
                    }

                    chatOutput(`[AI] ${assistantResponse}`); // Send response
                    enableInputAfter = true; // Re-enable input after successful response
                } catch (llmError) {
                    console.error(`[WebSocket] LLM Error (Session ${session.sessionId}):`, llmError);
                    chatError(`LLM Error: ${llmError.message}`);
                    enableInputAfter = true; // Re-enable input after LLM error
                }
            }
            // --- End FIX ---
        }
    } catch (error) {
        console.error(`[WebSocket] Error in handleChatMessage (Session ${session.sessionId}):`, error);
        chatError(`Internal Server Error: ${error.message}`);
        enableInputAfter = true; // Ensure input is enabled after unexpected errors
    }

    console.log(`[WebSocket] Returning from handleChatMessage. Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter;
}

/**
 * Handles 'input' type messages, typically responses to server-side prompts.
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} message - The parsed message object { type: 'input', value }.
 * @param {object} session - The session data object.
 * @returns {Promise<boolean>} - True if input should be enabled after processing, false otherwise.
 */
async function handleInputMessage(ws, message, session) {
    // --- FIX: Use message.value ---
    const inputValue = message.value;
    let enableInputAfter = false; // Default: Keep disabled, let the resumed operation decide

    // --- FIX: Add logging for received input message ---
    console.log(`[WebSocket] Processing input response (Session ${session.sessionId}): ${session.promptIsPassword ? '******' : inputValue}`);

    // --- FIX: Check if a prompt is actually pending ---
    if (!session.pendingPromptResolve) {
        console.warn(`[WebSocket] Received input when no prompt was pending (Session ${session.sessionId}). Input: ${inputValue}`);
        wsErrorHelper(ws, "Received unexpected input. No prompt was active.", true);
        return false; // wsErrorHelper handled enabling
    }
    // --- End FIX ---

    console.log(`[WebSocket] Handling input message. Pending prompt: ${!!session.pendingPromptResolve}, Context: ${session.promptContext}, Value: ${session.promptIsPassword ? '******' : inputValue}`);

    // --- FIX: Capture context and resolve/reject *before* clearing state ---
    const resolve = session.pendingPromptResolve;
    const reject = session.pendingPromptReject;
    const context = session.promptContext; // Capture context
    const promptIsPassword = session.promptIsPassword; // Capture flag
    const promptData = session.promptData; // Capture prompt data

    // Clear prompt state immediately
    clearTimeout(session.promptTimeoutId);
    session.pendingPromptResolve = null;
    session.pendingPromptReject = null;
    session.promptTimeoutId = null;
    session.promptIsPassword = false;
    session.promptContext = null;
    session.promptData = null; // Clear prompt data
    // --- End FIX ---

    // --- FIX: Handle post-research actions based on captured context ---
    // *** Check context EXPLICITLY ***
    if (context === 'post_research_action') {
        console.log(`[WebSocket] Handling post-research action input: ${inputValue}`);
        const action = inputValue.toLowerCase().trim();
        const markdownContent = session.currentResearchResult;
        // Use suggested filename from promptData if available, otherwise from session
        const suggestedFilename = promptData?.suggestedFilename || session.currentResearchFilename || 'research-result.md';
        let userPassword = session.password; // Get cached password

        wsOutputHelper(ws, `Selected action: ${action}`);
        enableInputAfter = true; // Default to enabling input after action

        if (!markdownContent) {
            wsErrorHelper(ws, "Error: Research content not found in session.");
        } else {
            try {
                switch (action) {
                    case 'download':
                        wsOutputHelper(ws, "Preparing download...");
                        safeSend(ws, {
                            type: 'download_file',
                            filename: suggestedFilename,
                            content: markdownContent
                        });
                        // Input enabled by default
                        break;

                    case 'upload':
                        if (!session.currentUser || session.currentUser.role === 'public') {
                            throw new Error("Login required to upload results.");
                        }
                        // Check if password is required (if token exists but password not cached)
                        const needsUploadPassword = await userManager.hasGitHubConfig(session.username) && !userPassword; // Check config, not just token
                        if (needsUploadPassword) {
                            wsOutputHelper(ws, "Password needed for GitHub token.");
                            enableInputAfter = false; // Keep disabled for nested prompt
                            try {
                                // Prompt for password - use context 'github_token_password'
                                userPassword = await wsPrompt(ws, session, "Enter password to decrypt GitHub token: ", PROMPT_TIMEOUT_MS, true, 'github_token_password');
                                if (!userPassword) throw new Error("Password required for upload.");
                                session.password = userPassword; // Cache password on success
                                // Input remains disabled, continue with upload logic below
                            } catch (promptError) {
                                // If the nested prompt fails, handle the error and ensure input state is managed
                                wsErrorHelper(ws, `Password prompt failed: ${promptError.message}`, true);
                                // Clear result from session as action failed
                                session.currentResearchResult = null;
                                session.currentResearchFilename = null;
                                return false; // Stop processing, wsErrorHelper enabled input
                            }
                        }
                        // Proceed with upload attempt
                        wsOutputHelper(ws, "Attempting to upload to GitHub...");
                        enableInputAfter = false; // Disable input during upload
                        // Get GitHub config (requires password if token needs decryption)
                        const githubConfig = await userManager.getGitHubConfig(session.username, userPassword);
                        if (!githubConfig || !githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
                            throw new Error("GitHub is not configured for this user or token decryption failed. Use /keys set github...");
                        }
                        // Define repo path (e.g., research/query-timestamp.md)
                        // Use the suggested filename directly as the repo path
                        const repoPath = suggestedFilename;
                        const commitMessage = `Research results for query: ${session.currentResearchQuery || 'Unknown Query'}`; // Use stored query if available
                        // Perform upload using the utility function
                        const uploadResult = await uploadToGitHub(
                            githubConfig, // Contains token, owner, repo, branch
                            repoPath,
                            markdownContent,
                            commitMessage
                        );
                        wsOutputHelper(ws, `Upload successful!`);
                        wsOutputHelper(ws, `Commit: ${uploadResult.commitUrl}`);
                        wsOutputHelper(ws, `File: ${uploadResult.fileUrl}`);
                        enableInputAfter = true; // Enable after successful upload
                        break;

                    case 'keep':
                        wsOutputHelper(ws, "Research result kept in session (will be lost on disconnect/logout).");
                        // Input enabled by default
                        break;

                    case 'discard': // Added discard action
                        wsOutputHelper(ws, "Research result discarded.");
                        // Input enabled by default
                        break;

                    default:
                        wsOutputHelper(ws, `Invalid action: '${action}'. Please choose Download, Upload, Keep, or Discard.`);
                        // Keep result in session if action is invalid
                        // Input enabled by default
                        break;
                }
            } catch (actionError) {
                console.error(`[WebSocket] Error during post-research action '${action}': ${actionError.message}`, actionError.stack);
                wsErrorHelper(ws, `Error performing action '${action}': ${actionError.message}`, true);
                enableInputAfter = false; // wsErrorHelper enables input
                // Clear password cache if upload failed due to password error
                if (action === 'upload' && actionError.message.toLowerCase().includes('password')) {
                    session.password = null;
                }
            } finally {
                // Clear research result from session unless action was 'keep' or invalid
                if (action === 'download' || action === 'upload' || action === 'discard') { // 'discard' case added for completeness
                    session.currentResearchResult = null;
                    session.currentResearchFilename = null;
                    delete session.currentResearchQuery; // Clear query context too
                }
            }
        }
    } else if (context === 'github_token_password') {
        // This context is handled within the 'upload' case above.
        // Resolve the nested prompt. The upload logic continues.
        console.log(`[WebSocket] Resolving nested GitHub password prompt.`);
        resolve(inputValue);
        enableInputAfter = false; // Keep disabled, upload logic continues
    } else {
        // --- FIX: Resolve the promise for prompts without specific context ---
        // This handles the input for interactive research query, breadth, depth, classify,
        // login password, key decryption passwords, etc.
        console.log(`[WebSocket] Resolving standard prompt (context: ${context || 'none'}) with value: ${promptIsPassword ? '******' : inputValue}`);
        resolve(inputValue);
        // Input state (enableInputAfter) will be determined by the code awaiting the wsPrompt result
        // (e.g., handleCommandMessage's interactive research loop or command execution logic).
        // That code keeps input disabled until the command finishes or errors.
        enableInputAfter = false; // Let the awaiting function decide
    }
    // --- End FIX ---

    console.log(`[WebSocket] Returning from handleInputMessage. Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter;
}

/**
 * Prompts the user via WebSocket and waits for an 'input' message.
 * Manages prompt state within the session.
 * @param {WebSocket} ws
 * @param {object} session
 * @param {string} promptMessage
 * @param {number} timeoutMs
 * @param {boolean} isPassword - If true, masks input display on client.
 * @param {string|null} context - Optional context for the prompt (e.g., 'post_research_action').
 * @returns {Promise<string>} Resolves with the user's input, rejects on timeout or error.
 */
function wsPrompt(ws, session, promptMessage, timeoutMs = PROMPT_TIMEOUT_MS, isPassword = false, context = null) {
    return new Promise((resolve, reject) => {
        if (session.pendingPromptResolve) {
            // --- FIX: Reject previous prompt if a new one is initiated ---
            console.warn(`[wsPrompt] New prompt initiated while another was pending for session ${session.sessionId}. Rejecting previous prompt.`);
            const previousReject = session.pendingPromptReject;
            clearTimeout(session.promptTimeoutId);
            session.pendingPromptResolve = null;
            session.pendingPromptReject = null;
            session.promptTimeoutId = null;
            session.promptIsPassword = false;
            session.promptContext = null;
            session.promptData = null; // Clear prompt data
            previousReject(new Error("New prompt initiated, cancelling previous one."));
            // --- End FIX ---
        }

        // --- Start: Log prompt initiation ---
        console.log(`[wsPrompt] Initiating prompt for session ${session.sessionId}. Message: "${promptMessage}", Password: ${isPassword}, Context: ${context}`);
        // --- End: Log prompt initiation ---

        session.pendingPromptResolve = resolve;
        session.pendingPromptReject = reject;
        session.promptIsPassword = isPassword;
        session.promptContext = context; // Store context
        // session.promptData is set externally if needed (e.g., by executeResearch)

        // Send the prompt message to the client
        try {
            // --- FIX: Send context along with prompt ---
            safeSend(ws, {
                type: 'prompt',
                data: promptMessage, // Use 'data' key consistent with client handler
                isPassword: isPassword,
                context: context // Send context to client if needed for UI hints
            });
            console.log(`[WebSocket] Prompt message sent to client (Session ${session.sessionId})`);
            // --- End FIX ---

            // Set timeout for the prompt
            session.promptTimeoutId = setTimeout(() => {
                if (session.pendingPromptReject === reject) { // Ensure it's still the same prompt
                    console.log(`[wsPrompt] Prompt timed out for session ${session.sessionId}.`);
                    session.pendingPromptResolve = null;
                    session.pendingPromptReject = null;
                    session.promptTimeoutId = null;
                    session.promptIsPassword = false;
                    session.promptContext = null;
                    session.promptData = null; // Clear prompt data
                    // Reject the promise
                    reject(new Error("Prompt timed out."));
                    // Send error to client and re-enable input
                    wsErrorHelper(ws, "Prompt timed out.", true);
                }
            }, timeoutMs);
        } catch (sendError) {
            console.error(`[wsPrompt] Failed to send prompt message for session ${session.sessionId}: ${sendError.message}`);
            // Clean up session state
            session.pendingPromptResolve = null;
            session.pendingPromptReject = null;
            session.promptTimeoutId = null;
            session.promptIsPassword = false;
            session.promptContext = null;
            session.promptData = null; // Clear prompt data
            // Reject the promise
            reject(new Error(`Failed to send prompt: ${sendError.message}`));
            // Attempt to send error to client and re-enable input
            wsErrorHelper(ws, `Server error: Failed to send prompt.`, true);
        }
    });
}

// --- Session Cleanup ---
export function cleanupInactiveSessions() { // --- FIX: Added export ---
  const now = Date.now();
  console.log(`[Session Cleanup] Running cleanup task. Current sessions: ${activeChatSessions.size}`);
  activeChatSessions.forEach((session, sessionId) => {
    if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
      console.log(`[Session Cleanup] Session ${sessionId} timed out due to inactivity.`);
      const ws = session.webSocketClient;
      // Reject pending prompt if any
      if (session.pendingPromptReject) {
        console.log(`[Session Cleanup] Rejecting pending prompt for inactive session ${sessionId}.`);
        clearTimeout(session.promptTimeoutId);
        const rejectFn = session.pendingPromptReject;
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false; // Clear flag
        session.promptContext = null; // Clear context
        session.promptData = null; // Clear prompt data
        rejectFn(new Error("Session timed out during prompt."));
      }
      // Send timeout message and close connection
      if (ws && ws.readyState === WebSocket.OPEN) {
        safeSend(ws, { type: 'session-expired' }); // Use specific type
        // safeSend(ws, { type: 'error', error: 'Session timed out due to inactivity.' });
        ws.close(1000, 'Session Timeout'); // 1000: Normal Closure
      }
      // Clean up server-side resources
      output.removeWebSocketClient(ws);
      if (session.memoryManager) {
          console.log(`[Session Cleanup] Releasing memory manager for timed out session ${sessionId}.`);
          session.memoryManager = null; // Release memory manager resources
      }
      // --- FIX: Clear currentUser and lastResearchResult on timeout ---
      session.currentUser = null;
      session.currentResearchResult = null;
      session.currentResearchFilename = null;
      activeChatSessions.delete(sessionId);
      if (ws) {
        wsSessionMap.delete(ws);
      }
      console.log(`[Session Cleanup] Cleaned up inactive session: ${sessionId}`);
    }
  });

  console.log(`[Session Cleanup] Finished cleanup task. Remaining sessions: ${activeChatSessions.size}`);
}

// Run cleanup periodically (e.g., every 5 minutes)
setInterval(cleanupInactiveSessions, 5 * 60 * 1000);

export default router;