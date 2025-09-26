import { userManager } from '../features/auth/user-manager.mjs';

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
  console.log(`Single-user mode active: ${current.username} (${current.role}). /logout does nothing.`);
  return { success: true };
}