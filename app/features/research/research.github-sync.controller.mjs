/**
 * Contract
 * Inputs:
 *   - service?: GitHubResearchSyncService instance or factory overrides.
 *   - logger?: Structured logger implementing debug/info/warn/error.
 *   - activityContext?: metadata merged into emitted GitHub activity entries (e.g., { correlationId }).
 * Outputs:
 *   - verify(): Repository configuration + branch metadata with activity log side-effects.
 *   - listEntries(options): Immutable directory listing for the research repo path.
 *   - fetchFile(options): UTF-8 decoded file payload with commit metadata for download/edit flows.
 *   - pushBatch(options): Commit summaries for batched file mutations (multi-file push).
 *   - uploadFile(options): Commit summary for a single file upload/edit.
 * Error modes:
 *   - Propagates RangeError for invalid inputs from underlying service.
 *   - Wraps upstream Octokit errors with context and re-throws preserving .status when present.
 * Performance:
 *   - CPU-light; dominated by GitHub API latency. No persistent state beyond activity buffering.
 * Side effects:
 *   - Emits recordGitHubActivity entries and structured logs; relies on GitHubResearchSyncService for API calls.
 */

import { createGitHubResearchSyncService, GitHubResearchSyncService } from './research.github-sync.service.mjs';
import { recordGitHubActivity } from './github-activity.channel.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  return String(error ?? 'Unknown error');
}

function extractStatus(error) {
  if (error && typeof error.status === 'number') {
    return error.status;
  }
  return null;
}

export class GitHubResearchSyncController {
  #activityContext;

  constructor({ service, logger = noopLogger, activityContext } = {}) {
    this.service = service instanceof GitHubResearchSyncService ? service : (service || createGitHubResearchSyncService());
    this.logger = logger ?? noopLogger;
    this.#activityContext = activityContext && typeof activityContext === 'object'
      ? Object.freeze({ ...activityContext })
      : null;
  }

  #mergeActivityMeta(meta) {
    if (!this.#activityContext) {
      return meta || null;
    }
    const base = meta && typeof meta === 'object' ? { ...meta } : {};
    for (const [key, value] of Object.entries(this.#activityContext)) {
      if (base[key] === undefined) {
        base[key] = value;
      }
    }
    return base;
  }

  #recordActivity(action, level, message, meta = {}) {
    recordGitHubActivity({ action, level, message, meta: this.#mergeActivityMeta(meta) });
  }

  async verify() {
    try {
      const result = await this.service.verify();
      const config = result?.config;
      const ownerRepo = config ? `${config.owner}/${config.repo}` : 'repository';
      const branch = config?.branch ? ` @ ${config.branch}` : '';
      this.#recordActivity('verify', 'info', `Verified ${ownerRepo}${branch}`, {
        ok: true,
        config,
        repository: result?.repository ?? null,
        branch: result?.branch ?? null
      });
      return result;
    } catch (error) {
      this.#recordActivity('verify', 'error', `Verification failed: ${describeError(error)}`, {
        ok: false,
        status: extractStatus(error)
      });
      throw error;
    }
  }

  async listEntries(options = {}) {
    try {
      const listing = await this.service.pullDirectory(options);
      this.#recordActivity('list', 'info', `Listed ${listing.entries.length} entr${listing.entries.length === 1 ? 'y' : 'ies'} at ${listing.path || '/'}`, {
        ok: true,
        path: listing.path,
        ref: listing.ref,
        entryCount: listing.entries.length
      });
      return Object.freeze({
        path: listing.path,
        ref: listing.ref,
        entries: listing.entries
      });
    } catch (error) {
      this.#recordActivity('list', 'error', `Failed to list entries: ${describeError(error)}`, {
        ok: false,
        path: options?.path ?? '',
        ref: options?.ref ?? null,
        status: extractStatus(error)
      });
      throw error;
    }
  }

  async fetchFile(options = {}) {
    try {
      const file = await this.service.pullFile(options);
      this.#recordActivity('fetch', 'info', `Fetched ${file.path}${file.ref ? ` @ ${file.ref}` : ''}`, {
        ok: true,
        path: file.path,
        ref: file.ref ?? null,
        size: file.size ?? null
      });
      return file;
    } catch (error) {
      this.#recordActivity('fetch', 'error', `Failed to fetch ${options?.path || 'file'}: ${describeError(error)}`, {
        ok: false,
        path: options?.path ?? null,
        ref: options?.ref ?? null,
        status: extractStatus(error)
      });
      throw error;
    }
  }

  async pushBatch(options = {}) {
    const { files, message, branch } = options;
    try {
      const summaries = await this.service.pushFiles({ files, message, branch });
      this.#recordActivity('push', 'info', `Pushed ${summaries.length} file${summaries.length === 1 ? '' : 's'}${branch ? ` to ${branch}` : ''}`, {
        ok: true,
        branch: branch ?? null,
        fileCount: summaries.length,
        message: message ?? null
      });
      return Object.freeze({ ok: true, summaries });
    } catch (error) {
      this.#recordActivity('push', 'error', `Push failed: ${describeError(error)}`, {
        ok: false,
        branch: branch ?? null,
        fileCount: Array.isArray(files) ? files.length : 0,
        status: extractStatus(error)
      });
      throw error;
    }
  }

  async uploadFile(options = {}) {
    const { path, content, message, branch } = options;
    try {
      const summary = await this.service.uploadFile({ path, content, message, branch });
      this.#recordActivity('upload', 'info', `Uploaded ${summary.path}${branch ? ` to ${branch}` : ''}`, {
        ok: true,
        path: summary.path,
        branch: branch ?? null,
        commitSha: summary.commitSha ?? null
      });
      return Object.freeze({
        ok: true,
        summary
      });
    } catch (error) {
      this.#recordActivity('upload', 'error', `Upload failed for ${path || 'file'}: ${describeError(error)}`, {
        ok: false,
        path: path ?? null,
        branch: branch ?? null,
        status: extractStatus(error)
      });
      throw error;
    }
  }

    async deleteFile(options = {}) {
      const { path, message, branch } = options;
      try {
        const summary = await this.service.deleteFile({ path, message, branch });
        this.#recordActivity('delete', 'info', `Deleted ${summary.path}${branch ? ` from ${branch}` : ''}`, {
          ok: true,
          path: summary.path,
          branch: branch ?? null,
          commitSha: summary.commitSha ?? null
        });
        return Object.freeze({
          ok: true,
          summary
        });
      } catch (error) {
        this.#recordActivity('delete', 'error', `Delete failed for ${path || 'file'}: ${describeError(error)}`, {
          ok: false,
          path: path ?? null,
          branch: branch ?? null,
          status: extractStatus(error)
        });
        throw error;
      }
    }
}

let singletonController = null;

export function getGitHubResearchSyncController(overrides = {}) {
  if (overrides.forceNew) {
    return new GitHubResearchSyncController(overrides);
  }
  if (!singletonController) {
    singletonController = new GitHubResearchSyncController(overrides);
  }
  return singletonController;
}

export function resetGitHubResearchSyncController() {
  singletonController = null;
}
