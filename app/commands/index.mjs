import * as researchCli from './research.cli.mjs';
import * as keysCli from './keys.cli.mjs';
import * as statusCli from './status.cli.mjs';
import * as chatCli from './chat.cli.mjs';
import * as chatHistoryCli from './chat-history.cli.mjs';
import * as memoryCli from './memory.cli.mjs';
import * as diagnoseCli from './diagnose.cli.mjs';
import * as loginCli from './login.cli.mjs';
import * as logoutCli from './logout.cli.mjs';
import * as passwordCli from './password.cli.mjs';
import * as missionsCli from './missions.cli.mjs';
import * as promptsCli from './prompts.cli.mjs';
import * as researchGitHubCli from './research-github.cli.mjs';
import * as githubSyncCli from './research.github-sync.cli.mjs';
import * as terminalCli from './terminal.cli.mjs';
import * as logsCli from './logs.cli.mjs';
import * as researchSchedulerCli from './research-scheduler.cli.mjs';
import * as usersCli from './users.cli.mjs';
import * as exportCli from './export.cli.mjs';
import * as storageCli from './storage.cli.mjs';
import * as securityCli from './security.cli.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

/**
 * Why: Centralise CLI/Web command wiring for parity across `/help`, the console CLI, and the Web terminal.
 * What: Exposes the normalized command registry, argument parser, and aggregated help text generator.
 * How: Compose per-command modules, guard inputs, and defer execution to feature-specific handlers.
 */

// Map command names (lowercase) to their execution functions
export const commands = {
    research: researchCli.executeResearch,
    keys: keysCli.executeKeys,
    status: statusCli.executeStatus,
    chat: chatCli.executeChat,
    'chat-history': chatHistoryCli.executeChatHistory,
    exitmemory: chatCli.executeExitMemory, // Assuming exitmemory is handled by chat.cli.mjs
    exitresearch: chatCli.executeExitResearch, // Assuming exitresearch is handled by chat.cli.mjs
    memory: memoryCli.executeMemory, // Handles subcommands like 'stats' via positionalArgs
    diagnose: diagnoseCli.executeDiagnose,
    login: loginCli.executeLogin,
    logout: logoutCli.executeLogout,
    'password-change': passwordCli.executePasswordChange,
    missions: missionsCli.executeMissions,
    prompts: promptsCli.executePrompts,
    'research-github': researchGitHubCli.executeResearchGitHub,
    'github-sync': githubSyncCli.executeGithubSync,
    terminal: terminalCli.executeTerminal,
    logs: logsCli.executeLogs,
    'research-scheduler': researchSchedulerCli.executeResearchScheduler,
    users: usersCli.executeUsers,
    export: exportCli.executeExport,
    storage: storageCli.executeStorage,
    security: securityCli.executeSecurity,
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
    const sections = [];
    const register = (name, getter) => {
        if (typeof getter !== 'function') {
            return;
        }
        const text = getter();
        if (typeof text === 'string' && text.trim()) {
            sections.push({ name, text: text.trim() });
        }
    };

    register('chat', chatCli.getChatHelpText);
    register('chat-history', chatHistoryCli.getChatHistoryHelpText);
    register('diagnose', diagnoseCli.getDiagnoseHelpText);
    register('export', exportCli.getExportHelpText);
    register('github-sync', githubSyncCli.getGithubSyncHelpText);
    register('keys', keysCli.getKeysHelpText);
    register('logs', logsCli.getLogsHelpText);
    register('login', loginCli.getLoginHelpText);
    register('logout', logoutCli.getLogoutHelpText);
    register('memory', memoryCli.getMemoryHelpText);
    register('missions', missionsCli.getMissionsHelpText);
    register('password-change', passwordCli.getPasswordChangeHelpText);
    register('prompts', promptsCli.getPromptsHelpText);
    register('research', researchCli.getResearchHelpText);
    register('research-github', researchGitHubCli.getResearchGitHubHelpText);
    register('research-scheduler', researchSchedulerCli.getResearchSchedulerHelpText);
    register('status', statusCli.getStatusHelpText);
    register('storage', storageCli.getStorageHelpText);
    register('security', securityCli.getSecurityHelpText);
    register('terminal', terminalCli.getTerminalHelpText);
    register('users', usersCli.getUsersHelpText);

    sections.sort((a, b) => a.name.localeCompare(b.name));

    const lines = [
        'Available Commands:',
        '-----------------'
    ];

    sections.forEach(({ text }) => {
        lines.push(text);
        lines.push('');
    });

    lines.push('/help                     Show this help message.');

    return lines.join('\n').trim();
}

// Optional: Add a dedicated help command function if needed elsewhere
const moduleLogger = createModuleLogger('commands.index');
const defaultHelpOutput = (message) => moduleLogger.info(message);

export function executeHelp(options) {
    const outputFn = typeof options?.output === 'function' ? options.output : defaultHelpOutput;
    outputFn(getHelpText());
    return Promise.resolve({ success: true });
}

// Add help to the commands map
commands.help = executeHelp;
