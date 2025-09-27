import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMock = {
  stats: vi.fn(),
  recall: vi.fn(),
  store: vi.fn(),
  summarize: vi.fn(),
  reset: vi.fn()
};

const getMemoryControllerMock = vi.fn(() => controllerMock);

vi.mock('../app/features/memory/index.mjs', () => ({
  getMemoryController: getMemoryControllerMock,
  resetMemoryController: vi.fn(),
  createVeniceMemoryEnricher: vi.fn()
}));

vi.mock('../app/utils/cli-error-handler.mjs', async () => {
  const actual = await vi.importActual('../app/utils/cli-error-handler.mjs');
  return {
    ...actual,
    handleCliError: vi.fn((error, type, context, errorFn) => {
      errorFn?.(error.message);
      return { success: false, error: error.message, type, context };
    })
  };
});

const { executeMemory, getMemoryHelpText } = await import('../app/commands/memory.cli.mjs');

const baseStats = Object.freeze({
  layers: [
    {
      layer: 'episodic',
      depth: 'medium',
      stored: 1,
      retrieved: 2,
      validated: 0,
      summarized: 0,
      ephemeralCount: 1,
      validatedCount: 0,
      githubEnabled: false
    }
  ],
  totals: Object.freeze({ stored: 1, retrieved: 2, validated: 0, summarized: 0, ephemeralCount: 1, validatedCount: 0, layers: 1 })
});

beforeEach(() => {
  controllerMock.stats.mockReset().mockResolvedValue(baseStats);
  controllerMock.recall.mockReset().mockResolvedValue([]);
  controllerMock.store.mockReset().mockResolvedValue({
    id: 'mem-1',
    layer: 'episodic',
    role: 'user',
    content: 'Remember this',
    timestamp: '2025-09-26T00:00:00.000Z',
    tags: [],
    metadata: {}
  });
  controllerMock.summarize.mockReset().mockResolvedValue({ success: true });
  getMemoryControllerMock.mockClear();
});

function createSpies() {
  const outputs = [];
  const output = vi.fn(value => {
    outputs.push(value);
  });
  const errors = [];
  const error = vi.fn(value => {
    errors.push(value);
  });
  return { output, error, outputs, errors };
}

describe('memory CLI help', () => {
  it('lists the new subcommands', () => {
    const help = getMemoryHelpText();
    expect(help).toContain('memory recall');
    expect(help).toContain('memory store');
    expect(help).toContain('memory summarize');
  });
});

describe('executeMemory', () => {
  it('invokes stats by default and prints human output', async () => {
    const { output, error, outputs } = createSpies();
    const result = await executeMemory({}, output, error);

    expect(result.success).toBe(true);
    expect(controllerMock.stats).toHaveBeenCalledWith({ githubEnabled: false, layer: undefined, user: null });
    expect(outputs.some(line => typeof line === 'string' && line.includes('Memory Statistics'))).toBe(true);
    expect(outputs.at(-1)).toEqual({ type: 'output', data: '', keepDisabled: false });
    expect(error).not.toHaveBeenCalled();
  });

  it('requires a query for recall', async () => {
    const { output, error } = createSpies();
    const result = await executeMemory({ action: 'recall' }, output, error);

    expect(result.success).toBe(false);
    expect(controllerMock.recall).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('requires a query'));
  });

  it('stores a memory and emits JSON when requested', async () => {
    const { output, error, outputs } = createSpies();

    const result = await executeMemory(
      { action: 'store', positionalArgs: ['Remember', 'this'], flags: { json: true } },
      output,
      error
    );

    expect(result.success).toBe(true);
    expect(controllerMock.store).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Remember this', layer: 'episodic' }),
      { githubEnabled: false, user: null }
    );
    const jsonLine = outputs.find(line => typeof line === 'string' && line.trim().startsWith('{'));
    expect(jsonLine).toBeDefined();
    expect(error).not.toHaveBeenCalled();
  });
});
