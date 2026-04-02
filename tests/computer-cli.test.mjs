import { beforeEach, describe, expect, it } from 'vitest';
import { executeComputer, getComputerHelpText } from '../app/commands/computer.cli.mjs';
import { resetComputerController } from '../app/features/tools/index.mjs';
import { resetComputerRuntimeServiceSingleton } from '../app/infrastructure/computer-runtime.service.mjs';

beforeEach(() => {
  resetComputerController();
  resetComputerRuntimeServiceSingleton();
});

describe('computer cli command', () => {
  it('exposes help text', () => {
    const help = getComputerHelpText();
    expect(help).toContain('/computer status');
    expect(help).toContain('/computer set');
  });

  it('returns runtime status by default', async () => {
    const result = await executeComputer({ flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.snapshot.runtime.shellInterface).toBe('local');
  });

  it('updates runtime shell interface', async () => {
    const result = await executeComputer({
      action: 'set',
      flags: { shellInterface: 'ssh' },
    });
    expect(result.success).toBe(true);
    expect(result.snapshot.runtime.shellInterface).toBe('ssh');
    expect(result.snapshot.runtime.codeExecSshEnabled).toBe(true);
  });

  it('validates missing set payload fields', async () => {
    const result = await executeComputer({ action: 'set', flags: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ValidationError');
  });
});
