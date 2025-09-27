/**
 * Contract
 * Inputs:
 *   - GitHub configuration resolved per call via `configLoader` (owner, repo, branch, token).
 *   - Octokit-compatible client factory producing a REST client bound to the decrypted token.
 *   - File payloads containing UTF-8 markdown/JSON strings destined for the research repository.
 * Outputs:
 *   - verify(): Repository + branch metadata confirming credentials are valid.
 *   - pullDirectory(): Normalized listings for the configured research directory.
 *   - pullFile(): Decoded UTF-8 contents for a specific research artifact.
 *   - pushFiles() / uploadFile(): Commit summaries (commit SHA/URL, file SHA/URL) for written artifacts.
 * Error modes:
 *   - Throws RangeError for missing/invalid configuration.
 *   - Throws when GitHub API calls fail (propagates Octokit error.message).
 * Performance:
 *   - Network-bound; no local disk access or in-memory caching beyond per-call response shaping.
 * Side effects:
 *   - Issues GitHub REST API requests (read/write) using the supplied credentials.
 */

import { Octokit } from '@octokit/rest';
import { Buffer } from 'buffer';
import { userManager as defaultUserManager } from '../auth/user-manager.mjs';

const DEFAULT_BASE_PATH = 'research';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

export class GitHubResearchSyncService {
  constructor({ configLoader, octokitFactory, basePath = DEFAULT_BASE_PATH, logger = noopLogger } = {}) {
    this.configLoader = typeof configLoader === 'function'
      ? configLoader
      : async () => {
          if (!defaultUserManager || typeof defaultUserManager.getDecryptedGitHubConfig !== 'function') {
            throw new Error('GitHub configuration loader is not available');
          }
          return defaultUserManager.getDecryptedGitHubConfig();
        };

    this.octokitFactory = typeof octokitFactory === 'function'
      ? octokitFactory
      : (config) => new Octokit({ auth: config.token });

    this.basePath = this.#normalizeBasePath(basePath);
    this.logger = logger ?? noopLogger;
  }

  async verify() {
    const config = await this.#resolveConfig();
    const client = this.#createClient(config);

    try {
      const repoResponse = await client.repos.get({ owner: config.owner, repo: config.repo });
      const branchResponse = await client.repos.getBranch({ owner: config.owner, repo: config.repo, branch: config.branch });

      return Object.freeze({
        ok: true,
        repository: Object.freeze({
          name: repoResponse.data.name,
          private: Boolean(repoResponse.data.private),
          defaultBranch: repoResponse.data.default_branch,
          htmlUrl: repoResponse.data.html_url ?? null
        }),
        branch: Object.freeze({
          name: branchResponse.data.name,
          commitSha: branchResponse.data.commit?.sha ?? null,
          protected: Boolean(branchResponse.data.protected ?? false)
        }),
        config: Object.freeze({
          owner: config.owner,
          repo: config.repo,
          branch: config.branch
        })
      });
    } catch (error) {
      this.logger?.warn?.(`[GitHubResearchSyncService] verify failed: ${error.message}`);
      const failure = new Error(`GitHub verification failed: ${error.message}`);
      if (error && typeof error.status === 'number') {
        failure.status = error.status;
      }
      throw failure;
    }
  }

  async pullDirectory({ path = '', ref } = {}) {
    const config = await this.#resolveConfig();
    const client = this.#createClient(config);
    const resolvedPath = this.#resolvePath(path);
    const targetRef = ref || config.branch;

    try {
      const response = await client.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: resolvedPath || '',
        ref: targetRef
      });

      const data = response.data;
      const entries = Array.isArray(data)
        ? data.map((entry) => this.#normalizeEntry(entry))
        : [this.#normalizeEntry(data)];

      return Object.freeze({
        path: resolvedPath,
        ref: targetRef,
        entries: Object.freeze(entries)
      });
    } catch (error) {
      if (error.status === 404) {
        return Object.freeze({ path: resolvedPath, ref: targetRef, entries: Object.freeze([]) });
      }
      this.logger?.error?.(`[GitHubResearchSyncService] pullDirectory failed for ${resolvedPath}: ${error.message}`);
      throw new Error(`Failed to pull directory '${resolvedPath}': ${error.message}`);
    }
  }

  async pullFile({ path, ref } = {}) {
    if (!path) {
      throw new RangeError('pullFile requires a path');
    }

    const config = await this.#resolveConfig();
    const client = this.#createClient(config);
    const resolvedPath = this.#resolvePath(path);
    const targetRef = ref || config.branch;

    try {
      const response = await client.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: resolvedPath,
        ref: targetRef
      });

      if (!response.data || response.data.type !== 'file') {
        throw new Error(`GitHub returned ${response.data?.type ?? 'unknown'} for path ${resolvedPath}`);
      }

