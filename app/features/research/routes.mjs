import express from 'express';
import crypto from 'crypto';
import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';
// --- FIX: Import executeExitResearch ---
import { commands as commandFunctions, displayHelp } from '../../commands/index.mjs';
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
      password: null, // Cached password for the session
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
          await handleInputMessage(ws, message, currentSession);
          enableInputAfterProcessing = false; // Input state decided by the command that initiated the prompt
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
      console.error(`[WebSocket] Error processing message (Session ${currentSessionId}): ${error.message}`, raw.toString());
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
        // Reject the promise to unblock any waiting async function
        rejectFn(new Error("WebSocket connection closed during prompt."));
      }
      if (session.memoryManager) {
        console.log(`[WebSocket] Nullifying memory manager for closed session ${closedSessionId}`);
        session.memoryManager = null; // Release memory manager resources if any
      }
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
            rejectFn(new Error("WebSocket connection error during prompt."));
        }

        if (session.memoryManager) {
            console.log(`[WebSocket] Releasing memory manager for session ${errorSessionId}.`);
            session.memoryManager = null; // Release memory manager resources
        }

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
  if (session.isChatActive) {
      console.warn(`[WebSocket] Attempted to run top-level command '/${message.command}' while chat is active (Session ${session.sessionId}).`);
      wsErrorHelper(ws, `Cannot run top-level commands while in chat mode. Use chat messages or in-chat commands (e.g., /exit).`, true);
      return false; // wsErrorHelper handles enabling input
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
  };
  try {
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
    // Extract query from positional args for direct command call
    options.query = options.positionalArgs.join(' '); // Join all positional args as the query
  } catch (parseError) {
    console.error(`[WebSocket] Error parsing arguments for ${commandString}:`, parseError);
    wsErrorHelper(ws, `Error parsing arguments: ${parseError.message}`, true); // Enable after error
    return false; // wsErrorHelper handled enabling
  }

  // Inject WebSocket-specific context into options
  options.webSocketClient = ws;
  options.isWebSocket = true;
  options.session = session; // Pass the whole session object

  // Define output/error handlers specific to this command execution
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

  // Add handlers to options object
  options.output = commandOutput;
  options.error = commandError;


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
           providedPassword = await wsPrompt(ws, session, `Enter password for ${username}: `, PROMPT_TIMEOUT_MS, true);
           // Input remains disabled, wsPrompt resolution doesn't re-enable it.
           // The rest of the login logic will determine the final state.
        }

        // Authenticate user using userManager (does not modify global state)
        const userData = await userManager.authenticateUser(username, providedPassword);

        // *** FIX: Update WebSocket session state ***
        const prevUsername = session.username;
        session.username = userData.username;
        session.role = userData.role;
        session.password = providedPassword; // Cache the successful password
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
        commandError(`Login failed: ${error.message}`); // commandError sets enableInputAfter = false
        enableInputAfter = false; // Explicitly ensure it's false
    }
    console.log(`[WebSocket] Returning from handleCommandMessage (/login). Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter; // Return final decision
  }
  // --- End Special Handling for /login ---


  // --- Generic Command Handling (excluding login) ---
  // --- FIX: Remove chat-specific command handling from here ---
  // // --- Check if in chat mode and handle chat-specific commands first ---
  // if (session.isChatActive) {
  //     // In chat mode, only specific commands are handled here, others are passed to handleChatMessage
  //     if (command === 'exit') {
  //         // ... (This logic is now primarily in handleChatMessage) ...
  //     } else if (command === 'exitmemory') {
  //         // ... (This logic is now primarily in handleChatMessage) ...
  //     }
  // }
  // --- End FIX ---


  const commandFn = commandFunctions[command];
  // --- FIX: Allow /research even if not directly in commandFunctions map (already handled) ---
  // --- FIX: Check commandFn existence *after* potential interactive research setup ---
  // if (!commandFn && command !== 'research') {
  //   commandError(`Unknown command: /${command}. Type /help for available commands.`);
  //   return false; // commandError handled state
  // }

  console.log(`[WebSocket] Processing command (Session ${session.sessionId}, User: ${session.username}): ${commandString}`);

  // --- Fetch currentUser data BEFORE specific command logic ---
  // This ensures currentUser is available for all commands, including /research
  try {
      if (session.username !== 'public') {
          options.currentUser = await userManager.getUserData(session.username);
          if (!options.currentUser) {
              commandError(`Error: Could not load user data for ${session.username}.`);
              return false; // commandError handled enabling
          }
      } else {
          options.currentUser = await userManager.getUserData('public');
      }
      // *** FIX: Assign fetched user data to requestingUser as expected by executeUsers ***
      options.requestingUser = options.currentUser;
      console.log(`[WebSocket] Fetched user data for command execution (assigned to currentUser and requestingUser): ${options.requestingUser?.username} (${options.requestingUser?.role})`);
  } catch (userError) {
      commandError(`Error fetching user data: ${userError.message}`);
      return false; // commandError handled enabling
  }
  // --- End Fetch currentUser ---


  // --- Interactive Research Flow ---
  if (command === 'research' && !options.query) {
      isInteractiveResearch = true;
      wsOutputHelper(ws, 'Starting interactive research setup...');
      enableInputAfter = false; // Disable input while prompting
      try {
          // Prompt for query
          const queryInput = await wsPrompt(ws, session, 'Please enter your research query: ');
          if (!queryInput) throw new Error('Research query cannot be empty.');
          options.query = queryInput; // Add query to options

          // Prompt for breadth
          const breadthInput = await wsPrompt(ws, session, `Enter research breadth (queries per level) [${options.breadth}]: `);
          if (breadthInput && !isNaN(parseInt(breadthInput))) {
              options.breadth = parseInt(breadthInput);
          }

          // Prompt for depth
          const depthInput = await wsPrompt(ws, session, `Enter research depth (levels) [${options.depth}]: `);
          if (depthInput && !isNaN(parseInt(depthInput))) {
              options.depth = parseInt(depthInput);
          }

          // Prompt for classification
          const classifyInput = await wsPrompt(ws, session, 'Use token classification? (y/n) [n]: ');
          options.classify = classifyInput.toLowerCase() === 'y';

          // Confirm parameters before proceeding
          wsOutputHelper(ws, `Research parameters set: Query="${options.query}", Breadth=${options.breadth}, Depth=${options.depth}, Classify=${options.classify}`);
          // Input remains disabled until research command finishes

      } catch (promptError) {
          commandError(`Interactive setup failed: ${promptError.message}`);
          return false; // Keep input disabled (error handler enables)
      }
  }
  // --- End Interactive Flow ---


  // --- FIX: Check commandFn existence *after* interactive flow might set command to 'research' ---
  if (!commandFn && command !== 'research') {
    commandError(`Unknown command: /${command}. Type /help for available commands.`);
    return false; // commandError handled state
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
  const needsPasswordCheckCommands = ['keys', 'password-change', 'chat', 'research', 'diagnose', 'users'];
  const requiresPasswordCheck = needsPasswordCheckCommands.includes(command);
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
          if (command !== 'chat' && command !== 'research') {
              commandError(`You must be logged in to use the /${command} command.`);
              return false; // commandError handled enabling
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
          }
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
      // Use wsPrompt to ask the client and wait for the 'input' message
      const promptedPassword = await wsPrompt(ws, session, passwordPromptText, PROMPT_TIMEOUT_MS, true);
      // *** Assign the prompted password to finalPassword ***
      finalPassword = promptedPassword;
      // Input remains disabled, wsPrompt resolution doesn't re-enable it.
      console.log(`[WebSocket] Password received via server-side prompt for command ${command} (Session ${session.sessionId})`);
      // Add logging to confirm password reception
      console.log(`[WebSocket] finalPassword after prompt: ${finalPassword ? '******' : 'null or empty'}`);

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
        console.log(`[WebSocket] Options passed to executeResearch:`, JSON.stringify({ ...options, webSocketClient: '[WebSocket Object]', session: { ...session, webSocketClient: '[WebSocket Object]' } }).substring(0, 500)); // Log options, masking sensitive parts if needed

        // Call executeResearch and await its result
        const researchResult = await executeResearch(options);

        // --- Start: Log after executeResearch completes ---
        console.log(`[WebSocket] executeResearch completed. Success: ${researchResult?.success}, KeepDisabled: ${researchResult?.keepDisabled}`);
        // --- End: Log after executeResearch completes ---

        // Determine final input state based on researchResult
        // If researchResult.keepDisabled is explicitly false, allow enabling.
        // If it's true or undefined, keep disabled (or let error handler decide).
        enableInputAfter = researchResult?.keepDisabled === false;

    } else if (commandFn) { // Handle other commands
        // options.currentUser and options.requestingUser are already set from earlier fetch

        // Execute the command function
        console.log(`[WebSocket] Executing command function: /${command} for user ${session.username}`);
        const logOptions = { ...options };
        if (logOptions.password) logOptions.password = '******';
        if (logOptions.session?.password) logOptions.session.password = '******';
        // Mask user password if present
        if (logOptions.currentUser?.passwordHash) logOptions.currentUser.passwordHash = '******';
        if (logOptions.requestingUser?.passwordHash) logOptions.requestingUser.passwordHash = '******';
        console.log(`[WebSocket] Options passed to command:`, JSON.stringify(logOptions, (key, value) => key === 'webSocketClient' ? '[WebSocket Object]' : value).substring(0, 500));

        const result = await commandFn(options);
        console.log(`[WebSocket] Command function /${command} finished. Result:`, result ? JSON.stringify(result).substring(0,100) : 'undefined');

        // --- Post-Execution State Management ---
        enableInputAfter = true; // Default to enabling after success
        // ... (rest of post-execution logic for chat-ready, keepDisabled, password caching) ...
         if (result?.type === 'chat-ready') {
            console.log("[WebSocket] chat-ready result received.");
            session.isChatActive = true;
            session.chatHistory = [];
            session.memoryManager = result.memoryManager;
            safeSend(ws, { type: 'chat-ready', prompt: '[chat] ', memoryEnabled: !!result.memoryManager });
        }
        if (result && result.keepDisabled === true) {
            console.log("[WebSocket] Command result explicitly requests keepDisabled=true.");
            enableInputAfter = false;
        }
        if (result && result.keepDisabled === false) {
            console.log("[WebSocket] Command result explicitly requests keepDisabled=false.");
            enableInputAfter = true;
        }
        // ... (password caching logic) ...
         const isPasswordError = result?.error?.toLowerCase().includes('password') || result?.error?.toLowerCase().includes('decryption failed');
        if (requiresPasswordCheck && result?.success === false && isPasswordError) {
            console.log(`[WebSocket] Clearing cached password for session ${session.sessionId} due to command failure related to password.`);
            session.password = null;
        } else if (requiresPasswordCheck && result?.success === true && finalPassword) {
            console.log(`[WebSocket] Caching successfully used password for session ${session.sessionId}.`);
            session.password = finalPassword;
        }

    } else {
        // Should not happen if initial check passed, but handle defensively
        commandError(`Command /${command} not found or not executable.`);
        return false;
    }

    console.log(`[WebSocket] Returning from handleCommandMessage. Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter; // Return final decision on input state

  } catch (error) {
    // Catch uncaught errors from the command function itself
    console.error(`[WebSocket] Uncaught error executing command /${command} (Session ${session.sessionId}, User: ${session.username}):`, error);
    // Use commandError to report and manage input state
    commandError(`Server error executing command: ${error.message}`);
    console.log(`[WebSocket] Returning from handleCommandMessage after catch. Final enableInputAfter: false`);
    // Error helper enables input by default, so return false as it was handled
    return false;
  }
}

