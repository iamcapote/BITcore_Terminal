/**
 * Why: Communicate single-user mode expectations when operators invoke /login.
 * What: Reads the active profile and surfaces a structured notice while keeping CLI/Web parity.
 * How: Uses the shared user manager and module logger to emit both telemetry and stdout output.
 */

import { userManager } from '../features/auth/user-manager.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.login.cli', { emitToStdStreams: false });

function emitInfo(message, meta) {
  moduleLogger.info(message, meta || null);
  process.stdout.write(`${message}\n`);
}

/**
 * Provides help text for the /login command.
 * @returns {string} Help text.
 */
export function getLoginHelpText() {
  return `/login - Single-user mode is active. No login required.`;
}

/**
 * CLI command for user login
 * Usage example: /login JohnDoe
 */
export async function executeLogin() {
  const current = userManager.getCurrentUser?.() || { username: 'operator', role: 'admin' };
  const message = `Single-user mode active: ${current.username} (${current.role}). /login is a no-op.`;
  emitInfo(message, {
    username: current.username,
    role: current.role
  });
  return { success: true, user: current };
}