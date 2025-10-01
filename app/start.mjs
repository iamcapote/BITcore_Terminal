import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { userManager } from './features/auth/user-manager.mjs';
import { output } from './utils/research.output-manager.mjs';
import { interactiveCLI } from './utils/cli-runner.mjs'; // Correctly import interactiveCLI
import { handleWebSocketConnection } from './features/research/routes.mjs';
import { commands, parseCommandArgs, getHelpText } from './commands/index.mjs'; // Import commands and parser
import { setupRoutes as setupMemoryRoutes } from './features/memory/routes.mjs';
import { setupPromptRoutes } from './features/prompts/routes.mjs';
import { getMissionScheduler, getMissionConfig } from './features/missions/index.mjs';
import { setupMissionRoutes } from './features/missions/routes.mjs';
import { setupStatusRoutes } from './features/status/routes.mjs';
import { setupGithubSyncRoutes } from './features/research/github-sync/routes.mjs';
import { setupGithubActivityRoutes } from './features/research/github-activity.routes.mjs';
import { setupTerminalPreferencesRoutes } from './features/preferences/terminal-preferences.routes.mjs';
import { setupResearchPreferencesRoutes } from './features/preferences/research-preferences.routes.mjs';
import { setupModelBrowserRoutes } from './features/ai/model-browser/index.mjs';
import { setupChatHistoryRoutes } from './features/chat-history/routes.mjs';
import { setupLogRoutes } from './features/logs/routes.mjs';
import { setupChatPersonaRoutes } from './features/chat/chat-persona.routes.mjs';

dotenv.config();

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const WEBSOCKET_PATH = '/api/research/ws'; // Define the WebSocket path

// --- Middleware ---
app.use(express.json()); // For parsing application/json
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// --- Feature Routes ---
setupMemoryRoutes(app);
setupPromptRoutes(app);
setupMissionRoutes(app, { logger: console });
setupStatusRoutes(app, { logger: console });
setupGithubSyncRoutes(app);
setupGithubActivityRoutes(app, { logger: console });
setupTerminalPreferencesRoutes(app, { logger: console });
setupResearchPreferencesRoutes(app, { logger: console });
setupModelBrowserRoutes(app, { logger: console });
setupChatHistoryRoutes(app, { logger: console });
setupLogRoutes(app, { logger: console });
setupChatPersonaRoutes(app, { logger: console });

// --- WebSocket Setup ---
// Ensure the server object is correctly passed
console.log('[WebSocket] Initializing WebSocketServer...');
const wss = new WebSocketServer({ server, path: WEBSOCKET_PATH });
console.log(`[WebSocket] WebSocketServer created. Listening on path: ${WEBSOCKET_PATH}`);

wss.on('error', (error) => {
    console.error('[WebSocket] Server Error:', error);
});

// --- Root Route ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- NEW: Research Page Route ---
app.get('/research/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'research', 'index.html'));
});
// Also handle requests without the trailing slash
app.get('/research', (req, res) => {
  res.redirect('/research/');
});

// --- Self Organizer Route ---

// --- Self Organizer Route ---
app.get('/organizer/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'organizer', 'index.html'));
});
app.get('/organizer', (req, res) => {
  res.redirect('/organizer/');
});

// --- GitHub Research Sync Dashboard Route ---
app.get('/github-sync/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'github-sync', 'index.html'));
});
app.get('/github-sync', (req, res) => {
  res.redirect('/github-sync/');
});

app.get('/chat-history/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat-history', 'index.html'));
});
app.get('/chat-history', (req, res) => {
  res.redirect('/chat-history/');
});

app.get('/logs/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logs', 'index.html'));
});
app.get('/logs', (req, res) => {
  res.redirect('/logs/');
});


// --- Error Handling Middleware (Basic) ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  res.status(500).send('Something broke!');
});

// --- Application Modes ---

/**
 * Starts the application in Web Server mode.
 */
async function startServer() {
  console.log('Web-CLI mode active. Access via browser.');
    await userManager.initialize();
    const currentUser = userManager.getCurrentUser();
    console.log(`[Server] Operating in single-user mode as ${currentUser.username} (${currentUser.role}).`);

  const missionConfig = getMissionConfig();
  if (missionConfig.schedulerEnabled) {
    const missionScheduler = getMissionScheduler({ logger: console, intervalMs: missionConfig.pollingIntervalMs });
    missionScheduler.start();
  } else {
    console.log('[Server] Mission scheduler disabled via feature flag.');
  }
  // Use the HTTP server instance directly for listening
    server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Express server running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Attempting to listen for WebSocket connections on path: ${WEBSOCKET_PATH}`);
  });

  server.on('error', (error) => {
      console.error(`[Server Error] ${error.message}`);
      // Handle specific listen errors with friendly messages
      if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Please close the other process or use a different port.`);
          process.exit(1);
      }
  });

  // --- RESTORE Original WebSocket Connection Handler ---
  wss.on('connection', (ws, req) => {
      // Use the original handler you imported
      console.log(`[WebSocket] Passing connection to handleWebSocketConnection for path: ${req.url}`); // Add log
      handleWebSocketConnection(ws, req);
  });
  // --- END RESTORED HANDLER ---
}

/**
 * Starts the application in Console CLI mode.
 */
async function startCli() {
    console.log("Starting Console CLI mode...");
    // Set the log handler for the OutputManager in CLI mode
    output.setLogHandler((level, message) => {
        // Simple console logging based on level
        if (level === 'error') {
            console.error(`[${level.toUpperCase()}] ${message}`);
        } else if (level === 'warn') {
            console.warn(`[${level.toUpperCase()}] ${message}`);
        } else if (level === 'debug' && process.env.DEBUG_MODE === 'true') {
            console.debug(`[${level.toUpperCase()}] ${message}`);
        } else if (level !== 'debug') { // Log info and others
            console.log(message); // Keep info logs clean
        }
    });

    try {
        await userManager.initialize();
        const currentUser = userManager.getCurrentUser();
        console.log(`[CLI] Operating in single-user mode as ${currentUser.username} (${currentUser.role}).`);
        console.log("Welcome to MCP Console CLI. Type /help for commands, /exit to quit.");

  const missionConfig = getMissionConfig();
  if (missionConfig.schedulerEnabled) {
    const missionScheduler = getMissionScheduler({ logger: console, intervalMs: missionConfig.pollingIntervalMs });
    missionScheduler.start();
  } else {
    console.log('[CLI] Mission scheduler disabled via feature flag.');
  }

        // Use interactiveCLI, passing the command map and output function
        interactiveCLI({ // Ensure this calls interactiveCLI
            commands: commands, // Pass the imported commands map
            onOutput: output.log, // Use the output manager's log method
            onExit: () => {
                console.log('Exiting MCP Console CLI.');
                process.exit(0);
            }
        });

    } catch (error) {
        output.error(`[CLI] Failed to start: ${error.message}`); // Use output manager
        console.error(error.stack); // Log stack trace for debugging
        process.exit(1);
    }
}

// --- Main Execution ---
const mode = process.argv[2]?.toLowerCase(); // Get mode from command line argument

if (mode === 'cli') {
  startCli();
} else {
  startServer();
}