/**
 * Handles 'input' type messages (responses to server-side prompts).
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} message - The parsed message object { type: 'input', value }. Changed key from 'input' to 'value'.
 * @param {object} session - The session data object.
 * @returns {Promise<void>}
 */
async function handleInputMessage(ws, message, session) {
  // *** FIX: Use 'value' key from client message instead of 'input' ***
  const { value: inputValue } = message;
  // Mask password input in logs if this is resolving a password prompt
  const logInput = session.promptIsPassword ? '******' : (inputValue === null ? '<null>' : String(inputValue).substring(0, 50));
  console.log(`[WebSocket] Processing input response (Session ${session.sessionId}): ${logInput}`);

  if (!session) {
    console.error("[WebSocket] CRITICAL: session object is null in handleInputMessage!");
    wsErrorHelper(ws, 'Internal Server Error: Session lost during input handling.', true); // Enable after critical error
    return;
  }

  console.log(`[WebSocket] Checking for pending server-side prompt. session.pendingPromptResolve is ${session.pendingPromptResolve ? 'set' : 'null'}`);

  if (session.pendingPromptResolve) {
    console.log(`[WebSocket] Found pending server-side prompt. Resolving... (Session ${session.sessionId})`);
    clearTimeout(session.promptTimeoutId); // Clear the timeout associated with the prompt
    session.promptTimeoutId = null;

    const resolve = session.pendingPromptResolve; // Get the resolve function
    // Clear the prompt state *before* resolving
    session.pendingPromptResolve = null;
    session.pendingPromptReject = null;
    session.promptIsPassword = false; // Clear password flag

    // Resolve the promise, which allows the waiting command handler (e.g., in handleCommandMessage) to continue
    // *** FIX: Resolve with the correct variable 'inputValue' ***
    resolve(inputValue);
    // Input remains disabled. The command awaiting the prompt will decide the final state.
    console.log(`[WebSocket] Server-side prompt resolved for session ${session.sessionId}. Input remains disabled (awaiting command completion).`);
  } else {
    // This is the scenario that was causing the error message.
    console.warn(`[WebSocket] Received unexpected input message when no server-side prompt was pending (Session ${session.sessionId}). Input: ${logInput}`);
    // Send an error back to the client and ensure input is enabled.
    // *** FIX: Use 'inputValue' in the error message ***
    wsErrorHelper(ws, `Received unexpected input: ${inputValue === null ? '<null>' : inputValue}`, true); // Enable after this unexpected message
  }
}

