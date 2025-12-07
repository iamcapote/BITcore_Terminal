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

import { safeSend } from '../utils/websocket.utils.mjs';
import { output as outputManagerInstance } from '../utils/research.output-manager.mjs';
import { singlePrompt } from '../utils/research.prompt.mjs';
import {
    resolveResearchDefaults,
    validateDepthOverride,
    validateBreadthOverride,
    validateVisibilityOverride,
    RESEARCH_RANGE_LIMITS
} from '../features/research/research.defaults.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
import { createResearchEmitter } from './research/emitters.mjs';
import { ensureResearchPassword } from './research/passwords.mjs';
import { sanitizeResearchOptionsForLog } from './research/logging.mjs';
import { persistSessionFromRef } from '../infrastructure/session/session.store.mjs';
import { runResearchWorkflow } from './research/run-workflow.mjs';
import { resolveResearchAction, isResearchArchiveAction, isResearchPreferencesAction } from './research/action-resolver.mjs';
import { listResearchArchive, downloadResearchArchive } from './research/archive-actions.mjs';
import { ensureResearchTelemetryChannel } from '../features/research/research.telemetry.metrics.mjs';
import {
    getResearchPreferences,
    updateResearchPreferences,
    resetResearchPreferences
} from '../features/preferences/index.mjs';

const moduleLogger = createModuleLogger('commands.research.cli', { emitToStdStreams: false });

const PROMPT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Error formatting helper keeps user-facing failures consistent and actionable.
function formatResearchError(error, { stage = 'pipeline', query = null } = {}) {
    const rawMessage = error?.message || String(error) || 'Unknown failure.';
    const normalized = rawMessage.replace(/\s+/g, ' ').trim();
    const messageWithPeriod = normalized.endsWith('.') ? normalized : `${normalized}.`;
    const stageLabel = stage ? stage : 'pipeline';
    const querySuffix = query ? ` Query: "${String(query).slice(0, 120)}".` : '';
    const guidance = ' Try again with --verbose for diagnostics, verify /keys stat, or run /diagnose if the issue persists.';
    return `[Research ${stageLabel}] ${messageWithPeriod}${querySuffix}${guidance}`;
}

function normalizeOptionalBoolean(value) {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === null) return undefined;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return true;
        }
        if (['true', '1', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'off', 'disable', 'disabled'].includes(normalized)) {
            return false;
        }
        return undefined;
    }
    return Boolean(value);
}

const PREFERENCE_DEPTH_FLAGS = Object.freeze(['depth', 'default-depth', 'defaults-depth']);
const PREFERENCE_BREADTH_FLAGS = Object.freeze(['breadth', 'default-breadth', 'defaults-breadth']);
const PREFERENCE_PUBLIC_FLAGS = Object.freeze(['public', 'is-public', 'visibility']);

function pickFlagValue(flags = {}, keys = []) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(flags, key)) {
            return flags[key];
        }
    }
    return undefined;
}

function buildResearchPreferencesPatchFromFlags(flags = {}) {
    if (!flags || typeof flags !== 'object') {
        return null;
    }

    const defaults = {};
    let mutated = false;

    const depthCandidate = pickFlagValue(flags, PREFERENCE_DEPTH_FLAGS);
    if (depthCandidate !== undefined) {
        const validation = validateDepthOverride(depthCandidate);
        if (!validation.ok) {
            const { min, max } = RESEARCH_RANGE_LIMITS.depth;
            throw new Error(validation.error || `Depth must be between ${min} and ${max}.`);
        }
        if (validation.provided && validation.value !== undefined) {
            defaults.depth = validation.value;
            mutated = true;
        }
    }

    const breadthCandidate = pickFlagValue(flags, PREFERENCE_BREADTH_FLAGS);
    if (breadthCandidate !== undefined) {
        const validation = validateBreadthOverride(breadthCandidate);
        if (!validation.ok) {
            const { min, max } = RESEARCH_RANGE_LIMITS.breadth;
            throw new Error(validation.error || `Breadth must be between ${min} and ${max}.`);
        }
        if (validation.provided && validation.value !== undefined) {
            defaults.breadth = validation.value;
            mutated = true;
        }
    }

    let visibilitySet = false;
    const publicCandidate = pickFlagValue(flags, PREFERENCE_PUBLIC_FLAGS);
    if (publicCandidate !== undefined) {
        const validation = validateVisibilityOverride(publicCandidate);
        if (!validation.ok) {
            throw new Error(validation.error || 'Visibility must be set using --public/--private or boolean equivalents.');
        }
        if (validation.provided && validation.value !== undefined) {
            defaults.isPublic = validation.value;
            mutated = true;
            visibilitySet = true;
        }
    }

    if (!visibilitySet && Object.prototype.hasOwnProperty.call(flags, 'private')) {
        const privateFlag = normalizeOptionalBoolean(flags.private);
        const resolved = privateFlag === undefined ? true : privateFlag;
        defaults.isPublic = !resolved;
        mutated = true;
        visibilitySet = true;
    }

    return mutated ? { defaults } : null;
}

