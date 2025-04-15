import { userManager } from '../features/auth/user-manager.mjs';

/**
 * CLI command for user logout
 */
export async function executeLogout() {
  // Check if logged in as public
  if (userManager.getUsername() === 'public') {
    console.log('Already in public mode');
    return { success: true };
  }

  try {
    const previousUser = userManager.getUsername();
    await userManager.logout();
    console.log(`Logged out ${previousUser}. Switched to public mode.`);
    return { success: true };
  } catch (error) {
    console.error(`Logout failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}