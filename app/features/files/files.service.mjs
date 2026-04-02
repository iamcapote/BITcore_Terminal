/**
 * FilesService
 * Why: Provide a secure workspace-bounded filesystem seam for explorer surfaces.
 * What: Exposes directory listing, file read/preview, and filename/content search primitives.
 * How: Resolves all user paths against a fixed root, rejects traversal, and returns normalized snapshots.
 */

import fs from 'fs/promises';
import path from 'path';

const DEFAULT_MAX_READ_BYTES = 256 * 1024;
const DEFAULT_PREVIEW_BYTES = 16 * 1024;
const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;
const DEFAULT_TREE_DEPTH = 4;
const MAX_TREE_DEPTH = 8;
const MAX_TREE_ENTRIES = 2000;

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

export class FilesService {
  #rootDir;
  #fs;
  #path;

  constructor(options = {}) {
    const rootDir = options.rootDir ?? process.cwd();
    this.#rootDir = path.resolve(rootDir);
    this.#fs = options.fsModule ?? fs;
    this.#path = options.pathModule ?? path;
  }

  get rootDir() {
    return this.#rootDir;
  }

  async listDirectory(relativePath = '.') {
    const targetPath = this.#resolveSafePath(relativePath);
    const stats = await this.#safeStat(targetPath);
    if (!stats.isDirectory()) {
      throw new ValidationError('ValidationError: path must reference a directory');
    }

    const children = await this.#fs.readdir(targetPath, { withFileTypes: true });
    const entries = await Promise.all(
      children.map(async (entry) => {
        const absolute = this.#path.join(targetPath, entry.name);
        const entryStats = await this.#safeStat(absolute);
        const normalizedPath = this.#toRelative(absolute);
        return Object.freeze({
          name: entry.name,
          path: normalizedPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isDirectory() ? null : entryStats.size,
          modifiedAt: typeof entryStats.mtime?.toISOString === 'function' ? entryStats.mtime.toISOString() : null,
        });
      }),
    );

    entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return Object.freeze({
      root: this.#rootDir,
      path: this.#toRelative(targetPath),
      entries: Object.freeze(entries),
    });
  }

  async getTree(relativePath = '.', options = {}) {
    const depth = Math.min(
      this.#normalizePositiveInteger(options.depth, DEFAULT_TREE_DEPTH, 'depth'),
      MAX_TREE_DEPTH,
    );
    const maxEntries = this.#normalizePositiveInteger(options.maxEntries, MAX_TREE_ENTRIES, 'maxEntries');
    const targetPath = this.#resolveSafePath(relativePath);
    const stats = await this.#safeStat(targetPath);
    if (!stats.isDirectory()) {
      throw new ValidationError('ValidationError: path must reference a directory');
    }

    let count = 0;
    const walk = async (absolutePath, remainingDepth) => {
      if (count >= maxEntries) {
        return [];
      }

      const children = await this.#fs.readdir(absolutePath, { withFileTypes: true });
      const mapped = [];
      for (const child of children) {
        if (count >= maxEntries) break;
        if (child.name === '.git' || child.name === 'node_modules') continue;
        const childPath = this.#path.join(absolutePath, child.name);
        const childStats = await this.#safeStat(childPath);
        const isDirectory = child.isDirectory();
        const node = {
          name: child.name,
          path: this.#toRelative(childPath),
          type: isDirectory ? 'directory' : 'file',
          size: isDirectory ? null : childStats.size,
          modifiedAt: typeof childStats.mtime?.toISOString === 'function' ? childStats.mtime.toISOString() : null,
        };
        count += 1;

        if (isDirectory && remainingDepth > 1) {
          const childrenNodes = await walk(childPath, remainingDepth - 1);
          mapped.push(Object.freeze({ ...node, children: Object.freeze(childrenNodes) }));
        } else {
          mapped.push(Object.freeze(node));
        }
      }

      mapped.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      return mapped;
    };

    const nodes = await walk(targetPath, depth);
    return Object.freeze({
      root: this.#rootDir,
      path: this.#toRelative(targetPath),
      depth,
      truncated: count >= maxEntries,
      nodes: Object.freeze(nodes),
    });
  }