function formatResearchPreferencesSnapshot(preferences) {
    const lines = ['--- Research Defaults ---'];
    const depth = Number.isFinite(preferences?.defaults?.depth) ? preferences.defaults.depth : null;
    const breadth = Number.isFinite(preferences?.defaults?.breadth) ? preferences.defaults.breadth : null;
    const isPublic = typeof preferences?.defaults?.isPublic === 'boolean' ? preferences.defaults.isPublic : false;

    lines.push(`Depth: ${depth != null ? `Level ${depth}` : 'Level —'}`);
    lines.push(`Breadth: ${breadth != null ? `${breadth} source${breadth === 1 ? '' : 's'}` : '—'}`);
    lines.push(`Public visibility: ${isPublic ? 'enabled' : 'disabled'}`);
    if (preferences?.updatedAt) {
        try {
            const timestamp = new Date(preferences.updatedAt).toISOString();
            lines.push(`Updated: ${timestamp}`);
        } catch (error) {
            moduleLogger.warn('Failed to format research preferences timestamp.', {
                updatedAt: preferences.updatedAt,
                message: error?.message || String(error)
            });
        }
    }
    return lines;
}

function sendResearchPreferencesAck(handler) {
    if (typeof handler !== 'function') {
        return;
    }
    try {
        handler({ type: 'output', data: '', keepDisabled: false });
    } catch (ackError) {
        moduleLogger.warn('Failed to emit research preferences acknowledgement.', {
            message: ackError?.message || String(ackError)
        });
    }
}

