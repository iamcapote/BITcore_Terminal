import express from 'express';
import http from 'http';
// Import necessary command components and parsing logic
import { commands, parseCommandArgs, displayHelp } from './commands/index.mjs';
import { userManager } from './features/auth/user-manager.mjs';
import { output } from './utils/research.output-manager.mjs'; // Ensure this is the singleton
import { handleCliError, ErrorTypes } from './utils/cli-error-handler.mjs';
import { setupWebSocket } from './config/websocket.mjs'; // Corrected path
import { handleWebSocketConnection } from './features/research/routes.mjs'; // Ensure this export exists
import { setupRoutes as setupResearchRoutes } from './features/research/routes.mjs'; // Renamed import
import { setupRoutes as setupAuthRoutes } from './features/auth/routes.mjs'; // Renamed import
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

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
setupResearchRoutes(app); // Setup research API routes (/api/research)
setupAuthRoutes(app);     // Setup auth API routes (/api/auth)

// --- WebSocket Setup ---
// Pass the server, the expected path, and the connection handler
setupWebSocket(server, WEBSOCKET_PATH, handleWebSocketConnection);

// --- Root Route ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
function startWebServer() {
  console.log('Web-CLI mode active. Access via browser.');
  // Use the HTTP server instance directly for listening
  server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}${WEBSOCKET_PATH}`);
    try {
      await userManager.loadUsers(); // Load users for Web-CLI mode
      console.log('[Web] Users loaded successfully.');
      // Initialize user manager (checks for admin, etc.) - might be needed for Web mode too
      await userManager.initialize();
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
}

/**
 * Starts the application in Console CLI mode.
 */
async function startCli() {
    console.log("Starting Console CLI mode...");
    try {
        await userManager.loadUsers(); // Load users for CLI mode
        console.log('[CLI] Users loaded successfully.');
        // Try to initialize user session (e.g., load from file)
        // Initialize also handles admin check/creation prompt if needed
        const initialUser = await userManager.initialize();
        if (!initialUser && !await userManager.adminExists()) {
             // If initialize returned null and no admin exists, prompt for creation
             console.log("No admin user found. Please create one.");
             const rlAdmin = readline.createInterface({ input: process.stdin, output: process.stdout });
             const username = await new Promise(resolve => rlAdmin.question('Enter admin username: ', resolve));
             const password = await new Promise(resolve => {
                 rlAdmin.question('Enter admin password: ', (input) => {
                     // Basic masking attempt (won't hide completely in all terminals)
                     // process.stdout.moveCursor(0, -1);
                     // process.stdout.clearLine(1);
                     resolve(input);
                 });
                 // Mute output for password entry (simple approach)
                 // Note: This is basic; a more robust solution uses raw mode.
                 // rlAdmin.stdoutMuted = true;
             });
             rlAdmin.close();
             await userManager.createInitialAdmin(username.trim(), password.trim());
             // Re-initialize after creating admin to set currentUser correctly
             await userManager.initialize();
        }

        console.log(`Logged in as ${userManager.getUsername()} (${userManager.getRole()})`); // Show initial user

        console.log("Welcome to MCP Console CLI. Type /help for commands, /exit to quit.");

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });

        // Flag to prevent prompting while a command is running
        let commandRunning = false;

        rl.prompt();

        rl.on('line', async (line) => {
            // Ignore input if a command is already running
            if (commandRunning) {
                // console.log("Command running, ignoring input:", line); // Optional debug log
                return;
            }

            const input = line.trim();

            if (input.toLowerCase() === '/exit') {
                rl.close(); // This will trigger the 'close' event below
                return;
            }

            // Don't process empty lines further
            if (!input) {
                 rl.prompt();
                 return;
            }

            if (!input.startsWith('/')) {
                // Only show error for non-empty, non-command input
                output.error("Invalid input. Commands must start with /");
                rl.prompt();
                return;
            }

            // Set flag to indicate command processing started
            commandRunning = true;
            // Pause readline to prevent interference during command execution, especially prompts
            // rl.pause(); // Pausing might interfere with prompts needing stdin

            try {
                // Parse the command string using the shared parser
                const parsed = parseCommandArgs(input.split(' ')); // parseCommandArgs expects an array
                // Correctly get the command name (assuming parseCommandArgs removes the '/')
                const commandName = parsed.command; // REMOVED .substring(1)
                const options = parsed.options;
                options.args = parsed.args || []; // Ensure args array exists

                // Find the command function
                const commandFn = commands[commandName];

                if (commandFn) {
                    // Add necessary context for CLI execution (no WebSocket)
                    options.isWebSocket = false;
                    options.session = null; // No session in pure CLI mode

                    // Create an object with bound output methods for CLI
                    const cliOutput = {
                        log: output.log.bind(output),
                        error: output.error.bind(output),
                        warn: output.warn.bind(output),
                        debug: output.debug.bind(output),
                        commandStart: output.commandStart.bind(output),
                        commandSuccess: output.commandSuccess.bind(output),
                        commandError: output.commandError.bind(output)
                        // Add other methods if needed by commands
                    };

                    // Execute the command, passing the object with bound methods
                    const result = await commandFn(options, cliOutput); // Pass cliOutput

                    // Handle potential results or errors (though most commands handle their own output)
                    if (result && result.success === false && result.error && !result.handled) {
                        // Use the passed output object/methods
                        cliOutput.error(`Command error: ${result.error}`); // Use cliOutput.error
                    } else if (result && result.success === true && result.message) {
                        // Use the passed output object/methods
                        cliOutput.log(result.message); // Use cliOutput.log
                    }
                    // Add more specific result handling if needed

                } else if (commandName === 'help') {
                    // Handle help specifically if not in the main commands object or provide a default
                     output.log("Available Commands (CLI - Partial List): /login, /logout, /status, /keys, /users, /chat, /research, /diagnose, /password-change, /exit"); // Use original output here is fine
                     // Or call a more detailed displayHelp function if available
                     // displayHelp(commands, output.log);
                } else {
                    // Use the original input for the error message for clarity
                    output.error(`Unknown command: ${input.split(' ')[0]}. Type /help for available commands.`); // Use original output here is fine
                }
            } catch (error) {
                // Catch errors during parsing or execution
                // Use the original output manager instance for top-level errors
                output.error(`Error processing command: ${error.message}`);
                console.error(error.stack); // Log stack trace for debugging
            } finally {
                 // Command finished, allow new input
                 commandRunning = false;
                 // Resume and prompt only if rl is not closed (e.g., by /exit)
                 if (!rl.closed) {
                    // rl.resume(); // Resume if paused
                    rl.prompt();
                 }
            }
        }).on('close', () => {
            console.log('Exiting MCP Console CLI.');
            process.exit(0);
        });
    } catch (error) {
        console.error('[CLI] Failed to start:', error);
        process.exit(1);
    }
}

// --- Main Execution ---
const mode = process.argv[2]?.toLowerCase(); // Get mode from command line argument

if (mode === 'cli') {
  startCli();
} else {
  startWebServer();
}