import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitHubMemoryIntegration } from '../app/infrastructure/memory/github-memory.integration.mjs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('GitHub memory integration (local fallback)', () => {
  let tempDir;
  let integration;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'github-mem-'));
    integration = new GitHubMemoryIntegration({
      username: 'operator',
      dataDir: tempDir,
      enabled: false
    });
    await integration.ensureDirectoryExists();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('stores memories on disk when GitHub sync is disabled', async () => {
    const result = await integration.storeMemory({
      content: 'Store this locally',
      tags: ['local']
    }, 'long_term');

    const storedFiles = await fs.readdir(path.join(tempDir, 'long_term'));

    expect(result.success).toBe(true);
    expect(storedFiles.length).toBe(1);
  });

  it('retrieves locally persisted memories', async () => {
    const metaDir = path.join(tempDir, 'meta');
    await integration.storeMemory({ content: 'Meta memory content', tags: ['meta'] }, 'meta');

    const memories = await integration.retrieveMemories('meta');

    expect(Array.isArray(memories)).toBe(true);
    expect(memories.length).toBe(1);
    expect(memories[0].content).toContain('Meta memory content');
  });

  it('filters memories by tags during retrieval', async () => {
    await integration.storeMemory({ content: 'JS memory', tags: ['javascript'] }, 'long_term');
    await integration.storeMemory({ content: 'Python memory', tags: ['python'] }, 'long_term');

    const jsMemories = await integration.retrieveMemories('long_term', ['javascript']);

    expect(jsMemories.length).toBe(1);
    expect(jsMemories[0].tags).toContain('javascript');
  });

  it('formats registry entries consistently', () => {
    const formatted = integration.formatMemoryEntry({
      id: 'mem-test',
      content: 'Registry formatting demo',
      tags: ['demo'],
      score: 0.9,
      timestamp: '2025-01-01T00:00:00Z'
    });

    expect(formatted).toContain('Memory ID: mem-test');
    expect(formatted).toContain('Tags: demo');
    expect(formatted).toContain('Content: Registry formatting demo');
  });

  it('parses registry markdown into structured memories', () => {
    const registry = `# Local Registry

## Entry: 2025-04-01T12:00:00Z
Memory ID: mem-one
Tags: testing, demo
Score: 0.80
Content: First entry

## Entry: 2025-04-02T08:00:00Z
Memory ID: mem-two
Tags: parsing
Score: 0.65
Content: Second entry`;

    const parsed = integration.parseRegistryContent(registry);

    expect(parsed.length).toBe(2);
    expect(parsed[0].id).toBe('mem-one');
    expect(parsed[0].tags).toContain('testing');
    expect(parsed[1].content).toBe('Second entry');
  });
});