/**
 * PromptGitHubSyncService orchestrates filesystem-backed prompt library sync
 * operations against a Git repository. It verifies repo access, pulls remote
 * changes, stages prompt definitions, commits updates, and pushes them back to
 * the configured remote while surfacing a normalized status payload.
 *
 * Contract
 * Inputs:
 *   - options?: {
 *       repoPath?: string;
 *       directory?: string;
 *       branch?: string;
 *       remote?: string;
 *       commitMessage?: string;
 *     }
 *   - logger?: { debug?: Function, info?: Function, warn?: Function, error?: Function }
 * Outputs:
 *   - status(options): Promise<{ status: 'ok'|'error'; message: string; statusReport?: object }>
 *   - pull(options): Promise<{ status: 'ok'|'error'; message: string; statusReport?: object }>
 *   - push(options): Promise<{ status: 'ok'|'error'; message: string; statusReport?: object }>
 *   - sync(options): Promise<{ status: 'ok'|'error'; message: string; pull?: object; push?: object }>
 * Error modes:
 *   - Propagates repo verification failures, git command errors, and filesystem issues.
 * Performance:
 *   - time: dominated by git commands (typically <5s); memory: <5 MB (no large buffers).
 * Side effects:
 *   - Executes git commands, reads/writes prompt files, mutates git index.
 */

import fs from 'fs/promises';
import path from 'path';
import { exec as execChild } from 'child_process';
import { promisify } from 'util';
import {
  verifyRepo,
  pullRepo,
  pushRepo,
  statusRepo
} from '../../infrastructure/missions/github-sync.mjs';
import { freezeDeep } from '../../utils/object.freeze.mjs';

const execAsync = promisify(execChild);

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function escapeArg(value) {
  if (value == null) {
    return "";
  }
  const stringValue = String(value);
  if (/^[\w./-]+$/.test(stringValue)) {
    return stringValue;
  }
  const escaped = stringValue.replace(/'/g, "'\"'\"'");
  return `'${escaped}'`;
}

export class PromptGitHubSyncService {
  constructor({ defaults = {}, logger = noopLogger } = {}) {
    this.defaults = {
      repoPath: defaults.repoPath,
      directory: defaults.directory || 'prompts',
      branch: defaults.branch || 'main',
      remote: defaults.remote || 'origin',
      commitMessage: defaults.commitMessage || 'chore(prompts): sync prompt library'
    };
    this.logger = logger ?? noopLogger;
  }

  get defaultsConfig() {
    return freezeDeep({ ...this.defaults });
  }

