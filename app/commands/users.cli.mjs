import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';
import { outputManager } from '../utils/research.output-manager.mjs';
// Remove the problematic import as promptUser is not used
// import { prompt as promptUser } from '../utils/research.prompt.mjs';
import { ErrorTypes, handleCliError } from '../utils/cli-error-handler.mjs';

/**
 * Provides help text for the /users command.
 * @returns {string} Help text.
 */
export function getUsersHelpText() {
    return `
/users <action> [options] - Manage users (Admin only).
Actions:
  list                     List all users.
  create <username>        Create a new user interactively.
  create <username> --role=<role> [--password=<password>]
                           Create a new user non-interactively.
                           Role must be 'client' or 'admin'.
  delete <username>        Delete a user. Requires confirmation.
Options:
  --role=<role>            Specify user role ('client' or 'admin').
  --password=<password>    Specify user password (use with caution).
`;
}

/**
 * CLI command for user management. Accepts a single options object.
 * @param {Object} options - Command options including positionalArgs, flags, session, output/error handlers.
 * @param {string[]} options.positionalArgs - Positional arguments (action, username, etc.)
 * @param {string} [options.role] - Role for create action (passed as flag --role=...)
 * @param {string} [options.password] - Password (for create action or admin confirmation)
 * @param {Function} options.output - Output function (log or WebSocket send)
 * @param {Function} options.error - Error function (error or WebSocket send)
 * @param {object} [options.currentUser] - User data object if authenticated (less relevant now, use requestingUser).
 * @param {object} [options.requestingUser] - User data object of the user making the request.
 */
export async function executeUsers(options = {}) {
  const {
      positionalArgs = [],
      role: roleFromFlag, // Role might come from --role flag
      password: providedPassword, // Password from handleCommandMessage (for admin confirmation)
      output: cmdOutput, // Use passed handlers
      error: cmdError,   // Use passed handlers
      // currentUser // Use requestingUser instead for permission checks
      requestingUser // Use the user making the request
  } = options;

  const action = positionalArgs[0]?.toLowerCase();
  const usernameArg = positionalArgs[1]; // Username is typically the second arg
  // Role can come from flag or potentially 3rd positional arg (less common)
  const roleArg = roleFromFlag || positionalArgs[2];

  cmdOutput(`Executing command: users (Action: ${action || 'list'})`);

  // --- Admin Check ---
  // Use the requestingUser passed in options
  if (!requestingUser || requestingUser.role !== 'admin') {
    cmdError('Error: Only administrators can manage users.');
    return { success: false, error: 'Permission denied', handled: true, keepDisabled: false };
  }

  // Admin password confirmation might be needed for destructive actions (delete)
  // This should be handled by handleCommandMessage prompting if necessary
  const adminPassword = providedPassword; // Password passed is the admin's password

  try {
      switch (action) {
        case 'create':
          // For create, password in options is the *new* user's temp password if provided
          // Role comes from roleArg
          // Pass requestingUser for permission check inside userManager.createUser
          return await createUser(usernameArg, roleArg, options.password, requestingUser, cmdOutput, cmdError); // Pass error handler and requestingUser
        case 'list':
          // Pass requestingUser for permission check inside userManager.listUsers
          return await listUsers(requestingUser, cmdOutput, cmdError); // Pass error handler and requestingUser
        case 'delete':
           if (!adminPassword && !options.isWebSocket) { // Prompt for admin password in CLI if needed
               // This prompt might interfere with Web-CLI flow if called incorrectly
               // adminPassword = await promptForPassword('Enter your admin password to confirm deletion: ');
               cmdError("Admin password confirmation required for delete (prompting not fully implemented here).");
               return { success: false, error: "Admin password required", handled: true, keepDisabled: false };
           } else if (!adminPassword && options.isWebSocket) {
               cmdError("Internal Error: Admin password required for delete but missing.");
               return { success: false, error: "Admin password required but missing", handled: true, keepDisabled: false };
           }
           // Pass requestingUser for permission check inside userManager.deleteUser
          return await deleteUser(usernameArg, requestingUser, cmdOutput, cmdError); // Pass error handler and requestingUser
        default:
          // If no action or unknown action, default to list
          cmdOutput('Unknown or missing action. Defaulting to list users.');
          // Pass requestingUser for permission check inside userManager.listUsers
          return await listUsers(requestingUser, cmdOutput, cmdError);
      }
  } catch (error) {
      return handleCliError(error, { command: 'users', action, error: cmdError }); // Pass the error function
  }
}

/**
 * Create a new user.
 * @param {string} username - Username for the new user.
 * @param {string} [role='client'] - Role for the new user ('client' or 'admin').
 * @param {string} [password] - Optional temporary password.
 * @param {object} requestingUser - The user object making the request.
 * @param {Function} output - Output function.
 * @param {Function} errorFn - Error function.
 * @returns {Promise<Object>} Result object.
 */