async function handleChatMessage(ws, message, session) {
  // --- FIX: Handle potential command object passed from routing ---
  let chatMessage;
  if (typeof message.message === 'string') {
      chatMessage = message.message;
  } else {
      // If it's not a string, it might be the command object { type, command, args }
      // Reconstruct the command string
      chatMessage = `/${message.command} ${message.args.join(' ')}`;
      console.log(`[WebSocket] Reconstructed command string in handleChatMessage: ${chatMessage}`);
  }
  // --- End FIX ---

  console.log(`[WebSocket] Processing chat message/command (Session ${session.sessionId}, User: ${session.username}): ${chatMessage}`);
  let enableInputAfter = true; // Default to enabling input

  if (!session || !session.isChatActive) {
    wsErrorHelper(ws, 'No active chat session found. Use /chat to start.', true); // Enable after error
    return false; // wsErrorHelper handled enabling
  }

  const trimmedMessage = chatMessage ? chatMessage.trim() : '';

  // Define output/error handlers for chat context
  const chatOutput = (data) => {
    // Send structured messages directly or use helper
    if (typeof data === 'object' && data !== null && data.type) {
      safeSend(ws, data); // Send structured message as-is
    } else {
      wsOutputHelper(ws, data); // Use helper for standard output
    }
    // Don't modify enableInputAfter here
  };
  const chatError = (data) => {
    wsErrorHelper(ws, data, true); // Use helper to send error and enable input
    enableInputAfter = false; // Signal that wsErrorHelper handled the input state
  };

  // --- Handle In-Chat Commands ---
  if (trimmedMessage.startsWith('/')) {
    // Simple split for in-chat commands
    const args = trimmedMessage.substring(1).split(' '); // Remove leading '/' before splitting
    const command = args[0].toLowerCase();
    const positionalArgs = args.slice(1); // Arguments after the command
    console.log(`[WebSocket] Handling in-chat command: /${command} with args:`, positionalArgs); // Log parsed command

    // --- Fetch currentUser data for in-chat commands ---
    let currentUserData;
    try {
        if (session.username !== 'public') {
            currentUserData = await userManager.getUserData(session.username);
            if (!currentUserData) {
                chatError(`Error: Could not load user data for ${session.username}.`);
                return false; // chatError handled enabling
            }
        } else {
            currentUserData = await userManager.getUserData('public');
        }
    } catch (userError) {
        chatError(`Error fetching user data: ${userError.message}`);
        return false; // chatError handled enabling
    }
    // --- End Fetch currentUser ---


    switch (command) {
      case 'exit':
        console.log(`[WebSocket] Exiting chat session: ${session.sessionId}`);
        session.isChatActive = false;
        if (session.memoryManager) {
          console.log(`[WebSocket] Chat exited without finalizing memory for session ${session.sessionId}.`);
          // Consider if memory should be finalized automatically here or require /exitmemory
          session.memoryManager = null;
        }
        session.chatHistory = [];
        session.password = null; // Clear cached password on exit
        safeSend(ws, { type: 'chat-exit' }); // Inform client
        safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' }); // Explicitly change mode back
        return true; // Enable input after exiting chat

      case 'exitmemory':
        if (session.memoryManager) {
          chatOutput('Finalizing memories...');
          enableInputAfter = false; // Keep disabled during finalization
          try {
            const result = await exitMemory({ session, output: chatOutput, error: chatError }, chatOutput, chatError);
            // Assume success enables unless result explicitly says otherwise
            enableInputAfter = !(result?.keepDisabled === true);
          } catch (memError) {
            chatError(`Error finalizing memory: ${memError.message}`);
            // chatError sets enableInputAfter = false, so return false
            return false;
          }
        } else {
          chatError('Memory mode is not enabled.');
          return false; // chatError handled enabling
        }
        // Return the state determined by the try/catch block
        return enableInputAfter;

      case 'memory':
         if (positionalArgs[0] === 'stats') { // Check first positional arg
             const memoryCommandFn = commandFunctions['memory'];
             if (memoryCommandFn) {
                 chatOutput('Getting memory stats...');
                 enableInputAfter = false; // Keep disabled during command
                 try {
                     // Pass options including positionalArgs
                     const result = await memoryCommandFn({
                         positionalArgs: positionalArgs, // Pass ['stats']
                         session: session,
                         isWebSocket: true,
                         webSocketClient: ws,
                         output: chatOutput,
                         error: chatError,
                         currentUser: currentUserData, // Pass fetched user data
                         // Add any flags if needed, though '/memory stats' likely doesn't use them
                     }, chatOutput, chatError);
                     // Assume success enables unless result explicitly says otherwise
                     enableInputAfter = !(result?.keepDisabled === true);
                 } catch(cmdError) {
                      chatError(`Error getting memory stats: ${cmdError.message}`);
                      return false; // chatError handled enabling
                 }
             } else {
                 chatError("Internal error: /memory command not found.");
                 return false; // chatError handled enabling
             }
         } else {
             chatError("Usage: /memory stats");
             return false; // chatError handled enabling
         }
         return enableInputAfter;

      case 'research':
        // Extract query from positionalArgs
        const researchQuery = positionalArgs.join(' ');

        if (!researchQuery) {
          chatError('Usage: /research <your research query>');
          return false; // chatError handled enabling
        }

        chatOutput(`Starting research based on chat context: "${researchQuery}"`);
        safeSend(ws, { type: 'research_start', keepDisabled: true }); // Keep disabled
        enableInputAfter = false; // Keep disabled during research

        try {
          let userPassword = session.password;
          if (!userPassword) {
            try {
              // Prompt for password, keeping input disabled
              userPassword = await wsPrompt(ws, session, "Password needed for research API key: ", PROMPT_TIMEOUT_MS, true);
              session.password = userPassword; // Cache password
              // Input remains disabled after prompt resolution
            } catch (promptError) {
              // wsPrompt error handler enables input
              return false; // Input state handled
            }
          }

          // Prepare options for startResearchFromChat
          // This function needs to be checked/adjusted to accept the right parameters
          const researchOptions = {
              query: researchQuery, // Pass the query string
              depth: 2, // Default or configure? Maybe allow --depth in chat? For now, default.
              breadth: 3, // Default
              password: userPassword, // Pass the obtained password
              username: session.username, // Pass username
              currentUser: currentUserData, // Pass fetched user data
              // Add other necessary options based on startResearchFromChat definition
              isWebSocket: true, // Indicate WebSocket context
              webSocketClient: ws // Pass WebSocket client
          };

          // Prepare handlers
          const researchProgress = (data) => {
            // ... existing progress handling ...
             if (typeof data === 'object' && data !== null && data.completedQueries !== undefined) {
              safeSend(ws, { type: 'progress', data: data });
            } else {
              wsOutputHelper(ws, data); // Send progress text
            }
          };
          // Use chatError for errors within research process started from chat
          const researchError = (err) => chatError(err);

          // Retrieve relevant memories if memory manager exists
          let relevantMemories = [];
          if (session.memoryManager) {
              try {
                  relevantMemories = await session.memoryManager.retrieveRelevantMemories(researchQuery, 5); // Limit number of memories
              } catch (memError) {
                  console.error(`[WebSocket] Error retrieving memory for chat research: ${memError.message}`);
                  chatOutput(`[System] Warning: Could not retrieve relevant memories - ${memError.message}`);
                  // Continue without memories
              }
          }

          // Call startResearchFromChat (ensure its signature matches)
          // Assuming startResearchFromChat is designed to handle this call structure
          const researchResult = await startResearchFromChat(
            session.chatHistory, // Pass current chat history
            relevantMemories,    // Pass retrieved memories
            researchOptions,     // Pass options object
            researchProgress,    // Pass progress handler
            researchError        // Pass error handler
          );

          // Research finished successfully
          // startResearchFromChat should ideally handle sending completion messages via its handlers
          // If not, send completion here. Assuming it does handle output.
          // safeSend(ws, { type: 'research_complete', summary: researchResult?.results?.summary });
          chatOutput("Research complete. You can continue chatting or type /exit.");
          enableInputAfter = true; // Enable after successful research

        } catch (researchError) {
          // Catch errors specifically from the startResearchFromChat call or setup
          console.error(`[WebSocket] Error in /research from chat: ${researchError.message}`, researchError.stack);
          // Use chatError to report and handle input state
          chatError(`Error during research: ${researchError.message}`);
          safeSend(ws, { type: 'research_complete', error: researchError.message, keepDisabled: false }); // Signal completion even on error, enable input
          return false; // chatError handled enabling (which is true by default in wsErrorHelper)
        }
        return enableInputAfter;

      // --- NEW: /exitresearch Command ---
      case 'exitresearch':
        chatOutput('Exiting chat and starting research based on history...');
        enableInputAfter = false; // Keep disabled during transition and research

        // Prepare options for executeExitResearch
        const exitResearchOptions = {
            session: session,
            output: chatOutput,
            error: chatError,
            currentUser: currentUserData,
            password: session.password, // Pass cached password if available
            isWebSocket: true,
            webSocketClient: ws,
            wsPrompt: wsPrompt // *** Pass the wsPrompt function ***
        };

        try {
            // Call the dedicated function from chat.cli.mjs
            // executeExitResearch handles its own logic, including password prompt if needed via wsPrompt
            const result = await executeExitResearch(exitResearchOptions);
            // executeExitResearch returns { success, keepDisabled }
            // It handles sending chat-exit, mode_change, and research completion messages.
            enableInputAfter = !(result?.keepDisabled === true); // Determine final state based on result
        } catch (execError) {
            // Catch errors from executeExitResearch itself (e.g., setup errors before it calls wsPrompt/startResearch)
            chatError(`Error processing /exitresearch: ${execError.message}`);
            // Ensure chat state is cleaned up even if executeExitResearch fails early
            if (session.isChatActive) { // Check if still active (might have been changed by partial execution)
                session.isChatActive = false;
                session.memoryManager = null;
                session.chatHistory = [];
                session.password = null; // Clear cached password on exit
                safeSend(ws, { type: 'chat-exit' });
                safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
            }
            return false; // chatError handled enabling
        }
        // Return the final state determined by executeExitResearch or the catch block
        return enableInputAfter;
      // --- End FIX ---

      // --- FIX: Add /help case ---
      case 'help':
        chatOutput('--- In-Chat Help ---');
        chatOutput('Available in-chat commands:');
        chatOutput('  /exit          - Leave the chat session.');
        chatOutput('  /exitmemory    - Finalize memories and leave chat (if memory enabled).');
        chatOutput('  /exitresearch  - Exit chat and start research using the conversation history.');
        chatOutput('  /memory stats  - Show stats for the current memory session (if memory enabled).');
        chatOutput('  /research <q>  - Start research based on chat context and query <q>.');
        chatOutput('  /help          - Show this help message.');
        chatOutput('To run other commands (like /status, /keys), first type /exit.');
        return true; // Enable input after help
      // --- End FIX ---

      default:
        // --- FIX: Modify error message for clarity ---
        chatError(`Unknown command in chat mode: /${command}. Type /help for available in-chat commands or /exit to leave chat.`);
        return false; // chatError handled enabling
    }
  }

  // --- Handle Regular Chat Message ---
  if (!trimmedMessage) {
    return true; // Enable input if message is empty
  }

  // ... add to history, store memory ...
  // Add user message to session history *before* LLM call
  session.chatHistory = session.chatHistory || []; // Ensure history array exists
  session.chatHistory.push({ role: 'user', content: trimmedMessage });

  // Check for password / API keys needed for chat LLM call
  let veniceKey;
  try {
    let userPassword = session.password;
    if (!userPassword) {
      try {
        // Prompt for password, keeping input disabled
        enableInputAfter = false; // Disable input while prompting
        userPassword = await wsPrompt(ws, session, "Password needed for chat API key: ", PROMPT_TIMEOUT_MS, true);
        session.password = userPassword; // Cache password
        // Input remains disabled after prompt resolution, LLM call will decide final state
      } catch (promptError) {
        // wsPrompt error handler (wsErrorHelper) enables input
        return false; // Input state handled
      }
    }

    veniceKey = await userManager.getApiKey('venice', userPassword, session.username);
    if (!veniceKey) {
      session.password = null; // Clear bad cached password
      throw new Error("Failed to get/decrypt Venice API key. Please check password or keys.");
    }
  } catch (keyError) {
    chatError(`API Key Error: ${keyError.message}`);
    return false; // chatError handled enabling
  }

  // --- Retrieve Memory & Prepare Messages ---
  let messagesForLLM = [...session.chatHistory];
  if (session.memoryManager) {
      try {
          const relevantMemories = await session.memoryManager.retrieveRelevantMemories(trimmedMessage);
          if (relevantMemories && relevantMemories.length > 0) {
              const memoryContext = relevantMemories.map(m => `[Archived Context] ${m.content}`).join('\n');
              // Add memory context as a system message at the beginning
              messagesForLLM.unshift({ role: 'system', content: `Relevant background information:\n${memoryContext}` });
              console.log(`[WebSocket] Added ${relevantMemories.length} relevant memories to LLM context.`);
          }
      } catch (memError) {
          console.error(`[WebSocket] Error retrieving memory for session ${session.sessionId}: ${memError.message}`);
          // Don't fail the chat, just proceed without memory context
          // Use safeSend for non-critical warning, avoid chatError which disables input via wsErrorHelper
          safeSend(ws, { type: 'output', data: `[System] Warning: Error retrieving memory - ${memError.message}` });
          // Input state remains determined by the LLM call flow
      }
  }

  // Limit history length to avoid excessive token usage (e.g., last 10 messages)
  const maxHistoryLength = 10; // Adjust as needed
  if (messagesForLLM.length > maxHistoryLength) {
      // Keep system message (if any) and the last N user/assistant messages
      const systemMessage = messagesForLLM.length > 0 && messagesForLLM[0].role === 'system' ? [messagesForLLM[0]] : [];
      const chatMessages = messagesForLLM.length > 0 && messagesForLLM[0].role === 'system' ? messagesForLLM.slice(1) : messagesForLLM;

      messagesForLLM = [
          ...systemMessage,
          ...chatMessages.slice(-maxHistoryLength) // Take last N chat messages
      ];
  }


  // --- Call LLM ---
  try {
    chatOutput('...'); // Show thinking indicator
    enableInputAfter = false; // Keep disabled during LLM call

    const llmClient = new LLMClient({ apiKey: veniceKey });

    console.log(`[WebSocket] Calling LLM for session ${session.sessionId} with ${messagesForLLM.length} messages.`);
    const response = await llmClient.completeChat({
        messages: messagesForLLM,
        temperature: 0.7, // Example temperature
        maxTokens: 1500   // Example max tokens
     });

    // Clean the response content if necessary
    const assistantMessageContent = response.content ? cleanChatResponse(response.content) : "[No response content]";

    // Add AI response to session history
    const assistantMessage = { role: 'assistant', content: assistantMessageContent };
    session.chatHistory.push(assistantMessage);

    // Store AI response in memory if enabled
    if (session.memoryManager) {
        try {
            await session.memoryManager.storeMemory(assistantMessageContent, 'assistant-message');
            console.log(`[WebSocket] Stored assistant response in memory for session ${session.sessionId}.`);
        } catch (memError) {
            console.error(`[WebSocket] Error storing assistant memory for session ${session.sessionId}: ${memError.message}`);
            // Inform user non-critically
             safeSend(ws, { type: 'output', data: `[System] Warning: Error storing response in memory - ${memError.message}` });
        }
    }

    // Send response to client
    safeSend(ws, { type: 'chat-response', message: assistantMessageContent });
    enableInputAfter = true; // Enable input after successful response

  } catch (error) {
    console.error('[WebSocket] LLM chat completion error:', error);
    chatError(`Chat error: ${error.message}`); // chatError handles enabling input
    return false; // chatError handled enabling
  }

  return enableInputAfter; // Return final state
}

