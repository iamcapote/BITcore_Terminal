import "dotenv/config";
import express from "express";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import fs from "fs/promises";
import os from "os";
import researchRoutes from "./features/research/routes.mjs";
import { ResearchEngine } from "./infrastructure/research/research.engine.mjs";
import { output } from "./utils/research.output-manager.mjs";
import { commands, parseCommandArgs, displayHelp } from "./commands/index.mjs";
import { executeResearch } from "./commands/research.cli.mjs";
import { callVeniceWithTokenClassifier } from "./utils/token-classifier.mjs";
import { userManager } from "./features/auth/user-manager.mjs";
import http from 'http';
import { exec } from 'child_process';
import researchRouter, { setupRoutes, handleResearchSocket, handleChatSocket } from './features/research/routes.mjs';
import { run } from './utils/cli-runner.mjs';
// Import WebSocket for server-side usage
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const PORT = process.env.PORT || 3000;

if (!process.env.BRAVE_API_KEY) {
  console.error("Missing BRAVE_API_KEY in environment variables.");
  process.exit(1);
}

// Initialize authentication system
async function initializeAuth() {
  try {
    await fs.mkdir(path.join(os.homedir(), ".mcp"), { recursive: true });
    
    // Initialize user manager - this ensures public user exists
    const user = await userManager.initialize();
    
    // If no admin exists and this is not CLI mode, prompt for admin creation
    // CLI mode has its own admin creation flow for better UX
    if (!(await userManager.adminExists()) && !process.argv.slice(2).includes("cli")) {
      console.log("[Auth] No admin user exists. Please create an admin account.");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const username = await new Promise((resolve) => rl.question("Enter admin username: ", resolve));
      const password = await new Promise((resolve) => rl.question("Enter admin password: ", resolve));
      rl.close();

      await userManager.createInitialAdmin(username, password);
      console.log("[Auth] Admin account created successfully. Restart the application to continue.");
      process.exit(0); // Exit to ensure the admin account is properly initialized
    }
    
    // If initialize() returned null (no admin exists), load the public user
    if (!user) {
      await userManager.loadUser("public");
    }
    
    return userManager.currentUser;
  } catch (error) {
    console.error(`[Auth] Initialization error: ${error.message}`);
    console.log("[Auth] Starting in fallback public mode");
    await userManager.loadUser("public");
    return userManager.currentUser;
  }
}

