/**
 * Why: Centralize API-key validation for the research command to keep the CLI entrypoint lean and consistent.
 * What: Checks for Brave/Venice keys, resolves decrypted values, and emits telemetry about auth readiness.
 * How: Leverages the user manager for presence checks, resolves keys via the shared helper, and signals failures with typed errors.
 * Contract
 *   Inputs:
 *     - params: {
 *         username: string;
 *         session?: object;
 *         telemetry?: TelemetryChannel;
 *         debug?: (message: string) => void;
 *       }
 *   Outputs:
 *     - Promise<{ braveKey: string; veniceKey: string }> OR throws MissingResearchKeysError / ResearchKeyResolutionError.
 *   Error modes:
 *     - MissingResearchKeysError when required keys are absent.
 *     - ResearchKeyResolutionError when decrypted key values cannot be retrieved.
 *   Performance:
 *     - time: O(1) checks plus decryption (<100 ms typical).
 *   Side effects:
 *     - Emits telemetry events; reads from user configuration stores.
 */

import { userManager } from '../../features/auth/user-manager.mjs';
import { resolveServiceApiKey } from '../../utils/api-keys.mjs';

export class MissingResearchKeysError extends Error {
    constructor(missingKeys) {
        const list = missingKeys.join(', ');
        super(`Missing API key(s): ${list}`);
        this.name = 'MissingResearchKeysError';
        this.missingKeys = missingKeys;
    }
}

export class ResearchKeyResolutionError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = 'ResearchKeyResolutionError';
    }
}

export async function resolveResearchKeys({ username, session, telemetry, debug = () => {} }) {
    const missingKeys = [];
    const hasBraveKey = await userManager.hasApiKey('brave', username);
    const hasVeniceKey = await userManager.hasApiKey('venice', username);

    if (!hasBraveKey) missingKeys.push('Brave');
    if (!hasVeniceKey) missingKeys.push('Venice');

    if (missingKeys.length > 0) {
        telemetry?.emitStatus({
            stage: 'blocked',
            message: 'Research blocked: missing required API keys.',
            detail: `Missing: ${missingKeys.join(', ')}`
        });
        throw new MissingResearchKeysError(missingKeys);
    }

    try {
        debug(`[resolveResearchKeys] Resolving API keys for ${username}...`);
        const braveKey = await resolveServiceApiKey('brave', { session });
        const veniceKey = await resolveServiceApiKey('venice', { session });

        const resolvedMissing = [
            braveKey ? null : 'Brave',
            veniceKey ? null : 'Venice'
        ].filter(Boolean);

        if (resolvedMissing.length > 0) {
            throw new ResearchKeyResolutionError(`Missing required API key(s): ${resolvedMissing.join(', ')}`);
        }

        telemetry?.emitStatus({
            stage: 'auth',
            message: 'API keys resolved successfully.'
        });

        return { braveKey, veniceKey };
    } catch (error) {
        const resolutionError = error instanceof ResearchKeyResolutionError
            ? error
            : new ResearchKeyResolutionError(error.message, { cause: error });

        telemetry?.emitStatus({
            stage: 'blocked',
            message: 'Missing required API keys.',
            detail: resolutionError.message
        });

        throw resolutionError;
    }
}
