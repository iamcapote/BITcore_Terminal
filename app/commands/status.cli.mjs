import { userManager } from '../features/auth/user-manager.mjs';

/**
 * CLI command to display current user status
 */
export async function executeStatus(options = {}) {
  const output = options.output || console.log;
  const username = userManager.getUsername();
  const role = userManager.getRole();
  const limits = userManager.getLimits();

  // Check API key presence
  const veniceKeyExists = await userManager.hasApiKey('venice');
  const braveKeyExists = await userManager.hasApiKey('brave');

  output('[DEBUG] Retrieving user status...');
  output(`[DEBUG] Username: ${username}`);
  output(`[DEBUG] Role: ${role}`);
  output(`[DEBUG] Limits: ${JSON.stringify(limits)}`);
  output(`[DEBUG] Venice API Key Exists: ${veniceKeyExists}`);
  output(`[DEBUG] Brave API Key Exists: ${braveKeyExists}`);

  output('=== User Status ===');
  output(`Username: ${username}`);
  output(`Role: ${role}`);
  output('API Key Configurations:');
  output(`  - Venice: ${veniceKeyExists ? '✓' : '✗'}`);
  output(`  - Brave:  ${braveKeyExists ? '✓' : '✗'}`);
  output('Limits:');
  for (const [key, value] of Object.entries(limits)) {
    output(`  - ${key}: ${value}`);
  }

  return { success: true };
}