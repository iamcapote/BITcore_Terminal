/**
 * Why: Ensure research action resolution honours explicit flags and positional subcommands.
 * What: Exercises mixed inputs to guarantee consistent routing for run/list/download actions.
 * How: Calls resolver with representative scenarios and asserts the resulting action/args tuple.
 */

import { describe, test, expect } from 'vitest';
import { resolveResearchAction } from '../app/commands/research/action-resolver.mjs';

describe('resolveResearchAction', () => {
  test('defaults to run with untouched positional arguments', () => {
    const result = resolveResearchAction({ positionalArgs: ['deep', 'learning'] });
    expect(result.action).toBe('run');
    expect(result.positionalArgs).toEqual(['deep', 'learning']);
  });

  test('picks list when first positional argument matches subcommand', () => {
    const result = resolveResearchAction({ positionalArgs: ['list', '--limit=5'] });
    expect(result.action).toBe('list');
    expect(result.positionalArgs).toEqual(['--limit=5']);
  });

  test('prefers explicit flag over positional arguments', () => {
    const result = resolveResearchAction({
      positionalArgs: ['quantum', 'computing'],
      flags: { action: 'download', id: 'abc123' }
    });
    expect(result.action).toBe('download');
    expect(result.positionalArgs).toEqual(['quantum', 'computing']);
  });

  test('ignores unknown action candidates', () => {
    const result = resolveResearchAction({ positionalArgs: ['launch', 'sequence'] });
    expect(result.action).toBe('run');
    expect(result.positionalArgs).toEqual(['launch', 'sequence']);
  });
});
