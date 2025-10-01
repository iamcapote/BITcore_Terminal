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
// --- FIX: Comment out missing import ---
// import { GitHubIntegration } from '../utils/github.utils.mjs';
// --- FIX: Remove unused uploadFileToGitHub import ---
// import { uploadFileToGitHub } from '../infrastructure/storage/github.storage.mjs';
import { ensureDir } from '../utils/research.ensure-dir.mjs'; // Import ensureDir
import inquirer from 'inquirer'; // Using inquirer for CLI prompts
import WebSocket from 'ws'; // Import WebSocket for type checking
// --- FIX: Remove unused runResearch import ---
// import { runResearch } from '../features/research/research.controller.mjs';
import { cleanQuery } from '../utils/research.clean-query.mjs';
import { output } from '../utils/research.output-manager.mjs'; // Use the output manager
import { singlePrompt } from '../utils/research.prompt.mjs'; // For CLI prompts
import { saveToFile } from '../utils/research.file-utils.mjs'; // For saving results
import { createMemoryService } from '../features/memory/memory.service.mjs';
import {
    fetchMemoryIntelligence,
    deriveMemoryFollowUpQueries,
    projectMemorySuggestions
} from '../utils/research.memory-intelligence.mjs';
import { resolveResearchDefaults } from '../features/research/research.defaults.mjs';
import { resolveServiceApiKey } from '../utils/api-keys.mjs';

// --- Remove freshUserManager import ---
// import { userManager as freshUserManager } from '../features/auth/user-manager.mjs';

// Keep track of the active readline interface to avoid conflicts
let activeRlInstance = null;

const PROMPT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const POST_RESEARCH_PROMPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for post-research action

const sharedMemoryService = createMemoryService();
const MEMORY_CONTEXT_MAX_RECORDS = 5;

/**
 * CLI command for executing research.
 * @param {Object} options - Command options including positionalArgs, flags, session, output/error handlers.
 * @param {string} [options.action='run'] - The subcommand (should always be 'run' now).
 * @param {string[]} options.positionalArgs - Positional arguments (query parts).
 * @param {string} [options.query] - Query string (for 'run' action).
 * @param {number} options.depth - Research depth (for 'run' action).
 * @param {number} options.breadth - Research breadth (for 'run' action).
 * @param {boolean} options.classify - Use token classification (for 'run' action).
 * @param {boolean} options.verbose - Enable verbose logging.
 * @param {string} [options.password] - Password provided via args/payload/cache/prompt.
 * @param {boolean} [options.isWebSocket=false] - Indicates if called via WebSocket.
 * @param {object} [options.session] - WebSocket session object.
 * @param {Function} options.output - Output function (log or WebSocket send).
 * @param {Function} options.error - Error function (error or WebSocket send).
 * @param {object} [options.currentUser] - User data object if authenticated.
 * @param {WebSocket} [options.webSocketClient] - WebSocket client instance.
 * @param {Function} [options.wsPrompt] - WebSocket prompt function.
 * @returns {Promise<Object>} Command result or error object. Contains `researchComplete: true` on success.
 */
