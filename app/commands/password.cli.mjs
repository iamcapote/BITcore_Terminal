import { userManager } from '../features/auth/user-manager.mjs';

/**
 * Provides help text for the /password-change command.
 * @returns {string} Help text.
 */
export function getPasswordChangeHelpText() {
  return `/password-change - Not applicable in single-user mode (no passwords).`;
}

/**
 * CLI command to change user password
 * @returns {Promise<Object>} Result of password change
 */
export async function executePasswordChange(options = {}) {
  const output = options.output || console.log;
  const current = userManager.getCurrentUser?.() || { username: 'operator', role: 'admin' };
  output(`Single-user mode active as ${current.username} (${current.role}). Passwords are not used.`);
  return { success: true };
}