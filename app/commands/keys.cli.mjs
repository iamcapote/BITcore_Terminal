import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';
import fetch from 'node-fetch';
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs'; // Import singleton for defaults
import crypto from 'crypto'; // Needed for safeSend if used
import { safeSend } from '../utils/websocket.utils.mjs';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs'; // Needed for testApiKeys
import { Octokit } from '@octokit/rest'; // Needed for testApiKeys

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

    // effectiveOutput(`[CMD START] keys: Action='${action}', Service='${service}'`); // Moved logCommandStart below checks

    // --- Public User Check ---
    // Allow 'check'/'stat' and 'help' for public, but block 'set' and 'test'
    if (currentUser && currentUser.role === 'public' && (action === 'set' || action === 'test')) {
        effectiveError('Setting or testing API keys is not available for public users. Please /login.');
        return { success: false, error: 'Permission denied for public user', handled: true, keepDisabled: false };
    }
    // Also block if not logged in at all for set/test
    if (!currentUser || currentUser.role === 'public') {
         if (action === 'set' || action === 'test') {
             effectiveError('You must be logged in to set or test API keys.');
             return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
         }
         // Allow check/stat/help even if public/not logged in (will show 'Not Configured')
    }
    // --- End Public User Check ---

    // --- Authentication Check (Redundant if public handled above, but safe) ---
    const isAuthenticated = !!currentUser && currentUser.role !== 'public';
    const currentUsername = currentUser ? currentUser.username : 'public';

    if (!isAuthenticated && (action === 'set' || action === 'test')) {
        effectiveError('You must be logged in to manage API keys.');
        return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
    }
    // --- End Authentication Check ---

    logCommandStart('keys', { ...options, action, service }); // Log command start after initial checks

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
                if (!service) {
                    effectiveError('Usage: /keys set <service> <value...>');
                    effectiveError('Services: brave, venice, github-token, github-owner, github-repo, github-branch');
                    return { success: false, error: 'Missing service for set', handled: true, keepDisabled: false };
                }
                if (!key && service !== 'github-branch') { // Value is required for most
                    effectiveError(`Usage: /keys set ${service} <value...>`);
                    return { success: false, error: `Missing value for set ${service}`, handled: true, keepDisabled: false };
                }
                if (!userPassword) { // Should be caught above, but double-check
                    effectiveError('Password is required to set keys or configuration.');
                    return { success: false, error: 'Password required', handled: true, keepDisabled: false };
                }

                // Handle different services
                if (service === 'brave' || service === 'venice') {
                    await userManager.setApiKey(service, key, userPassword, currentUsername);
                    effectiveOutput(`API key for ${service} set successfully.`);
                } else if (service === 'github-token') {
                    await userManager.setGitHubConfig(currentUsername, userPassword, { token: key });
                    effectiveOutput(`GitHub token set successfully.`);
                } else if (service === 'github-owner') {
                    await userManager.setGitHubConfig(currentUsername, userPassword, { owner: key });
                    effectiveOutput(`GitHub owner set to: ${key}`);
                } else if (service === 'github-repo') {
                    await userManager.setGitHubConfig(currentUsername, userPassword, { repo: key });
                    effectiveOutput(`GitHub repository set to: ${key}`);
                } else if (service === 'github-branch') {
                    const branchName = key || 'main'; // Default to 'main' if no value provided
                    await userManager.setGitHubConfig(currentUsername, userPassword, { branch: branchName });
                    effectiveOutput(`GitHub branch set to: ${branchName}`);
                } else {
                    effectiveError('Invalid service. Supported: brave, venice, github-token, github-owner, github-repo, github-branch');
                    return { success: false, error: 'Invalid service', handled: true, keepDisabled: false };
                }
                effectiveOutput(`[CMD SUCCESS] keys set: Completed successfully.`);
                return { success: true, keepDisabled: false };

            case 'check':
            case 'stat': // Alias for check
                // Call the new checkApiKeys method
                const keysStatus = await userManager.checkApiKeys(currentUsername);
                effectiveOutput('--- API Key & GitHub Status ---');
                effectiveOutput(`Brave API Key: ${keysStatus.brave ? 'Configured' : 'Not Configured'}`);
                effectiveOutput(`Venice API Key: ${keysStatus.venice ? 'Configured' : 'Not Configured'}`);
                effectiveOutput(`GitHub Config: ${keysStatus.github ? 'Configured' : 'Not Configured'}`); // Check combined config
                effectiveOutput(`[CMD SUCCESS] keys ${action}: Completed successfully.`);
                return { success: true, keepDisabled: false };

            case 'test':
                 if (!userPassword) { // Should be caught above, but double-check
                    effectiveError('Password is required to test API keys.');
                    return { success: false, error: 'Password required', handled: true, keepDisabled: false };
                }

                effectiveOutput('Testing API keys...');
                // Call the new testApiKeys method, passing username explicitly
                const testResults = await userManager.testApiKeys(userPassword, currentUsername); // Use userManager method

                effectiveOutput(`Brave API Key Test: ${testResults.brave.success === true ? 'OK' : (testResults.brave.success === false ? `Failed (${testResults.brave.error})` : 'Not Configured')}`);
                effectiveOutput(`Venice API Key Test: ${testResults.venice.success === true ? 'OK' : (testResults.venice.success === false ? `Failed (${testResults.venice.error})` : 'Not Configured')}`);
                effectiveOutput(`GitHub Token Test: ${testResults.github.success === true ? 'OK' : (testResults.github.success === false ? `Failed (${testResults.github.error})` : 'Not Configured')}`);

                // Check if *any* configured key/token failed
                let anyTestFailed = false;
                if (testResults.brave.success === false) anyTestFailed = true;
                if (testResults.venice.success === false) anyTestFailed = true;
                if (testResults.github.success === false) anyTestFailed = true;

                if (!anyTestFailed) {
                    effectiveOutput(`[CMD SUCCESS] keys test: All configured keys/tokens tested successfully or were not configured.`);
                    return { success: true, keepDisabled: false };
                } else {
                     effectiveOutput(`[CMD WARNING] keys test: One or more API key/token tests failed.`);
                    return { success: false, error: 'One or more API key/token tests failed.', handled: true, keepDisabled: false };
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

// Removed testApiKeys helper as it's now part of UserManager

export function getKeysHelpText() {
    return `API Key & GitHub Configuration Commands:
  /keys set <service> <value...>  Set API key or GitHub config. Requires password.
      Services: brave, venice, github-token, github-owner, github-repo, github-branch
      Examples:
          /keys set brave YOUR_BRAVE_KEY
          /keys set github-token YOUR_GITHUB_PAT
          /keys set github-owner your_username
          /keys set github-repo your_repository_name
          /keys set github-branch main (or leave value empty for 'main')
  /keys check | stat              Check if API keys & GitHub config are set.
  /keys test                      Test configured API keys & GitHub token. Requires password.
  /keys help                      Show this help message.`;
}