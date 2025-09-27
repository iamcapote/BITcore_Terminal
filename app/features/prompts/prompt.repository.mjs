/**
 * Contract
 * Inputs:
 *   - Prompt definitions normalised by `normalizePromptDefinition`.
 *   - Repository options { baseDir?: string, fsImpl?: typeof import('fs').promises, now?: () => Date }.
 * Outputs:
 *   - CRUD helpers returning frozen prompt records and lightweight summaries.
 * Error modes:
 *   - Throws NotFoundError when reading/deleting a missing prompt.
 *   - Propagates filesystem errors with context when I/O fails.
 * Performance:
 *   - File-system bound; caches directory existence to avoid redundant mkdir calls.
 * Side effects:
 *   - Reads/writes JSON prompt files under the configured base directory.
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { normalizePromptDefinition, normalizePromptId, stampUpdate } from './prompt.schema.mjs';

const PROMPT_EXTENSION = '.prompt.json';

export class NotFoundError extends Error {
  constructor(id) {
    super(`Prompt \"${id}\" not found.`);
    this.name = 'NotFoundError';
    this.id = id;
  }
}

export class PromptRepository {
  #dirReady = false;

  constructor({ baseDir = path.resolve(process.cwd(), 'prompts'), fsImpl = fs, now = () => new Date() } = {}) {
    this.baseDir = baseDir;
    this.fs = fsImpl;
    this.now = now;
  }

  async listSummaries() {
    const records = await this.listRecords();
    const summaries = records.map((record) => Object.freeze({
      id: record.id,
      title: record.title,
      description: record.description,
      tags: record.tags,
      version: record.version,
      updatedAt: record.updatedAt
    }));
    return Object.freeze([...summaries]);
  }

  async listRecords() {
    await this.#ensureDir();
    const entries = await this.fs.readdir(this.baseDir, { withFileTypes: true });
    const records = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(PROMPT_EXTENSION)) continue;
      try {
        const record = await this.#readRecord(path.join(this.baseDir, entry.name));
        records.push(record);
      } catch (error) {
        if (error instanceof NotFoundError || error?.code === 'ENOENT') continue;
        throw error;
      }
    }

    records.sort((a, b) => a.id.localeCompare(b.id));
    return Object.freeze([...records]);
  }

  async get(idLike) {
    const id = normalizePromptId(idLike);
    try {
      const record = await this.#readRecord(this.#filePath(id));
      return Object.freeze(record);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundError(id);
      }
      throw error;
    }
  }

  async save(definitionInput) {
    await this.#ensureDir();
    const normalized = normalizePromptDefinition(definitionInput, { now: this.now });
    const filePath = this.#filePath(normalized.id);

    let recordToPersist = normalized;

    try {
      const existing = await this.#readRecord(this.#filePath(normalized.id));
      recordToPersist = stampUpdate({
        ...normalized,
        createdAt: existing.createdAt,
        version: existing.version
      }, { now: this.now });
    } catch (error) {
      if (!(error instanceof NotFoundError) && error?.code !== 'ENOENT') {
        throw error;
      }
      // First write retains normalization defaults (version=1, timestamps set once).
      recordToPersist = normalized;
    }

    await this.fs.writeFile(filePath, `${JSON.stringify(recordToPersist, null, 2)}\n`, 'utf8');
    return recordToPersist;
  }

  async delete(idLike) {
    await this.#ensureDir();
    const id = normalizePromptId(idLike);
    const filePath = this.#filePath(id);
    try {
      await this.fs.unlink(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundError(id);
      }
      throw error;
    }
  }

  async exists(idLike) {
    const id = normalizePromptId(idLike);
    try {
      await this.fs.access(this.#filePath(id));
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  #filePath(id) {
    return path.join(this.baseDir, `${id}${PROMPT_EXTENSION}`);
  }

  async #ensureDir() {
    if (this.#dirReady) return;
    await this.fs.mkdir(this.baseDir, { recursive: true });
    this.#dirReady = true;
  }

  async #readRecord(filePath) {
    const raw = await this.fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizePromptDefinition(parsed);
  }
}
