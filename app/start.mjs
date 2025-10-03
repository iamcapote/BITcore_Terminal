/**
 * Why: Bootstrap entrypoint for the BITcore terminal, hosting both the web server and interactive CLI flows.
 * What: Loads configuration, wires Express routes, stands up the WebSocket gateway, and conditionally starts either the HTTP server or CLI runtime.
 * How: Shares a module-scoped logger across routes, schedulers, and output handlers to keep telemetry aligned between surfaces.
 */

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
import { getResearchRequestScheduler, getResearchSchedulerConfig } from './features/research/github-sync/index.mjs';
import { createModuleLogger } from './utils/logger.mjs';

dotenv.config();

const logger = createModuleLogger('app.start');

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
setupMissionRoutes(app, { logger: logger.child('routes.missions') });
setupStatusRoutes(app, { logger: logger.child('routes.status') });
setupGithubSyncRoutes(app);
setupGithubActivityRoutes(app, { logger: logger.child('routes.github-activity') });
setupTerminalPreferencesRoutes(app, { logger: logger.child('routes.terminal-preferences') });
setupResearchPreferencesRoutes(app, { logger: logger.child('routes.research-preferences') });
setupModelBrowserRoutes(app, { logger: logger.child('routes.model-browser') });
setupChatHistoryRoutes(app, { logger: logger.child('routes.chat-history') });
setupLogRoutes(app, { logger: logger.child('routes.logs') });
setupChatPersonaRoutes(app, { logger: logger.child('routes.chat-persona') });

// --- WebSocket Setup ---
// Ensure the server object is correctly passed
const wsLogger = logger.child('websocket');
wsLogger.info('Initializing WebSocketServer.', { path: WEBSOCKET_PATH });
const wss = new WebSocketServer({ server, path: WEBSOCKET_PATH });
wsLogger.info('WebSocketServer created.', { path: WEBSOCKET_PATH });

wss.on('error', (error) => {
  wsLogger.error('WebSocket server error.', { message: error?.message, stack: error?.stack });
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
  logger.error('Unhandled Express error.', { message: err?.message, stack: err?.stack });
  res.status(500).send('Something broke!');
});

// --- Application Modes ---

/**
 * Starts the application in Web Server mode.
 */
async function startServer() {
  logger.info('Web-CLI mode active. Access via browser.');
    await userManager.initialize();
    const currentUser = userManager.getCurrentUser();
    logger.info('Server operating in single-user mode.', { username: currentUser.username, role: currentUser.role });

  const missionConfig = getMissionConfig();
  if (missionConfig.schedulerEnabled) {
    const missionScheduler = getMissionScheduler({ logger: logger.child('scheduler.missions'), intervalMs: missionConfig.pollingIntervalMs });
    missionScheduler.start();
  } else {
    logger.info('Mission scheduler disabled via feature flag.');
  }

  const researchSchedulerConfig = getResearchSchedulerConfig();
  if (researchSchedulerConfig.enabled) {
    const researchScheduler = getResearchRequestScheduler({ logger: logger.child('scheduler.research') });
    researchScheduler.start();
  } else {
    logger.info('Research request scheduler disabled via feature flag.');
  }
  // Use the HTTP server instance directly for listening
    server.listen(PORT, '0.0.0.0', () => {
    logger.info('Express server running.', { host: '0.0.0.0', port: PORT });
    wsLogger.info('Listening for WebSocket connections.', { path: WEBSOCKET_PATH });
  });

  server.on('error', (error) => {
      logger.error('Server listen error.', { message: error?.message, stack: error?.stack, code: error?.code });
      // Handle specific listen errors with friendly messages
      if (error.code === 'EADDRINUSE') {
          logger.error('Port already in use.', { port: PORT });
          process.exit(1);
      }
  });

  // --- RESTORE Original WebSocket Connection Handler ---
  wss.on('connection', (ws, req) => {
      // Use the original handler you imported
      wsLogger.debug('Passing connection to handler.', { path: req.url });
      handleWebSocketConnection(ws, req);
  });
  // --- END RESTORED HANDLER ---
}

/**
 * Starts the application in Console CLI mode.
 */
async function startCli() {
  logger.info('Starting Console CLI mode.');
    // Set the log handler for the OutputManager in CLI mode
    output.setLogHandler((level, message) => {
    const normalized = typeof message === 'string' ? message : JSON.stringify(message);
    if (level === 'error') {
      logger.error(normalized);
    } else if (level === 'warn') {
      logger.warn(normalized);
    } else if (level === 'debug') {
      logger.debug(normalized);
    } else {
      logger.info(normalized);
    }
    });

    try {
        await userManager.initialize();
        const currentUser = userManager.getCurrentUser();
    logger.info('CLI operating in single-user mode.', { username: currentUser.username, role: currentUser.role });
    logger.info('Welcome to MCP Console CLI. Type /help for commands, /exit to quit.');

  const missionConfig = getMissionConfig();
  if (missionConfig.schedulerEnabled) {
  const missionScheduler = getMissionScheduler({ logger: logger.child('scheduler.missions'), intervalMs: missionConfig.pollingIntervalMs });
    missionScheduler.start();
  } else {
  logger.info('CLI mission scheduler disabled via feature flag.');
  }

  const researchSchedulerConfig = getResearchSchedulerConfig();
  if (researchSchedulerConfig.enabled) {
  const researchScheduler = getResearchRequestScheduler({ logger: logger.child('scheduler.research') });
    researchScheduler.start();
  } else {
  logger.info('CLI research request scheduler disabled via feature flag.');
  }

        // Use interactiveCLI, passing the command map and output function
        interactiveCLI({ // Ensure this calls interactiveCLI
            commands: commands, // Pass the imported commands map
            onOutput: output.log, // Use the output manager's log method
            onExit: () => {
        logger.info('Exiting MCP Console CLI.');
                process.exit(0);
            }
        });

    } catch (error) {
        output.error(`[CLI] Failed to start: ${error.message}`); // Use output manager
    logger.error('CLI startup failure.', { message: error?.message, stack: error?.stack });
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