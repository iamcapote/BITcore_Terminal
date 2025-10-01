import { describe, expect, it, vi } from 'vitest';
import { runOverrideQueries } from '../infrastructure/research/research.override-runner.mjs';

describe('runOverrideQueries', () => {
  it('executes override queries sequentially and deduplicates results', async () => {
    const research = vi
      .fn()
      .mockResolvedValueOnce({ learnings: ['A'], sources: ['S1'] })
      .mockResolvedValueOnce({ learnings: ['B', 'A'], sources: ['S2', 'S1'] });

    const pathInstance = { research };
    const log = vi.fn();
    const emitStatus = vi.fn();
    const emitThought = vi.fn();

    const outcome = await runOverrideQueries({
      overrideQueries: [{ original: 'One' }, { original: 'Two' }],
      pathInstance,
      depth: 1,
      breadth: 1,
      log,
      emitStatus,
      emitThought
    });

    expect(pathInstance.research).toHaveBeenCalledTimes(2);
    expect(outcome.learnings).toEqual(['A', 'B']);
    expect(outcome.sources).toEqual(['S1', 'S2']);
    expect(log).toHaveBeenCalled();
    expect(emitStatus).toHaveBeenCalled();
    expect(emitThought).toHaveBeenCalled();
  });

  it('skips invalid override query objects', async () => {
    const research = vi.fn().mockResolvedValue({ learnings: [], sources: [] });
    const log = vi.fn();

    await runOverrideQueries({
      overrideQueries: [null, { original: 'Valid' }],
      pathInstance: { research },
      depth: 1,
      breadth: 1,
      log
    });

    expect(research).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid override'));
  });

  it('returns empty aggregates when overrideQueries is empty', async () => {
    const result = await runOverrideQueries({ overrideQueries: [], pathInstance: { research: vi.fn() }, depth: 1, breadth: 1 });
    expect(result).toEqual({ learnings: [], sources: [] });
  });
});
