import path from 'path';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import { handleCliError, ErrorTypes, logCommandStart, logCommandSuccess } from '../utils/cli-error-handler.mjs';
import readline from 'readline'; // Keep for CLI mode
import os from 'os';
import fs from 'fs/promises';
// Import the shared safeSend utility
import { safeSend } from '../utils/websocket.utils.mjs';
// Import the singleton instance for defaults if needed
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs';
// Import token classifier function (assuming it exists and handles its own errors/output)
import { callVeniceWithTokenClassifier } from '../utils/token-classifier.mjs';


/**
 * Ensures only one readline interface is active for prompts.
 * Creates its own temporary interface.
 * @param {string} query The prompt message.
 * @param {boolean} isHidden If true, mask input (for passwords).
 * @returns {Promise<string>} User's input.
 */
function singlePrompt(query, isHidden = false) {
    return new Promise((resolve, reject) => {
        // Create a temporary interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        let password = ''; // Used only if isHidden is true

        const cleanup = (err = null, value = null) => {
            if (isHidden) {
                process.stdin.removeListener('keypress', onKeypress);
                if (process.stdin.isRaw) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause(); // Ensure stdin is paused after use
            }
            rl.close(); // Close the temporary interface
            if (err) {
                reject(err);
            } else {
                resolve(value); // Resolve with the value
            }
        };

        const onKeypress = (chunk, key) => {
            if (key) {
                if (key.name === 'return' || key.name === 'enter') {
                    process.stdout.write('\n'); // Ensure newline after hidden input
                    cleanup(null, password);
                } else if (key.name === 'backspace') {
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                } else if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
                    process.stdout.write('\nCancelled.\n');
                    cleanup(null, ''); // Resolve with empty string on cancel
                } else if (!key.ctrl && !key.meta && chunk) {
                    password += chunk;
                    process.stdout.write('*');
                }
            } else if (chunk) { // Handle paste
                password += chunk;
                process.stdout.write('*'.repeat(chunk.length));
            }
        };

        if (isHidden) {
            rl.setPrompt('');
            rl.write(query);
            if (process.stdin.isRaw) process.stdin.setRawMode(false); // Ensure not already raw
            process.stdin.setRawMode(true);
            process.stdin.resume(); // Resume stdin for this prompt
            process.stdin.on('keypress', onKeypress);
        } else {
            rl.question(query, (answer) => {
                cleanup(null, answer.trim()); // Resolve with the answer
            });
        }

        rl.on('error', (err) => {
            console.error("Readline error during prompt:", err);
            cleanup(err); // Reject on error
        });

        // Handle SIGINT (Ctrl+C) during rl.question (for non-hidden prompts)
        rl.on('SIGINT', () => {
            if (!isHidden) {
                process.stdout.write('\nCancelled.\n');
                cleanup(null, ''); // Resolve with empty string on cancel
            }
            // For hidden prompts, SIGINT is handled in onKeypress
        });
    });
}


/**
 * CLI command for executing the research pipeline. Accepts a single options object.
 * @param {Object} options - Command options including positionalArgs, flags, session, output/error handlers.
 * @param {string[]} options.positionalArgs - Positional arguments (query parts)
 * @param {string} [options.query] - Query string, potentially from interactive prompts.
 * @param {number} options.depth - Research depth
 * @param {number} options.breadth - Research breadth
 * @param {boolean} options.classify - Use token classification
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {string} [options.password] - Password provided via args/payload/cache/prompt
 * @param {boolean} [options.isWebSocket=false] - Indicates if called via WebSocket
 * @param {object} [options.session] - WebSocket session object
 * @param {Function} options.output - Output function (log or WebSocket send)
 * @param {Function} options.error - Error function (error or WebSocket send)
 * @param {object} [options.currentUser] - User data object if authenticated.
 * @param {WebSocket} [options.webSocketClient] - WebSocket client instance.
 * @returns {Promise<Object>} Research results or error object
 */
