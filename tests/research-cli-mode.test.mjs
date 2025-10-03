/**
 * Why: Guarantee CLI researchers get structured output and actionable errors without relying on WebSocket flows.
 * What: Mocks the research engine and supporting dependencies to exercise the CLI execution path for success and failure cases.
 * How: Captures emitted output/error lines while asserting cached state, hints, and formatted messages.
 */

import { describe, beforeAll, beforeEach, test, expect, vi } from 'vitest';

const researchRunMock = vi.hoisted(() => vi.fn());
const setCliResearchResultMock = vi.hoisted(() => vi.fn());
const clearCliResearchResultMock = vi.hoisted(() => vi.fn());
const resolveResearchDefaultsMock = vi.hoisted(() => vi.fn(async ({ depth, breadth }) => ({
  depth: depth ?? 2,
  breadth: breadth ?? 3,
  isPublic: false
})));

vi.mock('../app/infrastructure/research/research.engine.mjs', () => ({
  ResearchEngine: vi.fn(() => ({
    research: researchRunMock
  }))
}));

vi.mock('../app/utils/cli-error-handler.mjs', () => ({
  logCommandStart: vi.fn()
}));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend: vi.fn()
}));

vi.mock('../app/utils/research.output-manager.mjs', () => ({
  output: {
    debug: vi.fn()
  }
}));

vi.mock('../app/utils/research.prompt.mjs', () => ({
  singlePrompt: vi.fn(async () => 'prompted query')
}));

vi.mock('../app/features/memory/memory.service.mjs', () => ({
  createMemoryService: vi.fn(() => ({}))
}));

vi.mock('../app/features/research/research.defaults.mjs', () => ({
  resolveResearchDefaults: resolveResearchDefaultsMock
}));

vi.mock('../app/commands/research/memory-context.mjs', () => ({
  prepareMemoryContext: vi.fn(async () => ({ overrideQueries: [] }))
}));

vi.mock('../app/commands/research/keys.mjs', () => ({
  resolveResearchKeys: vi.fn(async () => ({ braveKey: 'brave-key', veniceKey: 'venice-key' })),
  MissingResearchKeysError: class MissingResearchKeysError extends Error {},
  ResearchKeyResolutionError: class ResearchKeyResolutionError extends Error {}
}));

vi.mock('../app/commands/research/query-classifier.mjs', () => ({
  enrichResearchQuery: vi.fn(async ({ query }) => ({ original: query, metadata: {} }))
}));

vi.mock('../app/utils/logger.mjs', () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

vi.mock('../app/commands/research/emitters.mjs', () => ({
  createResearchEmitter: ({ handler }) => (
    typeof handler === 'function'
      ? (value) => handler(value)
      : () => {}
  )
}));

vi.mock('../app/commands/research/passwords.mjs', () => ({
  ensureResearchPassword: vi.fn(async () => ({ password: null, result: null }))
}));

vi.mock('../app/commands/research/logging.mjs', () => ({
  sanitizeResearchOptionsForLog: vi.fn((options) => options)
}));

vi.mock('../app/commands/research/state.mjs', () => ({
  setCliResearchResult: setCliResearchResultMock,
  clearCliResearchResult: clearCliResearchResultMock
}));

let executeResearch;

beforeAll(async () => {
  ({ executeResearch } = await import('../app/commands/research.cli.mjs'));
});

beforeEach(() => {
  researchRunMock.mockReset();
  setCliResearchResultMock.mockReset();
  clearCliResearchResultMock.mockReset();
});

describe('executeResearch (CLI mode)', () => {
  test('prints summary, content, and follow-up guidance on success', async () => {
    researchRunMock.mockResolvedValue({
      learnings: ['Insight'],
      sources: ['https://example.com'],
      summary: 'Concise summary of findings.',
      markdownContent: '# Heading\nFindings here.',
      suggestedFilename: 'research-report.md'
    });

    const outputs = [];
    const errors = [];

    const result = await executeResearch({
      positionalArgs: ['Test subject'],
      depth: 1,
      breadth: 1,
      output: (value) => outputs.push(value),
      error: (value) => errors.push(value),
      currentUser: { username: 'operator', role: 'admin' }
    });

    expect(result.success).toBe(true);
    expect(errors).toHaveLength(0);
    const transcript = outputs.join('\n');
    expect(transcript).toContain('Summary:');
    expect(transcript).toContain('Concise summary of findings.');
    expect(transcript).toContain('--- Research Content ---');
    expect(transcript).toContain('# Heading');
    expect(transcript).toContain('Next steps: run /export');
    expect(setCliResearchResultMock).toHaveBeenCalledWith(expect.objectContaining({
      content: '# Heading\nFindings here.',
      filename: 'research-report.md',
      summary: 'Concise summary of findings.'
    }));
  });

  test('surfaces formatted guidance on unexpected failure', async () => {
    researchRunMock.mockRejectedValue(new Error('Network unreachable'));

    const outputs = [];
    const errors = [];

    const result = await executeResearch({
      positionalArgs: ['Broken topic'],
      depth: 1,
      breadth: 1,
      output: (value) => outputs.push(value),
      error: (value) => errors.push(value),
      currentUser: { username: 'operator', role: 'admin' }
    });

    expect(result.success).toBe(false);
    expect(errors).not.toHaveLength(0);
    const errorTranscript = errors.join('\n');
    expect(errorTranscript).toContain('Try again with --verbose');
    expect(errorTranscript).toContain('Broken topic');
  });
});
