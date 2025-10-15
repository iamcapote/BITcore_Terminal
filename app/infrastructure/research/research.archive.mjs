/**
 * Contract
 * Inputs:
 *   - artifact: ResearchArtifact { content: string; summary?: string|null; query?: string|null; filename?: string|null;
 *       depth?: number; breadth?: number; isPublic?: boolean; createdBy?: string|null; telemetry?: object|null }
 *   - options?: { directory?: string; maxEntries?: number; maxSizeBytes?: number }
 * Outputs:
 *   - saveResearchArtifact => Promise<{ id: string; createdAt: string }>
 *   - listResearchArtifacts => Promise<ResearchArtifactSummary[]>
 *   - getResearchArtifact => Promise<ResearchArtifactRecord>
 * Error modes:
 *   - Throws when the archive directory cannot be created or artifacts are missing.
 * Performance:
 *   - Optimized for dozens of artifacts; list operation performs single pass JSON parsing.
 * Side effects:
 *   - Creates JSON files on disk under the archive directory; enforces retention as configured.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import config from '../../config/index.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('infrastructure.research.archive');

function resolveDefaults() {
  const archiveConfig = config?.research?.archive ?? {};
  const directory = archiveConfig.directory;
  const maxEntries = Number.isInteger(archiveConfig.maxEntries) && archiveConfig.maxEntries > 0
    ? archiveConfig.maxEntries
    : 100;
  const maxSizeBytes = Number.isInteger(archiveConfig.maxSizeBytes) && archiveConfig.maxSizeBytes > 0
    ? archiveConfig.maxSizeBytes
    : 0;
  return { directory, maxEntries, maxSizeBytes, enabled: archiveConfig.enabled !== false };
}

function sanitizeId(candidate) {
  if (typeof candidate !== 'string') {
    throw new Error('Artifact id must be a string.');
  }
  const normalized = candidate.trim();
  if (!normalized) {
    throw new Error('Artifact id is required.');
  }
  if (!/^[a-z0-9\-]+$/i.test(normalized)) {
    throw new Error('Artifact id contains invalid characters.');
  }
  if (normalized.includes('..')) {
    throw new Error('Artifact id cannot include path traversal segments.');
  }
  return normalized;
}

async function ensureArchiveDirectory(directoryOverride) {
  const defaults = resolveDefaults();
  const directory = directoryOverride || defaults.directory;
  if (!directory) {
    throw new Error('Research archive directory is not configured.');
  }
  await ensureDir(directory);
  return { directory, defaults };
}

function buildId() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  return `${timestamp}-${randomSuffix}`;
}

async function pruneArchive(directory, { maxEntries }) {
  if (!maxEntries || maxEntries <= 0) {
    return;
  }
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const artifactFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name);
  if (artifactFiles.length <= maxEntries) {
    return;
  }
  const records = await Promise.all(artifactFiles.map(async (file) => {
    const filePath = path.join(directory, file);
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      return { file: filePath, createdAt: new Date(data.createdAt || 0).getTime() };
    } catch (error) {
      moduleLogger.warn('Failed to parse archive entry during pruning.', { file: filePath, error: error?.message || String(error) });
      return { file: filePath, createdAt: 0 };
    }
  }));
  records.sort((a, b) => b.createdAt - a.createdAt);
  const stale = records.slice(maxEntries);
  await Promise.allSettled(stale.map((record) => fs.unlink(record.file)));
}

function toSummary(record) {
  const contentBytes = typeof record.bytes === 'number'
    ? record.bytes
    : (record.content ? Buffer.byteLength(record.content, 'utf8') : 0);
  return Object.freeze({
    id: record.id,
    createdAt: record.createdAt,
    summary: record.summary ?? null,
    query: record.query ?? null,
    filename: record.filename ?? null,
    depth: record.depth ?? null,
    breadth: record.breadth ?? null,
    isPublic: record.isPublic ?? null,
    bytes: contentBytes,
  });
}

export async function saveResearchArtifact(artifact, options = {}) {
  const { directory, defaults } = await ensureArchiveDirectory(options.directory);
  if (defaults.enabled === false) {
    return null;
  }
  const payload = artifact || {};
  if (!payload.content || typeof payload.content !== 'string') {
    return null;
  }
  const contentBytes = Buffer.byteLength(payload.content, 'utf8');
  const maxSizeBytes = options.maxSizeBytes ?? defaults.maxSizeBytes;
  if (maxSizeBytes && contentBytes > maxSizeBytes) {
    moduleLogger.warn('Skipping archive write: content exceeds configured size limit.', {
      bytes: contentBytes,
      maxSizeBytes
    });
    return null;
  }
  const record = {
    id: buildId(),
    createdAt: new Date().toISOString(),
    content: payload.content,
    summary: payload.summary ?? null,
    query: payload.query ?? null,
    filename: payload.filename ?? null,
    depth: payload.depth ?? null,
    breadth: payload.breadth ?? null,
    isPublic: payload.isPublic ?? null,
    createdBy: payload.createdBy ?? null,
    engine: payload.engine ?? null,
    bytes: contentBytes
  };
  const filePath = path.join(directory, `${record.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
  await pruneArchive(directory, {
    maxEntries: options.maxEntries ?? defaults.maxEntries,
  });
  return { id: record.id, createdAt: record.createdAt };
}

async function readArtifactFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function listResearchArtifacts(options = {}) {
  const { directory } = await ensureArchiveDirectory(options.directory);
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const artifacts = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      try {
        const record = await readArtifactFile(path.join(directory, entry.name));
        artifacts.push(toSummary(record));
      } catch (error) {
        moduleLogger.warn('Failed to read archive entry during listing.', {
          file: entry.name,
          error: error?.message || String(error),
        });
      }
    }
    artifacts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : artifacts.length;
    return Object.freeze(artifacts.slice(0, limit));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return Object.freeze([]);
    }
    throw error;
  }
}

export async function getResearchArtifact(id, options = {}) {
  const safeId = sanitizeId(id);
  const { directory } = await ensureArchiveDirectory(options.directory);
  const filePath = path.join(directory, `${safeId}.json`);
  try {
    const record = await readArtifactFile(filePath);
    return Object.freeze(record);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Research artifact ${safeId} not found.`);
    }
    throw error;
  }
}

export async function clearResearchArtifacts(options = {}) {
  const { directory } = await ensureArchiveDirectory(options.directory);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      await fs.unlink(path.join(directory, entry.name));
    }
  }));
}
