import { executeResearch } from './research.cli.mjs';

export const commands = {
  research: executeResearch
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
    
    // Handle flags and key-value pairs
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      const value = parts.length > 1 ? parts[1] : true;
      options[key] = value;
      continue;
    }
    
    // Handle quoted strings
    if (!currentQuote) {
      if (arg.startsWith('"') || arg.startsWith("'")) {
        currentQuote = arg[0];
        currentValue = arg.substring(1);
        if (arg.endsWith(currentQuote) && arg.length > 1) {
          options[positionalIndex === 0 ? 'query' : `arg${positionalIndex}`] = 
            currentValue.substring(0, currentValue.length - 1);
          currentQuote = null;
          currentValue = '';
          positionalIndex++;
        }
      } else {
        options[positionalIndex === 0 ? 'query' : `arg${positionalIndex}`] = arg;
        positionalIndex++;
      }
    } else {
      currentValue += ' ' + arg;
      if (arg.endsWith(currentQuote)) {
        options[positionalIndex === 0 ? 'query' : `arg${positionalIndex}`] = 
          currentValue.substring(0, currentValue.length - 1);
        currentQuote = null;
        currentValue = '';
        positionalIndex++;
      }
    }
  }
  
  return { command, options };
}
