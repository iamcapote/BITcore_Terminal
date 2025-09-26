import express from 'express';
import crypto from 'crypto';
import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';
// --- FIX: Remove unused displayHelp import ---
import { commands, parseCommandArgs, getHelpText } from '../../commands/index.mjs';
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
import { outputManager } from '../../utils/research.output-manager.mjs'; // Use outputManager for logging

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
        const current = userManager.getCurrentUser();
        const sessionData = {
      sessionId: sessionId,
      webSocketClient: ws,
      isChatActive: false,
      chatHistory: [],
      memoryManager: null,
      lastActivity: Date.now(),
            username: current?.username || 'operator',
            role: current?.role || 'admin',
      pendingPromptResolve: null,
      pendingPromptReject: null,
      promptTimeoutId: null,
      promptIsPassword: false, // Added flag for prompt type
      promptContext: null, // Added flag for prompt context (e.g., 'post_research_action')
      promptData: null, // Added data associated with prompt context
      currentUser: null, // Cached user data (including potentially decrypted keys)
      currentResearchResult: null, // Store last research result content
      currentResearchFilename: null, // Store last research result suggested filename
      // --- ADDED FOR MODEL/CHARACTER ---
      sessionModel: null,      // To store the model for the session (chat/research)
      sessionCharacter: null,  // To store the character for the session (chat/research)
      // Classifier model/character are handled by the classifier utility itself or ResearchEngine
      // --- END ADDED ---
    };
    activeChatSessions.set(sessionId, sessionData);
    wsSessionMap.set(ws, sessionId);
    console.log(`[WebSocket] Created session ${sessionId} for new connection. Initial user: ${sessionData.username}`);

    output.addWebSocketClient(ws);

    // Send initial messages
    safeSend(ws, { type: 'connection', connected: true });
    // Inform client of active user for UI consistency
    safeSend(ws, { type: 'login_success', username: sessionData.username });
    safeSend(ws, { type: 'output', data: 'Welcome to MCP Terminal!' });
    safeSend(ws, { type: 'output', data: `Single-user mode active as ${sessionData.username} (${sessionData.role}). No login required.` });
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
      // --- ADDED: Log ping/pong separately if desired, or just let it flow if not too noisy ---
      if (message.type !== 'ping') { // Avoid logging pings if too frequent
        console.log(`[WebSocket] Received message (Session ${currentSessionId}, User: ${currentSession.username}):`, JSON.stringify(logPayload).substring(0, 250));
      } else {
        // console.log(`[WebSocket] Received ping (Session ${currentSessionId})`); // Optional: log pings
      }


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
          if (currentSession.isChatActive) {
              enableInputAfterProcessing = await handleChatMessage(ws, message, currentSession);
          } else {
              wsErrorHelper(ws, 'Cannot send chat messages when not in chat mode.', true);
          }
      } else if (message.type === 'input') {
          // Handle responses to server-side prompts
          console.log("[WebSocket] Routing input message to handleInputMessage.");
          // --- FIX: Pass enableInputAfterProcessing by reference or handle return value ---
          // handleInputMessage now returns the desired state
          enableInputAfterProcessing = await handleInputMessage(ws, message, currentSession);
          // enableInputAfterProcessing = false; // Input state decided by the command that initiated the prompt
      } else if (message.type === 'ping') {
          // console.log("[WebSocket] Handling ping."); // Already logged above if chosen
          currentSession.lastActivity = Date.now(); // Update activity on ping
          safeSend(ws, { type: 'pong' });
          enableInputAfterProcessing = true; // Re-enable after simple ping/pong (or rather, don't disable)
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
    // --- ADD: Clear ping/pong timers associated with the session if any (though client manages its own) ---
    // No server-side ping interval per session in this design, client initiates.

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
    // --- ADD: Clear ping/pong timers associated with the session if any ---
    // No server-side ping interval per session in this design.

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
 * @param {object} message - The parsed message object { type: 'command', command, args, password? }. NOTE: This structure might be deprecated if parsing happens earlier.
 * @param {object} session - The session data object.
 * @returns {Promise<boolean>} - True if input should be enabled after processing, false otherwise.
 */
async function handleCommandMessage(ws, message, session) {
    // --- Refactored Start: Use parseCommandArgs ---
    // Construct the full command string from the message payload for parsing
    // Assuming message = { type: 'command', command: 'keys', args: ['set', 'github', '--flag=value'] }
    const fullCommandString = `/${message.command} ${message.args.join(' ')}`;
    const { commandName, positionalArgs, flags } = parseCommandArgs(fullCommandString);
    const passwordFromPayload = message.password; // Get password if sent in payload

    // Declare effectiveModel and effectiveCharacter at the top of the function scope
    let effectiveModel = null;
    let effectiveCharacter = null;

    outputManager.debug(`[handleCommandMessage] Parsed: name='${commandName}', args=${JSON.stringify(positionalArgs)}, flags=${JSON.stringify(flags)}`);

    if (!commandName) {
        wsErrorHelper(ws, 'Invalid command format.', true);
        return false; // wsErrorHelper handles enabling
    }
    // --- End Refactored Start ---

    // --- FIX: Prevent top-level commands during active chat ---
    if (session.isChatActive && commandName !== 'help') { // Allow /help in chat
        console.warn(`[WebSocket] Attempted to run top-level command '/${commandName}' while chat is active (Session ${session.sessionId}).`);
        wsErrorHelper(ws, `Cannot run top-level commands while in chat mode. Use chat messages or in-chat commands (e.g., /exit).`, true); // Ensure input enabled after error
        return false; // wsErrorHelper handles enabling input by default handler (wsErrorHelper handles it)
    }
    // --- End FIX ---

    let enableInputAfter = true; // Default to enabling input after command finishes
    let isInteractiveResearch = false; // Flag for interactive flow

    // --- MODEL AND CHARACTER HANDLING ---
    const newModelFlag = flags.m;
    const newCharacterFlag = flags.c;

    if (commandName === 'chat' || commandName === 'research') {
        if (newModelFlag) {
            if (session.sessionModel === null) {
                session.sessionModel = newModelFlag;
                outputManager.debug(`[WebSocket] Session ${session.sessionId} model set by flag to: ${session.sessionModel}`);
                wsOutputHelper(ws, `Session model set to: ${session.sessionModel}`);
            } else if (session.sessionModel !== newModelFlag) {
                wsOutputHelper(ws, `Info: Model for this session is already set to '${session.sessionModel}'. Flag '--m ${newModelFlag}' ignored.`);
            }
        }
        if (newCharacterFlag) {
            const newCharValue = newCharacterFlag.toLowerCase() === 'none' ? 'None' : newCharacterFlag;
            if (session.sessionCharacter === null) {
                session.sessionCharacter = newCharValue;
                outputManager.debug(`[WebSocket] Session ${session.sessionId} character set by flag to: ${session.sessionCharacter}`);
                wsOutputHelper(ws, `Session character set to: ${session.sessionCharacter === 'None' ? 'None (no character)' : session.sessionCharacter}`);
            } else if (session.sessionCharacter !== newCharValue) {
                wsOutputHelper(ws, `Info: Character for this session is already set to '${session.sessionCharacter}'. Flag '--c ${newCharacterFlag}' ignored.`);
            }
        }
    }

    const defaultModels = {
        chat: 'qwen3-235b', // Fallback to hardcoded if not in config
        research: 'dolphin-2.9.2-qwen2-72b',
    };
    const defaultCharacters = {
        chat: 'bitcore',
        research: 'archon',
    };

    // Assign to the already declared variables (without 'let')
    effectiveModel = session.sessionModel;
    effectiveCharacter = session.sessionCharacter; // Can be null (never set), or 'None' (explicitly no character)

    if (commandName === 'chat') {
        if (effectiveModel === null) {
            effectiveModel = defaultModels.chat;
            session.sessionModel = effectiveModel; // Persist default for the session
            wsOutputHelper(ws, `Using default model for chat: ${effectiveModel}`);
        }
        if (effectiveCharacter === null) { 
            effectiveCharacter = defaultCharacters.chat;
            session.sessionCharacter = effectiveCharacter; // Persist default for the session
            wsOutputHelper(ws, `Using default character for chat: ${effectiveCharacter}`);
        }
    } else if (commandName === 'research') {
        if (effectiveModel === null) {
            effectiveModel = defaultModels.research;
            session.sessionModel = effectiveModel; // Persist default for the session
            wsOutputHelper(ws, `Using default model for research: ${effectiveModel}`);
        }
        if (effectiveCharacter === null) {
            effectiveCharacter = defaultCharacters.research;
            session.sessionCharacter = effectiveCharacter; // Persist default for the session
            wsOutputHelper(ws, `Using default character for research: ${effectiveCharacter}`);
        }
    }
    
    // Ensure a model is always present if the command requires one
    if (!effectiveModel && (commandName === 'chat' || commandName === 'research')) {
         // This case should ideally be covered by the above logic setting defaults
        effectiveModel = defaultModels[commandName];
        if (session.sessionModel === null) session.sessionModel = effectiveModel;
         outputManager.debug(`[WebSocket] Session ${session.sessionId} model defaulted to: ${effectiveModel} as a fallback.`);
    }
    // --- END MODEL AND CHARACTER HANDLING ---

    // --- Options Setup ---
    // Use parsed values directly
    const options = {
        positionalArgs: positionalArgs,
        flags: flags,
        // Add other default flags if necessary
        depth: flags.depth || 2, // Default research depth from flags or default
        breadth: flags.breadth || 3, // Default research breadth from flags or default
        classify: flags.classify || false, // Default research classification
        verbose: flags.verbose || false, // Default verbosity
        memory: flags.memory || false, // Default chat memory
        // --- Initialize output/error to null initially ---
        output: null,
        error: null,
        // Query is now derived later if needed, or comes from positionalArgs
        // --- PASS EFFECTIVE MODEL AND CHARACTER ---
        model: effectiveModel,
        // Pass null if character is 'None', otherwise pass the character string
        character: (effectiveCharacter === 'None' ? null : effectiveCharacter),
    };
    // --- End Options Setup ---


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
    // --- FIX: Define debug handler based on verbose flag ---
    const commandDebug = (data) => {
        // Only send debug messages if verbose flag is set OR DEBUG_MODE is true
        if (options.verbose || process.env.DEBUG_MODE === 'true') {
            // Prefix debug messages for clarity in UI
            wsOutputHelper(ws, `[DEBUG] ${data}`);
        }
        // Also log to server console if DEBUG_MODE is true
        if (process.env.DEBUG_MODE === 'true') {
            console.log(`[WS DEBUG][${session.sessionId}] ${data}`);
        }
    };


    // --- Inject WebSocket context AND output/error/debug handlers into options ---
    options.webSocketClient = ws;
    options.isWebSocket = true;
    options.session = session;
    options.wsPrompt = wsPrompt;
    options.output = commandOutput; // Assign defined handler
    options.error = commandError;   // Assign defined handler
    options.debug = commandDebug;   // Assign defined handler
    // --- End Inject ---
    // Single-user mode: no password prompts; API keys are used directly if available
    // Remove all password/public-user gating. Commands should self-handle missing keys.

    // --- Command Execution ---
    try {
        // *** Use commandFunction directly ***
        console.log(`[WebSocket] Executing command /${commandName} for user ${session.username}`);
        outputManager.debug(`[Command Execution] Options for /${commandName}: ${JSON.stringify(options, (key, value) => (key === 'webSocketClient' || key === 'session' || key === 'currentUser' || key === 'requestingUser' || key === 'wsPrompt' || key === 'output' || key === 'error' || key === 'debug' || key === 'password') ? `[${typeof value}]` : value, 2)}`);


        // Add specific logging for chat command options
        if (commandName === 'chat') {
            console.log('[WebSocket] Options passed to executeChat:', JSON.stringify(options, (key, value) => (key === 'webSocketClient' || key === 'session' || key === 'currentUser' || key === 'requestingUser' || key === 'wsPrompt' || key === 'output' || key === 'error') ? `[Object ${key}]` : value, 2));
        }
        // Add progress handler specifically for research
        if (commandName === 'research') {
            if (!options.query) { // Ensure query exists after potential interactive flow
                commandError('Research query is missing. Please provide a query or use interactive mode.');
                return false; // commandError enables input
            }
            options.progressHandler = (progressData) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    safeSend(ws, { type: 'progress', data: progressData });
                }
            };
            // --- FIX: Ensure debug handler is passed correctly ---
            // The debug handler is already assigned to options.debug above
            // executeResearch should use options.debug
        }

        // Execute the command function
        const result = await commandFunction(options); // Pass options including handlers

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

        // Special case: /logout is a no-op in single-user mode
        if (commandName === 'logout') {
            console.log(`[WebSocket] /logout called in single-user mode. No state change.`);
            safeSend(ws, { type: 'logout_success', message: 'Single-user mode: logout is a no-op.' });
            safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
            enableInputAfter = true; // Ensure input is enabled after message
        }

        // Special case: /chat command transitions state
        if (commandName === 'chat') {
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

        // Final check: If an error occurred *during* execution (not caught by commandError),
        // ensure input is enabled unless explicitly kept disabled.
        if (enableInputAfter === undefined) {
            console.warn(`[WebSocket] enableInputAfter was undefined after command /${commandName}. Defaulting to true.`);
            enableInputAfter = true;
        }

        console.log(`[WebSocket] Returning from handleCommandMessage. Final enableInputAfter: ${enableInputAfter}`);
        return enableInputAfter; // Return the final decision
    } catch (error) {
        // Catch errors during command execution itself
        console.error(`[WebSocket] Error executing command /${commandName} (Session ${session.sessionId}):`, error.message, error.stack);
        commandError(`Internal error executing command /${commandName}: ${error.message}`);
        return false; // commandError handled enabling input
    }
}

