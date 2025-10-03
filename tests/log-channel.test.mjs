/**
 * Why: Guard the shared log buffer contract that powers logs across CLI and Web surfaces.
 * What: Validates creation, retention, filtering, subscription, and stats behaviors of createLogChannel.
 * How: Instantiate fresh channels per test, push synthetic entries, and assert outputs stay within documented bounds.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLogChannel, MIN_BUFFER_SIZE, MAX_BUFFER_SIZE } from '../app/utils/log-channel.mjs';

let channel;

describe('createLogChannel', () => {
  beforeEach(() => {
    channel = createLogChannel({ bufferSize: 5 });
  });

  it('enforces buffer size with FIFO eviction', () => {
    for (let index = 0; index < 10; index += 1) {
      channel.push({ level: 'info', message: `entry-${index}`, timestamp: index });
    }

    const snapshot = channel.getSnapshot();
    expect(snapshot).toHaveLength(5);
    const sequences = snapshot.map((entry) => entry.sequence);
    expect(Math.min(...sequences)).toBe(6);
    expect(Math.max(...sequences)).toBe(10);
  });

  it('clamps configure calls within published bounds', () => {
    const { bufferSize: clampedMin } = channel.configure({ bufferSize: MIN_BUFFER_SIZE - 10 });
    expect(clampedMin).toBe(MIN_BUFFER_SIZE);

    const { bufferSize: clampedMax } = channel.configure({ bufferSize: MAX_BUFFER_SIZE + 1000 });
    expect(clampedMax).toBe(MAX_BUFFER_SIZE);
  });

  it('filters snapshot by level, search term, sample and since timestamp', () => {
    const baseTime = Date.now();
    channel.push({ level: 'info', message: 'alpha', timestamp: baseTime });
    channel.push({ level: 'warn', message: 'bravo', timestamp: baseTime + 10 });
    channel.push({ level: 'error', message: 'charlie', timestamp: baseTime + 20 });
    channel.push({ level: 'info', message: 'delta bravo', timestamp: baseTime + 30 });

    const filtered = channel.getSnapshot({
      levels: ['warn', 'error'],
      search: 'bravo',
      since: baseTime,
      sample: 1
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('bravo');

    const sampled = channel.getSnapshot({ sample: 2 });
    expect(sampled.every((entry) => entry.sequence % 2 === 0)).toBe(true);
  });

  it('notifies subscribers with normalized entries', () => {
    const listener = vi.fn();
    const unsubscribe = channel.subscribe(listener);

    const pushed = channel.push({ level: 'warning', message: { nested: 'value' } });
    expect(listener).toHaveBeenCalledTimes(1);
    const [entry] = listener.mock.calls[0];
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('{"nested":"value"}');
    expect(pushed).toEqual(entry);

    unsubscribe();
    channel.push({ level: 'info', message: 'after unsubscribe' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns accurate stats with optional since filter', () => {
    const now = Date.now();
    channel.push({ level: 'debug', message: 'd', timestamp: now - 100 });
    channel.push({ level: 'info', message: 'i', timestamp: now - 50 });
    channel.push({ level: 'error', message: 'e', timestamp: now });

    const stats = channel.getStats();
    expect(stats.total).toBe(3);
    expect(stats.levels).toEqual({ debug: 1, info: 1, warn: 0, error: 1 });
    expect(stats.firstTimestamp).toBeLessThanOrEqual(stats.lastTimestamp);

    const recent = channel.getStats({ since: now - 60 });
    expect(recent.total).toBe(2);
  });

  it('invokes custom listener error handler when subscriber throws', () => {
    const handler = vi.fn();
    const localChannel = createLogChannel({ bufferSize: 3, onListenerError: handler });
    const failingListener = vi.fn(() => {
      throw new Error('listener explosion');
    });

    localChannel.subscribe(failingListener);
    const entry = localChannel.push({ level: 'info', message: 'boom' });

    expect(handler).toHaveBeenCalledTimes(1);
    const [errorArg, contextArg] = handler.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(contextArg.listener).toBe(failingListener);
    expect(contextArg.entry).toEqual(entry);
  });

  it('falls back to stderr when error handler throws', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const handler = vi.fn(() => {
      throw new Error('handler fail');
    });
    const localChannel = createLogChannel({ bufferSize: 3, onListenerError: handler });
    localChannel.subscribe(() => {
      throw new Error('listener crash');
    });

    try {
      localChannel.push({ level: 'info', message: 'test' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });
});
