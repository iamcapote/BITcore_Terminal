/**
 * Client-Side Command Processor
 *
 * Parses commands entered in the web terminal, handles client-side actions
 * like password prompts, and sends commands to the backend via WebSocket.
 */
class CommandProcessor {
    constructor(terminal, webcomm) {
        this.terminal = terminal;
        this.webcomm = webcomm;
        // No longer need pendingPasswordResolve here, terminal manages the promise
    }

    /**
     * Parses and executes a command string.
     * @param {string} commandString - The full command string (e.g., "/login user --flag").
     * @returns {Promise<void>}
     */
    async executeCommand(commandString) {
        // Input is already disabled by terminal.js handleInput before calling this

        if (!commandString || !commandString.startsWith('/')) {
            this.terminal.appendOutput("Error: Invalid command format.");
            this.terminal.enableInput(); // Re-enable on format error
            return;
        }

        const rawArgs = this.parseCommandString(commandString);
        const command = rawArgs[0]?.substring(1); // Remove leading '/'
        const args = rawArgs.slice(1); // Arguments only

        if (!command) {
            // Don't output error for empty command, just re-enable input silently
            this.terminal.enableInput(); // Re-enable on empty command
            return;
        }

        // --- Client-Side Command Handling Removed ---
        // The server will now handle prompting for passwords via wsPrompt

        try {
            // --- Prepare Payload ---
            let password = null; // Store password if provided directly
            let passwordArgProvided = false;

            // Check if password is provided via --password= flag first
            const passwordFlagArgIndex = args.findIndex(arg => arg.startsWith('--password='));
            if (passwordFlagArgIndex !== -1) {
                password = args[passwordFlagArgIndex].split('=')[1];
                console.log("Password provided via flag.");
                passwordArgProvided = true;
                // Remove the password flag from args sent to server if desired, or let server handle it
                // args.splice(passwordFlagArgIndex, 1);
            }
            // Check if password is provided as the second argument for /login
            else if (command === 'login' && args.length === 2) {
                 // Assume the second arg is the password for /login user password
                 password = args[1];
                 console.log("Password potentially provided as second argument for /login.");
                 passwordArgProvided = true;
                 // Server-side /login command handler needs to be aware of this pattern.
                 // We still send both args.
            }

            // --- Send Command to Backend ---
            const payload = {
                command: command,
                args: args, // Send original args
                // Include password ONLY if it was provided directly in the command string
                ...(passwordArgProvided && password !== null && { password: password })
            };

            console.log("Sending command payload to backend:", { command: payload.command, args: payload.args, password: passwordArgProvided ? '******' : null });

            // Use webcomm to send the command with correct arguments
            await this.webcomm.sendCommand(payload.command, payload.args, payload.password); // Corrected call

            // Backend will now process the command. If a password is required and wasn't provided,
            // the backend (routes.mjs) will send a 'prompt' message back to the client.
            // Input remains disabled until a server response enables it.

        } catch (error) {
            // Catch errors during command parsing or sending
            console.error(`Error executing command "${command}" client-side:`, error);
            this.terminal.appendOutput(`Client-side error: ${error.message}`);
            this.terminal.enableInput(); // Ensure input is re-enabled after client-side error
        }
    }

    /**
     * Parses a command string into an array of arguments including the command itself.
     * Handles spaces and quoted strings.
     * @param {string} commandString - The command string.
     * @returns {string[]} - Array of arguments including the command.
     */
    parseCommandString(commandString) {
        const args = [];
        let currentArg = '';
        let inQuotes = false;
        let quoteChar = '';
        let escapeNext = false;

        for (let i = 0; i < commandString.length; i++) {
            const char = commandString[i];

            if (escapeNext) {
                currentArg += char;
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === ' ' && !inQuotes) {
                // Push the argument if it's not empty OR if it's not the very first potential argument (command)
                if (currentArg || args.length > 0) {
                    args.push(currentArg);
                    currentArg = '';
                }
            } else if ((char === '"' || char === "'") && !inQuotes) {
                 if (currentArg === '') { // Only start quotes if currentArg is empty
                    inQuotes = true;
                    quoteChar = char;
                } else {
                    currentArg += char; // Treat quote as part of the argument if not at the start
                }
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
                // Don't push here, wait for space or end of string
            } else {
                currentArg += char;
            }
        }

        // Push the last argument if it's not empty or if it's not the command itself being empty
         if (currentArg || args.length > 0) {
            args.push(currentArg);
        }


        // Filter out empty strings that might result from multiple spaces,
        // unless they were quoted empty strings (which parseCommandString doesn't explicitly handle yet, but might be desired)
        // For now, let's keep it simple and just return the split args.
        // The main change is ensuring the command itself is the first element.
        // Let's refine the splitting logic slightly above to avoid empty initial args.
        return args.filter((arg, index) => arg !== '' || index === 0); // Keep command even if empty, filter other empty args
    }
}

window.CommandProcessor = CommandProcessor;