import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';
import fetch from 'node-fetch';
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs'; // Import singleton for defaults
import crypto from 'crypto'; // Needed for safeSend if used
import { safeSend } from '../utils/websocket.utils.mjs';
import { handleCliError, ErrorTypes, logCommandStart } from '../utils/cli-error-handler.mjs'; // Added logCommandStart here
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
 * @param {object} options.flags - Parsed flags (e.g., { 'github-token': '...', 'github-owner': '...' })
 * @param {string} [options.password] - Password provided via args/payload/cache/prompt (expected if user is authenticated)
 * @param {boolean} [options.isWebSocket=false] - Indicates if called via WebSocket
 * @param {object} [options.session] - WebSocket session object
 * @param {Function} options.output - Output function (log or WebSocket send)
 * @param {Function} options.error - Error function (error or WebSocket send)
 * @param {object} [options.currentUser] - User data object if authenticated.
 * @returns {Promise<Object>} Command result
 */
export async function executeKeys(options = {}) {
    const {
        positionalArgs = [],
        flags = {}, // Add flags destructuring
        password, // Password from handleCommandMessage or CLI cache
        isWebSocket = false,
        session,
        output: cmdOutput,
        error: cmdError,
        currentUser
    } = options;

    // Determine effective output/error handlers (already done via options)
    const effectiveOutput = cmdOutput;
    const effectiveError = cmdError;
    // Simple debug for WS, console debug handled by cliOutput object if passed in CLI mode
    const effectiveDebug = isWebSocket ? (msg) => { if (session?.debug) cmdOutput(`[DEBUG] ${msg}`); } : console.log;

    const action = positionalArgs[0]?.toLowerCase();
    // Service and key are now only relevant for non-GitHub set actions
    const service = positionalArgs[1]?.toLowerCase();
    const key = positionalArgs.slice(2).join(' ');

    // --- Authentication Check ---
    const isAuthenticated = !!currentUser && currentUser.role !== 'public';
    const currentUsername = currentUser ? currentUser.username : 'public';

    // Define actions requiring authentication and potentially a password internally
    const needsAuth = action === 'set' || action === 'test';

    if (needsAuth && !isAuthenticated) {
        // Block set/test if not logged in at all
        effectiveError('You must be logged in to set or test API keys.');
        return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
    }
    // Allow check/stat/help even if public/not logged in

    // --- End Authentication Check ---

    logCommandStart('keys', { ...options, action, service, flags }); // Log command start

    try {
        // Password is required internally by userManager methods for encryption/decryption/verification.
        // It should be passed via `options.password` if the user is authenticated.
        let userPassword = options.password;

        // Determine if the operation *needs* a password internally
        const isSettingBraveVenice = action === 'set' && (service === 'brave' || service === 'venice');
        // Setting GitHub config *always* requires password verification now
        const isSettingGitHub = action === 'set' && service === 'github';
        const needsPasswordInternally = (action === 'test') || isSettingBraveVenice || isSettingGitHub;

        // --- Password Verification/Prompting ---
        // If the action needs a password internally AND the user is authenticated BUT no password was provided
        // (e.g., cache expired, WebSocket session issue), report error.
        if (isAuthenticated && needsPasswordInternally && !userPassword) {
            effectiveError('Error: Password required for this operation, but it was not available. Please try logging in again.');
            // For CLI, this might mean the cache is empty/invalid. For WS, it's an issue in handleCommandMessage.
            return { success: false, error: 'Password unavailable', handled: true, keepDisabled: false };
        }

        // Only prompt in Console CLI if NOT authenticated AND password is required
        // This path should generally not be hit due to the initial auth check, but acts as a safeguard.
        const needsPasswordPromptCli = !isWebSocket && !isAuthenticated && needsPasswordInternally;
        if (needsPasswordPromptCli) {
            userPassword = await singlePrompt(`Password required for user '${currentUsername}' to perform /keys ${action}: `, true);
            if (!userPassword) {
                effectiveError('Password is required for this action.');
                return { success: false, error: 'Password required', handled: true }; // CLI return
            }
             // We don't authenticate here, just get the password to pass to userManager,
             // which will perform the actual verification.
        }
        // --- End Password Handling ---


        switch (action) {
            case 'set':
                const githubConfig = {};
                let isSettingGitHubAction = false; // Renamed to avoid conflict with needsPasswordInternally check variable

                // --- Simplified Validation ---
                if (!service) {
                    effectiveError('Usage: /keys set <service> [options]');
                    effectiveError('Services: brave, venice, github');
                    effectiveError('Example: /keys set brave <key>');
                    effectiveError('Example: /keys set github --github-owner=... --github-repo=... --github-token=...');
                    return { success: false, error: 'Missing service name', handled: true, keepDisabled: false };
                }

                if (service === 'brave' || service === 'venice') {
                    if (!key && key !== '') { // Allow empty string to clear
                        effectiveError(`Usage: /keys set ${service} <value...> (leave value empty to clear)`);
                        return { success: false, error: `Missing value for set ${service}`, handled: true, keepDisabled: false };
                    }
                    // Proceed with Brave/Venice logic below
                } else if (service === 'github') {
                    isSettingGitHubAction = true;
                    // Check for required GitHub flags - token is now optional for setting just owner/repo/branch
                    if (flags['github-owner'] === undefined || flags['github-repo'] === undefined) {
                        effectiveError(`Error: Missing required flags for 'github' service.`);
                        effectiveError('Required: --github-owner=<user_or_org> --github-repo=<repo_name>');
                        effectiveError('Optional: --github-token=<pat> --github-branch=<branch> (defaults to main)');
                        effectiveError('Example: /keys set github --github-owner=... --github-repo=... --github-token=...');
                        return { success: false, error: 'Missing required GitHub flags (owner, repo)', handled: true, keepDisabled: false };
                    }

                    // Populate githubConfig from flags
                    // Handle token: undefined if flag not present, '' if flag present but no value (clear), value otherwise
                    githubConfig.token = flags['github-token'] === undefined ? undefined : (flags['github-token'] === true ? '' : flags['github-token']);
                    githubConfig.owner = flags['github-owner'] === true ? '' : flags['github-owner']; // Allow clearing owner? Maybe not. Let's assume required.
                    githubConfig.repo = flags['github-repo'] === true ? '' : flags['github-repo'];   // Allow clearing repo? Maybe not. Let's assume required.
                    // Default branch to 'main' if flag is present without value or missing entirely
                    githubConfig.branch = flags['github-branch'] === undefined ? 'main' : (flags['github-branch'] === true ? 'main' : flags['github-branch']);

                    // Re-validate required fields after parsing
                    if (!githubConfig.owner || !githubConfig.repo) {
                         effectiveError(`Error: --github-owner and --github-repo flags require values.`);
                         return { success: false, error: 'Missing values for required GitHub flags (owner, repo)', handled: true, keepDisabled: false };
                    }

                } else {
                    effectiveError(`Invalid service '${service}'. Supported services: brave, venice, github.`);
                    return { success: false, error: `Invalid service '${service}'`, handled: true, keepDisabled: false };
                }
                // --- End Simplified Validation ---


                // Ensure password is available if needed internally (already checked above)
                if (needsPasswordInternally && !userPassword) {
                    // This check is slightly redundant due to the earlier check, but safe to keep.
                    effectiveError('Password is required internally for this operation.');
                    return { success: false, error: 'Password required', handled: true, keepDisabled: false };
                }

                // Perform the set operations
                let results = [];
                let commandSuccess = true;

                if (service === 'brave' || service === 'venice') {
                    try {
                        await userManager.setApiKey(service, key, userPassword, currentUsername);
                        results.push(`API key for ${service} ${key ? 'set' : 'cleared'} successfully.`);
                    } catch (err) {
                        results.push(`Failed to set API key for ${service}: ${err.message}`);
                        commandSuccess = false;
                    }
                } else if (isSettingGitHubAction) { // Use the flag set during validation
                    try {
                        await userManager.setGitHubConfig(currentUsername, userPassword, githubConfig);
                        results.push(`GitHub configuration updated successfully.`);
                        // Report changes based on what was provided in githubConfig
                        if (githubConfig.owner !== undefined) effectiveOutput(`GitHub owner set to: ${githubConfig.owner}.`);
                        if (githubConfig.repo !== undefined) effectiveOutput(`GitHub repository set to: ${githubConfig.repo}.`);
                        if (githubConfig.branch !== undefined) effectiveOutput(`GitHub branch set to: ${githubConfig.branch}.`);
                        if (githubConfig.token !== undefined) effectiveOutput(`GitHub token ${githubConfig.token ? 'set' : 'cleared'}.`);

                    } catch (err) {
                        results.push(`Failed to set GitHub configuration: ${err.message}`);
                        commandSuccess = false;
                    }
                }

                // Output summary
                results.forEach(res => effectiveOutput(res));

                if (commandSuccess) {
                    effectiveOutput(`[CMD SUCCESS] keys set: Operation completed.`);
                    return { success: true, keepDisabled: false };
                } else {
                    effectiveError(`[CMD FAILED] keys set: One or more operations failed.`);
                    return { success: false, error: 'One or more set operations failed.', handled: true, keepDisabled: false };
                }

            case 'check':
            case 'stat': // Alias for check
                // Call the new checkApiKeys method
                const keysStatus = await userManager.checkApiKeys(currentUsername);
                effectiveOutput('--- API Key & GitHub Status ---');
                effectiveOutput(`Brave API Key: ${keysStatus.brave ? 'Configured' : 'Not Configured'}`);
                effectiveOutput(`Venice API Key: ${keysStatus.venice ? 'Configured' : 'Not Configured'}`);
                // --- FIX: Use correct methods for GitHub config and token ---
                const githubConfigExists = await userManager.hasGitHubConfig(currentUsername);
                effectiveOutput(`GitHub Config (Owner/Repo): ${githubConfigExists ? 'Configured' : 'Not Configured'}`);
                const hasToken = await userManager.hasGitHubToken(currentUsername);
                effectiveOutput(`GitHub Token: ${hasToken ? 'Set' : 'Not Set'}`);

                effectiveOutput(`[CMD SUCCESS] keys ${action}: Completed successfully.`);
                return { success: true, keepDisabled: false };

            case 'test':
                 // Ensure password is available if needed internally
                if (needsPasswordInternally && !userPassword) {
                    effectiveError('Password is required internally to test keys.');
                     return { success: false, error: 'Password required', handled: true, keepDisabled: false };
                }

                effectiveOutput('Testing API keys...');
                // Call the new testApiKeys method, passing username explicitly
                const testResults = await userManager.testApiKeys(userPassword, currentUsername); // Use userManager method

                // Refined output based on testResults structure
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
                     // Return success: false but don't necessarily disable the command
                    return { success: false, error: 'One or more API key/token tests failed.', handled: true, keepDisabled: false };
                }


            case 'help':
            default:
                effectiveOutput(getKeysHelpText());
                return { success: true, keepDisabled: false }; // Show help is not an error
        }
    } catch (error) {
        // Use the centralized error handler
        return handleCliError(error, 'keys', { effectiveError, isWebSocket });
        // effectiveError(`Error during keys command: ${error.message}`);
        // console.error(error.stack); // Log stack trace for debugging
        // return { success: false, error: error.message, handled: true, keepDisabled: false };
    }
}

