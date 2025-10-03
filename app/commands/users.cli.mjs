import { userManager } from '../features/auth/user-manager.mjs';
import { handleCliError } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
const moduleLogger = createModuleLogger('commands.users.cli');


/**
 * Why: Preserve the `/users` entry point while single-user mode remains default and allow optional
 *        self-hosted adapters to plug in multi-user functionality.
 * What: Emits compatibility messaging when no adapter is registered and delegates to the adapter
 *        when one is present.
 * How: Guard → Do → Verify across admin checks, adapter detection, and delegated operations.
 */

const ACTIONS = new Set(['list', 'create', 'delete']);
const DEFAULT_DISABLED_MESSAGE = 'User management is disabled in single-user mode. Install an adapter via userManager.registerUserDirectoryAdapter() to enable multi-user operations.';

/**
 * Provides help text for the /users command.
 * @returns {string} Help text.
 */
export function getUsersHelpText() {
    return `
/users <action> [options] - Admin-only compatibility wrapper.
Actions:
  list                     List users via the registered directory adapter.
  create <username>        Create a user when an adapter is installed.
  delete <username>        Delete a user when an adapter is installed.
Notes:
  Single-user deployments print "${DEFAULT_DISABLED_MESSAGE}" until an adapter is registered.
`;
}

/**
 * CLI command for user management. Accepts a single options object.
 * @param {Object} options - Command options including positionalArgs, flags, session, output/error handlers.
 * @param {string[]} options.positionalArgs - Positional arguments (action, username, etc.)
 * @param {string} [options.role] - Role for create action (passed as flag --role=...)
 * @param {string} [options.password] - Password (for create action or admin confirmation)
 * @param {Function} [options.output] - Output function (log or WebSocket send)
 * @param {Function} [options.error] - Error function (error or WebSocket send)
 * @param {object} [options.requestingUser] - User data object of the user making the request.
 */
export async function executeUsers(options = {}) {
  const {
      positionalArgs = [],
      role: roleFromFlag,
      password: providedPassword,
      output: outputHandler,
      error: errorHandler,
      requestingUser,
      isWebSocket = false
  } = options;

  const outputFn = typeof outputHandler === 'function' ? outputHandler : (message) => moduleLogger.info(message);
  const errorFn = typeof errorHandler === 'function' ? errorHandler : (message) => moduleLogger.error(message);

  const rawAction = positionalArgs[0]?.toLowerCase();
  const normalizedAction = ACTIONS.has(rawAction) ? rawAction : 'list';
  const usernameArg = positionalArgs[1];
  const roleArg = roleFromFlag || positionalArgs[2];

  outputFn(`Executing command: users (action: ${normalizedAction})`);

  // Guard: Only administrators can continue.
  if (!requestingUser || requestingUser.role !== 'admin') {
    errorFn('Error: Only administrators can manage users.');
    return { success: false, error: 'Permission denied', handled: true, keepDisabled: false };
  }

  // Guard: Evaluate action-level capabilities to avoid invoking undefined helpers.
  const adapter = typeof userManager.getUserDirectoryAdapter === 'function'
    ? userManager.getUserDirectoryAdapter()
    : null;

  if (!adapter) {
    outputFn(DEFAULT_DISABLED_MESSAGE);
    return { success: false, error: 'User management disabled', handled: true, keepDisabled: false };
  }

  const adminPassword = providedPassword;

  try {
      switch (normalizedAction) {
        case 'create':
          return await createUser(usernameArg, roleArg, options.password, requestingUser, adapter, outputFn, errorFn);
        case 'list':
          return await listUsers(requestingUser, adapter, outputFn, errorFn);
        case 'delete':
           if (!adminPassword && !isWebSocket) {
               errorFn('Admin password confirmation required for delete.');
               return { success: false, error: 'Admin password required', handled: true, keepDisabled: false };
           } else if (!adminPassword && isWebSocket) {
               errorFn('Admin password required but missing.');
               return { success: false, error: 'Admin password required but missing', handled: true, keepDisabled: false };
           }
          return await deleteUser(usernameArg, requestingUser, adapter, outputFn, errorFn);
        default:
          outputFn(DEFAULT_DISABLED_MESSAGE);
          return { success: false, error: 'Unknown action', handled: true, keepDisabled: false };
      }
  } catch (error) {
      return handleCliError(error, { command: 'users', action: normalizedAction, error: errorFn });
  }
}

/**
 * Create a new user when the backing directory exposes the helper.
 */
async function createUser(username, role = 'client', password, requestingUser, adapter, output, errorFn) {
  if (!username) {
    errorFn('Error: Username is required for create action.');
    return { success: false, error: 'Username required', handled: true, keepDisabled: false };
  }

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
  const newUserResult = await adapter.createUser({ username, role: normalizedRole, password, requestingUser });
    output(`Created user "${username}" with role "${normalizedRole}".`);
    if (newUserResult.generatedPassword) {
        output(`Temporary password: ${newUserResult.generatedPassword}`);
    }
    return { success: true, user: { username: newUserResult.username, role: newUserResult.role }, keepDisabled: false };
  } catch (error) {
     errorFn(`Error creating user: ${error.message}`);
     return { success: false, error: error.message, handled: true, keepDisabled: false };
  }
}

/**
 * List users from the backing directory.
 */
async function listUsers(requestingUser, adapter, output, errorFn) {
  try {
    const users = await adapter.listUsers({ requestingUser });
    output('--- User List ---');
    if (users.length === 0) {
        output('No users found.');
    } else {
        users.forEach(user => {
            if (user && user.username && user.role) {
                output(`- ${user.username} (${user.role})`);
            } else {
                output('- [Invalid user data]');
                moduleLogger.warn('Invalid user data encountered during user listing.', { user });
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
 * Delete a user when the helper exists.
 */
async function deleteUser(username, requestingUser, adapter, output, errorFn) {
  if (!username) {
    errorFn('Error: Username is required for delete action.');
    return { success: false, error: 'Username required', handled: true, keepDisabled: false };
  }

   if (username === 'admin') {
       errorFn('Error: Cannot delete the primary admin user.');
       return { success: false, error: 'Cannot delete primary admin', handled: true, keepDisabled: false };
   }

  try {
    output(`Attempting to delete user: ${username}...`);
  await adapter.deleteUser({ username, requestingUser });
    output(`Successfully deleted user: ${username}`);
    return { success: true, keepDisabled: false };
  } catch (error) {
    errorFn(`Error deleting user '${username}': ${error.message}`);
    return { success: false, error: error.message, handled: true, keepDisabled: false };
  }
}