// NEW: Define a shared research pipeline function
async function startResearchPipeline(inputFn, outputFn) {
  const researchQuery = await inputFn("What would you like to research? ");
  if (!researchQuery.trim()) {
    outputFn("Query cannot be empty.");
    return;
  }

  const breadthStr = await inputFn("Enter research breadth (2-10)? [3] ");
  const depthStr = await inputFn("Enter research depth (1-5)? [2] ");
  const breadth = parseInt(breadthStr || "3", 10);
  const depth = parseInt(depthStr || "2", 10);

  const useTokenClassifier = await inputFn("Would you like to use the token classifier to add metadata? (yes/no) [no] ");
  let enhancedQuery = { original: researchQuery };

  if (["yes", "y"].includes(useTokenClassifier.trim().toLowerCase())) {
    try {
      outputFn("Classifying query with token classifier...");
      const tokenMetadata = await callVeniceWithTokenClassifier(researchQuery);

      // Ensure original property remains a non-empty string
      if (!enhancedQuery.original || typeof enhancedQuery.original !== "string") {
        enhancedQuery.original = researchQuery;
      }

      // Safely store metadata
      enhancedQuery.metadata = tokenMetadata;

      outputFn("Token classification completed.");
      // Output formatted token classification result for better visibility
      outputFn(`Token classification result: ${enhancedQuery.metadata}`);
      outputFn("Using token classification to enhance research quality...");
    } catch (error) {
      outputFn(`Error during token classification: ${error.message}`);
      outputFn("Continuing with basic query...");
      enhancedQuery = { original: researchQuery }; // Fallback to basic query
    }
  }

  // Update display message to show proper handling
  outputFn(`\nStarting research...\nQuery: "${enhancedQuery.original}"\nDepth: ${depth} Breadth: ${breadth}\n${enhancedQuery.metadata ? "Using enhanced metadata from token classification" : ""}\n`);

  const engine = new ResearchEngine({
    query: enhancedQuery,
    breadth,
    depth,
    onProgress: progress => {
      outputFn(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
    }
  });

  const result = await engine.research();
  outputFn("\nResearch complete!");
  if (result.learnings.length === 0) {
    outputFn("No learnings were found.");
  } else {
    outputFn("\nKey Learnings:");
    result.learnings.forEach((learning, i) => {
      outputFn(`${i + 1}. ${learning}`);
    });
  }
  if (result.sources.length > 0) {
    outputFn("\nSources:");
  }
  outputFn(`\nResults saved to: ${result.filename || "research folder"}`);
}

// --- CLI mode changes ---
async function cliInput(promptText) {
  return new Promise(resolve => {
    // Make sure we're not handling duplicate inputs
    cliRl.removeAllListeners('line');
    
    // Use once instead of on to ensure the listener is removed after use
    cliRl.once('line', (line) => {
      resolve(line);
    });
    
    cliRl.question(promptText, () => {
      // This is intentionally left empty as we're handling the response with the line event
    });
  });
}

// Override the default output manager to unify logs for both CLI and Web
function createOutputHandler(outputFn) {
  return {
    log: (msg) => {
      outputFn(msg);
    },
    error: (msg) => {
      outputFn(`[err] ${msg}`);
    }
  };
}

// Add a flag to track active chat session
let activeChatSession = false;

// For CLI, we wrap console.log
function cliOutput(text) {
  console.log(text);
  // Sync logs with our "output" manager
  output.log(text);
}

let cliRl = null;
async function interactiveCLI() {
  output.use(createOutputHandler((msg) => console.log(msg))); 
  
  // Clean up any existing readline interface
  if (cliRl) {
    cliRl.close();
    cliRl = null;
  }
  
  // Create a fresh readline interface
  cliRl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout,
    terminal: true,  // Enable proper terminal handling
    historySize: 50
  });
  
  // Add a flag to track active chat session
  let activeChatSession = false;
  
  // Function to update the prompt based on active mode
  const updatePrompt = () => {
    // Only show prompt if not in chat mode (chat mode handles its own prompts)
    if (!global.inChatMode && !activeChatSession) {
      cliRl.setPrompt("> ");
      cliRl.prompt();
    }
  };
  
  // Initial prompt
  updatePrompt();
  
  // Use a single listener for all input
  cliRl.on("line", async (line) => {
    // Skip processing if in chat mode and not a command
    if ((global.inChatMode || activeChatSession) && !line.trim().startsWith('/')) {
      return; // Chat module handles this input
    }
    
    const input = line.trim();
    
    // Check if it's a command
    if (input.startsWith("/")) {
      const commandParts = input.substring(1).split(" ");
      const command = commandParts[0];
      const args = commandParts.slice(1);
      
      // Only process if we have a command
      if (command) {
        if (commands[command]) {
          try {
            const { command: parsedCmd, options } = parseCommandArgs([command, ...args]);
            
            // Set flag if starting a chat session
            if (parsedCmd === 'chat') {
              activeChatSession = true;
            }
            
            // Execute the command
            await commands[parsedCmd](options);
            
            // After command execution, check if we've exited chat mode
            if (parsedCmd === 'chat' && !global.inChatMode) {
              activeChatSession = false;
              // Restore the prompt after exiting chat
              updatePrompt();
            }
          } catch (error) {
            console.error(`Error executing command: ${error.message}`);
            updatePrompt();
          }
        } else if (command === "help") {
          await displayHelp();
          updatePrompt();
        } else {
          console.log(`Unknown command: ${command}`);
          console.log("Available commands:");
          Object.keys(commands).forEach(cmd => console.log(`  /${cmd}`));
          updatePrompt();
        }
      } else {
        updatePrompt();
      }
    } else if (input && !global.inChatMode && !activeChatSession) {
      console.log("Please start commands with / (e.g., /research, /login, /status)");
      updatePrompt();
    } else if (!global.inChatMode && !activeChatSession) {
      // Just re-display the prompt if not in chat mode
      updatePrompt();
    }
  });
  
  // Handle clean program exit
  process.on('SIGINT', () => {
    console.log("\nExiting MCP CLI...");
    if (cliRl) {
      cliRl.close();
      cliRl = null;
    }
    process.exit(0);
  });
}

