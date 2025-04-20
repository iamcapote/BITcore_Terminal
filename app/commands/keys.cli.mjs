import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';
import fetch from 'node-fetch';
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs'; // Import singleton for defaults
import crypto from 'crypto'; // Needed for safeSend if used
import { safeSend } from '../utils/websocket.utils.mjs';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';

// Keep track of the active readline interface to avoid conflicts
let activeRlInstance = null;

/**
 * Ensures only one readline interface is active for prompts.
 * Creates/closes temporary interfaces as needed.
 * @param {string} query The prompt message.
 * @param {boolean} isHidden If true, mask input (for passwords).
 * @returns {Promise<string>} User's input.
 */
function singlePrompt(query, isHidden = false) {
    return new Promise((resolve, reject) => {
        if (activeRlInstance) {
            // Should not happen if managed correctly, but reject if it does
            return reject(new Error("Another prompt is already active."));
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });
        activeRlInstance = rl; // Store reference

        let password = ''; // Used only if isHidden is true

        const cleanup = () => {
            if (process.stdin.isRaw) {
                process.stdin.setRawMode(false);
            }
            process.stdin.removeListener('keypress', onKeypress);
            process.stdin.pause(); // Pause stdin after use
            rl.close();
            if (activeRlInstance === rl) { // Avoid race conditions
                activeRlInstance = null;
            }
        };

        const onKeypress = (chunk, key) => {
            if (key) {
                if (key.name === 'return' || key.name === 'enter') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve(password);
                } else if (key.name === 'backspace') {
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b'); // Erase the character
                    }
                } else if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
                    cleanup();
                    process.stdout.write('\nCancelled.\n');
                    resolve(''); // Resolve empty on cancel
                } else if (!key.ctrl && !key.meta && chunk) {
                    password += chunk;
                    process.stdout.write('*');
                }
            } else if (chunk) { // Fallback
                password += chunk;
                process.stdout.write('*');
            }
        };

        if (isHidden) {
            rl.setPrompt(''); // Clear any default prompt
            rl.write(query); // Write the prompt query

            // Ensure raw mode is off before starting
            if (process.stdin.isRaw) {
                process.stdin.setRawMode(false);
            }
            process.stdin.setRawMode(true);
            process.stdin.resume(); // Ensure stdin is flowing
            process.stdin.on('keypress', onKeypress); // Attach the listener
        } else {
            // Normal question prompt
            rl.question(query, (answer) => {
                cleanup();
                resolve(answer.trim());
            });
        }

        rl.on('error', (err) => {
            cleanup();
            reject(err);
        });

        rl.on('SIGINT', () => {
            cleanup();
            process.stdout.write('\nCancelled.\n');
            resolve(''); // Resolve empty on cancel
        });
    });
}


/**
 * CLI command for managing API keys. Accepts a single options object.
 * @param {Object} options - Command options including positionalArgs, flags, session, output/error handlers.
 * @param {string[]} options.positionalArgs - Positional arguments (action, service, key)
 * @param {string} [options.password] - Password provided via args/payload/cache/prompt
 * @param {boolean} [options.isWebSocket=false] - Indicates if called via WebSocket
 * @param {object} [options.session] - WebSocket session object
 * @param {Function} options.output - Output function (log or WebSocket send)
 * @param {Function} options.error - Error function (error or WebSocket send)
 * @param {object} [options.currentUser] - User data object if authenticated.
 * @returns {Promise<Object>} Command result
 */