export async function executeResearch(options = {}) {
    // Log received options at the very beginning, masking password
    const initialLogOptions = { ...options };
    if (initialLogOptions.password) initialLogOptions.password = '******';
    // Avoid logging potentially large session object directly
    initialLogOptions.session = initialLogOptions.session ? `{ sessionId: ${initialLogOptions.session.sessionId}, user: ${initialLogOptions.session.username}, ... }` : null;
    // Mask currentUser password if present
    if (initialLogOptions.currentUser?.passwordHash) initialLogOptions.currentUser.passwordHash = '******';
    if (initialLogOptions.currentUser?.salt) initialLogOptions.currentUser.salt = '******';
    if (initialLogOptions.currentUser?.encryptedApiKeys) initialLogOptions.currentUser.encryptedApiKeys = '{...}';
    if (initialLogOptions.currentUser?.encryptedGitHubToken) initialLogOptions.currentUser.encryptedGitHubToken = '******';

    console.log(`[executeResearch] Received options:`, JSON.stringify(initialLogOptions, (key, value) => key === 'webSocketClient' ? '[WebSocket Object]' : value).substring(0, 1000));


    const {
        positionalArgs = [],
        query: queryFromOptions,
        depth: depthOverride,
        breadth: breadthOverride,
        isPublic: visibilityOverride,
        classify = false,
        verbose = false,
        password, // This is the password passed in options (from cache, payload, or prompt)
        isWebSocket = false,
        session,
        output: cmdOutput, // Renamed from options.output
        error: cmdError,   // Renamed from options.error
        currentUser,
        webSocketClient,
        telemetry,
        // --- FIX: Add wsPrompt ---
        wsPrompt: cmdPrompt, // Renamed from options.wsPrompt
        // --- Ensure debug is correctly destructured and has a default ---
        debug = options.verbose ? outputManagerInstance.debug.bind(outputManagerInstance) : () => {}, // Default to no-op if not verbose
        progressHandler: providedProgressHandler
    } = options;

    const { depth, breadth, isPublic } = await resolveResearchDefaults({
        depth: depthOverride,
        breadth: breadthOverride,
        isPublic: visibilityOverride,
    });

    Object.assign(options, { depth, breadth, isPublic });

    const telemetryChannel = telemetry ?? null;

    // --- FIX: Define effective handlers outside try block ---
    const effectiveOutput = cmdOutput;
    const effectiveError = cmdError;
    const effectiveDebug = isWebSocket
        ? (msg) => { if (session?.debug || verbose) effectiveOutput(`[DEBUG] ${msg}`); } // Use effectiveOutput
        : (msg) => { if (verbose) console.log(`[DEBUG] ${msg}`); };
    const effectivePrompt = isWebSocket ? cmdPrompt : singlePrompt;
    const effectiveProgress = (progressData = {}) => {
        const emittedEvent = telemetryChannel ? telemetryChannel.emitProgress(progressData) : null;
        const enrichedProgress = emittedEvent
            ? { ...progressData, eventId: emittedEvent.id, timestamp: emittedEvent.timestamp }
            : { ...progressData };

        if (typeof providedProgressHandler === 'function') {
            try {
                providedProgressHandler(enrichedProgress);
            } catch (handlerError) {
                console.error('[executeResearch] progressHandler threw an error:', handlerError);
            }
        } else if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'progress', data: enrichedProgress });
        } else if (verbose) {
            console.log('[research-progress]', enrichedProgress);
        }
    };
    // --- End FIX ---

    const commandStartedAt = Date.now();
    let researchStartedAt = null;
    telemetryChannel?.emitStatus({ stage: 'initializing', message: 'Validating research command options.' });

    // --- BLOCK PUBLIC USERS ---
    if (currentUser && currentUser.role === 'public') {
        effectiveError('Research command is not available for public users. Please /login to use this feature.');
        return { success: false, error: 'Permission denied for public user', handled: true, keepDisabled: false }; // Enable input after error
    }

    // Determine query for 'run' action
    // --- Query now comes ONLY from positionalArgs or options.query ---
    let researchQuery = positionalArgs.join(' ').trim() || queryFromOptions;
    // --- FIX: Define action variable (assuming 'run' is the only action now) ---
    const action = 'run';
    const needsPassword = action === 'run'; // For clarity in catch block

    try {
        // --- FIX: Add check for valid output/error functions ---
        if (typeof effectiveOutput !== 'function') {
            console.error("[executeResearch] CRITICAL: effectiveOutput is not a function.", options);
            // Cannot send error back to client easily here, log and maybe throw
            throw new Error("Internal server error: Output handler misconfigured.");
        }
        if (typeof effectiveError !== 'function') {
            console.error("[executeResearch] CRITICAL: effectiveError is not a function.", options);
            // Log, but try to continue if possible, or throw
            throw new Error("Internal server error: Error handler misconfigured.");
        }
        // --- End FIX ---

        // --- Public User Check - Moved to the top ---
        if (currentUser && currentUser.role === 'public') {
            effectiveError('Research command is not available for public users. Please /login to use this feature.');
            return { success: false, error: 'Permission denied for public user', handled: true, keepDisabled: false }; // Enable input after error
        }
        // --- End FIX ---

        // --- Authentication Check ---
        const isAuthenticated = !!currentUser && currentUser.role !== 'public';
        const currentUsername = currentUser ? currentUser.username : 'public'; // Should not be public due to check above
        const currentUserRole = currentUser ? currentUser.role : 'public'; // Should not be public
        effectiveDebug(`[executeResearch] Authentication check: currentUser=${currentUsername}, role=${currentUserRole}, isAuthenticated=${isAuthenticated}`);

        if (!isAuthenticated) {
            // This case should be covered by the public user check above, but keep for safety
            effectiveError('You must be logged in to use the /research command.');
            return { success: false, error: 'Authentication required', handled: true, keepDisabled: false }; // Enable input after error
        }

        logCommandStart('research', options); // Log command start after initial checks

        // --- Password Handling (Get password if needed and available) ---
        let userPassword = password; // Password from handleCommandMessage or cache

        // Password check remains important for key decryption and auto-upload
        if (needsPassword && !userPassword) {
             // --- FIX: Prompt for password if needed and not available ---
             if (!effectivePrompt) {
                 effectiveError('Internal Error: Prompt function not available.');
                 // --- FIX: Return keepDisabled: false as prompt failed server-side ---
                 return { success: false, error: 'Prompt unavailable', handled: true, keepDisabled: false };
             }
             effectiveDebug("Password not provided or cached for research, prompting user.");
             // Prompt without context, as it's for key decryption here
             const promptTarget = isWebSocket ? webSocketClient : null; // Pass ws for WebSocket, null for CLI
             try {
                 userPassword = await effectivePrompt(promptTarget, session, `Enter password to access API keys/GitHub: `, 120000, true, null); // isPassword = true
                 if (!userPassword) {
                     throw new Error("Password required or prompt cancelled/timed out");
                 }
                 effectiveDebug("Password received via prompt for research.");
                 // Cache password in session if WebSocket
                 if (isWebSocket && session) {
                     session.password = userPassword;
                     effectiveDebug("Password cached in session.");
                 }
             } catch (promptError) {
                 effectiveError(`Password prompt failed: ${promptError.message}`);
                 // --- FIX: Return keepDisabled: false as prompt failed/cancelled ---
                 return { success: false, error: `Password prompt failed: ${promptError.message}`, handled: true, keepDisabled: false };
             }
        }
        // --- End Password Handling ---


        // ===========================
        // --- REMOVED Subcommand Handling for list, download, upload ---
        // ===========================

        // --- The code now proceeds directly to the RUN action ---


        // ===========================
        // --- RUN Action (Default) ---
        // ===========================
        // Condition 'action === run' removed as it's the only path

        // --- API Key Check (for 'run' action) ---
        const hasBraveKey = await userManager.hasApiKey('brave', currentUsername);
        const hasVeniceKey = await userManager.hasApiKey('venice', currentUsername);
        if (!hasBraveKey || !hasVeniceKey) {
            let missingKeys = [];
            if (!hasBraveKey) missingKeys.push('Brave');
            if (!hasVeniceKey) missingKeys.push('Venice');
            telemetryChannel?.emitStatus({
                stage: 'blocked',
                message: 'Research blocked: missing required API keys.',
                detail: `Missing: ${missingKeys.join(', ')}`
            });
            effectiveError(`Missing API key(s) required for research: ${missingKeys.join(', ')}. Use /keys set to configure.`);
            return { success: false, error: `Missing API key(s): ${missingKeys.join(', ')}`, handled: true, keepDisabled: false };
        }

        // --- Get API Keys (Requires Password - already handled above) ---
        let braveKey, veniceKey;
        try {
            effectiveDebug(`[executeResearch] Resolving API keys for ${currentUsername}...`);
            braveKey = await resolveServiceApiKey('brave', { session });
            veniceKey = await resolveServiceApiKey('venice', { session });

            if (!braveKey || !veniceKey) {
                const missing = [
                    !braveKey ? 'Brave' : null,
                    !veniceKey ? 'Venice' : null,
                ].filter(Boolean).join(', ');
                throw new Error(`Missing required API key(s): ${missing || 'unknown'}`);
            }

            effectiveDebug('[executeResearch] API keys resolved successfully.');
        } catch (keyResolutionError) {
            effectiveError(`Unable to resolve API key(s): ${keyResolutionError.message}. Configure them via /keys set or environment variables.`);
            telemetryChannel?.emitStatus({
                stage: 'blocked',
                message: 'Missing required API keys.',
                detail: keyResolutionError.message
            });
            return { success: false, error: keyResolutionError.message, handled: true, keepDisabled: false };
        }
        telemetryChannel?.emitStatus({
            stage: 'auth',
            message: 'API keys resolved successfully.'
        });

        // --- Final Query Check ---
        if (!researchQuery) {
             if (isWebSocket) {
                // This indicates an issue in handleCommandMessage's interactive flow
                effectiveError('Internal Error: Research query is missing in WebSocket mode after prompt.');
                return { success: false, error: 'Query required', handled: true, keepDisabled: false };
            } else { // CLI prompt
                researchQuery = await singlePrompt('What would you like to research? ');
                if (!researchQuery) {
                    effectiveError('Research query cannot be empty.');
                    return { success: false, error: 'Empty query', handled: true };
                }
            }
        }

        telemetryChannel?.emitThought({
            text: `Research focus: ${researchQuery}`,
            stage: 'planning'
        });
        telemetryChannel?.emitStatus({
            stage: 'planning',
            message: 'Research query accepted.',
            meta: {
                depth,
                breadth,
                visibility: isPublic ? 'public' : 'private'
            }
        });

        // --- Token Classification ---
        let enhancedQuery = { original: researchQuery };
        let useClassifier = classify;
         if (useClassifier) {
            effectiveOutput('Attempting token classification...', true);
            telemetryChannel?.emitStatus({
                stage: 'classification',
                message: 'Running token classifier to enrich query.'
            });
            try {
                const tokenResponse = await callVeniceWithTokenClassifier(researchQuery, veniceKey);
                if (tokenResponse) {
                    enhancedQuery.tokenClassification = tokenResponse;
                    enhancedQuery.metadata = tokenResponse; // Also add as metadata for summary
                    effectiveOutput('Token classification successful.', true);
                    effectiveOutput(`[TokenClassifier] Metadata:\n${JSON.stringify(tokenResponse, null, 2)}`);
                    telemetryChannel?.emitThought({
                        text: 'Token classifier metadata captured.',
                        stage: 'classification',
                        meta: { keys: Object.keys(tokenResponse || {}) }
                    });
                } else {
                    effectiveOutput('Token classification returned no data.', true);
                }
            } catch (tokenError) {
                effectiveError(`Token classification failed: ${tokenError.message}. Proceeding without.`);
                telemetryChannel?.emitStatus({
                    stage: 'classification',
                    message: 'Token classifier failed; continuing without metadata.',
                    detail: tokenError.message
                });
            }
        }

        let memoryContext = null;
        const canSampleMemory = Boolean(sharedMemoryService && (currentUser?.username || currentUsername));
        if (canSampleMemory) {
            if (telemetryChannel) {
                telemetryChannel.emitStatus({
                    stage: 'memory',
                    message: 'Sampling memory intelligence for context.'
                });
            }

            try {
                memoryContext = await fetchMemoryIntelligence({
                    query: researchQuery,
                    memoryService: sharedMemoryService,
                    user: currentUser,
                    fallbackUsername: currentUsername,
                    limit: MEMORY_CONTEXT_MAX_RECORDS,
                    logger: effectiveDebug
                });

                const recordCount = memoryContext?.records?.length ?? 0;

                if (telemetryChannel && memoryContext?.telemetryPayload) {
                    telemetryChannel.emitMemoryContext(memoryContext.telemetryPayload);
                }

                if (telemetryChannel) {
                    if (recordCount > 0) {
                        telemetryChannel.emitThought({
                            text: `Loaded ${recordCount} memory snippet${recordCount === 1 ? '' : 's'} for context.`,
                            stage: 'memory',
                            meta: {
                                layers: Array.from(
                                    new Set(memoryContext.records.map((record) => record.layer).filter(Boolean))
                                ).slice(0, 4)
                            }
                        });
                    } else {
                        telemetryChannel.emitThought({
                            text: 'No matching memory snippets found; continuing with live research.',
                            stage: 'memory'
                        });
                    }
                }
            } catch (memoryError) {
                effectiveDebug(`[executeResearch] Memory intelligence fetch failed: ${memoryError.message}`);
                console.warn('[executeResearch] Memory intelligence fetch failed:', memoryError);
                if (telemetryChannel) {
                    telemetryChannel.emitStatus({
                        stage: 'memory-warning',
                        message: 'Memory intelligence unavailable.',
                        detail: memoryError.message
                    });
                }
            }
        }

        const overrideQueries = memoryContext?.records?.length
            ? deriveMemoryFollowUpQueries({
                baseQuery: researchQuery,
                memoryContext,
                maxQueries: MEMORY_CONTEXT_MAX_RECORDS
            })
            : [];

        const telemetrySuggestions = projectMemorySuggestions(overrideQueries);

        if (telemetryChannel && telemetrySuggestions.length) {
            telemetryChannel.emitSuggestions({
                source: 'memory',
                suggestions: telemetrySuggestions
            });
        }

        if (overrideQueries.length && telemetryChannel) {
            telemetryChannel.emitStatus({
                stage: 'memory-prioritization',
                message: `Injecting ${overrideQueries.length} memory-guided follow-up queries.`
            });
            telemetryChannel.emitThought({
                text: `Prioritizing ${overrideQueries.length} memory-guided follow-up queries before generating new leads.`,
                stage: 'planning',
                meta: {
                    memorySeeded: true,
                    memoryIds: overrideQueries
                        .map((entry) => entry.metadata?.memoryId)
                        .filter(Boolean)
                        .slice(0, 4)
                }
            });
        }

        // --- Initialize Research Engine ---
        const userInfo = { username: currentUsername, role: currentUserRole };
        const engineConfig = {
            braveApiKey: braveKey,
            veniceApiKey: veniceKey,
            verbose: verbose,
            user: userInfo,
            outputHandler: effectiveOutput,
            errorHandler: effectiveError,
            debugHandler: effectiveDebug,
            progressHandler: effectiveProgress,
            telemetry: telemetryChannel,
            isWebSocket: isWebSocket,
            webSocketClient: webSocketClient
        };
        if (overrideQueries.length) {
            engineConfig.overrideQueries = overrideQueries;
        }
        const controller = new ResearchEngine(engineConfig);

        // --- Run Research ---
    effectiveOutput(`Starting research pipeline... (depth ${depth}, breadth ${breadth}, ${isPublic ? 'public' : 'private'} visibility)`, true);
        telemetryChannel?.emitStatus({
            stage: 'running',
            message: 'Executing research pipeline.',
            meta: {
                depth,
                breadth,
                query: enhancedQuery.original,
                visibility: isPublic ? 'public' : 'private'
            }
        });
        telemetryChannel?.emitThought({
            text: `Initiating research for "${enhancedQuery.original}"`,
            stage: 'running'
        });
        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'research_start', keepDisabled: true });
        }

    researchStartedAt = Date.now();

        const results = await controller.research({
            query: enhancedQuery,
            depth,
            breadth
        });

        // --- Output Results ---
        if (results && results.success !== false) { // Check if research didn't explicitly fail
            // ...existing code...

            // --- Store result markdown content in session for post-research actions ---
            if (results.markdownContent && isWebSocket && session) {
                session.currentResearchResult = results.markdownContent; // Store the actual markdown
                session.currentResearchFilename = results.suggestedFilename; // Store the suggested filename
                // --- FIX: Store promptData needed by handleInputMessage ---
                session.promptData = { suggestedFilename: results.suggestedFilename };
                effectiveDebug("Stored research markdown content and suggested filename in session and promptData.");
                // --- FIX: Store password in session for post-research actions ---
                if (session.password !== userPassword) session.password = userPassword;
            } else if (results.suggestedFilename && isWebSocket && session) {
                effectiveError(`Internal Warning: Suggested filename exists but markdown content is missing in session ${session.sessionId}.`);
            }
            // --- Always inform user about session-only persistence ---
            // Message moved to prompt handler
        } else {
            // Handle case where research failed within the engine
            effectiveError(`Research failed: ${results?.error || 'Unknown error during research execution.'}`);
            // No prompt needed if research failed
            return { success: false, error: results?.error || 'Research failed', handled: true, keepDisabled: false };
        }

        if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, {
                type: 'research_complete',
                summary: results?.summary,
                suggestedFilename: results?.suggestedFilename,
                keepDisabled: true
            });
        }

        // --- Send Prompt or Finalize (WebSocket vs CLI) ---
        if (isWebSocket && webSocketClient) {
            // --- Use wsPrompt for post-research action ---
            effectiveOutput("Research complete. Choose an action:"); // Inform user prompt is coming

            if (!effectivePrompt) {
                effectiveError("Internal Error: Prompt function not available for post-research action.");
                return { success: true, results, keepDisabled: false }; // Enable input if prompt fails
            }

            try {
                // Initiate the server-side prompt
                // No need to await here, handleCommandMessage returns keepDisabled=true
                effectivePrompt(
                    webSocketClient,
                    session,
                    `Choose action for "${results.suggestedFilename || 'research results'}": [Download] | [Upload] | [Keep] | [Discard]`,
                    120000, // 2 minute timeout
                    false, // Not a password prompt
                    'post_research_action' // Set context for handleInputMessage
                );
                // --- FIX: Ensure password is available for post-research actions ---
                if (session.password !== userPassword) session.password = userPassword;
                // --- END FIX ---
                effectiveDebug(`Post-research action prompt sent. Server awaits response via handleInputMessage with context 'post_research_action'.`);
                // Keep input disabled, handleInputMessage will re-enable it after processing the choice.

            } catch (promptError) { // This catch might not be hit if effectivePrompt doesn't throw synchronously
                effectiveError(`Post-research action prompt failed or timed out: ${promptError.message}`);
                // Ensure input is re-enabled if the prompt fails server-side before sending
                return { success: true, results, keepDisabled: false };
            }
            // --- End wsPrompt ---

        } else {
            // CLI mode: Just finish
            effectiveOutput(`[CMD SUCCESS] research: Completed successfully.`);
            // Output the markdown content directly in CLI mode?
            if (results.markdownContent) {
                effectiveOutput("\n--- Research Content ---");
                effectiveOutput(results.markdownContent);
                effectiveOutput("--- End Content ---");
            }
            // No automatic upload here anymore
        }

        const completionDuration = Date.now() - (researchStartedAt || commandStartedAt);
        telemetryChannel?.emitComplete({
            success: true,
            durationMs: completionDuration,
            learnings: results?.learnings?.length || 0,
            sources: results?.sources?.length || 0,
            suggestedFilename: results?.suggestedFilename || null,
            summary: results?.summary || null
        });

        // Return success state for command handler logic
        // Keep input disabled if WebSocket because a prompt is now pending
        return { success: true, results: results, keepDisabled: isWebSocket };

        // --- This part should ideally not be reached ---
        // effectiveError(`Unknown research action: ${action}. Only 'run' is supported directly.`);
        // return { success: false, error: `Unknown action: ${action}`, handled: true, keepDisabled: false };
    } catch (error) {
        // --- FIX: Use effectiveError defined outside the try block ---
        effectiveError(`Error during research command: ${error.message}`);
        console.error(error.stack); // Keep stack trace log
        const failureDuration = Date.now() - (researchStartedAt || commandStartedAt);
        telemetryChannel?.emitStatus({
            stage: 'error',
            message: 'Research command failed.',
            detail: error.message
        });
        telemetryChannel?.emitComplete({
            success: false,
            durationMs: failureDuration,
            error: error.message
        });
        if (isWebSocket && webSocketClient) {
            // Send a generic completion message indicating failure
            safeSend(webSocketClient, { type: 'research_complete', error: error.message, keepDisabled: false }); // Send error completion
        }
         // Clear password cache on unexpected errors if WebSocket
        if (isWebSocket && session && needsPassword) {
             console.warn(`[WebSocket] Clearing session password due to unexpected error during research command: ${error.message}`);
             session.password = null;
        }
        return { success: false, error: error.message, handled: true, keepDisabled: false }; // Ensure input enabled on error
    }
}

// Removed promptForPassword as singlePrompt handles hidden input

// ... existing getResearchHelpText function ...
export function getResearchHelpText() {
    return `
Usage: /research <query> [--depth=<number>] [--breadth=<number>] [--classify] [--verbose]
Initiates a research task based on the provided query. Requires login.
After completion (Web UI), you will be prompted to Download, Upload (to GitHub), Keep (in session), or Discard the result.

Arguments:
  <query>          The topic or question to research. Can be multiple words.

Options:
  --depth=<number>   Specify the depth of the research (default: 2). Controls how many layers of queries are generated.
  --breadth=<number> Specify the breadth of the research (default: 3). Controls how many queries are generated per layer.
  --classify         Enhance the initial query using token classification via Venice AI (requires Venice key).
  --verbose          Enable detailed logging during the research process.

Examples:
  /research history of artificial intelligence
  /research benefits of renewable energy --depth=3 --breadth=5
  /research "impact of social media on mental health" --classify
`;
}

