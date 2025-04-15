import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';

/**
 * CLI command for user login
 * Usage example: /login JohnDoe
 */
export async function executeLogin(options = {}) {
  console.log(`[DEBUG] executeLogin called with options:`, options);
  
  // Map positional arguments to named parameters
  const username = options.arg0;
  const providedPassword = options.arg1;

  // If user didn't provide a username, show current status.
  if (!username) {
    console.log(`Current user: ${userManager.getUsername()} (${userManager.getRole()})`);
    return { success: true };
  }

  // If already logged in as this user
  if (userManager.isAuthenticated() && userManager.getUsername() === username) {
    console.log(`Already logged in as ${username}`);
    return { success: true };
  }

  try {
    let password = providedPassword;
    let rl = null;
    
    // Prompt for password if not provided
    if (!password) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      password = await new Promise(resolve => {
        rl.question(`Enter password for ${username}: `, resolve);
      });
      rl.close();
      rl = null;
    }

    console.log(`[DEBUG] Login attempt for ${username} with ${password ? 'provided' : 'prompted'} password`);

    const user = await userManager.login(username, password);
    console.log(`Logged in as ${user.username} (${user.role})`);
    return { success: true, user };
  } catch (error) {
    console.error(`Login failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}