export async function executeResearch(options = {}) {
    // Log received options at the very beginning, masking password
    const initialLogOptions = { ...options };
    if (initialLogOptions.password) initialLogOptions.password = '******';
    if (initialLogOptions.session?.password) initialLogOptions.session.password = '******';
    // Mask currentUser password if present
    if (initialLogOptions.currentUser?.password) initialLogOptions.currentUser.password = '******';
    console.log(`[executeResearch] Received options:`, JSON.stringify(initialLogOptions, (key, value) => key === 'webSocketClient' ? '[WebSocket Object]' : value).substring(0, 500));

    const {
        positionalArgs = [], // Use positionalArgs from options
        query: queryFromOptions, // Get query directly from options
        depth = 2,
        breadth = 3,
        classify = false, // Default from options flags
        verbose = false,
        password, // Password from handleCommandMessage
        isWebSocket = false,
        session,
        output: cmdOutput, // Use passed handlers
        error: cmdError,   // Use passed handlers
        currentUser, // Use passed user data
        webSocketClient // Use passed client instance
    } = options;

    // Determine effective output/error handlers (already done via options)
    const effectiveOutput = cmdOutput;
    const effectiveError = cmdError;
    const effectiveDebug = isWebSocket
        ? (msg) => { if (session?.debug || verbose) cmdOutput(`[DEBUG] ${msg}`); } // Check verbose flag too
        : (msg) => { if (verbose) console.log(`[DEBUG] ${msg}`); }; // Simple console debug

    // --- NEW: Define progress handler ---
    const effectiveProgress = isWebSocket && webSocketClient
        ? (progressData) => {
            // Send progress updates via WebSocket
            safeSend(webSocketClient, { type: 'progress', data: progressData });
          }
        : (progressData) => {
            // Log progress to console in CLI mode (optional, can be noisy)
            if (verbose) {
                console.log(`[Progress] Status: ${progressData.status}, Queries: ${progressData.completedQueries}/${progressData.totalQueries || '?'}, Depth: ${progressData.currentDepth}/${progressData.totalDepth}`);
            }
          };
    // --- End NEW ---


    // --- Determine the effective research query ---
    let researchQuery = positionalArgs.join(' ').trim();
    if (!researchQuery && queryFromOptions) {
        // Use query from options if positionalArgs were empty (e.g., interactive flow)
        researchQuery = queryFromOptions;
        effectiveDebug(`[executeResearch] Using query from options: "${researchQuery}"`);
    } else if (researchQuery && queryFromOptions && researchQuery !== queryFromOptions) {
        // Log if both are present but different (unlikely scenario)
        effectiveDebug(`[executeResearch] Warning: Query from positional args ("${researchQuery}") differs from options.query ("${queryFromOptions}"). Using positional args.`);
    } else if (!researchQuery && !queryFromOptions) {
        effectiveDebug(`[executeResearch] No query provided via positional args or options.query.`);
        // The interactive prompt logic below will handle this for CLI mode.
        // For WebSocket, an error will be thrown if query is still missing.
    }
    // --- End Determine Query ---

    try {
        effectiveDebug(`[CMD START] research: Query='${researchQuery}', Depth=${depth}, Breadth=${breadth}, Classify=${classify}, Verbose=${verbose}`);
        effectiveDebug(`[executeResearch] Password received in options: ${password ? '******' : 'Not provided'}`);

        // --- Authentication Check ---
        // ** Use the currentUser object passed in options **
        const isAuthenticated = !!currentUser && currentUser.role !== 'public';
        const currentUsername = currentUser ? currentUser.username : 'public';
        const currentUserRole = currentUser ? currentUser.role : 'public';
        effectiveDebug(`[executeResearch] Authentication check: currentUser=${currentUsername}, role=${currentUserRole}, isAuthenticated=${isAuthenticated}`);

        if (!isAuthenticated) {
            effectiveError('You must be logged in to use the /research command.');
            return { success: false, error: 'Authentication required', handled: true, keepDisabled: false };
        }

        // --- API Key Check ---
        const hasBraveKey = await userManager.hasApiKey('brave', currentUsername);
        const hasVeniceKey = await userManager.hasApiKey('venice', currentUsername);
        if (!hasBraveKey || !hasVeniceKey) {
            let missingKeys = [];
            if (!hasBraveKey) missingKeys.push('Brave');
            if (!hasVeniceKey) missingKeys.push('Venice');
            effectiveError(`Missing API key(s) required for research: ${missingKeys.join(', ')}. Use /keys set to configure.`);
            return { success: false, error: `Missing API key(s): ${missingKeys.join(', ')}`, handled: true, keepDisabled: false };
        }


        // --- Password Handling & Key Decryption ---
        let userPassword = password; // Password from handleCommandMessage
        effectiveDebug(`[executeResearch] userPassword initialized with: ${userPassword ? '******' : 'Not provided'}`);

        // --- CLI Specific Password Prompt (Fallback) ---
        if (!userPassword && !isWebSocket) {
            userPassword = await singlePrompt('Please enter your password to decrypt API keys: ', true);
            if (!userPassword) {
                effectiveError('Password is required to decrypt API keys.');
                return { success: false, error: 'Password required', handled: true }; // CLI mode return
            }
            // Optionally cache for CLI session if userManager supports it
            // userManager.cliSessionPassword = userPassword;
            effectiveDebug("Password obtained via prompt for CLI research.");
        }
        // Error if WebSocket mode and password wasn't provided/cached/prompted by handleCommandMessage
        // ** This check should happen *before* attempting to get keys if a password is required **
        // Let's move the key retrieval into a block that checks for the password first.

        // --- Get API Keys ---
        let braveKey, veniceKey;

        // Check if we have the password needed for decryption
        if (!userPassword) {
            // If password is required (checked in handleCommandMessage) but not available here, it's an error.
            // This covers the case where the prompt failed or was bypassed incorrectly.
            effectiveError('Internal Error: Password required for API keys but not available.');
            // Add more context
            console.error(`[executeResearch] Error condition: userPassword is falsy (${userPassword}), isWebSocket=${isWebSocket}, currentUser=${currentUsername}`);
            return { success: false, error: 'Password required but missing', handled: true, keepDisabled: false };
        }

        // Now attempt decryption using the available userPassword
        try {
            effectiveDebug(`[executeResearch] Attempting to get API keys for ${currentUsername} using provided password...`);
            braveKey = await userManager.getApiKey('brave', userPassword, currentUsername);
            veniceKey = await userManager.getApiKey('venice', userPassword, currentUsername);
            effectiveDebug(`[executeResearch] API key retrieval attempt complete. Brave: ${braveKey ? 'OK' : 'Failed'}, Venice: ${veniceKey ? 'OK' : 'Failed'}`);
        } catch (decryptionError) {
             // Clear cached password in session if decryption fails
            if (session) {
                effectiveDebug(`[executeResearch] Clearing session password due to decryption error.`);
                session.password = null;
            }
            // if (!isWebSocket) userManager.cliSessionPassword = null; // Clear CLI cache too
            effectiveError(`Failed to decrypt API key(s): ${decryptionError.message}. Please check your password.`);
            return { success: false, error: `API key decryption failed: ${decryptionError.message}`, handled: true, keepDisabled: false };
        }

        // Check if keys were successfully retrieved *after* decryption attempt
        if (!braveKey || !veniceKey) {
            // This means decryption succeeded (no error thrown) but a key was missing, or decryption failed silently (less likely).
            // Or, more likely, the password was wrong, getApiKey threw, and we caught it above.
            // This block might be redundant if getApiKey always throws on bad password. Let's refine the error message.
            if (session) session.password = null; // Clear potentially bad password
            let failedKeys = [];
            if (!braveKey) failedKeys.push('Brave');
            if (!veniceKey) failedKeys.push('Venice');
            const errorMsg = `Failed to retrieve required API key(s): ${failedKeys.join(', ')}. Ensure keys are set and password is correct.`;
            effectiveError(errorMsg);
            return { success: false, error: errorMsg, handled: true, keepDisabled: false };
        }
        // If we reach here, keys are decrypted successfully.
        effectiveDebug(`[executeResearch] API keys successfully decrypted and retrieved.`);


        // --- Final Query Check & Interactive Prompt (CLI only) ---
        // Check if query is still missing after all attempts (positional, options)
        if (!researchQuery) {
            if (isWebSocket) {
                // This should not happen if handleCommandMessage correctly prompted or received a query.
                effectiveError('Internal Error: Research query is missing in WebSocket mode before execution.');
                return { success: false, error: 'Query required but missing', handled: true, keepDisabled: false };
            } else { // CLI prompt as last resort
                researchQuery = await singlePrompt('What would you like to research? ');
                if (!researchQuery) {
                    effectiveError('Research query cannot be empty.');
                    return { success: false, error: 'Empty query', handled: true };
                }
                effectiveDebug(`[executeResearch] Query obtained via CLI prompt: "${researchQuery}"`);
            }
        }
        // If we reach here, we definitely have a researchQuery

        // --- Token Classification ---
        let enhancedQuery = { original: researchQuery }; // Structure expected by engine/summary
        let useClassifier = classify; // Use flag value from options

        // Prompt for classification in interactive CLI mode if flag wasn't explicitly passed
        if (!isWebSocket && !options.hasOwnProperty('classify')) { // Check if flag was explicitly set
             const answer = await singlePrompt('Use token classification? (y/n) [n]: ');
             useClassifier = answer.toLowerCase() === 'y';
        }

        if (useClassifier) {
            effectiveOutput('Attempting token classification...', true); // Keep WS input disabled
            try {
                // Pass the decrypted Venice key directly
                const tokenResponse = await callVeniceWithTokenClassifier(researchQuery, veniceKey); // Pass key
                if (tokenResponse) {
                    enhancedQuery.tokenClassification = tokenResponse; // Add to query object
                    effectiveOutput('Token classification successful.', true); // Keep WS input disabled
                    // --- NEW: Log the metadata/token classification response ---
                    effectiveOutput(`[TokenClassifier] Venice AI response (metadata):\n${typeof tokenResponse === 'object' ? JSON.stringify(tokenResponse, null, 2) : String(tokenResponse)}`);
                } else {
                    effectiveOutput('Token classification returned no data. Proceeding without.', true); // Keep WS input disabled
                }
            } catch (tokenError) {
                effectiveError(`Token classification failed: ${tokenError.message}. Proceeding without classification.`);
                // Don't abort, just proceed without classification
            }
        }

        // --- NEW: Log the query object (input + metadata) before research ---
        effectiveOutput(`[ResearchPipeline] Query object to be used for research:`);
        effectiveOutput(JSON.stringify(enhancedQuery, null, 2));

        // --- Initialize Research Engine ---
        const userInfo = { username: currentUsername, role: currentUserRole };
        const engineConfig = {
            braveApiKey: braveKey,
            veniceApiKey: veniceKey, // Pass key to engine
            verbose: verbose,
            user: userInfo,
            outputHandler: effectiveOutput,
            errorHandler: effectiveError,
            debugHandler: effectiveDebug,
            progressHandler: effectiveProgress, // <= NEW: Pass the progress handler
            isWebSocket: isWebSocket,
            webSocketClient: webSocketClient
        };
        const controller = new ResearchEngine(engineConfig);


        // --- Run Research ---
        effectiveOutput('Starting research pipeline...', true); // Keep WS input disabled

        // Send start signal for Web-CLI
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_start', keepDisabled: true });
        }

        // Pass query object, depth, breadth directly to the research method
        const results = await controller.research({
            query: enhancedQuery, // Pass the object with original query and optional classification
            depth: parseInt(depth, 10) || 2, // Ensure integer, provide default
            breadth: parseInt(breadth, 10) || 3 // Ensure integer, provide default
        });

        // --- NEW: Print out all key research steps/results ---
        if (results) {
            if (results.generatedQueries) {
                effectiveOutput('\n--- Generated Queries ---');
                results.generatedQueries.forEach((q, i) => {
                    effectiveOutput(`${i + 1}. ${q.original}${q.metadata ? ` [metadata: ${JSON.stringify(q.metadata)}]` : ''}`);
                });
            }
            if (results.learnings) {
                effectiveOutput('\n--- Key Learnings ---');
                results.learnings.forEach((l, i) => effectiveOutput(`${i + 1}. ${l}`));
            }
            if (results.followUpQuestions) {
                effectiveOutput('\n--- Follow-up Questions ---');
                results.followUpQuestions.forEach((fq, i) => effectiveOutput(`${i + 1}. ${fq}`));
            }
            if (results.summary) {
                effectiveOutput('\n--- Research Summary ---');
                effectiveOutput(results.summary);
            }
            if (results.filename) {
                effectiveOutput(`\nResults saved to: ${results.filename}`);
            }
        }

        // --- Handle Results ---
        // Log final success message in CLI mode
         if (!isWebSocket) { // Check if running in CLI
            effectiveOutput(`[CMD SUCCESS] research: Completed successfully. Results saved to: ${results?.filename || 'N/A'}`);
        }

        // Send completion signal for Web-CLI
        if (isWebSocket && webSocketClient) {
            // Include filename in completion message
            safeSend(webSocketClient, {
                type: 'research_complete',
                summary: results?.summary || "Research finished, but no summary was generated.",
                filename: results?.filename,
                keepDisabled: false // Re-enable input
            });
        }

        // Final summary output is handled by the engine's outputHandler

        return { success: true, results: results, keepDisabled: false }; // Ensure input enabled

    } catch (error) {
        effectiveError(`Error during research command: ${error.message}`);
        console.error(error.stack); // Log full stack trace for debugging
        // Send completion signal on error for Web-CLI
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_complete', error: error.message, keepDisabled: false });
        }
        // Ensure keepDisabled is false on error to re-enable input
        return { success: false, error: error.message, handled: true, keepDisabled: false };
    }
}

// Removed promptForPassword as singlePrompt handles hidden input
