/**
 * Contract
 * Inputs:
 *   - MissionGitHubSyncOptions {
 *       repoPath: string;
 *       filePath: string;
 *       branch?: string;
 *       remote?: string;
 *       commitMessage?: string;
 *       strategy?: 'ours' | 'theirs';
 *     }
 *   - payload?: { content: string }
 * Outputs:
 *   - MissionGitHubSyncResult {
 *       status: 'ok' | 'conflict' | 'error';
 *       message: string;
 *       details?: object;
 *       statusReport?: GitStatusReport;
 *     }
 * Error modes:
 *   - ValidationError when repoPath/filePath missing
 *   - Conflict state bubbled as status === 'conflict'
 *   - Unexpected errors reported with status === 'error'
 * Performance:
 *   - time: soft 2s, hard 5s; memory: <5 MB (file buffered)
 * Side effects:
 *   - Reads/writes mission manifest file in git repo
 *   - Executes git commands through infrastructure adapter
 * Telemetry:
 *   - Compose logs for sync actions (expected to be wrapped by controller)
 */

import fs from 'fs/promises';
import path from 'path';
import { freezeDeep } from '../../utils/object.freeze.mjs';
import {
  verifyRepo,
  pullRepo,
  pushRepo,
  statusRepo,
  resolveConflicts,
  commitRepo
} from '../../infrastructure/missions/github-sync.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class MissionGitHubSyncService {
  constructor({ defaults = {}, logger = noopLogger } = {}) {
    this.defaults = {
      repoPath: defaults.repoPath,
      filePath: defaults.filePath,
      branch: defaults.branch || 'main',
      remote: defaults.remote || 'origin',
      commitMessage: defaults.commitMessage || 'chore(missions): sync mission manifest',
      strategy: defaults.strategy || 'ours'
    };
    this.logger = logger ?? noopLogger;
  }

  get defaultsConfig() {
    return freezeDeep({ ...this.defaults });
  }

  async load(options = {}) {
    const opts = this.#normalizeOptions(options);
    const verification = await verifyRepo(opts.repoPath);
    if (!verification.success) {
      return this.#freezeResult({
        status: 'error',
        message: verification.message,
        details: verification
      });
    }

    const status = await pullRepo(opts.repoPath, { remote: opts.remote, branch: opts.branch });
    if (!status.success) {
      return this.#freezeResult({ status: 'error', message: status.message, details: status });
    }

    const content = await this.#readContent(this.#toAbsoluteFile(opts));
    return this.#freezeResult({
      status: 'ok',
      message: content ? 'Manifest loaded.' : 'Manifest not found.',
      payload: content,
      statusReport: await this.#buildStatus(opts)
    });
  }

  async save(options = {}, payload) {
    const opts = this.#normalizeOptions(options);
    const verification = await verifyRepo(opts.repoPath);
    if (!verification.success) {
      return this.#freezeResult({
        status: 'error',
        message: verification.message,
        details: verification
      });
    }

    if (!payload || typeof payload.content !== 'string') {
      return this.#freezeResult({
        status: 'error',
        message: 'Mission manifest save requires payload.content string.'
      });
    }

    const pull = await pullRepo(opts.repoPath, { remote: opts.remote, branch: opts.branch });
    if (!pull.success) {
      return this.#freezeResult({ status: 'error', message: pull.message, details: pull });
    }

    await this.#writeContent(this.#toAbsoluteFile(opts), payload.content);

    const commit = await commitRepo(opts.repoPath, {
      filePath: opts.filePath,
      message: opts.commitMessage
    });
    if (!commit.success) {
      const statusReport = await this.#buildStatus(opts);
      if (statusReport.conflicts.length > 0) {
        return this.#freezeResult({
          status: 'conflict',
          message: 'Conflicts detected while committing mission manifest.',
          statusReport
        });
      }
      return this.#freezeResult({ status: 'error', message: commit.message, details: commit });
    }

    const push = await pushRepo(opts.repoPath, { remote: opts.remote, branch: opts.branch });
    if (!push.success) {
      return this.#freezeResult({ status: 'error', message: push.message, details: push });
    }

    return this.#freezeResult({
      status: 'ok',
      message: 'Mission manifest synced to GitHub.',
      statusReport: await this.#buildStatus(opts)
    });
  }

  async resolve(options = {}, { filePath, strategy } = {}) {
    const opts = this.#normalizeOptions({ ...options, filePath: filePath || options.filePath });
    const resolution = await resolveConflicts(opts.repoPath, {
      filePath: opts.filePath,
      strategy: strategy || opts.strategy
    });
    const statusReport = await this.#buildStatus(opts);
    return this.#freezeResult({
      status: resolution.success ? 'ok' : 'error',
      message: resolution.message,
      details: resolution,
      statusReport
    });
  }

  async inspect(options = {}) {
    const opts = this.#normalizeOptions(options, { allowMissingFile: true });
    return this.#freezeResult({
      status: 'ok',
      message: 'Mission GitHub status captured.',
      statusReport: await this.#buildStatus(opts)
    });
  }

  #normalizeOptions(options = {}, { allowMissingFile = false } = {}) {
    const {
      repoPath = this.defaults.repoPath,
      filePath = this.defaults.filePath,
      branch = this.defaults.branch,
      remote = this.defaults.remote,
      commitMessage = this.defaults.commitMessage,
      strategy = this.defaults.strategy
    } = options;

    if (!repoPath) {
      throw new Error('Mission GitHub sync requires repoPath.');
    }
    if (!allowMissingFile && !filePath) {
      throw new Error('Mission GitHub sync requires filePath.');
    }

    return {
      repoPath: path.resolve(repoPath),
      filePath,
      branch,
      remote,
      commitMessage,
      strategy
    };
  }

  #toAbsoluteFile({ repoPath, filePath }) {
    if (!filePath) return null;
    return path.resolve(repoPath, filePath);
  }

  async #writeContent(targetPath, content) {
    if (!targetPath) {
      throw new Error('Cannot write mission manifest without a filePath.');
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');
  }

  async #readContent(targetPath) {
    if (!targetPath) return null;
    try {
      return await fs.readFile(targetPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async #buildStatus(options) {
    const status = await statusRepo(options.repoPath);
    return freezeDeep(status);
  }

  #freezeResult(payload) {
    return freezeDeep(payload);
  }
}

export function createMissionGitHubSyncService(overrides = {}) {
  return new MissionGitHubSyncService(overrides);
}
