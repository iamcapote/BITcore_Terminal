import * as researchCli from './research.cli.mjs';
import * as keysCli from './keys.cli.mjs';
import * as loginCli from './login.cli.mjs';
import * as logoutCli from './logout.cli.mjs';
import * as statusCli from './status.cli.mjs';
import * as usersCli from './users.cli.mjs';
import * as passwordCli from './password.cli.mjs';
import * as chatCli from './chat.cli.mjs';
import * as memoryCli from './memory.cli.mjs';
import * as diagnoseCli from './diagnose.cli.mjs';

// Map command names (lowercase) to their execution functions
export const commands = {
    research: researchCli.executeResearch,
    keys: keysCli.executeKeys,
    login: loginCli.executeLogin,
    logout: logoutCli.executeLogout,
    status: statusCli.executeStatus,
    users: usersCli.executeUsers,
    'password-change': passwordCli.executePasswordChange, // Use quotes for hyphenated names
    chat: chatCli.executeChat,
    exitmemory: chatCli.executeExitMemory, // Assuming exitmemory is handled by chat.cli.mjs
    exitresearch: chatCli.executeExitResearch, // Assuming exitresearch is handled by chat.cli.mjs
    memory: memoryCli.executeMemory, // Handles subcommands like 'stats' via positionalArgs
    diagnose: diagnoseCli.executeDiagnose,
    // Add other commands here
};

/**
 * Parses a command string into its components.
 * Handles flags like --key=value or --flag.
 * @param {string} commandString - The raw command string (e.g., "/keys set github --github-owner=user --flag").
 * @returns {{commandName: string|null, positionalArgs: string[], flags: object}}
 */
export function parseCommandArgs(commandString) {
    if (!commandString || typeof commandString !== 'string') {
        return { commandName: null, positionalArgs: [], flags: {} };
    }

    // Improved splitting to handle quoted arguments (basic handling)
    const parts = [];
    let currentPart = '';
    let inQuotes = false;
    for (let i = 0; i < commandString.length; i++) {
        const char = commandString[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ' ' && !inQuotes) {
            if (currentPart) {
                parts.push(currentPart);
                currentPart = '';
            }
        } else {
            currentPart += char;
        }
    }
    if (currentPart) {
        parts.push(currentPart);
    }

    if (parts.length === 0) {
        return { commandName: null, positionalArgs: [], flags: {} };
    }

    // Remove leading slash if present from the first part (command name)
    const rawCommandName = parts[0].startsWith('/') ? parts[0].substring(1) : parts[0];
    const commandName = rawCommandName.toLowerCase(); // Normalize command name

    const positionalArgs = [];
    const flags = {};

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('--')) {
            const flagParts = part.substring(2).split('=', 2); // Split only on the first '='
            const flagName = flagParts[0];
            // If there's a value after '=', use it; otherwise, treat it as a boolean flag (true)
            flags[flagName] = flagParts.length > 1 ? flagParts[1] : true;
        } else {
            positionalArgs.push(part);
        }
    }

    return { commandName, positionalArgs, flags };
}


/**
 * Generates the combined help text for all commands.
 * @returns {string} Formatted help text.
 */
export function getHelpText() {
    // Dynamically generate help text from imported modules if they export a help function/text
    let help = 'Available Commands:\n';
    help += '-----------------\n';

    // Add help text from each command module that provides it
    if (researchCli.getResearchHelpText) help += researchCli.getResearchHelpText() + '\n\n';
    if (keysCli.getKeysHelpText) help += keysCli.getKeysHelpText() + '\n\n';
    if (loginCli.getLoginHelpText) help += loginCli.getLoginHelpText() + '\n\n';
    if (logoutCli.getLogoutHelpText) help += logoutCli.getLogoutHelpText() + '\n\n';
    if (statusCli.getStatusHelpText) help += statusCli.getStatusHelpText() + '\n\n';
    if (usersCli.getUsersHelpText) help += usersCli.getUsersHelpText() + '\n\n';
    if (passwordCli.getPasswordHelpText) help += passwordCli.getPasswordHelpText() + '\n\n';
    if (chatCli.getChatHelpText) help += chatCli.getChatHelpText() + '\n\n'; // Assumes chat provides combined help
    if (memoryCli.getMemoryHelpText) help += memoryCli.getMemoryHelpText() + '\n\n';
    if (diagnoseCli.getDiagnoseHelpText) help += diagnoseCli.getDiagnoseHelpText() + '\n\n';

    // Add a general help command usage
    help += '/help                     Show this help message.\n';

    return help.trim();
}

// Optional: Add a dedicated help command function if needed elsewhere
export function executeHelp(options) {
    options.output(getHelpText());
    return Promise.resolve({ success: true });
}

// Add help to the commands map
commands.help = executeHelp;