      const encoding = response.data.encoding || 'base64';
      const rawContent = response.data.content || '';
      const normalizedContent = Buffer.from(rawContent.replace(/\n/g, ''), encoding).toString('utf8');

      return Object.freeze({
        path: resolvedPath,
        ref: targetRef,
        sha: response.data.sha,
        size: response.data.size,
        content: normalizedContent,
        downloadUrl: response.data.download_url ?? response.data.html_url ?? null
      });
    } catch (error) {
      this.logger?.error?.(`[GitHubResearchSyncService] pullFile failed for ${resolvedPath}: ${error.message}`);
      const failure = new Error(`Failed to pull file '${resolvedPath}': ${error.message}`);
      if (error && typeof error.status === 'number') {
        failure.status = error.status;
      }
      throw failure;
    }
  }

  async pushFiles({ files, message, branch } = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new RangeError('pushFiles requires a non-empty files array');
    }

    const config = await this.#resolveConfig();
    const client = this.#createClient(config);
    const targetBranch = branch || config.branch;

    const summaries = [];
    for (const file of files) {
      const repoPath = this.#resolvePath(file?.path);
      if (!repoPath) {
        throw new RangeError('Each file requires a path');
      }
      if (typeof file.content !== 'string') {
        throw new RangeError(`File '${repoPath}' content must be a UTF-8 string`);
      }

      let existingSha = undefined;
      try {
        const existing = await client.repos.getContent({
          owner: config.owner,
          repo: config.repo,
          path: repoPath,
          ref: targetBranch
        });
        if (existing?.data?.sha) {
          existingSha = existing.data.sha;
        }
      } catch (readError) {
        if (readError.status !== 404) {
          const inspectError = new Error(`Failed to inspect '${repoPath}': ${readError.message}`);
          if (readError && typeof readError.status === 'number') {
            inspectError.status = readError.status;
          }
          throw inspectError;
        }
      }

      const commitMessage = message || `Update ${repoPath}`;
      const encodedContent = Buffer.from(file.content, 'utf8').toString('base64');

      try {
        const response = await client.repos.createOrUpdateFileContents({
          owner: config.owner,
          repo: config.repo,
          path: repoPath,
          message: commitMessage,
          branch: targetBranch,
          content: encodedContent,
          sha: existingSha
        });

        summaries.push(Object.freeze({
          path: repoPath,
          branch: targetBranch,
          commitSha: response.data.commit?.sha ?? null,
          commitUrl: response.data.commit?.html_url ?? null,
          fileSha: response.data.content?.sha ?? null,
          fileUrl: response.data.content?.html_url ?? null
        }));
      } catch (writeError) {
        const failure = new Error(`Failed to push '${repoPath}': ${writeError.message}`);
        if (writeError && typeof writeError.status === 'number') {
          failure.status = writeError.status;
        }
        throw failure;
      }
    }

    return Object.freeze(summaries);
  }

  async uploadFile({ path, content, message, branch } = {}) {
    if (!path) {
      throw new RangeError('uploadFile requires a path');
    }
    if (typeof content !== 'string') {
      throw new RangeError('uploadFile content must be a string');
    }

    const [summary] = await this.pushFiles({
      files: [{ path, content }],
      message: message || `Upload ${path}`,
      branch
    });
    return summary;
  }

  async #resolveConfig() {
    const config = await this.configLoader();
    if (!config || !config.owner || !config.repo) {
      throw new RangeError('GitHub configuration is incomplete (owner/repo required)');
    }
    if (!config.branch) {
      throw new RangeError('GitHub configuration is missing branch');
    }
    if (!config.token) {
      throw new RangeError('GitHub token is required to sync research artifacts');
    }
    return config;
  }

  #createClient(config) {
    const client = this.octokitFactory(config);
    if (!client || !client.repos) {
      throw new Error('Octokit factory returned an invalid client');
    }
    return client;
  }

  #normalizeBasePath(pathLike) {
    if (!pathLike) return '';
    return String(pathLike).replace(/^\/+/, '').replace(/\/+$/, '');
  }

  #resolvePath(pathLike) {
    const candidate = typeof pathLike === 'string' ? pathLike : '';
    const trimmed = candidate.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!this.basePath) {
      return trimmed;
    }
    if (!trimmed) {
      return this.basePath;
    }
    return `${this.basePath}/${trimmed}`.replace(/\/+/, '/');
  }

  #normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return Object.freeze({ type: 'unknown', name: null, path: null, sha: null, size: null, url: null });
    }
    return Object.freeze({
      type: entry.type,
      name: entry.name ?? null,
      path: entry.path ?? null,
      sha: entry.sha ?? null,
      size: entry.size ?? null,
      url: entry.download_url ?? entry.html_url ?? null
    });
  }
}

export function createGitHubResearchSyncService(overrides = {}) {
  return new GitHubResearchSyncService(overrides);
}
