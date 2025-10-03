/**
 * CLI Runner Utility
 * Why: Provide reusable helpers to execute terminal commands programmatically and via an interactive REPL.
 * What: Exposes a programmatic `run` helper and an interactive CLI loop that routes input to registered commands.
 * How: Parses command strings, delegates to command handlers, and emits structured logs for default output paths.
 */

import { commands, parseCommandArgs, getHelpText } from '../commands/index.mjs';
import readline from 'readline';
import { createModuleLogger } from './logger.mjs';

const moduleLogger = createModuleLogger('utils.cli-runner');

function defaultOutput(message) {
  moduleLogger.info(message);
}

function defaultError(message) {
  moduleLogger.error(message);
}

function defaultExit() {
  moduleLogger.info('Interactive CLI session exited.');
}

/**
 * Run a CLI command programmatically
 * 
 * @param {string} commandStr - Command string (e.g., "research quantum computing --depth=3")
 * @param {Object} options - Additional options for running the command
 * @param {Function} options.onOutput - Function to handle command output
 * @param {Function} options.onError - Function to handle command errors
 * @param {Function} options.onComplete - Function called when command completes
 * @returns {Promise<Object>} Command result
 */
export async function run(commandStr, options = {}) {
  try {
    // Split command string into args
    const args = commandStr.split(/\s+/);
    const cmdName = args[0].replace(/^\/+/, ''); // Remove leading slashes
    
    // Check if command exists
    if (!commands[cmdName]) {
      const error = `Unknown command: ${cmdName}`;
      if (options.onError) {
        options.onError(error);
      }
      return { success: false, error };
    }
    
    // Parse arguments
    const { options: cmdOptions } = parseCommandArgs(args);
    
    // Execute command
    const result = await commands[cmdName](cmdOptions);
    
    // Handle completion
    if (options.onComplete) {
      options.onComplete(result);
    }
    
    return result;
  } catch (error) {
    if (options.onError) {
      options.onError(error.message);
    } else {
      defaultError(error.message);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Interactive CLI runner that handles user input and commands
 * 
 * @param {Object} options - CLI runner options
 * @param {Function} options.onOutput - Function to handle output
 * @param {Function} options.onExit - Function called when the CLI exits
 */
export function interactiveCLI(options = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const onOutput = typeof options.onOutput === 'function' ? options.onOutput : defaultOutput;
  const onExit = typeof options.onExit === 'function' ? options.onExit : defaultExit;

  rl.on('line', async (input) => {
    if (input.startsWith('/')) {
      const command = input.slice(1).split(' ')[0];
      if (commands[command]) {
        try {
          const { command: parsedCmd, options: cmdOptions } = parseCommandArgs([command, ...input.slice(1).split(' ').slice(1)]);
          await commands[parsedCmd](cmdOptions, onOutput, onOutput);
        } catch (error) {
          onOutput(`Error executing command: ${error.message}`);
        }
      } else if (command === 'help') {
        const helpCommand = options.positionalArgs?.[0] ?? null;
        onOutput(getHelpText(helpCommand));
        return;
      } else if (command === 'exit' || command === 'quit') {
        if (onExit) {
          onExit();
        }
        rl.close();
        return;
      } else {
        onOutput(`Unknown command: ${command}`);
        onOutput("Available commands:");
        Object.keys(commands).forEach(cmd => onOutput(`  /${cmd}`));
      }
    } else if (input) {
      // Only show help message if input is not empty
      onOutput("Please start commands with / (e.g., /research, /login, /status)");
    }
    rl.prompt();
  });

  rl.on('close', () => {
    onExit();
    process.exit(0);
  });

  rl.setPrompt('> ');
  rl.prompt();
}