/**
 * Why: Surface the active operator's capability state in single-user mode via CLI/Web parity.
 * What: Reports role, API key presence, and limit configuration while emitting structured telemetry.
 * How: Reads from the user manager, formats human-readable lines, and mirrors them through the shared logger.
 */

import { userManager } from '../features/auth/user-manager.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.status.cli', { emitToStdStreams: false });

function createEmitter(outputCandidate) {
  const outputFn = typeof outputCandidate === 'function' ? outputCandidate : null;
  return (message, meta = null) => {
    moduleLogger.info(message, meta);
    if (outputFn) {
      outputFn(message);
    } else {
      process.stdout.write(`${message}\n`);
    }
  };
}

/**
 * Provides help text for the /status command.
 * @returns {string} Help text.
 */
export function getStatusHelpText() {
    return `/status - Display your current login status, role, and API key configuration status.`;
}

/**
 * CLI command to display current user status
 */
export async function executeStatus(options = {}) {
  const emit = createEmitter(options.output);
  const currentUser = await userManager.getUserData();
  const username = currentUser.username;
  const role = currentUser.role;
  const limits = currentUser.limits || {};

  const veniceKeyExists = await userManager.hasApiKey('venice');
  const braveKeyExists = await userManager.hasApiKey('brave');
  const githubConfigExists = await userManager.hasGitHubConfig();
  const githubTokenExists = await userManager.hasGitHubToken();

  emit('=== User Status ===', {
    username,
    role,
    veniceKeyExists,
    braveKeyExists,
    githubConfigExists,
    githubTokenExists
  });
  emit(`Username: ${username}`, { field: 'username', value: username });
  emit(`Role: ${role}`, { field: 'role', value: role });
  emit('API Key Configurations:');
  emit(`  - Venice: ${veniceKeyExists ? '✓' : '✗'}`, { service: 'venice', exists: veniceKeyExists });
  emit(`  - Brave:  ${braveKeyExists ? '✓' : '✗'}`, { service: 'brave', exists: braveKeyExists });
  emit(`  - GitHub Config (Owner/Repo): ${githubConfigExists ? '✓' : '✗'}`, { service: 'github-config', exists: githubConfigExists });
  emit(`  - GitHub Token: ${githubTokenExists ? '✓' : '✗'}`, { service: 'github-token', exists: githubTokenExists });

  // --- REMOVED Debug logs for brevity ---
  // output('[DEBUG] Retrieving user status...');
  // output(`[DEBUG] Username: ${username}`);
  // output(`[DEBUG] Role: ${role}`);
  // output(`[DEBUG] Limits: ${JSON.stringify(limits)}`);
  // output(`[DEBUG] Venice API Key Exists: ${veniceKeyExists}`);
  // output(`[DEBUG] Brave API Key Exists: ${braveKeyExists}`);
  // output(`[DEBUG] GitHub API Key Exists: ${githubKeyExists}`);

  // --- FIX: Display limits more clearly ---
  const limitEntries = Object.entries(limits);
  if (limitEntries.length > 0) {
    emit('Limits:', { limits });
    for (const [key, value] of limitEntries) {
      emit(`  - ${key}: ${value}`, { limit: key, value });
    }
  } else {
    emit('Limits: None Applied');
  }

  moduleLogger.info('Status command completed.', {
    username,
    role,
    veniceKeyExists,
    braveKeyExists,
    githubConfigExists,
    githubTokenExists,
    limits: Object.keys(limits)
  });
  return { success: true };
}