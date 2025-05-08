// ...existing code...
import { safeSend } from '../utils/websocket.utils.mjs'; // Ensure safeSend is imported
// ...existing code...

/**
 * Executes the research command.
 * @param {Array<string>} args - Command arguments (not typically used here as prompts handle input).
 * @param {Object} options - Command options including flags and context.
 * @param {Object} session - WebSocket session object.
 * @param {Object} currentUser - The user executing the command.
 * @param {Object} requestingUser - The user context for the request.
 * @returns {Promise<Object>} - Research results or error object.
 */
export async function executeResearch(args, options, session, currentUser, requestingUser) {
  const {
    query: initialQuery, // Query from initial prompt
    depth: configDepth,
    breadth: configBreadth,
    classify: configClassify,
    verbose,
    memory,
    webSocketClient, // Get the WebSocket client object
    isWebSocket,
    password // User's password for API key decryption
  } = options;

  // --- Define WebSocket Handlers ---
  const wsOutputHandler = (...msgs) => {
    if (isWebSocket && webSocketClient) {
      // Simple formatting for now, join multiple args
      const message = msgs.map(msg => typeof msg === 'object' ? JSON.stringify(msg) : String(msg)).join(' ');
      safeSend(webSocketClient, { type: 'output', message });
    } else {
      console.log(...msgs); // Fallback to console if not WebSocket
    }
  };

  const wsErrorHandler = (...msgs) => {
    if (isWebSocket && webSocketClient) {
      const message = msgs.map(msg => typeof msg === 'object' ? JSON.stringify(msg) : String(msg)).join(' ');
      // Send as 'error' type to client
      safeSend(webSocketClient, { type: 'error', message });
    } else {
      console.error(...msgs); // Fallback to console
    }
  };

  // --- MODIFICATION: Send debug messages to WebSocket client ---
  const wsDebugHandler = (...msgs) => {
    // Only send debug if verbose is enabled OR if it's specifically needed for UI
    // Let's always send for now to ensure visibility, can add verbose check later if needed.
    if (isWebSocket && webSocketClient) {
      const message = msgs.map(msg => {
          // Basic formatting for objects/arrays in debug logs
          if (typeof msg === 'object' && msg !== null) {
              try {
                  // Limit depth/length if necessary
                  return JSON.stringify(msg, null, 2); // Pretty print objects
              } catch (e) {
                  return '[Unserializable Object]';
              }
          }
          return String(msg);
      }).join(' ');
      // Send as 'debug' type or reuse 'output' with prefix
      safeSend(webSocketClient, { type: 'output', message: `[DEBUG] ${message}` }); // Prefixing as output type
      // Alternatively, use a dedicated 'debug' type if the frontend handles it:
      // safeSend(webSocketClient, { type: 'debug', message });
    }
    // Optionally log to server console as well for debugging the server itself
    // console.log('[WS_DEBUG]', ...msgs);
  };
  // --- END MODIFICATION ---


  // ... (rest of the function: API key retrieval, engine instantiation, etc.) ...

  try {
    // Retrieve API keys using the provided password
    const braveApiKey = await getApiKeyForUser('brave', currentUser.username, password);
    const veniceApiKey = await getApiKeyForUser('venice', currentUser.username, password);

    if (!braveApiKey || !veniceApiKey) {
      throw new Error("Failed to retrieve necessary API keys. Check user configuration and password.");
    }

    // Store password in session after prompt
    if (isWebSocket && session && password) {
      session.password = password;
    }

    // Instantiate ResearchEngine with WebSocket handlers
    const engine = new ResearchEngine({
      braveApiKey,
      veniceApiKey,
      verbose,
      user: currentUser,
      // --- Pass the WebSocket-aware handlers ---
      outputHandler: wsOutputHandler,
      errorHandler: wsErrorHandler,
      debugHandler: wsDebugHandler, // Pass the modified debug handler
      progressHandler: (progressData) => { // Define progress handler inline
        if (isWebSocket && webSocketClient) {
          safeSend(webSocketClient, { type: 'progress', data: progressData });
        }
        // Optionally log progress to server console too
        // console.log('[Progress]', progressData);
      },
      // --- End Pass Handlers ---
      isWebSocket, // Pass flag
      webSocketClient // Pass client object
      // overrideQueries can be added here if needed based on options/logic
    });

    // Prepare the query object for the engine
    const researchQuery = {
        original: initialQuery,
        // metadata can be added here if classification was done
        metadata: options.metadata || null // Pass metadata if available from options
    };


    // Execute research
    wsOutputHandler('Starting research pipeline...'); // Use handler
    const results = await engine.research({
      query: researchQuery,
      depth: configDepth,
      breadth: configBreadth
    });

    // Handle results (e.g., prompt user for action)
    if (results && results.markdownContent) {
      wsOutputHandler('Research complete. Choose an action:'); // Use handler
      // Store password in session for post-research actions
      if (isWebSocket && session && password) {
        session.password = password;
      }
      // ... (rest of post-research action prompting logic using wsPrompt) ...
      // This part remains largely the same, using wsPrompt which handles WS communication
       const action = await wsPrompt(session, `Choose action for "${results.suggestedFilename}": [Download] | [Upload] | [Keep] | [Discard]`, false, 'post_research_action');
       wsOutputHandler(`Selected action: ${action}`); // Use handler

       // --- FIX: Pass password from session or currentUser to handler ---
       const userPassword = (session && session.password) || (currentUser && currentUser.password) || null;
       await handlePostResearchAction(action, results.suggestedFilename, results.markdownContent, { ...options, password: userPassword });
       // --- END FIX ---

    } else {
       wsErrorHandler('Research finished but no markdown content was generated.'); // Use handler
       // Potentially return the raw results or an error indicator
       return { error: 'Research finished but no markdown content was generated.', rawResults: results };
    }


    // Return results (or indicate success/failure)
    // The actual return value might be less critical if actions are handled via prompts
    return { success: true, filename: results.suggestedFilename }; // Example return

  } catch (error) {
    wsErrorHandler(`Research command failed: ${error.message}`); // Use handler
    console.error("Research Execution Error Stack:", error.stack); // Keep detailed stack trace on server console
    // Ensure the error is returned or thrown so the command runner handles it
     return { error: `Research failed: ${error.message}` }; // Return error object
  }
}

// ... (rest of the file, including handlePostResearchAction etc.) ...

// --- FIX: Example handlePostResearchAction (ensure password is passed) ---
async function handlePostResearchAction(action, filename, markdownContent, options) {
  // ...existing code...
  // Always use password from options
  const password = options.password;
  // ...existing code...
  if (action.toLowerCase() === 'upload') {
    // ...existing code...
    // Pass password to upload logic
    await uploadToGitHub(filename, markdownContent, password);
    // ...existing code...
  }
  // ...existing code...
}
// ...existing code...