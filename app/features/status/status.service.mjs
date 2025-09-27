/**
 * Contract
 * Inputs:
 *   - summary options { validateGitHub?: boolean } which toggle remote verification for GitHub status.
 *   - Depends on userManager for credential lookups, GitHub research controller for remote verification,
 *     and memory service factory for health probes.
 * Outputs:
 *   - Object.freeze({ generatedAt: ISO string, statuses: { [key]: StatusDescriptor } })
 *   - StatusDescriptor: { state: string, label: string, message: string, meta: object }
 * Error modes:
 *   - Propagates unexpected errors from dependency layers (user manager, GitHub controller, memory service).
 *   - Individual status builders swallow known failure modes and downgrade the resulting status instead of throwing.
 * Performance:
 *   - Each call issues lightweight user/config lookups and, when validateGitHub=true, a single GitHub verify call.
 *   - Memory health probe performs a stats() request once per invocation with optional fallback.
 * Side effects:
 *   - When validateGitHub=true, performs a remote GitHub API call via the research sync controller.
 */

import { userManager as defaultUserManager } from '../auth/user-manager.mjs';
import { getGitHubResearchSyncController } from '../research/research.github-sync.controller.mjs';
import { createMemoryService } from '../memory/memory.service.mjs';

const STATUS_LABELS = Object.freeze({
  venice: 'Venice LLM',
  brave: 'Brave Search',
  github: 'GitHub Sync',
  memory: 'Memory Core'
});

const STATUS_CLASSIFICATIONS = Object.freeze([
  'active',
  'warning',
  'error',
  'missing',
  'checking',
  'unknown'
]);

function freezeStatusDescriptor({ state, label, message, meta = {} }) {
  const normalizedState = STATUS_CLASSIFICATIONS.includes(state) ? state : 'unknown';
  return Object.freeze({
    state: normalizedState,
    label,
    message,
    meta: Object.freeze({ ...meta })
  });
}

export class StatusService {
  constructor({
    userManager = defaultUserManager,
    githubControllerFactory,
    memoryServiceFactory,
    logger
  } = {}) {
    this.userManager = userManager;
    this.logger = logger || console;

    this.githubControllerFactory = typeof githubControllerFactory === 'function'
      ? githubControllerFactory
      : ((overrides = {}) => getGitHubResearchSyncController({ ...overrides, forceNew: true }));

    this.memoryServiceFactory = typeof memoryServiceFactory === 'function'
      ? memoryServiceFactory
      : ((overrides = {}) => createMemoryService({ userManager: this.userManager, ...overrides }));
  }

