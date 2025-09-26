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
  const currentUser = await userManager.getUserData();
  const username = currentUser.username;
  const role = currentUser.role;
  const limits = currentUser.limits || {};

  const veniceKeyExists = await userManager.hasApiKey('venice');
  const braveKeyExists = await userManager.hasApiKey('brave');
  const githubConfigExists = await userManager.hasGitHubConfig();
  const githubTokenExists = await userManager.hasGitHubToken();

  output('=== User Status ===');
  output(`Username: ${username}`);
  output(`Role: ${role}`);
  output('API Key Configurations:');
  output(`  - Venice: ${veniceKeyExists ? '✓' : '✗'}`);
  output(`  - Brave:  ${braveKeyExists ? '✓' : '✗'}`);
  // --- FIX: Display GitHub config and token status separately ---
  output(`  - GitHub Config (Owner/Repo): ${githubConfigExists ? '✓' : '✗'}`);
  output(`  - GitHub Token: ${githubTokenExists ? '✓' : '✗'}`);

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
    output('Limits:');
    for (const [key, value] of limitEntries) {
      output(`  - ${key}: ${value}`);
    }
  } else {
    output('Limits: None Applied');
  }

  return { success: true };
}