async function createUser(username, role = 'client', password, requestingUser, output, errorFn) {
  if (!username) {
    // TODO: Implement interactive creation for CLI if needed, or disallow in Web-CLI
    errorFn('Error: Username is required for create action.');
    return { success: false, error: 'Username required', handled: true, keepDisabled: false };
  }

  // Validate username and role
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errorFn('Error: Username must contain only letters, numbers, underscores, and hyphens.');
    return { success: false, error: 'Invalid username format', handled: true, keepDisabled: false };
  }

  const normalizedRole = role?.toLowerCase() || 'client';
  if (normalizedRole !== 'client' && normalizedRole !== 'admin') {
    errorFn('Error: Role must be either "client" or "admin".');
    return { success: false, error: 'Invalid role', handled: true, keepDisabled: false };
  }

  try {
    // userManager.createUser handles password generation if not provided
    // Pass requestingUser to userManager.createUser for permission check
    const newUserResult = await userManager.createUser(username, normalizedRole, password, requestingUser);
    output(`Created user "${username}" with role "${normalizedRole}".`);
    // Access generatedPassword from the result object
    if (newUserResult.generatedPassword) {
        output(`Temporary password: ${newUserResult.generatedPassword}`);
    }
    // Return only non-sensitive parts
    return { success: true, user: { username: newUserResult.username, role: newUserResult.role }, keepDisabled: false };
  } catch (error) {
     errorFn(`Error creating user: ${error.message}`);
     return { success: false, error: error.message, handled: true, keepDisabled: false };
  }
}

/**
 * List all users.
 * @param {object} requestingUser - The user object making the request.
 * @param {Function} output - Output function.
 * @param {Function} errorFn - Error function.
 * @returns {Promise<Object>} Result object.
 */
async function listUsers(requestingUser, output, errorFn) {
  try {
    // Pass requestingUser to userManager.listUsers
    const users = await userManager.listUsers(requestingUser);
    output('--- User List ---');
    if (users.length === 0) {
        output('No users found.');
    } else {
        // Ensure users array contains objects with username and role
        users.forEach(user => {
            if (user && user.username && user.role) {
                output(`- ${user.username} (${user.role})`);
            } else {
                output('- [Invalid user data]');
                console.warn("Invalid user data found during list:", user);
            }
        });
    }
    output('-----------------');
    return { success: true, users, keepDisabled: false };
  } catch (error) {
    errorFn(`Error listing users: ${error.message}`);
    return { success: false, error: error.message, handled: true, keepDisabled: false };
  }
}

/**
 * Delete a user by username.
 * @param {string} username - Username to delete.
 * @param {object} requestingUser - The user object making the request.
 * @param {Function} output - Output function.
 * @param {Function} errorFn - Error function.
 * @returns {Promise<Object>} Result object.
 */
async function deleteUser(username, requestingUser, output, errorFn) {
  if (!username) {
     // TODO: Implement interactive deletion for CLI if needed, or disallow in Web-CLI
    errorFn('Error: Username is required for delete action.');
    return { success: false, error: 'Username required', handled: true, keepDisabled: false };
  }

   if (username === 'admin') { // Example safeguard
       errorFn('Error: Cannot delete the primary admin user.');
       return { success: false, error: 'Cannot delete primary admin', handled: true, keepDisabled: false };
   }

  try {
    // Optional: Add confirmation prompt here if needed, especially for CLI
    // if (!options.isWebSocket) { ... confirm ... }

    output(`Attempting to delete user: ${username}...`);
    // Pass requestingUser to userManager.deleteUser
    await userManager.deleteUser(username, requestingUser); // Assumes userManager handles "not found" etc.
    output(`Successfully deleted user: ${username}`);
    return { success: true, keepDisabled: false };
  } catch (error) {
    errorFn(`Error deleting user '${username}': ${error.message}`);
    return { success: false, error: error.message, handled: true, keepDisabled: false };
  }
}


// --- createAdmin and interactive functions are primarily for initial CLI setup ---
// --- They might not be directly callable or suitable for the WebSocket interface ---

/**
 * CLI command for creating an admin user (only if no admin exists).
 * @param {Object} options - Command options (less relevant here, uses readline).
 * @returns {Promise<Object>} Result of admin creation.
 */
export async function createAdmin(options = {}) {
    // This function uses console.log/error and readline directly.
    // It's intended for initial setup via `npm start cli -- create-admin` or similar.
    // It should NOT be called directly from the WebSocket handler.
    if (options.isWebSocket) {
        options.error?.('Error: create-admin command is not available via Web-CLI.');
        return { success: false, error: 'Command not available', handled: true, keepDisabled: false };
    }

    // ... (rest of existing createAdmin logic using console and readline) ...
    if (await userManager.adminExists()) {
      console.error('Error: An admin user already exists.');
      return { success: false, error: 'Admin already exists' };
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const username = await new Promise((resolve) => rl.question('Enter admin username: ', resolve));

      // Validate username format
      if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username must contain only letters, numbers, underscores, and hyphens');
      }

      const password = await new Promise((resolve) => rl.question('Enter admin password: ', resolve));

      // Validate password strength
      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      rl.close();

      const adminUser = await userManager.createInitialAdmin(username, password);
      console.log(`Admin user '${adminUser.username}' created successfully.`);
      return { success: true, user: adminUser };
    } catch (error) {
      rl.close();
      console.error(`Error creating admin user: ${error.message}`);
      return { success: false, error: error.message };
    }
}

// Interactive functions (interactiveCreate, interactiveDelete) using readline
// are also primarily for the Console CLI and should not be called from WebSocket.