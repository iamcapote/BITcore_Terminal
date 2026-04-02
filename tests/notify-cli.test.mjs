/**
 * CLI parity tests for notify.cli.mjs
 * Pattern derived from: existing mcp-cli.test.mjs and swarm-cli.test.mjs structures in this codebase.
 * Tests: list, add, dismiss, dismiss-all, clear, --json flag, unknown subcommand, help.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeNotify, getNotifyHelpText } from '../app/commands/notify.cli.mjs';
import { resetNotificationCenterService } from '../app/infrastructure/notification-center.service.mjs';

beforeEach(() => {
  resetNotificationCenterService();
});

function capture() {
  const lines = [];
  return {
    handler: (val) => lines.push(val),
    lines,
  };
}

describe('list — empty state', () => {
  it('returns success with empty snapshot', async () => {
    const result = await executeNotify({ positionalArgs: ['list'] });
    expect(result.success).toBe(true);
    expect(result.snapshot.queue).toHaveLength(0);
  });

  it('prints "No active notifications." to output', async () => {
    const out = capture();
    await executeNotify({ positionalArgs: ['list'] }, out.handler);
    expect(out.lines.some(l => String(l).includes('No active notifications.'))).toBe(true);
  });
});

describe('add', () => {
  it('enqueues a notification and returns the record', async () => {
    const result = await executeNotify({
      positionalArgs: ['add', 'Test', 'alert'],
      flags: { severity: 'warning', category: 'system' },
    });
    expect(result.success).toBe(true);
    expect(result.record.title).toBe('Test alert');
    expect(result.record.severity).toBe('warning');
    expect(result.record.category).toBe('system');
    expect(result.record.id).toBeTruthy();
  });

  it('returns ValidationError when no title provided', async () => {
    const result = await executeNotify({ positionalArgs: ['add'] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ValidationError/);
  });

  it('defaults to severity=info and category=general', async () => {
    const result = await executeNotify({ positionalArgs: ['add', 'Default'], flags: {} });
    expect(result.record.severity).toBe('info');
    expect(result.record.category).toBe('general');
  });
});

describe('list — after add', () => {
  it('shows new notification in queue', async () => {
    await executeNotify({ positionalArgs: ['add', 'Check queue'] });
    const result = await executeNotify({ positionalArgs: ['list'] });
    expect(result.snapshot.queue.length).toBeGreaterThanOrEqual(1);
    expect(result.snapshot.queue[0].title).toBe('Check queue');
  });
});

describe('dismiss', () => {
  it('dismisses a known notification by id', async () => {
    const added = await executeNotify({ positionalArgs: ['add', 'Dismiss me'] });
    const id = added.record.id;
    const result = await executeNotify({ positionalArgs: ['dismiss', id] });
    expect(result.success).toBe(true);
    expect(result.result.id).toBe(id);
  });

  it('returns error when no id provided', async () => {
    const result = await executeNotify({ positionalArgs: ['dismiss'] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ValidationError/);
  });

  it('returns error for unknown id', async () => {
    const result = await executeNotify({ positionalArgs: ['dismiss', 'no-such-id'] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/NotFound|ValidationError/);
  });
});

describe('dismiss-all', () => {
  it('dismisses all queued notifications', async () => {
    await executeNotify({ positionalArgs: ['add', 'Alpha'] });
    await executeNotify({ positionalArgs: ['add', 'Beta'] });
    const result = await executeNotify({ positionalArgs: ['dismiss-all'] });
    expect(result.success).toBe(true);
    expect(result.result.dismissed).toBeGreaterThanOrEqual(2);
  });
});

describe('clear', () => {
  it('clears notification history and returns count', async () => {
    await executeNotify({ positionalArgs: ['add', 'Archived'], flags: {} });
    await executeNotify({ positionalArgs: ['dismiss-all'] });
    const result = await executeNotify({ positionalArgs: ['clear'] });
    expect(result.success).toBe(true);
    expect(typeof result.result.cleared).toBe('number');
  });
});

describe('--json flag', () => {
  it('outputs JSON string to outputFn on list', async () => {
    await executeNotify({ positionalArgs: ['add', 'JSON test'] });
    const out = capture();
    const result = await executeNotify({ positionalArgs: ['list'], flags: { json: 'true' } }, out.handler);
    expect(result.success).toBe(true);
    const jsonLine = out.lines.find(l => typeof l === 'string' && l.startsWith('{'));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine);
    expect(parsed).toHaveProperty('queue');
  });

  it('outputs JSON string to outputFn on add', async () => {
    const out = capture();
    await executeNotify({ positionalArgs: ['add', 'JSON add'], flags: { json: 'true' } }, out.handler);
    const jsonLine = out.lines.find(l => typeof l === 'string' && l.startsWith('{'));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine);
    expect(parsed).toHaveProperty('id');
    expect(parsed.title).toBe('JSON add');
  });
});

describe('unknown subcommand', () => {
  it('returns success=false with error message', async () => {
    const result = await executeNotify({ positionalArgs: ['flork'] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown notify subcommand/);
  });

  it('outputs help text on unknown subcommand', async () => {
    const out = capture();
    await executeNotify({ positionalArgs: ['flork'] }, out.handler);
    const allText = out.lines.join('\n');
    expect(allText).toContain('/notify');
  });
});

describe('help subcommand', () => {
  it('returns success and outputs help text', async () => {
    const out = capture();
    const result = await executeNotify({ positionalArgs: ['help'] }, out.handler);
    expect(result.success).toBe(true);
    expect(out.lines.join('\n')).toContain('/notify');
  });
});

describe('getNotifyHelpText', () => {
  it('is a non-empty string containing list and add', () => {
    const text = getNotifyHelpText();
    expect(typeof text).toBe('string');
    expect(text).toContain('/notify list');
    expect(text).toContain('/notify add');
    expect(text).toContain('/notify dismiss');
  });
});