// --- Web-CLI changes ---
function wsInputFactory(ws) {
  return async function(promptText) {
    // Send the prompt
    const promptId = crypto.randomUUID();
    ws.send(JSON.stringify({ 
      type: "prompt", 
      data: promptText,
      messageId: promptId 
    }));
    
    // Wait for the next message that has an "input" field
    return new Promise(resolve => {
      const messageHandler = function inputHandler(raw) {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.input !== undefined) {
            // Important: Remove this specific handler to prevent duplicate processing
            ws.removeListener("message", messageHandler);
            resolve(msg.input ? msg.input.trim() : '');
            return;
          }
        } catch (e) {
          // Just continue if parsing fails
        }
      };
      
      // Use a specific handler for this prompt
      ws.addListener("message", messageHandler);
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        ws.removeListener("message", messageHandler);
        resolve(''); // Resolve with empty string after timeout
      }, 60000); // 1 minute timeout
    });
  };
}

function wsOutputFactory(ws) {
  return function(text) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Generate a unique ID for each output message
      const messageId = `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ws.send(JSON.stringify({ 
        type: "output", 
        data: text,
        messageId: messageId
      }));
    }
  };
}

// --- Modify CLI branch ---
(async () => {
  // Initialize authentication system
  const user = await initializeAuth();

  // Determine mode based on arguments
  const isCliMode = process.argv.slice(2).includes("cli");

  // Ensure proper mode selection for Web-CLI and Terminal-CLI
  if (isCliMode) {
    console.log("[CLI] Starting in terminal-CLI mode...");
    interactiveCLI();
  } else {
    console.log("[Web] Starting in web-CLI mode...");
    const app = express();
    app.use(express.json());
    app.use("/api/research", researchRoutes);
    
    // Serve static files from the public directory
    app.use(express.static(path.join(__dirname, "public")));

    // Create HTTP server
    const server = http.createServer(app).listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    // Create WebSocket server instance
    const wss = new WebSocketServer({ noServer: true });
    
    // Handle WebSocket upgrade requests
    server.on('upgrade', (req, socket, head) => {
      const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
      
      // Route WebSocket connections through the /ws endpoint
      if (pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, ws => {
          wss.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    });
    
    // Set up general WebSocket connection handler
    wss.on('connection', (ws) => {
      console.log('[WebSocket] New connection established');
      
      // Register this client with output manager
      output.addWebSocketClient(ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'output',
        data: 'Connected to MCP Server. Type /help for available commands.',
        messageId: `welcome-${Date.now()}`
      }));
      
      // Set initial endpoint - will be changed based on first message
      ws.endpoint = null;
      
      // Handle the first message to determine endpoint
      const handleFirstMessage = (message) => {
        try {
          console.log('[WebSocket] Processing first message:', message.toString().substring(0, 100));
          const data = JSON.parse(message);
          
          // Determine the correct endpoint based on the first message
          if (data.type === 'chat-init' || data.type === 'chat-message' || 
              (data.input && data.input.trim().toLowerCase().startsWith('/chat'))) {
            console.log('[WebSocket] Routing to chat handler');
            ws.endpoint = 'chat';
            handleChatSocket(ws);
          } else {
            console.log('[WebSocket] Routing to research handler');
            ws.endpoint = 'research';
            handleResearchSocket(ws);
          }
          
          // Remove this handler after the first message
          ws.off('message', handleFirstMessage);
          
          // Re-emit this message to be handled by the appropriate handler
          ws.emit('message', message);
        } catch (error) {
          console.error('[WebSocket] Error handling first message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
            messageId: `error-${Date.now()}`
          }));
        }
      };
      
      // Listen for the first message to determine endpoint
      ws.on('message', handleFirstMessage);
    });
    
    // Set up research routes
    setupRoutes(app, server, wss);
  }
})();

// Helper function to handle research with various input types
async function startResearchWithQuery(query, breadth, depth, outputFn) {
  // Extract the actual query content
  let queryForDisplay = query;
  let metadataInfo = "";
  
  if (typeof query === "object") {
    if (!query.original) {
      outputFn("Error: Invalid query format. Missing original query text.");
      return;
    }
    queryForDisplay = query.original;

    // If there"s classifier metadata, note it
    if (query.metadata) {
      metadataInfo = "\nUsing token classification metadata to enhance results.";
    } else {
      // Log same classification steps as CLI if relevant
      outputFn("Classifying query with token classifier...");
      try {
        const tokenMetadata = await callVeniceWithTokenClassifier(query.original);
        query.metadata = tokenMetadata;
        outputFn("Token classification completed.");
        outputFn(`Token classification result: ${tokenMetadata}`);
        outputFn("Using token classification to enhance research quality...");
        metadataInfo = "\nUsing enhanced metadata from token classification";
      } catch (error) {
        outputFn(`Error during token classification: ${error.message}`);
        outputFn("Continuing with basic query...");
      }
    }
  }

  // Match the same logging depth as CLI
  outputFn(`\nStarting research with query: "${queryForDisplay}"${metadataInfo}`);
  outputFn(`Depth: ${depth} Breadth: ${breadth}\n`);

  try {
    const engine = new ResearchEngine({
      query, // Pass the query as-is (could be string or object)
      breadth,
      depth,
      onProgress: (progress) => {
        outputFn(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
      }
    });

    const result = await engine.research();

    outputFn("\nResearch complete!");
    if (result.learnings.length === 0) {
      outputFn("No learnings were found.");
    } else {
      outputFn("\nKey Learnings:");
      result.learnings.forEach((learning, i) => {
        outputFn(`${i + 1}. ${learning}`);
      });
    }
    if (result.sources.length > 0) {
      outputFn("\nSources:");
      result.sources.forEach(source => outputFn(`- ${source}`));
    }
    outputFn(`\nResults saved to: ${result.filename || "research folder"}`);
  } catch (error) {
    outputFn(`\nError during research: ${error.message}`);
  }
}

// We"ll split out gathering research inputs from the actual research steps:
async function gatherResearchInputs(wsInput, wsOutput) {
  const researchQuery = await wsInput("What would you like to research? ");
  if (!researchQuery.trim()) {
    wsOutput("Query cannot be empty.");
    return null;
  }
  const breadthStr = await wsInput("Enter research breadth (2-10)? [3] ");
  const depthStr = await wsInput("Enter research depth (1-5)? [2] ");
  const breadth = parseInt(breadthStr || "3", 10);
  const depth = parseInt(depthStr || "2", 10);

  const useClassifier = await wsInput("Would you like to use the token classifier to add metadata? (yes/no) [no] ");
  let enhancedQuery = { original: researchQuery };
  if (["yes", "y"].includes(useClassifier.trim().toLowerCase())) {
    try {
      wsOutput("Classifying query with token classifier...");
      const tokenMetadata = await callVeniceWithTokenClassifier(researchQuery);
      if (!enhancedQuery.original || typeof enhancedQuery.original !== "string") {
        enhancedQuery.original = researchQuery;
      }
      enhancedQuery.metadata = tokenMetadata;
      wsOutput("Token classification completed.");
      wsOutput(`Token classification result: ${enhancedQuery.metadata}`);
      wsOutput("Using token classification to enhance research quality...");
    } catch (error) {
      wsOutput(`Error during token classification: ${error.message}`);
      wsOutput("Continuing with basic query...");
    }
  }
  return { query: enhancedQuery, breadth, depth };
}

async function runResearch(engineParams, wsOutput) {
  const { query, breadth, depth } = engineParams;
  wsOutput(`\nStarting research...\nQuery: "${query.original}"\nDepth: ${depth} Breadth: ${breadth}` 
    + `${query.metadata ? "\nUsing enhanced metadata from token classification" : ""}\n`);
  const engine = new ResearchEngine({
    query,
    breadth,
    depth,
    onProgress: (progress) => {
      wsOutput(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
    }
  });
  const result = await engine.research();
  wsOutput("\nResearch complete!");
  if (result.learnings.length === 0) {
    wsOutput("No learnings were found.");
  } else {
    wsOutput("\nKey Learnings:");
    result.learnings.forEach((learning, i) => {
      wsOutput(`${i + 1}. ${learning}`);
    });
  }
  if (result.sources.length > 0) {
    wsOutput("\nSources:");
    result.sources.forEach((source) => wsOutput(`- ${source}`));
  }
  wsOutput(`\nResults saved to: ${result.filename || "research folder"}`);
}