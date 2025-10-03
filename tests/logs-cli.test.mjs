import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logChannel } from '../app/utils/log-channel.mjs';
import { executeLogs, getLogsHelpText } from '../app/commands/logs.cli.mjs';

function createSpies() {
  const outputs = [];
  const errors = [];
  return {
    outputs,
    errors,
    output: vi.fn((value) => {
      outputs.push(value);
    }),
    error: vi.fn((value) => {
      errors.push(value);
    })
  };
}

beforeEach(() => {
  logChannel.clear();
  logChannel.configure({ bufferSize: 500 });
});

describe('logs CLI help', () => {
  it('mentions follow mode options', () => {
    const help = getLogsHelpText();
    expect(help).toContain('--follow');
    expect(help).toContain('--duration');
  });
});

describe('executeLogs tail', () => {
  it('prints recent log entries in text mode', async () => {
    logChannel.push({ level: 'info', message: 'Server started', timestamp: 1735689600000 });
    logChannel.push({ level: 'error', message: 'Subsystem failure', timestamp: 1735689605000 });

    const { output, error, outputs, errors } = createSpies();
    const result = await executeLogs({ flags: { limit: '10' } }, output, error);

    expect(result.success).toBe(true);
    expect(outputs.length).toBeGreaterThanOrEqual(3);
    const rendered = outputs.filter((value) => typeof value === 'string');
    expect(rendered[0]).toContain('INFO');
    expect(rendered[1]).toContain('ERROR');
    expect(errors).toHaveLength(0);
  });

  it('returns JSON when requested', async () => {
    logChannel.push({ level: 'warn', message: 'Rate limit warning', timestamp: 1735689610000 });
    const { output, error, outputs, errors } = createSpies();

    const result = await executeLogs({ flags: { json: 'true', limit: '5' } }, output, error);

    expect(result.success).toBe(true);
    const jsonPayload = outputs.find((value) => typeof value === 'string');
    expect(() => JSON.parse(jsonPayload)).not.toThrow();
    expect(errors).toHaveLength(0);
  });

  it('streams new entries when follow is enabled', async () => {
    vi.useFakeTimers();
    const { output, error, outputs, errors } = createSpies();

    try {
      const followPromise = executeLogs({ flags: { follow: 'true', duration: '250ms', limit: '5' } }, output, error);

      await vi.advanceTimersByTimeAsync(10);
      logChannel.push({ level: 'info', message: 'Follow event #1', timestamp: Date.now() });

      await vi.advanceTimersByTimeAsync(300);
      const result = await followPromise;

      expect(result.followed).toBe(true);
      const streamedLines = outputs.filter((value) => typeof value === 'string');
      expect(streamedLines.some((line) => line.includes('Follow event #1'))).toBe(true);
      expect(errors).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('executeLogs admin subcommands', () => {
  it('reports current settings', async () => {
    const { output, error, outputs, errors } = createSpies();

    const result = await executeLogs({ action: 'settings' }, output, error);

    expect(result.success).toBe(true);
    expect(outputs.some((line) => typeof line === 'string' && line.includes('Buffer Size'))).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('updates buffer retention size', async () => {
    const { output, error, outputs, errors } = createSpies();

    const result = await executeLogs({ action: 'retention', positionalArgs: ['650'] }, output, error);

    expect(result.success).toBe(true);
    expect(logChannel.getBufferSize()).toBe(650);
    expect(outputs.find((line) => typeof line === 'string')).toContain('650');
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid retention payloads', async () => {
    const { output, error, errors } = createSpies();

    const result = await executeLogs({ action: 'retention', positionalArgs: ['invalid'] }, output, error);

    expect(result.success).toBe(false);
    expect(errors).toHaveLength(1);
    expect(result.error).toMatch(/finite integer/i);
  });

  it('clears the log buffer', async () => {
    logChannel.push({ level: 'warn', message: 'to be purged' });
    const { output, error, outputs, errors } = createSpies();

    const result = await executeLogs({ action: 'purge' }, output, error);

    expect(result.success).toBe(true);
    expect(logChannel.getSnapshot()).toHaveLength(0);
    expect(outputs.find((line) => typeof line === 'string')).toContain('cleared');
    expect(errors).toHaveLength(0);
  });
});
