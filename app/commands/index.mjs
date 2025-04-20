import { executeResearch } from './research.cli.mjs';
import { executeLogin } from './login.cli.mjs';
import { executeLogout } from './logout.cli.mjs';
import { executeStatus } from './status.cli.mjs';
import { executeUsers, createAdmin } from './users.cli.mjs';
import { executeKeys, getKeysHelpText } from './keys.cli.mjs';
import { executePasswordChange } from './password.cli.mjs';
import { executeDiagnose, getDiagnoseHelpText } from './diagnose.cli.mjs';
// --- FIX: Import executeExitResearch ---
import { executeChat, exitMemory, executeExitResearch } from './chat.cli.mjs';
import { executeMemory } from './memory.cli.mjs';

// Wrapper for displayHelp to match command signature
async function displayHelpWrapper(options) {
    // displayHelp now accepts an output function
    await displayHelp(options.output);
    return { success: true, keepDisabled: false }; // Indicate success and enable input
}

export const commands = {
  research: executeResearch,
  login: executeLogin,
  logout: executeLogout,
  status: executeStatus,
  users: executeUsers,
  keys: executeKeys,
  'password-change': executePasswordChange,
  'create-admin': createAdmin, // Keep for initial setup if needed via CLI
  diagnose: executeDiagnose,
  chat: executeChat,
  exitmemory: exitMemory, // Specific command for exiting memory mode
  // --- FIX: Add executeExitResearch to the map ---
  exitresearch: executeExitResearch, // Command to exit chat and start research
  memory: executeMemory, // Command for memory operations like stats
  help: displayHelpWrapper, // Add help command
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

  if (command === 'memory' && options.arg0) {
    options.action = options.arg0;
    delete options.arg0;
  }
  
  return { command, options };
}

/**
 * Display help documentation for available commands
 * @param {Function} output - Function to send output (console.log or wsOutputHelper)
 */
export async function displayHelp(output) { // Accept output function
  output('Available Commands:');
  output('/login <username> [password] - Log in as a user');
  output('/logout - Log out of the current session');
  output('/status - Display current user status');
  output('/users <action> [args] - Manage users (admin only). Actions: create, list, delete');
  output('/chat [--memory=true] [--depth=short|medium|long] - Start an interactive chat session');
  output('  -> In Chat: /exit, /exitmemory, /exitresearch, /memory stats, /research <q>, /help'); // Hint about in-chat commands

  output(getKeysHelpText()); // Call the function and send its return value

  output('/password-change - Change the current user\'s password');
  output('/research <query> [--depth=<n>] [--breadth=<n>] [--classify] - Perform research (Can also be run via interactive prompts)');

  output(getDiagnoseHelpText()); // Call the function and send its return value
  output('/help - Show this help message.'); // Add help command description
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
