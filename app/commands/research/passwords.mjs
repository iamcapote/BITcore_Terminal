/**
 * Why: Encapsulate password acquisition for research commands so prompting logic stays reusable and testable.
 * What: Resolves an operator password when required, invoking WebSocket prompts when needed and propagating structured command results on failure.
 * How: Skips prompting when a password is already present, validates prompt availability, captures debug telemetry, and caches the password on the active session.
 */

const DEFAULT_PROMPT_LABEL = 'Enter password to access API keys/GitHub: ';

/**
 * Contract
 * Inputs:
 *   - needsPassword: boolean indicator whether the command flow requires a password.
 *   - existingPassword?: string | null previously resolved password.
 *   - promptFn?: Function invoked to request a password (signature matches wsPrompt/singlePrompt).
 *   - promptTimeoutMs: number timeout in milliseconds for interactive prompts.
 *   - isWebSocket: boolean flag for WebSocket execution mode.
 *   - session?: object mutable session for caching resolved password.
 *   - webSocketClient?: WebSocket client instance for prompt routing.
 *   - debug?: Function optional debug logger receiving string messages.
 *   - emitError?: Function error handler for surfacing prompt failures.
 *   - promptLabel?: string custom prompt message.
 * Outputs:
 *   - { password: string | null, result: object | null } result holds a command response when prompting fails.
 * Error modes:
 *   - Returns { result: { success: false, handled: true, keepDisabled: false, error } } when prompt unavailable or fails.
 * Performance:
 *   - Negligible CPU usage; single prompt invocation. Timeout behaviour governed by caller.
 * Side effects:
 *   - May mutate session.password when running in WebSocket mode.
 */
export async function ensureResearchPassword({
    needsPassword,
    existingPassword = null,
    promptFn,
    promptTimeoutMs,
    isWebSocket,
    session,
    webSocketClient,
    debug,
    emitError,
    promptLabel = DEFAULT_PROMPT_LABEL
}) {
    if (!needsPassword) {
        return { password: existingPassword, result: null };
    }

    if (existingPassword) {
        return { password: existingPassword, result: null };
    }

    if (typeof promptFn !== 'function') {
        emitError?.('Internal Error: Prompt function not available.');
        return {
            password: null,
            result: { success: false, error: 'Prompt unavailable', handled: true, keepDisabled: false }
        };
    }

    debug?.('Password not provided or cached for research, prompting user.');
    const promptTarget = isWebSocket ? webSocketClient : null;

    try {
        const password = await promptFn(promptTarget, session, promptLabel, promptTimeoutMs, true, null);
        if (!password) {
            throw new Error('Password required or prompt cancelled/timed out');
        }
        debug?.('Password received via prompt for research.');
        if (isWebSocket && session) {
            session.password = password;
            debug?.('Password cached in session.');
        }
        return { password, result: null };
    } catch (promptError) {
        const message = promptError?.message || String(promptError);
        emitError?.(`Password prompt failed: ${message}`);
        return {
            password: null,
            result: {
                success: false,
                error: `Password prompt failed: ${message}`,
                handled: true,
                keepDisabled: false
            }
        };
    }
}