/**
 * Initiates a prompt on the client and waits for an 'input' response.
 * Manages prompt state and timeouts on the server-side session.
 * @param {WebSocket} ws - The WebSocket client connection.
 * @param {object} session - The session data object.
 * @param {string} promptText - The text to display to the user.
 * @param {number} [timeoutMs=PROMPT_TIMEOUT_MS] - Timeout duration.
 * @param {boolean} [isPassword=false] - Whether the input should be masked.
 * @returns {Promise<string>} - A promise that resolves with the user's input or rejects on error/timeout.
 */
async function wsPrompt(ws, session, promptText, timeoutMs = PROMPT_TIMEOUT_MS, isPassword = false) {
  // Check if another prompt is already active for this session
  if (session.pendingPromptResolve) {
    console.warn(`[WebSocket] Attempted to start a new server-side prompt while another was active (Session ${session.sessionId})`);
    // Reject the new prompt attempt immediately
    throw new Error("Another prompt is already active for this connection.");
  }

  console.log(`[WebSocket] Initiating server-side prompt (Session ${session.sessionId}), Password: ${isPassword}`);

  // Return a promise that will be resolved/rejected by handleInputMessage or the timeout
  return new Promise((resolve, reject) => {
    // Store the resolve/reject functions and state in the session
    session.pendingPromptResolve = resolve;
    session.pendingPromptReject = reject;
    session.promptIsPassword = isPassword; // Store if it's a password prompt for logging in handleInputMessage

    // Set a timeout for the prompt
    session.promptTimeoutId = setTimeout(() => {
      // Check if the prompt is still pending when the timeout fires
      if (session.pendingPromptReject) {
        console.log(`[WebSocket] Server-side prompt timed out (Session ${session.sessionId}).`);
        const rejectFn = session.pendingPromptReject; // Get reject function

        // Clear the prompt state BEFORE informing client/rejecting
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false;

        // Inform the client about the timeout and ensure input is re-enabled
        wsErrorHelper(ws, 'Prompt timed out.', true); // true = enable input

        rejectFn(new Error(`Prompt timed out after ${timeoutMs / 1000} seconds.`));
      } else {
         console.log(`[WebSocket] Prompt timeout fired, but no pending reject function found (Session ${session.sessionId}). State might have been cleared already.`);
      }
    }, timeoutMs);

    // Send the 'prompt' message to the client
    const sent = safeSend(ws, {
      type: 'prompt',
      data: promptText,
      isPassword: isPassword,
    });

    // If sending the prompt message fails immediately, clean up and reject
    if (!sent) {
      console.error(`[WebSocket] Failed to send prompt message immediately (Session ${session.sessionId})`);
      clearTimeout(session.promptTimeoutId);
      // Ensure state is cleared before rejecting
      session.pendingPromptResolve = null;
      session.pendingPromptReject = null;
      session.promptTimeoutId = null;
      session.promptIsPassword = false;
      // Inform the caller about the failure
      // No need to call wsErrorHelper here as the connection is likely broken/closed by safeSend
      reject(new Error(`Failed to send prompt message.`));
    } else {
        console.log(`[WebSocket] Prompt message sent to client (Session ${session.sessionId})`);
        // Input remains disabled (or enabled if already in prompt) until response or timeout
    }
  });
}

