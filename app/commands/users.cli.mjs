import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';

/**
 * CLI command for user management. For now, we only implement 'create' for new users.
 * Usage example: /users create <username> --role=client
 */
export async function executeUsers(options = {}) {
  const { action, username, role, password, output = console.log } = options;
  
  // Support for both standard CLI args and validation test parameters
  const effectiveOutput = typeof output === 'function' ? output : console.log;

  // Must be admin
  if (!userManager.isAdmin()) {
    effectiveOutput('Error: Only administrators can manage users');
    return { success: false, error: 'Permission denied' };
  }

  // Handle no arguments case (list users)
  if (!action) {
    return await listUsers(effectiveOutput);
  }

  switch (action) {
    case 'create':
      return await createUser(username, role, password, effectiveOutput);
    case 'list':
      return await listUsers(effectiveOutput);
    case 'delete':
      return await deleteUser(username, effectiveOutput);
    default:
      effectiveOutput('Unknown action for /users command');
      effectiveOutput('Valid actions: create, list, delete');
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Create a new user. If username not provided, do interactive prompts.
 */
async function createUser(username, role = 'client', password, output = console.log) {
  if (!username) {
    // Interactive mode
    return await interactiveCreate();
  } else {
    // Validate username and role
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      output('Error: Username must contain only letters, numbers, underscores, and hyphens');
      return { success: false, error: 'Invalid username format' };
    }
    
    if (role !== 'client' && role !== 'admin') {
      output('Error: Role must be either "client" or "admin"');
      return { success: false, error: 'Invalid role' };
    }
    
    // Non-interactive
    const newUser = await userManager.createUser(username, role, password);
    output(`Created user "${username}" with role "${role}".`);
    output(`Temporary password: ${newUser.password}`);
    return { success: true, user: newUser };
  }
}

/**
 * Interactive version for createUser
 */
async function interactiveCreate() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const username = await new Promise(resolve => rl.question('Enter new username: ', resolve));
    
    // Validate username format
    if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username must contain only letters, numbers, underscores, and hyphens');
    }
    
    const role = await new Promise(resolve => rl.question('Enter role (client or admin) [client]: ', resolve)) || 'client';
    
    if (role !== 'client' && role !== 'admin') {
      throw new Error('Role must be either "client" or "admin"');
    }
    
    rl.close();

    const newUser = await userManager.createUser(username, role);
    console.log(`Created user "${username}" with role "${role}".`);
    console.log(`Temporary password: ${newUser.password}`);
    return { success: true, user: newUser };
  } catch (error) {
    rl.close();
    console.error('Error creating user:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * CLI command for creating an admin user (only if no admin exists).
 * @returns {Promise<Object>} Result of admin creation
 */
export async function createAdmin(options = {}) {
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

/**
 * List all users.
 */
async function listUsers(output = console.log) {
  try {
    const users = await userManager.listUsers();
    output('List of users:');
    users.forEach(user => output(`- ${user.username} (${user.role})`));
    return { success: true, users };
  } catch (error) {
    output('Error listing users:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a user by username.
 * @param {string} username - Username to delete
 * @param {Function} output - Output function
 * @returns {Promise<Object>} Result of the deletion
 */
async function deleteUser(username, output = console.log) {
  // Check if username is provided
  if (!username) {
    // Interactive mode for deletion
    return await interactiveDelete(output);
  }
  
  try {
    // Confirm deletion (non-interactive)
    output(`Attempting to delete user: ${username}`);
    
    await userManager.deleteUser(username);
    output(`Successfully deleted user: ${username}`);
    return { success: true };
  } catch (error) {
    output(`Error deleting user: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Interactive version for deleteUser
 * @param {Function} output - Output function
 * @returns {Promise<Object>} Result of the deletion
 */
async function interactiveDelete(output = console.log) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Show list of users first
    const users = await userManager.listUsers();
    output('Available users:');
    users.forEach(user => {
      // Don't show public user as deletable
      if (user.username !== 'public') {
        output(`- ${user.username} (${user.role})`);
      }
    });
    
    const username = await new Promise(resolve => rl.question('Enter username to delete: ', resolve));
    
    if (!username) {
      rl.close();
      output('No username provided. Operation cancelled.');
      return { success: false, error: 'No username provided' };
    }
    
    // Additional confirmation
    const confirmation = await new Promise(resolve => 
      rl.question(`Are you sure you want to delete user '${username}'? (yes/no): `, resolve)
    );
    
    rl.close();
    
    if (confirmation.toLowerCase() !== 'yes') {
      output('User deletion cancelled.');
      return { success: false, cancelled: true };
    }
    
    await userManager.deleteUser(username);
    output(`Successfully deleted user: ${username}`);
    return { success: true };
  } catch (error) {
    rl.close();
    output(`Error deleting user: ${error.message}`);
    return { success: false, error: error.message };
  }
}