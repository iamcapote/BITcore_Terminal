import { userManager } from '../features/auth/user-manager.mjs';
import { outputManager } from '../utils/research.output-manager.mjs'; // Use named import again

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
  const output = options.output || console.log;
  // --- FIX: Get user details from options.requestingUser if available (for WebSocket) ---
  const requestingUser = options.requestingUser;
  const username = requestingUser?.username || userManager.getUsername(); // Use WS user or fallback to CLI user
  const role = requestingUser?.role || userManager.getRole();
  // --- FIX: Get limits based on the actual user being checked ---
  const limits = requestingUser ? (requestingUser.limits || {}) : userManager.getLimits(); // Use WS user limits or fallback

  // Check API key presence for the correct user
  const veniceKeyExists = await userManager.hasApiKey('venice', username);
  const braveKeyExists = await userManager.hasApiKey('brave', username);
  // --- FIX: Add GitHub key check ---
  const githubKeyExists = await userManager.hasApiKey('github', username);

  // --- REMOVED Debug logs for brevity ---
  // output('[DEBUG] Retrieving user status...');
  // output(`[DEBUG] Username: ${username}`);
  // output(`[DEBUG] Role: ${role}`);
  // output(`[DEBUG] Limits: ${JSON.stringify(limits)}`);
  // output(`[DEBUG] Venice API Key Exists: ${veniceKeyExists}`);
  // output(`[DEBUG] Brave API Key Exists: ${braveKeyExists}`);
  // output(`[DEBUG] GitHub API Key Exists: ${githubKeyExists}`);

  output('=== User Status ===');
  output(`Username: ${username}`);
  output(`Role: ${role}`);
  output('API Key Configurations:');
  output(`  - Venice: ${veniceKeyExists ? '✓' : '✗'}`);
  output(`  - Brave:  ${braveKeyExists ? '✓' : '✗'}`);
  // --- FIX: Display GitHub key status ---
  output(`  - GitHub: ${githubKeyExists ? '✓' : '✗'}`);

  // --- FIX: Display limits more clearly ---
  const limitEntries = Object.entries(limits);
  if (limitEntries.length > 0) {
    output('Limits:');
    for (const [key, value] of limitEntries) {
      output(`  - ${key}: ${value}`);
    }
  } else if (role !== 'public') {
    output('Limits: None Applied'); // Indicate no limits for authenticated users if empty
  } else {
     output('Limits: (Public defaults apply)'); // Fallback for public if somehow empty
  }

  return { success: true };
}