// Helper function to check if a command needs a password (add commands as needed)
// Use commandName here
function commandRequiresPassword(commandName) {
    const commandsList = ['keys', 'password-change', 'research', 'chat', 'exitmemory', 'exitresearch', 'diagnose', 'users']; // Added users
    return commandsList.includes(commandName);
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
        safeSend(ws, { type: 'error', error: 'Chat mode not active. Use /chat first.' });
        return true;
    }

    const userMsg = message.message?.trim();
    if (!userMsg) return true;

    // --- NEW: Intercept in-chat commands (starting with '/') ---
    if (userMsg.startsWith('/')) {
        // Extract command and args
        const [cmd, ...args] = userMsg.slice(1).split(/\s+/);
        const command = cmd.toLowerCase();

        // Handle /exit and other in-chat commands
        if (command === 'exit') {
            session.isChatActive = false;
            session.chatHistory = [];
            if (session.memoryManager) session.memoryManager = null;
            safeSend(ws, { type: 'chat-exit' });
            safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
            return true;
        }
        // --- ADD: Handle /exitresearch ---
        if (command === 'exitresearch') {
            // Call the new exitResearch logic from chat.cli.mjs
            const result = await executeExitResearch({
                session,
                output: (msg) => wsOutputHelper(ws, msg),
                error: (msg) => wsErrorHelper(ws, msg, true),
                currentUser: session.currentUser,
                password: session.password,
                isWebSocket: true,
                webSocketClient: ws,
                wsPrompt,
                progressHandler: (progressData) => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        safeSend(ws, { type: 'progress', data: progressData });
                    }
                }
            });
            // Return input state as indicated by the result
            return !(result?.keepDisabled === true);
        }
        // Optionally handle other in-chat commands here (e.g., /exitmemory, /help, etc.)
        // For unknown commands, show error
        safeSend(ws, { type: 'output', data: `Unknown in-chat command: /${command}` });
        return true;
    }

    // store user line
    session.chatHistory ??= [];
    session.chatHistory.push({ role: 'user', content: userMsg });

    try {
        let veniceApiKey = null;
        try {
            outputManager.debug(`[WebSocket][Chat] Attempting to retrieve Venice API key (single-user mode)`);
            veniceApiKey = await userManager.getApiKey({ service: 'venice' });
            if (veniceApiKey) {
                outputManager.debug(`[WebSocket][Chat] Successfully retrieved Venice API key.`);
            } else {
                outputManager.warn(`[WebSocket][Chat] Venice API key not set. Using default or will fail if none.`);
            }
        } catch (keyError) {
            outputManager.error(`[WebSocket][Chat] Error retrieving Venice API key: ${keyError.message}. Chat will use fallback.`);
        }

        const llmConfig = {};
        if (veniceApiKey) {
            llmConfig.apiKey = veniceApiKey;
            outputManager.debug(`[WebSocket][Chat] LLMClient will use user-specific Venice API key for ${session.currentUser.username}.`);
        } else {
            outputManager.debug('[WebSocket][Chat] LLMClient will use default (environment) Venice API key.');
        }

        const llm = new LLMClient(llmConfig);
        const model = session.sessionModel || 'qwen-2.5-qwq-32b'; // Ensure fallback
        const character = session.sessionCharacter === 'None' ? null : (session.sessionCharacter || 'bitcore'); // Handle 'None' and fallback

        const systemMessageContent = character
            ? `You are ${character}. You are a helpful assistant.`
            : 'You are a helpful assistant.';
        const system = { role: 'system', content: systemMessageContent };

        const shortHistory = session.chatHistory.slice(-9);
        const messages = [system, ...shortHistory];

        const res = await llm.completeChat({ messages, model, temperature: 0.7, maxTokens: 2048 });
        const clean = cleanChatResponse(res.content);

        session.chatHistory.push({ role: 'assistant', content: clean });

        safeSend(ws, { type: 'chat-response', message: clean });
    } catch (err) {
        console.error('[WebSocket][Chat] LLM error:', err.message, err.stack);
        if (err instanceof Error && err.message.toLowerCase().includes('api key is required')) {
            wsErrorHelper(ws, `Chat failed: Venice API key is missing or invalid. Please set it via '/keys set venice <apikey>' or ensure VENICE_API_KEY environment variable is configured.`, true);
        } else {
            wsErrorHelper(ws, `Chat failed: ${err.message}`, true);
        }
    }
    return true;
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
    session.lastActivity = Date.now(); // Update activity

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

        try {
            let userPassword = session.password; // <-- FIX: Always start with session.password

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
                    wsOutputHelper(ws, "Attempting to upload to GitHub...");
                    enableInputAfter = false;
                    const githubConfig = await userManager.getDecryptedGitHubConfig();
                    if (!githubConfig || !githubConfig.owner || !githubConfig.repo) {
                        let errorDetail = "Unknown reason";
                        if (!githubConfig) errorDetail = "Config object is null/undefined (configure owner/repo)";
                        else if (!githubConfig.owner) errorDetail = "GitHub owner not configured";
                        else if (!githubConfig.repo) errorDetail = "GitHub repo not configured";
                        console.error(`[WebSocket] GitHub Upload Check Failed: ${errorDetail}`);
                        throw new Error(`GitHub owner/repo not configured. Use /keys set github... (${errorDetail})`);
                    }
                    if (!githubConfig.token) {
                        console.warn(`[WebSocket] GitHub token is missing. Upload will likely fail.`);
                    }
                    const repoPath = suggestedFilename;
                    const commitMessage = `Research results for query: ${session.currentResearchQuery || 'Unknown Query'}`;
                    const uploadResult = await uploadToGitHub(
                        githubConfig,
                        repoPath,
                        markdownContent,
                        commitMessage,
                        wsOutputHelper.bind(null, ws),
                        wsErrorHelper.bind(null, ws)
                    );
                    wsOutputHelper(ws, `Upload successful!`);
                    wsOutputHelper(ws, `Commit: ${uploadResult.commitUrl}`);
                    wsOutputHelper(ws, `File: ${uploadResult.fileUrl}`);
                    enableInputAfter = true;
                    break;

                case 'keep':
                    wsOutputHelper(ws, "Research result kept in session (will be lost on disconnect/logout).");
                    break;

                case 'discard':
                    wsOutputHelper(ws, "Research result discarded.");
                    break;

                default:
                    wsOutputHelper(ws, `Invalid action: '${action}'. Please choose Download, Upload, Keep, or Discard.`);
                    break;
            }
        } catch (actionError) {
            console.error(`[WebSocket] Error during post-research action '${action}': ${actionError.message}`, actionError.stack);
            wsErrorHelper(ws, `Error performing action '${action}': ${actionError.message}`, true);
            enableInputAfter = false;
            if (action === 'upload' && actionError.message.toLowerCase().includes('password')) {
                session.password = null;
            }
        } finally {
            if (action === 'download' || action === 'upload' || action === 'discard') {
                session.currentResearchResult = null;
                session.currentResearchFilename = null;
                delete session.currentResearchQuery;
            }
        }
    } else if (context === 'github_token_password') {
        // Single-user mode: no nested GitHub password prompts
        resolve(inputValue);
        enableInputAfter = true;
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

// WebSocket message handler
async function handleWebSocketMessage(ws, message) {
    // ... existing code ...

    try {
        // ... existing message parsing ...

        if (parsedMessage.type === 'command') {
            outputManager.debug(`[WS][${ws.id}] Received command message: ${parsedMessage.command}`); // Log raw command
            ws.isProcessing = true; // Mark as processing
            wsSend(ws, { type: 'disable_input' }); // Disable input during processing

            const { commandName, positionalArgs, flags } = parseCommandArgs(parsedMessage.command);
            outputManager.debug(`[WS][${ws.id}] Parsed command: name='${commandName}', args=${JSON.stringify(positionalArgs)}, flags=${JSON.stringify(flags)}`); // Log parsed parts

            // Ensure commandName is valid before proceeding
            if (!commandName) {
                 wsErrorHelper(ws, 'Invalid command format.');
                 wsSend(ws, { type: 'enable_input' });
                 ws.isProcessing = false;
                 return;
            }

            // --- Updated Command Execution ---
            // Find the command function in the imported map
            const commandFunction = commands[commandName];

            if (commandFunction) {
                // Prepare options for the command function
                const commandOptions = {
                    positionalArgs,
                    flags,
                    isWebSocket: true,
                    session: ws, // Pass WebSocket session object
                    output: (msg) => wsSend(ws, { type: 'output', message: msg }),
                    error: (errMsg) => wsErrorHelper(ws, errMsg), // Use helper for errors
                    currentUser: ws.currentUser, // Pass authenticated user data
                    password: ws.currentPassword // Pass cached password if available
                };

                // Execute the specific command function
                const result = await commandFunction(commandOptions);

                // Handle command result (optional: specific actions based on result)
                outputManager.debug(`[WS][${ws.id}] Command '${commandName}' execution result:`, result);

                // Re-enable input unless command explicitly requests otherwise
                if (!result?.keepDisabled) {
                    wsSend(ws, { type: 'enable_input' });
                }
            } else if (commandName === 'help') {
                // Handle /help specifically if not in the map or as a fallback
                wsSend(ws, { type: 'output', message: getHelpText() });
                wsSend(ws, { type: 'enable_input' });
            } else {
                wsErrorHelper(ws, `Unknown command: /${commandName}. Type /help for available commands.`);
                wsSend(ws, { type: 'enable_input' });
            }
            // --- End Updated Command Execution ---

            ws.isProcessing = false; // Mark processing finished

        } else if (parsedMessage.type === 'chat-message') {
            // ... existing chat message handling ...
        } else if (parsedMessage.type === 'prompt_response') {
            // ... existing prompt response handling ...
        } else if (parsedMessage.type === 'input') {
             // Handle generic input when in specific modes (like chat)
             // ... existing input handling ...
        } else {
            outputManager.warn(`[WS][${ws.id}] Received unknown message type: ${parsedMessage.type}`);
            wsErrorHelper(ws, `Unknown message type: ${parsedMessage.type}`);
        }

    } catch (error) {
        // ... existing error handling ...
        wsErrorHelper(ws, `Internal server error processing message: ${error.message}`);
        if (!ws.isProcessing) { // Ensure input is re-enabled if error happens before processing flag is set
             wsSend(ws, { type: 'enable_input' });
        } else {
             ws.isProcessing = false; // Reset flag on error
             wsSend(ws, { type: 'enable_input' }); // Attempt to re-enable input
        }
    }
}

// ... rest of the file ...