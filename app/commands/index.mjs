import { executeLogin, getLoginHelpText } from './login.cli.mjs';
import { executeLogout, getLogoutHelpText } from './logout.cli.mjs';
import { executeStatus, getStatusHelpText } from './status.cli.mjs';
import { executeKeys, getKeysHelpText } from './keys.cli.mjs';
import { executePasswordChange, getPasswordChangeHelpText } from './password.cli.mjs';
import { executeUsers, getUsersHelpText } from './users.cli.mjs';
import { executeResearch, getResearchHelpText } from './research.cli.mjs';
import { executeDiagnose, getDiagnoseHelpText } from './diagnose.cli.mjs';
import { executeChat, getChatHelpText } from './chat.cli.mjs';
import { executeMemory, getMemoryHelpText } from './memory.cli.mjs';
// import { executeAdmin, getAdminHelpText } from './admin.cli.mjs'; // Assuming admin command exists
// --- FIX: Comment out missing storage command ---
// import { executeStorage, getStorageHelpText } from './storage.cli.mjs';
// --- FIX: Comment out missing export command ---
// import { executeExport, getExportHelpText } from './export.cli.mjs'; // Import export command

export const commands = {
    login: { execute: executeLogin, help: getLoginHelpText },
    logout: { execute: executeLogout, help: getLogoutHelpText },
    status: { execute: executeStatus, help: getStatusHelpText },
    keys: { execute: executeKeys, help: getKeysHelpText },
    'password-change': { execute: executePasswordChange, help: getPasswordChangeHelpText },
    users: { execute: executeUsers, help: getUsersHelpText },
    research: { execute: executeResearch, help: getResearchHelpText },
    diagnose: { execute: executeDiagnose, help: getDiagnoseHelpText },
    chat: { execute: executeChat, help: getChatHelpText },
    memory: { execute: executeMemory, help: getMemoryHelpText },
    // --- FIX: Comment out missing storage command ---
    // storage: { execute: executeStorage, help: getStorageHelpText },
    // --- FIX: Comment out missing export command ---
    // export: { execute: executeExport, help: getExportHelpText }, // Add export command
    // admin: { execute: executeAdmin, help: getAdminHelpText },
    // Add other commands here
};

export function getHelpText(commandName = null) {
    if (commandName && commands[commandName] && commands[commandName].help) {
        return commands[commandName].help();
    } else if (commandName) {
        return `Unknown command: /${commandName}\nType /help for a list of available commands.`;
    } else {
        let help = 'Available commands:\n';
        for (const name in commands) {
            // --- FIX: Check if command exists before accessing help ---
            if (commands[name] && commands[name].help) {
                // Get the first line of the help text for the summary
                const firstLine = commands[name].help().split('\n')[0];
                help += `  ${firstLine}\n`;
            } else if (commands[name]) { // Check if command exists but has no help
                help += `  /${name}\n`;
            }
        }
         help += '\nType /help <command> for more details on a specific command.';
        return help;
    }
}

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
  const positionalArgs = []; // Use a dedicated array for positional args

  // Handle quoted strings and flags
  let currentQuote = null;
  let currentValue = '';
  let currentArgIndex = 1; // Start processing from the first argument after the command

  while (currentArgIndex < args.length) {
    const arg = args[currentArgIndex];

    if (!currentQuote) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        options[key] = value === undefined ? true : value; // Handle flags without values
      } else if (arg.startsWith('"') || arg.startsWith("'")) {
        currentQuote = arg[0];
        currentValue = arg.substring(1);
        // Handle case where quote is the entire argument or has content ending with quote
        if (currentValue.endsWith(currentQuote) && currentValue.length > 0) {
          positionalArgs.push(currentValue.slice(0, -1));
          currentQuote = null;
          currentValue = '';
        } else if (arg.length === 1) { // Just the opening quote
          // Start accumulating
        } else { // Starts with quote, has content but no closing quote yet
          // Continue accumulating in the else block
        }
      } else {
        positionalArgs.push(arg); // Treat as positional argument
      }
    } else {
      // Accumulate value within quotes
      currentValue += ' ' + arg;
      if (arg.endsWith(currentQuote)) {
        positionalArgs.push(currentValue.slice(0, -1)); // Remove trailing quote
        currentQuote = null;
        currentValue = '';
      }
    }
    currentArgIndex++;
  }

  // If loop finishes while still inside quotes (e.g., missing closing quote)
  if (currentQuote && currentValue) {
    // Treat as positional arg without the leading quote
    positionalArgs.push(currentValue);
  }

  // Add positional args to options object for backward compatibility/command usage
  options.positionalArgs = positionalArgs;

  // Specific command adjustments (can be removed if commands handle positionalArgs directly)
  if (command === 'users' && positionalArgs.length > 0) {
    options.action = positionalArgs[0];
  }
  if (command === 'memory' && positionalArgs.length > 0) {
    options.action = positionalArgs[0];
  }
  if (command === 'keys' && positionalArgs.length > 0) {
    options.action = positionalArgs[0];
  }

  return { command, options };
}


/**
 * Expose all CLI commands to the web interface
 *
 * @returns {Array<Object>} List of commands with their descriptions and options
 */
export function exposeCommandsToWebInterface() {
  return Object.keys(commands)
    // --- FIX: Filter out commands that might be temporarily disabled (like storage) ---
    .filter(commandName => commands[commandName] && typeof commands[commandName].execute === 'function')
    .map(commandName => {
        const command = commands[commandName];
        return {
            name: commandName,
            description: `Execute the ${commandName} command`,
            // Ensure options access is safe, provide empty array if options undefined
            // Note: This options part is likely placeholder/unused as options aren't defined on the command object itself
            options: Object.keys(command?.options || {}).map(option => ({
                name: option,
                description: `Option for ${commandName}`
            }))
        };
  });
}
