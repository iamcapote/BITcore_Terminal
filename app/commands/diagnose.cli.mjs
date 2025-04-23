/**
 * MCP System Diagnostic Tool
 *
 * This CLI tool provides administrators with system health checks
 * and diagnostics for the MCP application. It can be used to
 * quickly identify and potentially repair common system issues.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
// Use the actual userManager instance
import { userManager } from '../features/auth/user-manager.mjs';
import fetch from 'node-fetch'; // Ensure fetch is available
import readline from 'readline'; // For password prompt

// --- Placeholder Constants ---
// These should ideally be imported from a central config file if they exist elsewhere
const USER_FILES_DIR = path.join(os.homedir(), '.mcp', 'users');
const RESEARCH_DIR = path.join(os.homedir(), '.mcp', 'research'); // Example path
const API_TIMEOUT = 10000; // 10 seconds timeout for API checks
// --- End Placeholder Constants ---

/**
 * Check API connectivity and keys (Internal helper for executeDiagnose)
 * @param {Object} options - Command options, potentially including session/password/currentUser.
 */
async function checkApi(options) {
    const { output, error, debug, currentUser, password } = options;
    output('\n--- API Connectivity & Key Check ---');
    let allOk = true;

    if (!currentUser || currentUser.username === 'public') {
        error('Cannot test user API keys without being logged in.');
        return false; // Cannot proceed without a logged-in user
    }

    // Use the password from options if available (likely passed from session cache or prompt)
    const userPassword = password;
    if (!userPassword) {
        error(`Password required for user ${currentUser.username} to test API keys, but none provided.`);
        // Consider prompting if in interactive mode and no password available?
        // For now, just fail the check.
        return false;
    }

    debug(`Checking APIs for user: ${currentUser.username}`);

    // Check Brave
    try {
        debug(`Attempting to decrypt Brave key for ${currentUser.username}...`);
        // Pass options object
        const braveKey = await userManager.getApiKey({ username: currentUser.username, password: userPassword, service: 'brave' });
        if (!braveKey) {
            output('🟡 Brave: Key not set or decryption failed.');
            allOk = false;
        } else {
            // Add a simple fetch test if possible, requires a known simple endpoint
            output('🟢 Brave: Key decrypted successfully (Connectivity test skipped).');
        }
    } catch (e) {
        error(`🔴 Brave: Error during key check/decryption: ${e.message}`);
        allOk = false;
    }

    // Check Venice
    try {
        debug(`Attempting to decrypt Venice key for ${currentUser.username}...`);
        // Pass options object
        const veniceKey = await userManager.getApiKey({ username: currentUser.username, password: userPassword, service: 'venice' });
        if (!veniceKey) {
            output('🟡 Venice: Key not set or decryption failed.');
            allOk = false;
        } else {
            debug('Venice key decrypted, attempting ping...');
            const llmClient = new LLMClient(veniceKey);
            await llmClient.ping();
            output('🟢 Venice: Key decrypted and API ping successful.');
        }
    } catch (e) {
        error(`🔴 Venice: Error during key check/test: ${e.message}`);
        allOk = false;
    }

     // Check GitHub
    try {
        debug(`Attempting to decrypt GitHub token for ${currentUser.username}...`);
        const githubToken = await userManager.getGitHubToken(currentUser.username, userPassword); // Assuming getGitHubToken needs password
        if (!githubToken) {
            output('🟡 GitHub: Token not set or decryption failed.');
            // Not necessarily a failure if user doesn't use GitHub feature
        } else {
            debug('GitHub token decrypted, attempting authentication check...');
            const octokit = new Octokit({ auth: githubToken });
            await octokit.rest.users.getAuthenticated();
            output('🟢 GitHub: Token decrypted and authentication successful.');
        }
    } catch (e) {
         if (e.message.includes('decryption failed')) {
             output('🟡 GitHub: Token decryption failed.');
         } else if (e.message.includes('Not set')) {
             output('🟡 GitHub: Token not set.');
         } else {
            error(`🔴 GitHub: Error during token check/test: ${e.message}`);
            allOk = false; // Fail if test call fails
         }
    }

    output(`API Check Result: ${allOk ? 'OK' : 'Issues found'}`);
    return allOk;
}