async function handleResearchPreferencesAction({ flags = {}, outputHandler, errorHandler, wantsJson }) {
    const outputFn = createResearchEmitter({ handler: outputHandler, level: 'info', logger: moduleLogger });
    const errorFn = createResearchEmitter({ handler: errorHandler, level: 'error', logger: moduleLogger });

    try {
        const resetFlag = normalizeOptionalBoolean(flags.reset);
        const refreshFlag = normalizeOptionalBoolean(flags.refresh);
        let preferences;
        let action = 'read';

        if (resetFlag === true) {
            preferences = await resetResearchPreferences();
            action = 'reset';
        } else {
            const patch = buildResearchPreferencesPatchFromFlags(flags);
            if (patch) {
                preferences = await updateResearchPreferences(patch);
                action = 'update';
            } else {
                preferences = await getResearchPreferences({ refresh: refreshFlag === true });
            }
        }

        if (wantsJson) {
            outputFn(JSON.stringify(preferences, null, 2), { subcommand: 'preferences', format: 'json', action });
        } else {
            formatResearchPreferencesSnapshot(preferences).forEach((line, index) => {
                if (index === 0) {
                    outputFn(line, { subcommand: 'preferences', action });
                } else {
                    outputFn(line);
                }
            });
        }

        sendResearchPreferencesAck(outputHandler);
        moduleLogger.info('Research preferences processed.', { action, wantsJson: Boolean(wantsJson) });
        return { success: true, handled: true, preferences };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorFn(message, { subcommand: 'preferences' });
        sendResearchPreferencesAck(outputHandler);
        moduleLogger.error('Research preferences subcommand failed.', {
            message,
            stack: error instanceof Error ? error.stack : null
        });
        return { success: false, handled: true, error: message };
    }
}

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
    const initialLogOptions = sanitizeResearchOptionsForLog(options);
    moduleLogger.info('Received research command options.', {
        options: JSON.stringify(initialLogOptions).substring(0, 1000)
    });


    const {
        positionalArgs = [],
        flags = {},
        action: explicitAction,
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
        progressHandler: providedProgressHandler,
        langChainQueryChainOverride
    } = options;

    const flagsWithExplicitAction = explicitAction
        ? { ...flags, action: explicitAction }
        : flags;

    const wantsJsonFlag = normalizeOptionalBoolean(flagsWithExplicitAction.json);
    const wantsJson = wantsJsonFlag === undefined ? false : wantsJsonFlag;

    const rawLangChainFlag = flagsWithExplicitAction['langchain-query-chain']
        ?? flagsWithExplicitAction.langchainQueryChain
        ?? flagsWithExplicitAction.langchain;
    const parsedLangChainFlag = normalizeOptionalBoolean(rawLangChainFlag);
    const effectiveLangChainQueryChainOverride =
        typeof langChainQueryChainOverride === 'boolean'
            ? langChainQueryChainOverride
            : parsedLangChainFlag;

    const { action, positionalArgs: resolvedPositionalArgs } = resolveResearchAction({
        positionalArgs,
        flags: flagsWithExplicitAction
    });

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

    if (isResearchPreferencesAction(action)) {
        return handleResearchPreferencesAction({
            flags: flagsWithExplicitAction,
            outputHandler: cmdOutput,
            errorHandler: cmdError,
            wantsJson
        });
    }

    if (isResearchArchiveAction(action)) {
        const limitCandidate = flagsWithExplicitAction.limit
            ?? flagsWithExplicitAction.n
            ?? flagsWithExplicitAction.count;
        if (action === 'list') {
            const limitValue = Number.parseInt(limitCandidate, 10);
            const limit = Number.isFinite(limitValue) ? limitValue : undefined;
            return listResearchArchive({
                limit,
                output: cmdOutput,
                error: cmdError
            });
        }
        if (action === 'download') {
            const idCandidate = flagsWithExplicitAction.id
                ?? flagsWithExplicitAction.target
                ?? flagsWithExplicitAction.path
                ?? resolvedPositionalArgs[0];
            return downloadResearchArchive({
                id: idCandidate,
                output: cmdOutput,
                error: cmdError,
                isWebSocket,
                webSocketClient
            });
        }
    }

    const depthValidation = validateDepthOverride(depthOverride);
    if (!depthValidation.ok) {
        const message = depthValidation.error || 'Depth override is invalid.';
        moduleLogger.warn('Depth override validation failed.', {
            value: depthOverride,
            error: message
        });
        const emitError = typeof cmdError === 'function' ? cmdError : (value) => process.stderr.write(`${value}\n`);
        emitError(message);
        return { success: false, error: message, handled: true, keepDisabled: false };
    }

    const breadthValidation = validateBreadthOverride(breadthOverride);
    if (!breadthValidation.ok) {
        const message = breadthValidation.error || 'Breadth override is invalid.';
        moduleLogger.warn('Breadth override validation failed.', {
            value: breadthOverride,
            error: message
        });
        const emitError = typeof cmdError === 'function' ? cmdError : (value) => process.stderr.write(`${value}\n`);
        emitError(message);
        return { success: false, error: message, handled: true, keepDisabled: false };
    }

    const visibilityValidation = validateVisibilityOverride(visibilityOverride);
    if (!visibilityValidation.ok) {
        const message = visibilityValidation.error || 'Visibility override is invalid.';
        moduleLogger.warn('Visibility override validation failed.', {
            value: visibilityOverride,
            error: message
        });
        const emitError = typeof cmdError === 'function' ? cmdError : (value) => process.stderr.write(`${value}\n`);
        emitError(message);
        return { success: false, error: message, handled: true, keepDisabled: false };
    }

    const { depth, breadth, isPublic } = await resolveResearchDefaults({
        depth: depthValidation.value,
        breadth: breadthValidation.value,
        isPublic: visibilityValidation.value,
    });

    Object.assign(options, {
        depth,
        breadth,
        isPublic,
        classify,
        action,
        langChainQueryChainOverride: effectiveLangChainQueryChainOverride
    });
    options.positionalArgs = resolvedPositionalArgs;
    options.flags = flagsWithExplicitAction;

    let telemetryChannel = telemetry ?? null;

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

    // --- BLOCK PUBLIC USERS ---
    if (currentUser && currentUser.role === 'public') {
        effectiveError('Research command is not available for public users. Please /login to use this feature.');
        return { success: false, error: 'Permission denied for public user', handled: true, keepDisabled: false }; // Enable input after error
    }

    // Determine query for 'run' action
    // --- Query now comes ONLY from positionalArgs or options.query ---
    let researchQuery = resolvedPositionalArgs.join(' ').trim() || queryFromOptions;
    const needsPassword = true;

    const queryState = { researchQuery: researchQuery || null, enhancedQuery: null };

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

        if (!telemetryChannel) {
            const { channel } = ensureResearchTelemetryChannel({ key: currentUsername });
            telemetryChannel = channel;
        }

        telemetryChannel?.emitStatus({ stage: 'initializing', message: 'Validating research command options.' });

        // --- Password Handling (Get password if needed and available) ---
        let userPassword = password; // Password from handleCommandMessage or cache

        // --- Password Handling (No-op in single-user mode) ---
        // If single-user mode, skip password prompt entirely
        if (currentUser && currentUser.role === 'admin' && !process.env.RESEARCH_VAULT_ENABLED) {
            userPassword = null;
        } else {
            const { password: resolvedPassword, result: passwordFailure } = await ensureResearchPassword({
                needsPassword,
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
        }
        // --- End Password Handling ---


    queryState.researchQuery = researchQuery || null;

        const workflowOutcome = await runResearchWorkflow({
            options,
            researchQuery,
            queryState,
            currentUser,
            isWebSocket,
            session,
            userPassword,
            effectiveOutput,
            effectiveError,
            effectiveDebug,
            effectivePrompt,
            effectiveProgress,
            telemetryChannel,
            verbose,
            optionOverrideQueries,
            webSocketClient,
            depth,
            breadth,
            isPublic,
            commandStartedAt,
            logger: moduleLogger,
            formatError: formatResearchError,
            langChainQueryChainOverride: effectiveLangChainQueryChainOverride
        });

        ({ researchStartedAt = null } = workflowOutcome);
        const { commandResult, results } = workflowOutcome;

        const completionDuration = Date.now() - ((researchStartedAt ?? commandStartedAt));
        if (commandResult.success) {
            telemetryChannel?.emitComplete({
                success: true,
                durationMs: completionDuration,
                learnings: results?.learnings?.length || 0,
                sources: results?.sources?.length || 0,
                suggestedFilename: results?.suggestedFilename || null,
                summary: results?.summary || null
            });
            return {
                ...commandResult,
                results,
                researchComplete: true
            };
        }

        telemetryChannel?.emitComplete({
            success: false,
            durationMs: completionDuration,
            error: commandResult.error || 'Research failed'
        });
        return commandResult;

        // --- This part should ideally not be reached ---
        // effectiveError(`Unknown research action: ${action}. Only 'run' is supported directly.`);
        // return { success: false, error: `Unknown action: ${action}`, handled: true, keepDisabled: false };
    } catch (error) {
        const fallbackQuery = queryState.enhancedQuery?.original
            ?? queryState.researchQuery
            ?? researchQuery
            ?? positionalArgs.join(' ');
        const formatted = formatResearchError(error, {
            stage: 'command',
            query: fallbackQuery
        });
        effectiveError(formatted);
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
        if (isWebSocket && session) {
            session.currentResearchResult = null;
            session.currentResearchFilename = null;
            session.currentResearchSummary = null;
            session.promptData = null;
            delete session.currentResearchQuery;
            try {
                await persistSessionFromRef(session, {
                    currentResearchSummary: null,
                    currentResearchQuery: queryState.enhancedQuery?.original ?? queryState.researchQuery ?? researchQuery,
                });
            } catch (persistError) {
                moduleLogger.warn('Failed to persist session snapshot after research failure.', {
                    message: persistError?.message || String(persistError),
                    sessionId: session?.sessionId || null,
                });
            }
        }
         // Clear password cache on unexpected errors if WebSocket
        if (isWebSocket && session && needsPassword) {
             moduleLogger.warn('Clearing session password after research command failure.', {
                message: error?.message || String(error),
                sessionId: session?.sessionId || null
             });
             session.password = null;
            try {
                await persistSessionFromRef(session, {
                    currentResearchSummary: null,
                    currentResearchQuery: queryState.enhancedQuery?.original ?? queryState.researchQuery ?? researchQuery,
                });
            } catch (persistError) {
                moduleLogger.warn('Failed to persist session snapshot after clearing password.', {
                    message: persistError?.message || String(persistError),
                    sessionId: session?.sessionId || null,
                });
            }
        }
        return { success: false, error: error.message, handled: true, keepDisabled: false }; // Ensure input enabled on error
    }
}