  async readFile(relativePath, options = {}) {
    const maxBytes = this.#normalizePositiveInteger(options.maxBytes, DEFAULT_MAX_READ_BYTES, 'maxBytes');
    return this.#readFileInternal(relativePath, maxBytes);
  }

  async previewFile(relativePath) {
    return this.#readFileInternal(relativePath, DEFAULT_PREVIEW_BYTES);
  }

  async search(query, options = {}) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new ValidationError('ValidationError: query must be a non-empty string');
    }

    const limit = Math.min(
      this.#normalizePositiveInteger(options.limit, DEFAULT_SEARCH_LIMIT, 'limit'),
      MAX_SEARCH_LIMIT,
    );
    const basePath = this.#resolveSafePath(options.path ?? '.');
    const baseStats = await this.#safeStat(basePath);
    if (!baseStats.isDirectory()) {
      throw new ValidationError('ValidationError: search path must reference a directory');
    }

    const needle = query.trim().toLowerCase();
    const queue = [basePath];
    const results = [];
    while (queue.length > 0 && results.length < limit) {
      const currentDir = queue.shift();
      const children = await this.#fs.readdir(currentDir, { withFileTypes: true });
      for (const child of children) {
        if (results.length >= limit) break;
        if (child.name === '.git' || child.name === 'node_modules') continue;
        const absolute = this.#path.join(currentDir, child.name);
        const relative = this.#toRelative(absolute);
        const isDirectory = child.isDirectory();

        if (child.name.toLowerCase().includes(needle)) {
          results.push(
            Object.freeze({
              name: child.name,
              path: relative,
              type: isDirectory ? 'directory' : 'file',
            }),
          );
        }

        if (isDirectory) {
          queue.push(absolute);
        }
      }
    }

    return Object.freeze({
      root: this.#rootDir,
      path: this.#toRelative(basePath),
      query: query.trim(),
      results: Object.freeze(results),
    });
  }

  async #readFileInternal(relativePath, maxBytes) {
    const targetPath = this.#resolveSafePath(relativePath);
    const stats = await this.#safeStat(targetPath);
    if (!stats.isFile()) {
      throw new ValidationError('ValidationError: path must reference a file');
    }

    const buffer = await this.#fs.readFile(targetPath);
    const truncated = buffer.byteLength > maxBytes;
    const view = truncated ? buffer.subarray(0, maxBytes) : buffer;
    const content = this.#toTextPreview(view);

    return Object.freeze({
      root: this.#rootDir,
      path: this.#toRelative(targetPath),
      bytes: buffer.byteLength,
      truncated,
      content,
    });
  }

  #toTextPreview(buffer) {
    const utf8 = buffer.toString('utf8');
    const sample = utf8.slice(0, 2048);
    const hasControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(sample);
    if (hasControlChars) {
      return '[Binary file preview unavailable]';
    }
    return utf8;
  }

  #resolveSafePath(relativePath) {
    if (typeof relativePath !== 'string') {
      throw new ValidationError('ValidationError: path must be a string');
    }

    const normalizedInput = relativePath.trim() === '' ? '.' : relativePath.trim();
    const resolved = this.#path.resolve(this.#rootDir, normalizedInput);
    if (!this.#isWithinRoot(resolved)) {
      throw new ValidationError('ValidationError: path escapes workspace root');
    }
    return resolved;
  }

  #isWithinRoot(candidatePath) {
    return candidatePath === this.#rootDir || candidatePath.startsWith(`${this.#rootDir}${this.#path.sep}`);
  }

  #toRelative(absolutePath) {
    const relative = this.#path.relative(this.#rootDir, absolutePath);
    if (!relative) return '.';
    return relative.split(this.#path.sep).join('/');
  }

  #normalizePositiveInteger(input, fallback, fieldName) {
    if (input === undefined || input === null) return fallback;
    const parsed = Number(input);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new ValidationError(`ValidationError: ${fieldName} must be a positive integer`);
    }
    return parsed;
  }

  async #safeStat(targetPath) {
    try {
      return await this.#fs.stat(targetPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundError('NotFoundError: path does not exist');
      }
      throw error;
    }
  }
}

export function createFilesService(options = {}) {
  return new FilesService(options);
}