/**
 * Check file and directory permissions (Internal helper)
 */
async function checkPermissions(output) {
  // ... (Keep internal checkPermissions function as is) ...
  output('\n🔍 Checking file and directory permissions...');

  const checkDirAccess = async (dirPath, dirName) => {
    try {
      await fs.mkdir(dirPath, { recursive: true }); // Ensure directory exists
      await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
      output(`✅ ${dirName} directory (${dirPath}) is readable and writable.`);
      return true;
    } catch (error) {
      output(`❌ ${dirName} directory (${dirPath}) is not accessible: ${error.message}`);
      return false;
    }
  };

  await checkDirAccess(USER_FILES_DIR, 'Users');
  await checkDirAccess(RESEARCH_DIR, 'Research'); // Check research dir too

  const tempDir = os.tmpdir();
  await checkDirAccess(tempDir, 'Temporary');
}

/**
 * Check storage usage and availability (Internal helper)
 */
async function checkStorage(output) {
  // ... (Keep internal checkStorage function as is) ...
  output('\n🔍 Checking storage usage and availability...');

  const getDirSize = async (dirPath) => {
    let totalSize = 0;
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        try {
          if (item.isDirectory()) {
            totalSize += await getDirSize(itemPath);
          } else if (item.isFile()) {
            const stat = await fs.stat(itemPath);
            totalSize += stat.size;
          }
        } catch (itemError) {
          // Log specific item error but continue
          // output(`⚠️ Error processing item ${itemPath}: ${itemError.message}`);
        }
      }
    } catch (error) {
      // Only log error if it's not 'directory not found'
      if (error.code !== 'ENOENT') {
        output(`⚠️ Error calculating size of ${dirPath}: ${error.message}`);
      }
    }
    return totalSize;
  };

  const formatBytes = (bytes) => {
    if (bytes < 0) bytes = 0; // Handle potential negative size on error
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    let i = 0;
    // Handle log(0) case and ensure i is calculated correctly
    if (bytes > 0) {
        i = Math.floor(Math.log(bytes) / Math.log(k));
    }
    // Ensure i is within bounds
    const unitIndex = Math.min(i, units.length - 1);
    return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(2))} ${units[unitIndex]}`;
  };

  const userFilesSize = await getDirSize(USER_FILES_DIR);
  output(`📊 User files size (${USER_FILES_DIR}): ${formatBytes(userFilesSize)}`);

  const researchFilesSize = await getDirSize(RESEARCH_DIR);
  output(`📊 Research files size (${RESEARCH_DIR}): ${formatBytes(researchFilesSize)}`);

  // Disk space check (keep existing logic)
  try {
    // Use the user's home directory path for statfs to get partition info
    const homeDir = os.homedir();
    const stats = await fs.statfs(homeDir);
    const freeSpace = stats.bavail * stats.bsize;
    const totalSpace = stats.blocks * stats.bsize;
    output(`📊 Disk space (home partition: ${homeDir}): ${formatBytes(freeSpace)} free / ${formatBytes(totalSpace)} total`);
  } catch (statfsError) {
    output(`⚠️ Could not get disk space using fs.statfs: ${statfsError.message}. Trying fallback...`);
    try {
      // Fallback using 'df' command (more likely to work on Linux/macOS)
      // Use '.' to check the partition of the current working directory as fallback
      const dfOutput = execSync('df -Pk .', { encoding: 'utf8' });
      const lines = dfOutput.trim().split('\n');
      if (lines.length > 1) {
        const values = lines[1].split(/\s+/);
        // Fields: Filesystem, 1K-blocks, Used, Available, Use%, Mounted on
        // We need Available (index 3) and 1K-blocks (index 1)
        if (values.length >= 4) {
          const availableKB = parseInt(values[3], 10);
          const totalKB = parseInt(values[1], 10);
          if (!isNaN(availableKB) && !isNaN(totalKB)) {
            output(`📊 Disk space (fallback via df on '.'): ${formatBytes(availableKB * 1024)} free / ${formatBytes(totalKB * 1024)} total`);
          } else {
            output("⚠️ Could not parse 'df' output (non-numeric values).");
          }
        } else {
          output("⚠️ Could not parse 'df' output (unexpected format).");
        }
      } else {
        output("⚠️ Could not parse 'df' output (no lines).");
      }
    } catch (dfError) {
      output(`⚠️ Fallback 'df' command failed: ${dfError.message}`);
      output("⚠️ Could not determine disk space.");
    }
  }
}


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
export async function executeDiagnose(options) {
    const {
        positionalArgs = [],
        session,
        isWebSocket,
        password: providedPassword, // Password from handleCommandMessage
        output: cmdOutput, // Use passed handlers
        error: cmdError,   // Use passed handlers
        currentUser // Use passed user data
    } = options;

    // Determine which checks to run
    const checksToRun = positionalArgs.length > 0 ? positionalArgs.map(a => a.toLowerCase()) : ['all'];
    const runAll = checksToRun.includes('all');

    cmdOutput(`Executing command: diagnose (Checks: ${checksToRun.join(', ')})`);

    // --- Admin Check ---
    if (!currentUser || currentUser.role !== 'admin') {
        cmdError('Error: Only administrators can run diagnostics.');
        return { success: false, error: 'Permission denied', handled: true, keepDisabled: false };
    }

    let overallSuccess = true;
    let results = {};

    try {
        // --- System Information ---
        if (runAll || checksToRun.includes('system')) {
            cmdOutput('\n--- System Information ---');
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
                    cmdOutput(`${key}: ${value}`);
                }
            } catch (err) {
                 cmdError(`Error getting system info: ${err.message}`);
                 overallSuccess = false;
                 results.system = { error: err.message };
            }
        }

        // --- User Configuration ---
        if (runAll || checksToRun.includes('users')) {
            cmdOutput('\n--- User Configuration ---');
            try {
                // Check if userManager instance exists (basic check)
                const userManagerAvailable = !!userManager;
                cmdOutput(`User Manager Available: ${userManagerAvailable}`);
                if (!userManagerAvailable) {
                    throw new Error("UserManager instance is not available.");
                }
                const userCount = await userManager.getUserCount(); // Ensure this is async if it reads files
                const currentUsername = currentUser.username;
                cmdOutput(`Total Users: ${userCount}`);
                cmdOutput(`Current User (Context): ${currentUsername} (${currentUser.role})`);
                results.users = { available: userManagerAvailable, count: userCount, currentUser: currentUsername };
            } catch (err) {
                cmdError(`Error checking users: ${err.message}`);
                overallSuccess = false;
                results.users = { error: err.message };
            }
        }

        // --- API Connectivity & Keys ---
        if (runAll || checksToRun.includes('api') || checksToRun.includes('keys')) {
             // Password should have been obtained by handleCommandMessage and put in options.password
             // The checkApi helper function will use options.password or session.password
             // No need for extra password checks here, rely on checkApi's internal logic.
             cmdOutput(`[Diagnose] Checking API keys. Password provided: ${providedPassword ? 'Yes' : 'No (will try session cache)'}`);

             // Pass the full options object, which includes password, session, and currentUser
             await checkApi(options);
             // Note: checkApi logs its own success/failure messages. We don't explicitly track its success here.
             results.api = { checked: true }; // Mark as checked
        }


        // --- File Permissions ---
        if (runAll || checksToRun.includes('perms') || checksToRun.includes('permissions')) {
             await checkPermissions(cmdOutput);
             // Note: checkPermissions logs its own success/failure.
             results.permissions = { checked: true };
        }

        // --- Storage ---
        if (runAll || checksToRun.includes('storage')) {
             await checkStorage(cmdOutput);
             // Note: checkStorage logs its own success/failure.
             results.storage = { checked: true };
        }


        // Add more checks as needed

        cmdOutput(`\nDiagnosis complete. Review output above for status.`);
        // Overall success is currently just tracking major exceptions, not individual check failures.
        // Could be enhanced to aggregate status from helpers if needed.

        return { success: overallSuccess, results, handled: true, keepDisabled: false }; // Enable input

    } catch (error) {
        cmdError(`Error during diagnosis: ${error.message}`);
        console.error(error.stack); // Log stack trace server-side
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