export async function executeKeys(options = {}) {
    const {
        positionalArgs = [], // Use positionalArgs from options
        password, // Password from handleCommandMessage
        isWebSocket = false,
        session,
        output: cmdOutput, // Renamed for clarity
        error: cmdError,   // Renamed for clarity
        currentUser // User data from handleCommandMessage
    } = options;

    // Determine effective output/error handlers (already done via options)
    const effectiveOutput = cmdOutput;
    const effectiveError = cmdError;
    // Simple debug for WS, console debug handled by cliOutput object if passed in CLI mode
    const effectiveDebug = isWebSocket ? (msg) => { if (session?.debug) cmdOutput(`[DEBUG] ${msg}`); } : console.log;

    const action = positionalArgs[0]?.toLowerCase();
    const service = positionalArgs[1]?.toLowerCase();
    // Combine remaining args for the key, allowing spaces if not quoted by client
    const key = positionalArgs.slice(2).join(' ');

    effectiveOutput(`[CMD START] keys: Action='${action}', Service='${service}'`);

    // --- Authentication Check ---
    const isAuthenticated = !!currentUser && currentUser.role !== 'public';
    const currentUsername = currentUser ? currentUser.username : 'public';

    if (!isAuthenticated) {
        effectiveError('You must be logged in to manage API keys.');
        return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
    }

    try {
        // Password should be handled by handleCommandMessage and passed in options.password
        let userPassword = options.password;

        // --- CLI Specific Password Prompt (Fallback) ---
        // Only prompt in Console CLI if password wasn't provided via args/cache AND is needed
        const needsPasswordCli = !isWebSocket && !userPassword && (action === 'set' || action === 'test');
        if (needsPasswordCli) {
            userPassword = await singlePrompt(`Please enter your password for /keys ${action}: `, true);
            if (!userPassword) {
                effectiveError('Password is required for this action.');
                return { success: false, error: 'Password required', handled: true }; // CLI return
            }
            // Optionally cache for CLI session if userManager supports it
            // userManager.cliSessionPassword = userPassword; // Avoid caching here, let login handle it
        }
        // Error if WebSocket and password still missing when needed (logic error in handleCommandMessage)
        else if (isWebSocket && !userPassword && (action === 'set' || action === 'test')) {
             effectiveError('Internal Error: Password required but missing.');
             return { success: false, error: 'Password required but missing', handled: true, keepDisabled: false };
        }
        // --- End Password Handling ---


        switch (action) {
            case 'set':
                if (!service || !key) {
                    effectiveError('Usage: /keys set <service> <key>');
                    return { success: false, error: 'Missing arguments for set', handled: true, keepDisabled: false };
                }
                if (service !== 'brave' && service !== 'venice' && service !== 'github') { // Added github
                    effectiveError('Invalid service. Supported services: brave, venice, github');
                    return { success: false, error: 'Invalid service', handled: true, keepDisabled: false };
                }
                if (!userPassword) { // Should be caught above, but double-check
                    effectiveError('Password is required to encrypt the API key.');
                    return { success: false, error: 'Password required', handled: true, keepDisabled: false };
                }
                // Pass username explicitly to setApiKey
                await userManager.setApiKey(service, key, userPassword, currentUsername);
                effectiveOutput(`API key for ${service} set successfully.`);
                effectiveOutput(`[CMD SUCCESS] keys set: Completed successfully.`);
                return { success: true, keepDisabled: false };

            case 'check':
            case 'stat': // Alias for check
                // Call the new checkApiKeys method
                const keysStatus = await userManager.checkApiKeys(currentUsername);
                effectiveOutput('--- API Key Status ---');
                effectiveOutput(`Brave API Key: ${keysStatus.brave ? 'Configured' : 'Not Configured'}`);
                effectiveOutput(`Venice API Key: ${keysStatus.venice ? 'Configured' : 'Not Configured'}`);
                effectiveOutput(`GitHub API Key: ${keysStatus.github ? 'Configured' : 'Not Configured'}`); // Added github
                effectiveOutput(`[CMD SUCCESS] keys ${action}: Completed successfully.`);
                return { success: true, keepDisabled: false };

            case 'test':
                 if (!userPassword) { // Should be caught above, but double-check
                    effectiveError('Password is required to test API keys.');
                    return { success: false, error: 'Password required', handled: true, keepDisabled: false };
                }

                effectiveOutput('Testing API keys...');
                // Call the new testApiKeys method, passing username explicitly
                const testResults = await userManager.testApiKeys(userPassword, currentUsername);

                effectiveOutput(`Brave API Key Test: ${testResults.brave.success ? 'OK' : `Failed (${testResults.brave.error})`}`);
                effectiveOutput(`Venice API Key Test: ${testResults.venice.success ? 'OK' : `Failed (${testResults.venice.error})`}`);
                effectiveOutput(`GitHub API Key Test: ${testResults.github.success ? 'OK' : `Failed (${testResults.github.error})`}`); // Added github

                // Check if *all* configured keys passed
                let allTestsPassed = true;
                let testsFailed = false;
                if (keysStatus.brave && !testResults.brave.success) allTestsPassed = false;
                if (keysStatus.venice && !testResults.venice.success) allTestsPassed = false;
                if (keysStatus.github && !testResults.github.success) allTestsPassed = false;
                if (!testResults.brave.success || !testResults.venice.success || !testResults.github.success) testsFailed = true;


                if (allTestsPassed) {
                    effectiveOutput(`[CMD SUCCESS] keys test: All configured keys tested successfully.`);
                    return { success: true, keepDisabled: false };
                } else if (testsFailed) {
                    // Error message handled by testApiKeys outputting failures
                    // effectiveError('One or more API key tests failed.');
                     effectiveOutput(`[CMD WARNING] keys test: One or more API key tests failed.`);
                    return { success: false, error: 'One or more API key tests failed.', handled: true, keepDisabled: false };
                } else {
                     effectiveOutput(`[CMD SUCCESS] keys test: No keys configured to test.`);
                     return { success: true, keepDisabled: false }; // Not a failure if no keys are set
                }


            case 'help':
            default:
                effectiveOutput(getKeysHelpText());
                return { success: true, keepDisabled: false }; // Show help is not an error
        }
    } catch (error) {
        effectiveError(`Error during keys command: ${error.message}`);
        console.error(error.stack); // Log stack trace for debugging
        return { success: false, error: error.message, handled: true, keepDisabled: false };
    }
}

export function getKeysHelpText() {
    return `API Key Management Commands:
  /keys set <service> <key>   Set API key (brave, venice, github). Requires password.
  /keys check | stat          Check if API keys are configured.
  /keys test                  Test configured API keys. Requires password.
  /keys help                  Show this help message.`;
}