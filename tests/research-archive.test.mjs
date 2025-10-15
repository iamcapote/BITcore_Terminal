/**
 * Why: Verify durable research archive helpers persist, list, and retrieve artifacts correctly.
 * What: Exercises save/list/get flows against a temporary directory to ensure metadata integrity.
 * How: Writes artifacts to a temp path, inspects summaries, and confirms retrieval payloads.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import {
  saveResearchArtifact,
  listResearchArtifacts,
  getResearchArtifact,
  clearResearchArtifacts
} from '../app/infrastructure/research/research.archive.mjs';

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'research-archive-'));
  await clearResearchArtifacts({ directory: tempDir });
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('research archive', () => {
  test('saves artifacts and returns in list order', async () => {
    await saveResearchArtifact({
      content: '# Report 1',
      summary: 'First summary',
      query: 'topic one',
      filename: 'report-one.md'
    }, { directory: tempDir, maxEntries: 10 });

    await saveResearchArtifact({
      content: '# Report 2',
      summary: 'Second summary',
      query: 'topic two',
      filename: 'report-two.md'
    }, { directory: tempDir, maxEntries: 10 });

    const entries = await listResearchArtifacts({ directory: tempDir });
    expect(entries).toHaveLength(2);
    const summaries = entries.map((entry) => entry.summary);
    expect(summaries).toContain('First summary');
    expect(summaries).toContain('Second summary');
  });

  test('retrieves full artifact content by id', async () => {
    const { id } = await saveResearchArtifact({
      content: '# Findings',
      summary: 'Detailed findings',
      query: 'deep dive'
    }, { directory: tempDir, maxEntries: 10 });

    const record = await getResearchArtifact(id, { directory: tempDir });
    expect(record.content).toBe('# Findings');
    expect(record.summary).toBe('Detailed findings');
    expect(record.id).toBe(id);
  });
});
