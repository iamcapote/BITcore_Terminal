/**
 * Contract
 * Inputs:
 *   - options: {
 *       positionalArgs?: string[];
 *       flags?: Record<string, string | boolean>;
 *       output?: (line: string | object) => void;
 *       error?: (line: string | object) => void;
 *       isWebSocket?: boolean;
 *     }
 * Outputs:
 *   - Promise<{ success: boolean; handled?: boolean; error?: string; keepDisabled: boolean }>
 * Error modes:
 *   - Validation errors for missing service/flags are surfaced via error handler with handled=true.
 *   - Unexpected failures from userManager propagate through handleCliError.
 * Performance:
 *   - time: <200ms (local disk writes only); memory: trivial (<1 MB).
 * Side effects:
 *   - Reads/writes user credential store via userManager; logs to provided output handler.
 */
import { userManager } from '../features/auth/user-manager.mjs';
import { handleCliError, logCommandStart } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';
import {
    isSecureConfigAvailable,
    secureConfigWritesEnabled,
} from '../features/config/secure-config.service.mjs';

const moduleLogger = createModuleLogger('commands.keys.cli', { emitToStdStreams: false });

function stringifyMessage(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (value == null) {
        return '';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return '[unserializable output]';
        }
    }
    return String(value);
}

function createEmitter(handler, level) {
    const fn = typeof handler === 'function' ? handler : null;
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    return (value, meta = null) => {
        const message = stringifyMessage(value);
        const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
        moduleLogger[level](message, payloadMeta);
        if (fn) {
            fn(value);
        } else {
            stream.write(`${message}\n`);
        }
    };
}

export async function executeKeys(options = {}) {
    const {
        positionalArgs = [],
        flags = {},
        output: cmdOutput,
        error: cmdError,
    } = options;

    const action = positionalArgs[0]?.toLowerCase() || 'help';
    const service = positionalArgs[1]?.toLowerCase();
    const value = positionalArgs.slice(2).join(' ');

    logCommandStart('keys', { ...options, action, service });

    const output = createEmitter(cmdOutput, 'info');
    const error = createEmitter(cmdError, 'error');

    try {
        switch (action) {
            case 'set':
                return await handleSet(service, value, flags, output, error);
            case 'check':
            case 'stat':
                return await handleCheck(output);
            case 'test':
                return await handleTest(output, error);
            case 'help':
            default:
                output(getKeysHelpText());
                return { success: true, keepDisabled: false };
        }
    } catch (err) {
        return handleCliError(err, 'keys', { effectiveError: error, isWebSocket: options.isWebSocket });
    }
}

async function handleSet(service, value, flags, output, error) {
    if (!service) {
        error('Usage: /keys set <service> [options]', { code: 'missing_service' });
        error('Services: brave, venice, github');
        return { success: false, error: 'Missing service', handled: true, keepDisabled: false };
    }

    if (service === 'brave' || service === 'venice') {
        await userManager.setApiKey(service, value || null);
        output(`API key for ${service} ${value ? 'updated' : 'cleared'}.`, {
            service,
            action: value ? 'updated' : 'cleared'
        });
        await announceSecureConfigUsage(output);
        moduleLogger.info('API key write succeeded.', { service, providedValue: Boolean(value) });
        return { success: true, keepDisabled: false };
    }

    if (service === 'github') {
        if (flags['github-owner'] === undefined || flags['github-repo'] === undefined) {
            error('GitHub configuration requires --github-owner and --github-repo.', {
                code: 'missing_github_flags'
            });
            return { success: false, error: 'Missing GitHub owner or repo', handled: true, keepDisabled: false };
        }

        const config = {
            owner: flags['github-owner'] === true ? '' : flags['github-owner'],
            repo: flags['github-repo'] === true ? '' : flags['github-repo'],
            branch: flags['github-branch'] === undefined ? 'main' : (flags['github-branch'] === true ? 'main' : flags['github-branch']),
            token: flags['github-token'] === undefined ? undefined : (flags['github-token'] === true ? '' : flags['github-token']),
        };

        if (!config.owner || !config.repo) {
            error('GitHub owner and repo must have values.', {
                code: 'invalid_github_config'
            });
            return { success: false, error: 'Invalid GitHub configuration', handled: true, keepDisabled: false };
        }

        await userManager.setGitHubConfig(config);
        output('GitHub configuration updated.', {
            owner: config.owner,
            repo: config.repo,
            branch: config.branch
        });
        if (config.token !== undefined) {
            output(`GitHub token ${config.token ? 'set' : 'cleared'}.`, {
                tokenProvided: Boolean(config.token)
            });
        }
        await announceSecureConfigUsage(output);
        moduleLogger.info('GitHub configuration stored.', {
            owner: config.owner,
            repo: config.repo,
            branch: config.branch,
            tokenProvided: config.token !== undefined && Boolean(config.token)
        });
        return { success: true, keepDisabled: false };
    }

    error(`Unknown service '${service}'. Supported: brave, venice, github.`, {
        code: 'unknown_service',
        service
    });
    return { success: false, error: 'Unknown service', handled: true, keepDisabled: false };
}

