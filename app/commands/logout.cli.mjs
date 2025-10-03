/**
 * Why: Provide a consistent CLI response for logout attempts in single-user mode.
 * What: Mirrors Web GUI messaging by surfacing the active operator and noting logout is disabled.
 * How: Reads the current user from the shared manager and emits structured output via the module logger and stdout.
 */

import { userManager } from '../features/auth/user-manager.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.logout.cli', { emitToStdStreams: false });

function emitInfo(message, meta) {
  moduleLogger.info(message, meta || null);
  process.stdout.write(`${message}\n`);
}

/**
 * Provides help text for the /logout command.
 * @returns {string} Help text.
 */
export function getLogoutHelpText() {
  return `/logout - Single-user mode is active. Logout is a no-op.`;
}

/**
 * CLI command for user logout
 */
export async function executeLogout() {
  const current = userManager.getCurrentUser?.() || { username: 'operator', role: 'admin' };
  const message = `Single-user mode active: ${current.username} (${current.role}). /logout does nothing.`;
  emitInfo(message, {
    username: current.username,
    role: current.role
  });
  return { success: true };
}