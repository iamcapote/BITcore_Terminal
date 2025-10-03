/**
 * Contract
 * Why: Ensure password prompt is skipped in single-user mode unless vault is enabled.
 * What: Mocks user context and environment to verify prompt/no-prompt behaviour for CLI and Web flows.
 * How: Stubs password helper, runs `executeResearch` with/without vault, and asserts prompt calls and result propagation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureResearchPasswordMock = vi.fn();

vi.mock('../app/commands/research/passwords.mjs', () => ({
  ensureResearchPassword: (...args) => ensureResearchPasswordMock(...args),
}));

vi.mock('../app/utils/cli-error-handler.mjs', () => ({
  logCommandStart: vi.fn(),
}));

vi.mock('../app/utils/research.output-manager.mjs', () => ({
  output: {
    log: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../app/utils/logger.mjs', () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend: vi.fn(),
}));

vi.mock('../app/features/research/research.defaults.mjs', () => ({
  resolveResearchDefaults: vi.fn(async ({ depth, breadth, isPublic } = {}) => ({
    depth: depth ?? 2,
    breadth: breadth ?? 3,
    isPublic: isPublic ?? false,
  })),
}));

vi.mock('../app/commands/research/keys.mjs', () => ({
  resolveResearchKeys: vi.fn().mockResolvedValue({ braveKey: 'brave', veniceKey: 'venice' }),
  MissingResearchKeysError: class extends Error {},
  ResearchKeyResolutionError: class extends Error {},
}));

vi.mock('../app/commands/research/query-classifier.mjs', () => ({
  enrichResearchQuery: vi.fn().mockResolvedValue({ original: 'topic', metadata: null }),
}));

vi.mock('../app/commands/research/memory-context.mjs', () => ({
  prepareMemoryContext: vi.fn().mockResolvedValue({ overrideQueries: [] }),
}));

vi.mock('../app/infrastructure/research/research.engine.mjs', () => {
  const ResearchEngine = vi.fn().mockImplementation(() => ({
    research: vi.fn().mockResolvedValue({ success: true, markdownContent: '# Findings', suggestedFilename: 'topic.md' })
  }));
  return { ResearchEngine };
});

import { executeResearch } from '../app/commands/research.cli.mjs';

describe('executeResearch password prompt behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEARCH_VAULT_ENABLED;
  });

  it('skips password prompt in single-user mode (admin, vault disabled)', async () => {
    const output = vi.fn();
    const error = vi.fn();
    const currentUser = { username: 'operator', role: 'admin' };

    const result = await executeResearch({
      positionalArgs: ['topic'],
      output,
      error,
      currentUser,
    });

    expect(ensureResearchPasswordMock).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('calls password prompt if vault is enabled', async () => {
    process.env.RESEARCH_VAULT_ENABLED = 'true';
    ensureResearchPasswordMock.mockResolvedValue({ password: 'pw', result: null });

    const output = vi.fn();
    const error = vi.fn();
    const currentUser = { username: 'operator', role: 'admin' };

    const result = await executeResearch({
      positionalArgs: ['topic'],
      output,
      error,
      currentUser,
    });

    expect(ensureResearchPasswordMock).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('calls password prompt for non-admin users', async () => {
    ensureResearchPasswordMock.mockResolvedValue({ password: 'pw', result: null });

    const output = vi.fn();
    const error = vi.fn();
    const currentUser = { username: 'other', role: 'user' };

    const result = await executeResearch({
      positionalArgs: ['topic'],
      output,
      error,
      currentUser,
    });

    expect(ensureResearchPasswordMock).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });
});
