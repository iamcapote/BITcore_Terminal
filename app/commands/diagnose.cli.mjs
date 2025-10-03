/**
 * Contract
 * Inputs:
 *   - options: {
 *       positionalArgs?: string[];
 *       session?: object;
 *       currentUser?: { username: string; role: string };
 *       output: (line: string | object) => void;
 *       error: (line: string | object) => void;
 *       password?: string;
 *       isWebSocket?: boolean;
 *     }
 * Outputs:
 *   - Promise<{ success: boolean; handled: true; keepDisabled: boolean; results?: Record<string, unknown> }>
 * Error modes:
 *   - Permission denied when currentUser.role !== 'admin'.
 *   - Propagates unexpected errors from filesystem or API probes with context message.
 * Performance:
 *   - time: soft 2s, hard 5s (API checks have 7s timeout internally);
 *     memory: <10 MB (small directory scans only).
 * Side effects:
 *   - Reads filesystem metadata; issues HTTP requests to Brave/Venice/GitHub for credential validation.
 *   - Writes no data; logs structured strings through provided output handler.
 */

import os from 'os';
import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
import { checkApi, checkPermissions, checkStorage } from './diagnose/checks.mjs';

const moduleLogger = createModuleLogger('commands.diagnose.cli', { emitToStdStreams: false });

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
    moduleLogger[level](message, payloadMeta);
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

/**
 * Contract: validates Brave/Venice/GitHub connectivity using configured credentials.
 * Inputs: { output: Function; error: Function }
 * Returns: Promise<boolean> where false indicates at least one credential failure.
 * Errors: surfaces network/timeout errors via error handler and returns false.
 */

/**
 * Main execution function for the /diagnose command. Accepts a single options object.
 *
 * @param {Object} options - Command options including positionalArgs, flags, session, output/error handlers.
 * @param {string[]} options.positionalArgs - Positional arguments (e.g., ['api', 'perms'] or ['all'])
 * @param {string} [options.password] - Password provided via args/payload/cache/prompt
 * @param {boolean} [options.isWebSocket=false] - Indicates if called via WebSocket
 * @param {object} [options.session] - WebSocket session object
 * @param {Function} options.output - Output function (log or WebSocket send)
 * @param {Function} options.error - Error function (error or WebSocket send)
 * @param {object} [options.currentUser] - User data object if authenticated.
 */
