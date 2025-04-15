import { userManager } from '../features/auth/user-manager.mjs';

/**
 * CLI command to display current user status
 */
export async function executeStatus() {
  const username = userManager.getUsername();
  const role = userManager.getRole();
  const limits = userManager.getLimits();

  // Check API key presence
  const veniceKeyExists = await userManager.hasApiKey('venice');
  const braveKeyExists = await userManager.hasApiKey('brave');

  console.log('[DEBUG] Retrieving user status...');
  console.log(`[DEBUG] Username: ${username}`);
  console.log(`[DEBUG] Role: ${role}`);
  console.log(`[DEBUG] Limits:`, limits);
  console.log(`[DEBUG] Venice API Key Exists: ${veniceKeyExists}`);
  console.log(`[DEBUG] Brave API Key Exists: ${braveKeyExists}`);

  console.log('=== User Status ===');
  console.log(`Username: ${username}`);
  console.log(`Role: ${role}`);
  console.log('API Key Configurations:');
  console.log(`  - Venice: ${veniceKeyExists ? '✓' : '✗'}`);
  console.log(`  - Brave:  ${braveKeyExists ? '✓' : '✗'}`);
  console.log('Limits:');
  for (const [key, value] of Object.entries(limits)) {
    console.log(`  - ${key}: ${value}`);
  }

  return { success: true };
}