  async getSummary(options = {}) {
    const { validateGitHub = false } = options;

    const veniceStatus = await this.#buildApiStatus({
      key: 'venice',
      envVar: 'VENICE_API_KEY',
      label: STATUS_LABELS.venice,
      readyMessage: 'Ready',
      missingMessage: 'API key missing'
    });

    const braveStatus = await this.#buildApiStatus({
      key: 'brave',
      envVar: 'BRAVE_API_KEY',
      label: STATUS_LABELS.brave,
      readyMessage: 'Ready',
      missingMessage: 'API key missing'
    });

    const githubStatus = await this.#buildGitHubStatus({ validateGitHub });
    const memoryStatus = await this.#buildMemoryStatus({ githubStatus });

    const statuses = Object.freeze({
      venice: veniceStatus,
      brave: braveStatus,
      github: githubStatus,
      memory: memoryStatus
    });

    return Object.freeze({
      generatedAt: new Date().toISOString(),
      statuses
    });
  }

  async #buildApiStatus({ key, envVar, label, readyMessage, missingMessage }) {
    try {
      const hasUserKey = await this.userManager.hasApiKey?.(key);
      const envValue = process.env?.[envVar];
      const envConfigured = typeof envValue === 'string' && envValue.trim().length > 0;
      const active = Boolean(hasUserKey || envConfigured);

      return freezeStatusDescriptor({
        state: active ? 'active' : 'missing',
        label,
        message: active ? readyMessage : missingMessage,
        meta: {
          configured: active,
          userScoped: Boolean(hasUserKey),
          envScoped: envConfigured
        }
      });
    } catch (error) {
      this.logger?.warn?.(`[StatusService] Failed to evaluate ${key} API status: ${error.message}`);
      return freezeStatusDescriptor({
        state: 'error',
        label,
        message: error.message || 'Status check failed',
        meta: { error: error.message }
      });
    }
  }

  async #buildGitHubStatus({ validateGitHub }) {
    const label = STATUS_LABELS.github;
    const meta = {
      hasConfig: false,
      hasToken: false,
      verified: false,
      repository: null,
      branch: null
    };

    try {
      meta.hasConfig = await this.userManager.hasGitHubConfig?.();
      meta.hasToken = await this.userManager.hasGitHubToken?.();
    } catch (error) {
      this.logger?.warn?.(`[StatusService] Failed to read GitHub config: ${error.message}`);
      return freezeStatusDescriptor({
        state: 'error',
        label,
        message: error.message || 'GitHub configuration unavailable',
        meta: { ...meta, error: error.message }
      });
    }

    if (!meta.hasConfig) {
      return freezeStatusDescriptor({
        state: 'missing',
        label,
        message: 'Repository not configured',
        meta
      });
    }

    if (!meta.hasToken) {
      return freezeStatusDescriptor({
        state: 'warning',
        label,
        message: 'Access token missing',
        meta
      });
    }

    if (!validateGitHub) {
      return freezeStatusDescriptor({
        state: 'active',
        label,
        message: 'Configured',
        meta
      });
    }

    try {
      const controller = this.githubControllerFactory({ logger: this.logger });
      const verification = await controller.verify();
      meta.verified = true;
      meta.repository = verification?.repository ?? null;
      meta.branch = verification?.branch ?? null;

      const repoLabel = verification?.config
        ? `${verification.config.owner}/${verification.config.repo}@${verification.config.branch}`
        : 'Configured';

      return freezeStatusDescriptor({
        state: 'active',
        label,
        message: `Connected (${repoLabel})`,
        meta
      });
    } catch (error) {
      this.logger?.warn?.(`[StatusService] GitHub verification failed: ${error.message}`);
      return freezeStatusDescriptor({
        state: 'error',
        label,
        message: error.message || 'GitHub verification failed',
        meta: { ...meta, verified: false, error: error.message }
      });
    }
  }

  async #buildMemoryStatus({ githubStatus }) {
    const label = STATUS_LABELS.memory;
    const meta = {
      mode: null,
      githubConfigured: Boolean(githubStatus?.meta?.hasConfig && githubStatus?.meta?.hasToken),
      githubVerified: Boolean(githubStatus?.meta?.verified),
      error: null
    };

    const memoryService = this.memoryServiceFactory({});

    if (meta.githubConfigured) {
      try {
        await memoryService.stats({ githubEnabled: true });
        meta.mode = 'github';
        return freezeStatusDescriptor({
          state: githubStatus?.state === 'active' ? 'active' : 'warning',
          label,
          message: githubStatus?.state === 'active'
            ? 'Synced via GitHub'
            : 'GitHub configured but not verified',
          meta
        });
      } catch (error) {
        this.logger?.warn?.(`[StatusService] Memory GitHub stats failed: ${error.message}`);
        meta.error = error.message;
      }
    }

    try {
      await memoryService.stats({ githubEnabled: false });
      meta.mode = meta.githubConfigured ? 'local-fallback' : 'local';
      return freezeStatusDescriptor({
        state: meta.githubConfigured ? 'warning' : 'active',
        label,
        message: meta.githubConfigured ? 'Local fallback (GitHub unavailable)' : 'Local mode ready',
        meta
      });
    } catch (error) {
      this.logger?.error?.(`[StatusService] Memory stats failed: ${error.message}`);
      return freezeStatusDescriptor({
        state: 'error',
        label,
        message: error.message || 'Memory subsystem unavailable',
        meta: { ...meta, error: error.message }
      });
    }
  }
}

export function createStatusService(overrides = {}) {
  return new StatusService(overrides);
}