async function handleCheck(output) {
    const status = await userManager.checkApiKeys();
    const hasGithubToken = await userManager.hasGitHubToken();

    output('--- API Key & GitHub Status ---', { status, hasGithubToken });
    output(`Brave API Key: ${status.brave ? 'Configured' : 'Not Configured'}`, {
        service: 'brave',
        configured: status.brave
    });
    output(`Venice API Key: ${status.venice ? 'Configured' : 'Not Configured'}`, {
        service: 'venice',
        configured: status.venice
    });
    output(`GitHub Owner/Repo: ${status.github ? 'Configured' : 'Not Configured'}`, {
        service: 'github-config',
        configured: status.github
    });
    output(`GitHub Token: ${hasGithubToken ? 'Set' : 'Not Set'}`, {
        service: 'github-token',
        configured: hasGithubToken
    });

    return { success: true, keepDisabled: false };
}

async function handleTest(output, error) {
    output('Testing configured credentials...', { phase: 'start' });
    const results = await userManager.testApiKeys();

    const describe = (label, result) => {
        if (result.success === true) {
            output(`${label}: OK`, { label, status: 'ok' });
        } else if (result.success === false) {
            output(`${label}: Failed (${result.error || 'Unknown error'})`, {
                label,
                status: 'failed',
                error: result.error || 'Unknown error'
            });
        } else {
            output(`${label}: Not Configured`, { label, status: 'not_configured' });
        }
    };

    describe('Brave API Key', results.brave);
    describe('Venice API Key', results.venice);
    describe('GitHub Token', results.github);

    const anyFailures = [results.brave, results.venice, results.github].some((r) => r.success === false);

    if (anyFailures) {
        error('One or more credentials failed validation.', {
            failures: Object.fromEntries(
                Object.entries(results)
                    .filter(([, value]) => value?.success === false)
                    .map(([key, value]) => [key, value.error || 'Unknown error'])
            )
        });
        return { success: false, handled: true, keepDisabled: false };
    }

    output('Credential tests completed.', { phase: 'complete' });
    return { success: true, keepDisabled: false };
}

export function getKeysHelpText() {
    return `API Key & GitHub Configuration

    /keys set <service> [options]   Update stored credentials.

        Services:
            brave     Set Brave Search API key.
            venice    Set Venice LLM API key.
            github    Configure GitHub owner/repo/token for uploads.

        Encrypted storage:
            Set BITCORE_CONFIG_SECRET to enable encrypted credential storage.
            Provide BITCORE_ALLOW_CONFIG_WRITES=1 (or use the encrypted flag) to allow writes.

        Examples:
            /keys set brave YOUR_BRAVE_KEY
            /keys set venice ""
            /keys set github --github-owner=user --github-repo=my-repo --github-branch=main
            /keys set github --github-owner=user --github-repo=my-repo --github-token=YOUR_PAT

    /keys check                 Show current configuration status.
    /keys test                  Validate configured credentials.
    /keys help                  Display this help message.`;
}

async function announceSecureConfigUsage(output) {
    if (!isSecureConfigAvailable()) {
        return;
    }
    const writesAllowed = await secureConfigWritesEnabled();
    output('Credentials stored via encrypted secure-config overlay.', {
        storage: 'secure-config',
        writesEnabled: writesAllowed,
    });
}