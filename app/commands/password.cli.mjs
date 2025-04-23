import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';

/**
 * Provides help text for the /password-change command.
 * @returns {string} Help text.
 */
export function getPasswordChangeHelpText() {
    return `/password-change - Change your account password. You will be prompted for your current and new passwords.`;
}

/**
 * CLI command to change user password
 * @returns {Promise<Object>} Result of password change
 */
export async function executePasswordChange(options = {}) {
  const output = options.output || console.log;
  // Check if user is authenticated (not public)
  if (!userManager.isAuthenticated()) {
    output('Error: You must be logged in to change password');
    return { success: false, error: 'Authentication required' };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Promisify the question method
  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  try {
    // Ask for current password
    const currentPassword = await question('Enter your current password: ');

    // Ask for new password
    const newPassword = await question('Enter your new password: ');
    if (!newPassword || newPassword.length < 8) {
      output('Error: Password must be at least 8 characters');
      rl.close();
      return { success: false, error: 'Password too short' };
    }

    // Ask for confirmation
    const confirmPassword = await question('Confirm your new password: ');
    if (newPassword !== confirmPassword) {
      output('Error: Passwords do not match');
      rl.close();
      return { success: false, error: 'Passwords do not match' };
    }

    rl.close();

    // Change password
    await userManager.changePassword(currentPassword, newPassword);

    output('Password changed successfully!');
    return { success: true };
  } catch (error) {
    rl.close();
    output(`Failed to change password: ${error.message}`);
    return { success: false, error: error.message };
  }
}