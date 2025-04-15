/**
 * Parses CLI arguments into a structured format.
 * @param {string[]} args - Array of command-line arguments.
 * @returns {Object} Parsed command and options.
 */
export function parseArgs(args) {
  if (!args || args.length === 0) return { command: null, options: {} };

  const command = args[0].replace(/^\/+/, ''); // Remove leading slashes
  const options = {};
  let positionalIndex = 0;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    } else {
      options[`arg${positionalIndex}`] = arg;
      positionalIndex++;
    }
  }

  return { command, options };
}