export async function executeDiagnose(options = {}) {
  const {
    positionalArgs = [],
    session,
    isWebSocket,
    password: providedPassword, // Password from handleCommandMessage
    output: outputHandler, // Use passed handlers
    error: errorHandler,   // Use passed handlers
    currentUser // Use passed user data
  } = options;

  const outputFn = createEmitter(outputHandler, 'info');
  const errorFn = createEmitter(errorHandler, 'error');

    // Determine which checks to run
    const checksToRun = positionalArgs.length > 0 ? positionalArgs.map(a => a.toLowerCase()) : ['all'];
    const runAll = checksToRun.includes('all');

  outputFn(`Executing command: diagnose (Checks: ${checksToRun.join(', ')})`, { checks: checksToRun, runAll });
  moduleLogger.info('Diagnose command invoked.', {
    checks: checksToRun,
    runAll,
    isWebSocket: Boolean(isWebSocket),
    username: currentUser?.username ?? null,
    role: currentUser?.role ?? null
  });

    // --- Admin Check ---
    if (!currentUser || currentUser.role !== 'admin') {
    errorFn('Error: Only administrators can run diagnostics.', { reason: 'not_admin' });
    moduleLogger.warn('Diagnose command blocked for non-admin user.', {
      username: currentUser?.username ?? null,
      role: currentUser?.role ?? null
    });
        return { success: false, error: 'Permission denied', handled: true, keepDisabled: false };
    }

    let overallSuccess = true;
    let results = {};

    try {
        // --- System Information ---
        if (runAll || checksToRun.includes('system')) {
      outputFn('\n--- System Information ---');
            try {
                results.system = {
                    platform: os.platform(),
                    arch: os.arch(),
                    nodeVersion: process.version,
                    cpuCount: os.cpus().length,
                    totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
                    freeMemoryGB: (os.freemem() / (1024 ** 3)).toFixed(2),
                    uptimeSeconds: os.uptime().toFixed(0),
                };
        for (const [key, value] of Object.entries(results.system)) {
          outputFn(`${key}: ${value}`, { section: 'system', key, value });
                }
            } catch (err) {
         errorFn(`Error getting system info: ${err.message}`, { section: 'system', message: err.message });
                 overallSuccess = false;
                 results.system = { error: err.message };
            }
        }

        // --- User Configuration ---
        if (runAll || checksToRun.includes('users')) {
      outputFn('\n--- User Configuration ---');
            try {
                // Check if userManager instance exists (basic check)
                const userManagerAvailable = !!userManager;
        outputFn(`User Manager Available: ${userManagerAvailable}`, { section: 'users', key: 'available', value: userManagerAvailable });
                if (!userManagerAvailable) {
                    throw new Error("UserManager instance is not available.");
                }
                const userCount = await userManager.getUserCount(); // Ensure this is async if it reads files
                const currentUsername = currentUser.username;
        outputFn(`Total Users: ${userCount}`, { section: 'users', key: 'count', value: userCount });
        outputFn(`Current User (Context): ${currentUsername} (${currentUser.role})`, {
          section: 'users',
          key: 'currentUser',
          user: currentUsername,
          role: currentUser.role
        });
                results.users = { available: userManagerAvailable, count: userCount, currentUser: currentUsername };
            } catch (err) {
        errorFn(`Error checking users: ${err.message}`, { section: 'users', message: err.message });
                overallSuccess = false;
                results.users = { error: err.message };
            }
        }

        // --- API Connectivity & Keys ---
        if (runAll || checksToRun.includes('api') || checksToRun.includes('keys')) {
             // Password should have been obtained by handleCommandMessage and put in options.password
             // The checkApi helper function will use options.password or session.password
             // No need for extra password checks here, rely on checkApi's internal logic.
       outputFn(`[Diagnose] Checking API keys. Password provided: ${providedPassword ? 'Yes' : 'No (will try session cache)'}`, {
        section: 'api',
        passwordProvided: Boolean(providedPassword)
       });

             // Pass the full options object, which includes password, session, and currentUser
  const apiOk = await checkApi({ output: outputFn, error: errorFn });
       // Note: checkApi logs its own success/failure messages. Track status for rollup.
       results.api = { checked: true, success: apiOk };
       overallSuccess = overallSuccess && apiOk;
        }


        // --- File Permissions ---
        if (runAll || checksToRun.includes('perms') || checksToRun.includes('permissions')) {
     const permsOk = await checkPermissions(outputFn);
       results.permissions = { checked: true, success: permsOk };
       overallSuccess = overallSuccess && permsOk;
        }

        // --- Storage ---
        if (runAll || checksToRun.includes('storage')) {
     const storageOk = await checkStorage(outputFn);
       results.storage = { checked: true, success: storageOk };
       overallSuccess = overallSuccess && storageOk;
        }


        // Add more checks as needed

    outputFn(`\nDiagnosis complete. Review output above for status.`);
    const failedChecks = Object.entries(results)
      .filter(([, value]) => value?.success === false || value?.error)
      .map(([key]) => key);
    moduleLogger.info('Diagnose command completed.', {
      success: overallSuccess,
      checks: Object.keys(results),
      failedChecks,
      runAll
    });

    return { success: overallSuccess, results, handled: true, keepDisabled: false }; // Enable input

    } catch (error) {
    errorFn(`Error during diagnosis: ${error.message}`, { message: error.message });
    moduleLogger.error('Diagnose command failed.', {
      message: error.message,
      stack: error.stack || null,
      checks: checksToRun,
      runAll
    });
        return { success: false, error: error.message, handled: true, keepDisabled: false }; // Enable input on error
    }
}


/**
 * Simple password prompt for CLI (Internal helper, might be replaced by singlePrompt).
 * @param {string} query - The prompt message.
 * @returns {Promise<string>} - The entered password.
 */
function promptForPassword(query) {
    // ... (Keep internal promptForPassword function as is, used only as fallback) ...
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        const _stdout = process.stdout; // Reference original stdout
        // Removed onData listener as it wasn't used correctly

        _stdout.write(query); // Write the prompt
        process.stdin.setRawMode(true); // Enable raw mode
        process.stdin.resume(); // Start listening
        process.stdin.setEncoding('utf8');
        let password = '';

        const listener = (key) => {
            const char = key.toString();
            if (char === '\u0003') { // Ctrl+C
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdin.removeListener('data', listener);
                rl.close(); // Close readline interface
                _stdout.write('\nCancelled.\n');
                reject(new Error("Password entry cancelled."));
                return;
            }
            if (char === '\r' || char === '\n') { // Enter key
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdin.removeListener('data', listener);
                rl.close(); // Close readline interface
                _stdout.write('\n'); // Newline after entry
                resolve(password);
                return;
            }
            if (char === '\u007f' || char === '\b') { // Backspace
                 if (password.length > 0) {
                    password = password.slice(0, -1);
                    _stdout.write('\b \b'); // Erase character visually
                 }
            } else {
                // Filter out non-printable characters (except allowed ones like backspace)
                if (char >= ' ') {
                    password += char;
                    _stdout.write('*'); // Mask input
                }
            }
        };
        process.stdin.on('data', listener);

        // Handle potential errors on readline interface itself
        rl.on('error', (err) => {
             process.stdin.setRawMode(false);
             process.stdin.pause();
             process.stdin.removeListener('data', listener);
             rl.close();
             reject(err);
        });
         // Handle SIGINT (Ctrl+C) on the readline interface as well
        rl.on('SIGINT', () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', listener);
            rl.close();
            _stdout.write('\nCancelled.\n');
            reject(new Error("Password entry cancelled."));
        });
    });
}


/**
 * Provides help text for the diagnose command.
 */
export function getDiagnoseHelpText() {
  return "/diagnose [check...] - Run system diagnostics (admin only).\n" +
         "  Checks: system, users, api, keys, perms, storage, all (default)";
}