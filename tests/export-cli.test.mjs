/**
 * Why: Validate the `/export` command so operators can persist research results from the CLI surface.
 * What: Confirms markdown is written to disk when cached content exists and surfaces helpful messaging when it does not.
 * How: Uses the shared CLI test harness to invoke the command with different cache states and inspects filesystem output.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import { createCliTestContext } from './helpers/cli-test-context.mjs';
import { executeExport } from '../app/commands/export.cli.mjs';
import { setCliResearchResult, clearCliResearchResult } from '../app/commands/research/state.mjs';

const ctx = createCliTestContext({ autoInitialize: true });

async function withTempDir(fn) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitcore-export-'));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

describe('export command (CLI)', () => {
  beforeEach(async () => {
    await ctx.initialize();
    ctx.flushOutput();
    clearCliResearchResult();
  });

  afterEach(() => {
    clearCliResearchResult();
  });

  test('writes cached markdown to the requested path', async () => {
    await withTempDir(async (directory) => {
      const targetPath = path.join(directory, 'result.md');
      setCliResearchResult({
        content: '# Research\nGenerated content.',
        filename: 'research/sample.md',
        summary: 'Sample summary',
        query: 'Sample topic',
        generatedAt: '2025-10-03T00:00:00Z'
      });

      const { result, output } = await ctx.runCommand(executeExport, {
        positionalArgs: [targetPath],
        flags: { overwrite: true }
      });

      expect(result.success).toBe(true);
      const transcript = output.join('\n');
      expect(transcript).toMatch(targetPath);

      const fileContents = await fs.readFile(targetPath, 'utf8');
      expect(fileContents).toContain('# Research');
      expect(fileContents).toContain('Generated content.');
    });
  });

  test('reports when no research result has been cached', async () => {
    const { result, output } = await ctx.runCommand(executeExport, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('No research result');
    expect(output.join('\n')).toMatch(/No research result/i);
  });
});