  async status(options = {}) {
    const opts = this.#normalizeOptions(options);
    const verification = await verifyRepo(opts.repoPath);
    if (!verification.success) {
      return this.#freezeResult({
        status: 'error',
        message: verification.message,
        details: verification
      });
    }

    const status = await statusRepo(opts.repoPath);
    const report = status?.success ? this.#decorateStatus(status, opts) : status;
    return this.#freezeResult({
      status: status?.success ? 'ok' : 'error',
      message: status?.message ?? 'Prompt GitHub status unavailable.',
      statusReport: report
    });
  }

  async pull(options = {}) {
    const opts = this.#normalizeOptions(options);
    const verification = await verifyRepo(opts.repoPath);
    if (!verification.success) {
      return this.#freezeResult({
        status: 'error',
        message: verification.message,
        details: verification
      });
    }

    const pullResult = await pullRepo(opts.repoPath, { remote: opts.remote, branch: opts.branch });
    if (!pullResult.success) {
      return this.#freezeResult({
        status: 'error',
        message: pullResult.message,
        details: pullResult
      });
    }

    await fs.mkdir(opts.absoluteDirectory, { recursive: true });

    return this.#freezeResult({
      status: 'ok',
      message: 'Prompt library refreshed from GitHub.',
      statusReport: await this.#buildStatus(opts)
    });
  }

  async push(options = {}) {
    const opts = this.#normalizeOptions(options);
    const verification = await verifyRepo(opts.repoPath);
    if (!verification.success) {
      return this.#freezeResult({
        status: 'error',
        message: verification.message,
        details: verification
      });
    }

    await fs.mkdir(opts.absoluteDirectory, { recursive: true });

    const pullResult = await pullRepo(opts.repoPath, { remote: opts.remote, branch: opts.branch });
    if (!pullResult.success) {
      return this.#freezeResult({
        status: 'error',
        message: pullResult.message,
        details: pullResult
      });
    }

    const staged = await this.#stageDirectory(opts);
    if (!staged.success) {
      return this.#freezeResult({
        status: 'error',
        message: staged.message,
        details: staged.details
      });
    }

    const commit = await this.#commit(opts);
    if (!commit.success && !commit.noop) {
      return this.#freezeResult({
        status: 'error',
        message: commit.message,
        details: commit.details,
        statusReport: await this.#buildStatus(opts)
      });
    }

    if (!commit.noop) {
      const pushResult = await pushRepo(opts.repoPath, { remote: opts.remote, branch: opts.branch });
      if (!pushResult.success) {
        return this.#freezeResult({
          status: 'error',
          message: pushResult.message,
          details: pushResult,
          statusReport: await this.#buildStatus(opts)
        });
      }
    }

    return this.#freezeResult({
      status: 'ok',
      message: commit.noop ? 'No prompt changes detected.' : 'Prompt library pushed to GitHub.',
      statusReport: await this.#buildStatus(opts)
    });
  }

  async sync(options = {}) {
    const pullResult = await this.pull(options);
    if (pullResult.status !== 'ok') {
      return pullResult;
    }
    const pushResult = await this.push(options);
    if (pushResult.status !== 'ok') {
      return pushResult;
    }
    return this.#freezeResult({
      status: 'ok',
      message: 'Prompt library synchronized with GitHub.',
      pull: pullResult,
      push: pushResult
    });
  }

  #normalizeOptions(options = {}) {
    const repoPath = path.resolve(options.repoPath ?? this.defaults.repoPath ?? process.cwd());
    const directory = options.directory ?? this.defaults.directory ?? 'prompts';
    if (!directory || typeof directory !== 'string') {
      throw new Error('Prompt GitHub sync requires a directory name.');
    }
    const branch = options.branch ?? this.defaults.branch ?? 'main';
    const remote = options.remote ?? this.defaults.remote ?? 'origin';
    const commitMessage = options.commitMessage ?? this.defaults.commitMessage ?? 'chore(prompts): sync prompt library';

    return {
      repoPath,
      directory,
      branch,
      remote,
      commitMessage,
      absoluteDirectory: path.resolve(repoPath, directory)
    };
  }

  async #stageDirectory(options) {
    try {
      await this.#runGit(`git add -A ${escapeArg(options.directory)}`, options.repoPath);
      this.logger.debug?.('[PromptGitHubSyncService] staged prompt directory', { directory: options.directory });
      return { success: true, message: 'Prompt directory staged.' };
    } catch (error) {
      this.logger.error?.('[PromptGitHubSyncService] staging failed', { error: error.message });
      return { success: false, message: 'Staging prompt directory failed.', details: error.message };
    }
  }

  async #commit(options) {
    try {
      await this.#runGit(`git commit -m ${escapeArg(options.commitMessage)}`, options.repoPath);
      this.logger.info?.('[PromptGitHubSyncService] commit created', { message: options.commitMessage });
      return { success: true, message: 'Prompt changes committed.' };
    } catch (error) {
      const message = error?.message || '';
      if (/nothing to commit/i.test(message)) {
        this.logger.info?.('[PromptGitHubSyncService] no changes to commit');
        return { success: false, noop: true, message: 'No prompt changes to commit.', details: message };
      }
      this.logger.error?.('[PromptGitHubSyncService] commit failed', { error: message });
      return { success: false, message: 'Prompt commit failed.', details: message };
    }
  }

  async #runGit(command, cwd) {
    this.logger.debug?.('[PromptGitHubSyncService] git command', { command, cwd });
    await execAsync(command, { cwd });
  }

  async #buildStatus(options) {
    const status = await statusRepo(options.repoPath);
    const decorated = this.#decorateStatus(status, options);
    return freezeDeep(decorated);
  }

  #decorateStatus(status, options) {
    if (!status || !status.success) {
      return status;
    }

    const filterRelevant = (entries = []) =>
      entries.filter((entry) => entry.startsWith(`${options.directory}/`) || entry === options.directory);

    return {
      ...status,
      prompts: {
        staged: filterRelevant(status.staged),
        modified: filterRelevant(status.modified),
        conflicts: filterRelevant(status.conflicts)
      }
    };
  }

  #freezeResult(payload) {
    return freezeDeep(payload);
  }
}

export function createPromptGitHubSyncService(options = {}) {
  return new PromptGitHubSyncService(options);
}