// Removed promptForPassword as singlePrompt handles hidden input

// ... existing getResearchHelpText function ...
export function getResearchHelpText() {
        return `
Usage:
    /research <query> [--depth=<number>] [--breadth=<number>] [--classify] [--verbose]
    /research list [--limit=<n>]
    /research download <artifact-id>
    /research preferences [--depth=<number>] [--breadth=<number>] [--public=true|false] [--reset] [--refresh] [--json]

Run Mode:
    Executes the research pipeline for the provided query. After completion you can Download, Upload (GitHub), Keep, or Discard the result.

Archive Mode:
    list       Show durable research artifacts saved locally.
    download   Print or download an archived artifact by id.

Preferences Mode:
    preferences   View or update persisted research defaults shared by CLI and Nova.

Options:
    --depth=<number>     Depth between 1-6 (default: 2).
    --breadth=<number>   Breadth between 1-6 (default: 3).
    --classify           Enhance the query via token classification.
    --langchain-query-chain[=true|false]
                         Override the LangChain query chain flag (default: environment setting).
    --public=<boolean>   Toggle whether research outputs default to public visibility.
    --reset              Reset research defaults to their shipped baseline values.
    --refresh            Force reload of research defaults from disk when viewing preferences.
    --json               Emit structured JSON snapshots for scripting.
    --verbose            Emit detailed progress logs.

Examples:
    /research history of artificial intelligence
    /research benefits of renewable energy --depth=3 --breadth=5
    /research list --limit=5
    /research download 2025-10-15T18-20-00-archon
    /research preferences --depth=4 --public=true
`;
}

