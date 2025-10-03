/**
 * Why: Orchestrates the `/research` command for CLI and WebSocket clients so operators can run instrumented investigations.
 * What: Validates requests, resolves credentials, composes the research engine, and streams telemetry/output across transports.
 * How: Guard → Do → Verify pipeline coordinating password prompts, API key access, memory enrichment, research execution, and post-run actions.
 * Contract
 *   Inputs:
 *     - options: ResearchCommandOptions { positionalArgs?: string[]; query?: string; depth?: number; breadth?: number; classify?: boolean; verbose?: boolean; password?: string; isWebSocket?: boolean; session?: object; output: Function; error: Function; currentUser?: object; webSocketClient?: WebSocket; wsPrompt?: Function; telemetry?: TelemetryChannel; progressHandler?: Function; overrideQueries?: Array }
 *   Outputs:
 *     - Resolves to { success: boolean; handled?: boolean; keepDisabled?: boolean; researchComplete?: boolean; error?: string }
 *   Error modes:
 *     - Validation errors for missing handlers/query, AuthenticationError for public users, ConfigurationError when API keys unavailable, upstream ResearchEngine errors surfaced with context.
 *   Performance:
 *     - Guard/resolve work <2s (soft), research pipeline streaming; memory footprint <10 MB per run.
 *   Side effects:
 *     - Prompts for passwords, reads encrypted config, performs external network requests via ResearchEngine, emits telemetry and websocket events.
 */

import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import WebSocket from 'ws';
import { logCommandStart } from '../utils/cli-error-handler.mjs';
import { safeSend } from '../utils/websocket.utils.mjs';
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs';
import { singlePrompt } from '../utils/research.prompt.mjs';
import { createMemoryService } from '../features/memory/memory.service.mjs';
import { resolveResearchDefaults } from '../features/research/research.defaults.mjs';
import { prepareMemoryContext } from './research/memory-context.mjs';
import {
    resolveResearchKeys,
    MissingResearchKeysError,
    ResearchKeyResolutionError
} from './research/keys.mjs';
import { enrichResearchQuery } from './research/query-classifier.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
import { createResearchEmitter } from './research/emitters.mjs';
import { ensureResearchPassword } from './research/passwords.mjs';

