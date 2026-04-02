/**
 * WorkspaceGitService
 * Why: Provide safe Git primitives for explorer-led recovery and branch workflows.
 * What: Exposes status, branch listing/creation, checkout, file history, and file-level revert.
 * How: Executes git with argument arrays in a fixed workspace repo and normalizes output for API consumers.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 200;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class WorkspaceGitService {
  #repoDir;
  #path;

  constructor(options = {}) {
    this.#repoDir = path.resolve(options.repoDir ?? process.cwd());
    this.#path = options.pathModule ?? path;
  }

  get repoDir() {
    return this.#repoDir;
  }

  async getStatus() {
    await this.#ensureRepository();
    const branchName = (await this.#runGit(['branch', '--show-current'])).trim() || 'detached';
    const porcelain = (await this.#runGit(['status', '--porcelain=v1'])).trim();
    const entries = porcelain ? porcelain.split('\n').filter(Boolean) : [];

    const files = entries.map((line) => {
      const code = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      return Object.freeze({
        path: filePath,
        code,
        staged: code[0] !== ' ' && code[0] !== '?',
        modified: code[1] !== ' ',
        untracked: code[0] === '?' || code[1] === '?',
      });
    });

    return Object.freeze({
      repoDir: this.#repoDir,
      branch: branchName,
      clean: files.length === 0,
      files: Object.freeze(files),
    });
  }

  async listBranches() {
    await this.#ensureRepository();
    const stdout = await this.#runGit(['branch', '--list', '--format=%(refname:short)']);
    const current = (await this.#runGit(['branch', '--show-current'])).trim();
    const branches = stdout
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((name) => Object.freeze({ name, current: name === current }));

    return Object.freeze({
      repoDir: this.#repoDir,
      current,
      branches: Object.freeze(branches),
    });
  }

  async createBranch(name, from = null) {
    const branchName = this.#validateBranchName(name);
    await this.#ensureRepository();
    const args = from ? ['branch', branchName, from] : ['branch', branchName];
    await this.#runGit(args);
    return this.listBranches();
  }

  async checkoutBranch(name) {
    const branchName = this.#validateBranchName(name);
    await this.#ensureRepository();
    await this.#runGit(['checkout', branchName]);
    return this.getStatus();
  }

  async getFileHistory(relativePath, options = {}) {
    const filePath = this.#validateWorkspacePath(relativePath);
    await this.#ensureRepository();
    const limit = this.#normalizeLimit(options.limit);
    const format = '%H|%h|%an|%ad|%s';
    const stdout = await this.#runGit([
      'log',
      `--max-count=${limit}`,
      '--date=iso-strict',
      `--pretty=format:${format}`,
      '--',
      filePath,
    ]);

    const commits = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, date, ...subjectParts] = line.split('|');
        return Object.freeze({
          hash,
          shortHash,
          author,
          date,
          subject: subjectParts.join('|'),
        });
      });

    return Object.freeze({
      repoDir: this.#repoDir,
      path: filePath,
      commits: Object.freeze(commits),
    });
  }

  async revertFile(relativePath) {
    const filePath = this.#validateWorkspacePath(relativePath);
    await this.#ensureRepository();
    await this.#runGit(['checkout', '--', filePath]);
    return this.getStatus();
  }

  async #ensureRepository() {
    try {
      const output = (await this.#runGit(['rev-parse', '--is-inside-work-tree'])).trim();
      if (output !== 'true') {
        throw new NotFoundError('NotFoundError: workspace is not a git repository');
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError('NotFoundError: workspace is not a git repository');
    }
  }

  async #runGit(args) {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd: this.#repoDir });
      return stdout;
    } catch (error) {
      const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
      const message = stderr || error?.message || 'Git command failed';
      throw new Error(message);
    }
  }

  #normalizeLimit(limit) {
    if (limit === undefined || limit === null) return DEFAULT_HISTORY_LIMIT;
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new ValidationError('ValidationError: limit must be a positive integer');
    }
    return Math.min(parsed, MAX_HISTORY_LIMIT);
  }

  #validateBranchName(name) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('ValidationError: branch name is required');
    }
    const trimmed = name.trim();
    if (!/^[A-Za-z0-9._/-]+$/.test(trimmed) || trimmed.includes('..') || trimmed.startsWith('-')) {
      throw new ValidationError('ValidationError: invalid branch name');
    }
    return trimmed;
  }

  #validateWorkspacePath(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
      throw new ValidationError('ValidationError: file path is required');
    }
    const trimmed = relativePath.trim();
    const resolved = this.#path.resolve(this.#repoDir, trimmed);
    if (resolved !== this.#repoDir && !resolved.startsWith(`${this.#repoDir}${this.#path.sep}`)) {
      throw new ValidationError('ValidationError: path escapes workspace root');
    }
    return trimmed.split('\\').join('/');
  }
}

export function createWorkspaceGitService(options = {}) {
  return new WorkspaceGitService(options);
}
