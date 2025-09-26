import { userManager } from '../features/auth/user-manager.mjs';

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
  console.log(`Single-user mode active: ${current.username} (${current.role}). /login is a no-op.`);
  return { success: true, user: current };
}