const moduleLogger = createModuleLogger('commands.research.cli', { emitToStdStreams: false });

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

    moduleLogger.info('Received research command options.', {
        options: JSON.stringify(initialLogOptions, (key, value) => key === 'webSocketClient' ? '[WebSocket Object]' : value).substring(0, 1000)
    });


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
        overrideQueries: optionOverrideQueries = [],
        webSocketClient,
        telemetry,
        wsPrompt: cmdPrompt, // Renamed from options.wsPrompt
        // --- Ensure debug is correctly destructured and has a default ---
        debug = options.verbose ? outputManagerInstance.debug.bind(outputManagerInstance) : () => {}, // Default to no-op if not verbose
        progressHandler: providedProgressHandler
    } = options;

    if (cmdOutput && typeof cmdOutput !== 'function') {
        moduleLogger.warn('Received non-function output handler. Falling back to stdout.', {
            handlerType: typeof cmdOutput
        });
    }
    if (cmdError && typeof cmdError !== 'function') {
        moduleLogger.warn('Received non-function error handler. Falling back to stderr.', {
            handlerType: typeof cmdError
        });
    }

    const { depth, breadth, isPublic } = await resolveResearchDefaults({
        depth: depthOverride,
        breadth: breadthOverride,
        isPublic: visibilityOverride,
    });

    Object.assign(options, { depth, breadth, isPublic });

    const telemetryChannel = telemetry ?? null;

    const effectiveOutput = createResearchEmitter({ handler: cmdOutput, level: 'info', logger: moduleLogger });
    const effectiveError = createResearchEmitter({ handler: cmdError, level: 'error', logger: moduleLogger });
    const effectiveDebug = isWebSocket
        ? (msg) => { if (session?.debug || verbose) effectiveOutput(`[DEBUG] ${msg}`); }
        : (msg) => { if (verbose) moduleLogger.debug(msg); };
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
                moduleLogger.error('Progress handler threw an error.', {
                    message: handlerError?.message || String(handlerError),
                    stack: handlerError?.stack || null
                });
            }
        } else if (isWebSocket && webSocketClient) {
            safeSend(webSocketClient, { type: 'progress', data: enrichedProgress });
        } else if (verbose) {
            moduleLogger.info('Research progress event.', enrichedProgress);
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
    const action = 'run';
    const needsPassword = action === 'run'; // For clarity in catch block

    try {
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

        const { password: resolvedPassword, result: passwordFailure } = await ensureResearchPassword({
            needsPassword,
            existingPassword: userPassword,
            promptFn: effectivePrompt,
            promptTimeoutMs: PROMPT_TIMEOUT_MS,
            isWebSocket,
            session,
            webSocketClient,
            debug: effectiveDebug,
            emitError: effectiveError
        });

        if (passwordFailure) {
            return passwordFailure;
        }

        userPassword = resolvedPassword;
        // --- End Password Handling ---


        // ===========================
        // --- REMOVED Subcommand Handling for list, download, upload ---
        // ===========================

        // --- The code now proceeds directly to the RUN action ---


        // ===========================
        // --- RUN Action (Default) ---
        // ===========================
        // Condition 'action === run' removed as it's the only path

        let braveKey;
        let veniceKey;
        try {
            ({ braveKey, veniceKey } = await resolveResearchKeys({
                username: currentUsername,
                session,
                telemetry: telemetryChannel,
                debug: effectiveDebug
            }));
        } catch (keyError) {
            if (keyError instanceof MissingResearchKeysError) {
                const missingLabel = keyError.missingKeys.join(', ');
                effectiveError(`Missing API key(s) required for research: ${missingLabel}. Use /keys set to configure.`);
                return { success: false, error: keyError.message, handled: true, keepDisabled: false };
            }
            if (keyError instanceof ResearchKeyResolutionError) {
                effectiveError(`Unable to resolve API key(s): ${keyError.message}. Configure them via /keys set or environment variables.`);
                return { success: false, error: keyError.message, handled: true, keepDisabled: false };
            }
            throw keyError;
        }

        if (!researchQuery) {
             if (isWebSocket) {
                effectiveError('Internal Error: Research query is missing in WebSocket mode after prompt.');
                return { success: false, error: 'Query required', handled: true, keepDisabled: false };
            }
            researchQuery = await singlePrompt('What would you like to research? ');
            if (!researchQuery) {
                effectiveError('Research query cannot be empty.');
                return { success: false, error: 'Empty query', handled: true };
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

        const enhancedQuery = await enrichResearchQuery({
            query: researchQuery,
            classify,
            veniceKey,
            output: effectiveOutput,
            error: effectiveError,
            telemetry: telemetryChannel
        });

        if (isWebSocket && session) {
            session.currentResearchQuery = enhancedQuery?.original || researchQuery;
            session.currentResearchResult = null;
            session.currentResearchFilename = null;
        }

        const { overrideQueries: memoryOverrides } = await prepareMemoryContext({
            query: researchQuery,
            memoryService: sharedMemoryService,
            user: currentUser,
            fallbackUsername: currentUsername,
            limit: MEMORY_CONTEXT_MAX_RECORDS,
            telemetry: telemetryChannel,
            debug: effectiveDebug
        });

        const combinedOverrideQueries = [
            ...(Array.isArray(optionOverrideQueries) ? optionOverrideQueries : []),
            ...memoryOverrides
        ];

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
        if (combinedOverrideQueries.length) {
            engineConfig.overrideQueries = combinedOverrideQueries;
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

            // --- Store result markdown content in session for post-research actions ---
            if (results.markdownContent && isWebSocket && session) {
                session.currentResearchResult = results.markdownContent; // Store the actual markdown
                session.currentResearchFilename = results.suggestedFilename; // Store the suggested filename
                session.promptData = { suggestedFilename: results.suggestedFilename };
                effectiveDebug("Stored research markdown content and suggested filename in session and promptData.");
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
                    POST_RESEARCH_PROMPT_TIMEOUT_MS,
                    false, // Not a password prompt
                    'post_research_action' // Set context for handleInputMessage
                );
                if (session.password !== userPassword) session.password = userPassword;
                effectiveDebug("Post-research action prompt sent. Server awaits response via handleInputMessage with context 'post_research_action'.");
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
        effectiveError(`Error during research command: ${error.message}`);
        moduleLogger.error('Unhandled error during research command.', {
            message: error?.message || String(error),
            stack: error?.stack || null
        });
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
             moduleLogger.warn('Clearing session password after research command failure.', {
                message: error?.message || String(error),
                sessionId: session?.sessionId || null
             });
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

