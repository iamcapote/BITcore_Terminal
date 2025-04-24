import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import readline from 'readline'; // Import readline
import { userManager } from './features/auth/user-manager.mjs';
import { output } from './utils/research.output-manager.mjs';
import { interactiveCLI } from './utils/cli-runner.mjs'; // Correctly import interactiveCLI
import { handleWebSocketConnection } from './features/research/routes.mjs';
import { setupRoutes as setupAuthRoutes } from './features/auth/routes.mjs';
import { commands, parseCommandArgs, getHelpText } from './commands/index.mjs'; // Import commands and parser

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

// --- API Routes ---
setupAuthRoutes(app);     // Setup auth API routes (/api/auth)

// --- WebSocket Setup ---
const wss = new WebSocketServer({ server, path: WEBSOCKET_PATH });

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
  // Use the HTTP server instance directly for listening
  server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}${WEBSOCKET_PATH}`);
    try {
      await userManager.loadUsers(); // Load users for Web-CLI mode (needed for lookups)
      console.log('[Web] Users loaded successfully.');
      // REMOVED: await userManager.initialize(); - Do not initialize CLI session state for web server
    } catch (error) {
      console.error('[Web] Failed to start:', error);
      server.close(); // Close the server on initialization error
    }
  });

  server.on('error', (error) => {
      console.error(`[Server Error] ${error.message}`);
      // Handle specific listen errors with friendly messages
      if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Please close the other process or use a different port.`);
          process.exit(1);
      }
  });

  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] Handling upgrade request for path:', req.url);
    if (req.url === '/api/research/ws') {
         handleWebSocketConnection(ws, req);
    } else {
        console.log(`[WebSocket] Connection attempt to unknown path: ${req.url}. Closing.`);
        ws.close(1008, 'Invalid path');
    }
  });
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
        await userManager.loadUsers(); // Load users for CLI mode
        console.log('[CLI] Users loaded successfully.');
        // Initialize also handles admin check/creation prompt if needed
        const initialUser = await userManager.initialize();

        // --- Admin Creation Prompt Logic ---
        if (!initialUser && !await userManager.adminExists()) {
             console.log("No admin user found. Please create one.");
             const rlAdmin = readline.createInterface({ input: process.stdin, output: process.stdout });
             // Use async/await with Promises for prompts
             const username = await new Promise(resolve => rlAdmin.question('Enter admin username: ', resolve));
             const password = await new Promise(resolve => {
                 // Use rl.question with hidden input simulation if possible (basic)
                 const query = 'Enter admin password: ';
                 const stdin = process.stdin;
                 const stdout = process.stdout;
                 let pass = '';

                 stdout.write(query);
                 stdin.setRawMode(true);
                 stdin.resume();
                 stdin.setEncoding('utf8');

                 const onData = (char) => {
                     char = char.toString();
                     switch (char) {
                         case '\n': case '\r': case '\u0004': // Enter, Ctrl+D
                             stdin.setRawMode(false);
                             stdin.pause();
                             stdin.removeListener('data', onData);
                             stdout.write('\n');
                             resolve(pass);
                             break;
                         case '\u0003': // Ctrl+C
                             stdin.setRawMode(false);
                             stdin.pause();
                             stdin.removeListener('data', onData);
                             stdout.write('\nCancelled.\n');
                             process.exit(); // Exit on Ctrl+C during password
                             break;
                         case '\u007f': // Backspace
                             if (pass.length > 0) {
                                 pass = pass.slice(0, -1);
                                 stdout.clearLine(0); // Clear current line
                                 stdout.cursorTo(0); // Move cursor to beginning
                                 stdout.write(query + '*'.repeat(pass.length)); // Rewrite prompt + asterisks
                             }
                             break;
                         default:
                             pass += char;
                             stdout.write('*');
                             break;
                     }
                 };
                 stdin.on('data', onData);
             });
             rlAdmin.close(); // Close the temporary interface
             await userManager.createInitialAdmin(username.trim(), password.trim());
             await userManager.initialize(); // Re-initialize after creating admin
        }
        // --- End Admin Creation ---

        console.log(`Logged in as ${userManager.getUsername()} (${userManager.getRole()})`); // Show initial user
        console.log("Welcome to MCP Console CLI. Type /help for commands, /exit to quit.");

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