import { executeResearch } from './research.cli.mjs';
import { executeLogin } from './login.cli.mjs';
import { executeLogout } from './logout.cli.mjs';
import { executeStatus } from './status.cli.mjs';
import { executeUsers } from './users.cli.mjs';
import { executeKeys } from './keys.cli.mjs';
import { executePasswordChange } from './password.cli.mjs';
import { createAdmin } from './users.cli.mjs';
import { executeDiagnose } from './diagnose.cli.mjs';
import { executeChat, exitMemory } from './chat.cli.mjs';

export const commands = {
  research: executeResearch,
  login: executeLogin,
  logout: executeLogout,
  status: executeStatus,
  users: executeUsers,
  keys: executeKeys,
  'password-change': executePasswordChange,
  'create-admin': createAdmin,
  diagnose: executeDiagnose,
  chat: executeChat,
  exitmemory: exitMemory
};

/**
 * Parse command line arguments into a structured format
 * 
 * @param {Array<string>} args - Command line arguments
 * @returns {Object} Structured command and options
 */
export function parseCommandArgs(args) {
  if (!args || args.length === 0) return { command: null, options: {} };
  
  const command = args[0].replace(/^\/+/, ''); // Remove leading slashes
  
  // Extract options
  const options = {};
  let positionalIndex = 0;
  
  // Handle quoted strings for the query parameter
  let currentQuote = null;
  let currentValue = '';
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (!currentQuote) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        options[key] = value || true;
      } else if (arg.startsWith('"') || arg.startsWith("'")) {
        currentQuote = arg[0];
        currentValue = arg.substring(1);
      } else {
        options[`arg${positionalIndex}`] = arg;
        positionalIndex++;
      }
    } else {
      currentValue += ' ' + arg;
      if (arg.endsWith(currentQuote)) {
        options[`arg${positionalIndex}`] = currentValue.slice(0, -1);
        currentQuote = null;
        currentValue = '';
        positionalIndex++;
      }
    }
  }
  
  if (command === 'users' && options.arg0) {
    options.action = options.arg0;
    delete options.arg0;
  }
  
  return { command, options };
}

/**
 * Display help documentation for available commands
 */
export async function displayHelp() {
  console.log('Available Commands:');
  console.log('/login <username> - Log in as a user');
  console.log('/logout - Log out of the current session');
  console.log('/status - Display current user status');
  console.log('/users create <username> --role=<role> - Create a new user');
  
  // Import and use the getKeysHelpText function
  const { getKeysHelpText } = await import('./keys.cli.mjs');
  console.log(getKeysHelpText());
  
  console.log('/keys check - Check API key configurations');
  console.log('/keys test - Test API key validity');
  console.log("/password-change - Change the current user's password");
  console.log('/research <query> [--depth=<n>] [--breadth=<n>] - Perform research');
  
  // Import and use the getDiagnoseHelpText function
  const { getDiagnoseHelpText } = await import('./diagnose.cli.mjs');
  console.log(getDiagnoseHelpText());
}

/**
 * Expose all CLI commands to the web interface
 * 
 * @returns {Array<Object>} List of commands with their descriptions and options
 */
export function exposeCommandsToWebInterface() {
  return Object.keys(commands).map(command => ({
    name: command,
    description: `Execute the ${command} command`,
    options: Object.keys(commands[command].options || {}).map(option => ({
      name: option,
      description: `Option for ${command}`
    }))
  }));
}
