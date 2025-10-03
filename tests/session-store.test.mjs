import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';

describe('session store persistence', () => {
  let tmpDir;
  let loadSessionState;
  let saveSessionState;
  let applySessionStateToRef;
  let persistSessionFromRef;
  let resetSessionPersistenceForTests;
  let getSessionFilePath;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitcore-session-'));
    process.env.BITCORE_STORAGE_DIR = tmpDir;
    vi.resetModules();
    ({
      loadSessionState,
      saveSessionState,
      applySessionStateToRef,
      persistSessionFromRef,
      resetSessionPersistenceForTests,
      getSessionFilePath,
    } = await import('../app/infrastructure/session/session.store.mjs'));
    await resetSessionPersistenceForTests();
  });

  afterEach(async () => {
    await resetSessionPersistenceForTests();
    delete process.env.BITCORE_STORAGE_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('loadSessionState returns defaults when no file exists', async () => {
    const state = await loadSessionState({ force: true });
    expect(state.currentResearchResult).toBeNull();
    expect(state.sessionModel).toBeNull();
  });

  test('saveSessionState writes snapshot to disk', async () => {
    const markdown = '# Research Result';
    await saveSessionState({
      currentResearchResult: markdown,
      currentResearchFilename: 'research/test.md',
      currentResearchSummary: 'Short summary',
      currentResearchQuery: 'Test query',
      sessionModel: 'qwen',
      sessionCharacter: 'archon',
      memoryEnabled: true,
      memoryDepth: 'long-term',
      memoryGithubEnabled: true,
    });

    const saved = await loadSessionState({ force: true });
    expect(saved.currentResearchResult).toBe(markdown);
    expect(saved.currentResearchFilename).toBe('research/test.md');
    expect(saved.sessionModel).toBe('qwen');

    const fileContents = JSON.parse(await fs.readFile(getSessionFilePath(), 'utf8'));
    expect(fileContents.currentResearchResult).toBe(markdown);
    expect(fileContents.memoryEnabled).toBe(true);
  });

  test('persistSessionFromRef captures runtime session references', async () => {
    const session = {
      currentResearchResult: 'Restored markdown',
      currentResearchFilename: 'research/restored.md',
      currentResearchSummary: 'Restored summary',
      currentResearchQuery: 'Restored query',
      sessionModel: 'claude',
      sessionCharacter: 'bitcore',
      memoryEnabled: true,
      memoryDepth: 'short-term',
      memoryGithubEnabled: false,
    };

    await persistSessionFromRef(session);

    const snapshot = await loadSessionState({ force: true });
    expect(snapshot.currentResearchFilename).toBe('research/restored.md');
    const hydrated = applySessionStateToRef({}, snapshot);
    expect(hydrated.currentResearchResult).toBe('Restored markdown');
    expect(hydrated.sessionCharacter).toBe('bitcore');
    expect(hydrated.memoryEnabled).toBe(true);
  });
});