// ... existing cleanupInactiveSessions ...
// Ensure cleanupInactiveSessions also clears prompt state correctly
export function cleanupInactiveSessions() {
  const now = Date.now();
  console.log(`[Session Cleanup] Running cleanup check... Current sessions: ${activeChatSessions.size}`);
  let cleanedCount = 0;

  activeChatSessions.forEach((session, sessionId) => {
    if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
      console.log(`[Session Cleanup] Removing inactive session: ${sessionId} (User: ${session.username || 'N/A'})`);

      // Reject any pending server-side prompt before closing
      if (session.pendingPromptReject) {
        console.log(`[Session Cleanup] Rejecting pending server-side prompt for timed-out session ${sessionId}`);
        clearTimeout(session.promptTimeoutId);
        const rejectFn = session.pendingPromptReject; // Store before clearing
        session.pendingPromptResolve = null;
        session.pendingPromptReject = null;
        session.promptTimeoutId = null;
        session.promptIsPassword = false;
        rejectFn(new Error("Session timed out during prompt."));
      }

      // Inform client and close connection if possible
      if (session.webSocketClient && session.webSocketClient.readyState === WebSocket.OPEN) {
        safeSend(session.webSocketClient, { type: 'system-message', message: 'Session timed out due to inactivity.' });
        safeSend(session.webSocketClient, { type: 'session-expired' }); // Specific event for client handling
        session.webSocketClient.close(1008, 'Session Timeout');
      }

      // Clean up server-side resources
      if (session.memoryManager) {
        session.memoryManager = null; // Release memory manager if applicable
      }
      if (session.webSocketClient) {
        wsSessionMap.delete(session.webSocketClient); // Remove from WeakMap
      }
      activeChatSessions.delete(sessionId); // Remove from main session map
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    console.log(`[Session Cleanup] Cleaned up ${cleanedCount} inactive sessions.`);
  }
}

// Start the cleanup interval
setInterval(cleanupInactiveSessions, SESSION_INACTIVITY_TIMEOUT / 2); // Check periodically

// Function to set up routes (if needed elsewhere, otherwise keep local)
function setupRoutes(app) {
    app.use('/api/research', router);
    // Add other route setups if necessary
}

export { setupRoutes }; // Export only setupRoutes if needed, handleWebSocketConnection is already exported above
export default router; // Keep default export if needed, handleWebSocketConnection is already exported above