// Removed testApiKeys helper as it's now part of UserManager

export function getKeysHelpText() {
    // Updated help text for clarity and consistency
    return `API Key & GitHub Configuration Commands (Requires login for 'set' and 'test'):

  /keys set <service> [options]   Set API key or GitHub config.

  Services:
    brave     Set Brave Search API key.
    venice    Set Venice LLM API key.
    github    Set GitHub configuration for persistence.

  Options for 'brave'/'venice':
    <value...>   The API key value. Leave empty to clear.
      Example: /keys set brave YOUR_BRAVE_KEY
               /keys set venice ""

  Options for 'github':
    --github-owner=<user>     (Required) Repository owner (username or org).
    --github-repo=<name>      (Required) Repository name.
    --github-token=<pat>      (Optional) GitHub Personal Access Token (repo scope). Use --github-token="" to clear.
    --github-branch=<branch>  (Optional) Repository branch (defaults to 'main').
      Example: /keys set github --github-owner=user --github-repo=my-repo --github-token=YOUR_PAT --github-branch=dev
               /keys set github --github-owner=user --github-repo=my-repo

  Other Actions:
    /keys check | stat              Check if API keys & GitHub config/token are set.
    /keys test                      Test configured API keys & GitHub token.
    /keys help                      Show this help message.

  Note: 'set' and 'test' require your password internally, which should be handled by your current session.`;
}