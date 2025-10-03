/**
 * Why: Validate the structured logging helpers so downstream features rely on consistent entries.
 * What: Exercises createModuleLogger helpers plus format/normalize utilities for messages and metadata.
 * How: Reset the shared log channel between cases, emit sample entries, and assert normalized outputs.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { createModuleLogger, normalizeLogLevel, formatLogMessage, normalizeLogMeta } from '../app/utils/logger.mjs';
import { logChannel } from '../app/utils/log-channel.mjs';

const originalDebugMode = process.env.DEBUG_MODE;

function restoreDebugMode() {
  if (originalDebugMode === undefined) {
    delete process.env.DEBUG_MODE;
  } else {
    process.env.DEBUG_MODE = originalDebugMode;
  }
}

describe('logger utilities', () => {
  beforeEach(() => {
    logChannel.clear();
    delete process.env.DEBUG_MODE;
  });

  afterEach(() => {
    logChannel.clear();
  });

  afterAll(() => {
    restoreDebugMode();
  });

  it('pushes structured entries with merged meta snapshots', () => {
    const baseMeta = { component: 'scheduler', base: true, nested: { flag: 'root' } };
    const logger = createModuleLogger('scheduler', { emitToStdStreams: false, baseMeta });

    const requestMeta = { requestId: 'abc123', nested: { attempt: 2 } };
    const entry = logger.info('launching new mission', requestMeta);

    expect(entry).toBeTruthy();
    expect(entry.level).toBe('info');

    const snapshot = logChannel.getSnapshot({ limit: 1 });
    expect(snapshot).toHaveLength(1);
    const [record] = snapshot;

    expect(record.source).toBe('scheduler');
    expect(record.message).toBe('launching new mission');
    expect(record.meta).toEqual({
      component: 'scheduler',
      base: true,
      nested: { attempt: 2 },
      requestId: 'abc123'
    });

    baseMeta.base = false;
    requestMeta.nested.attempt = 7;
    expect(record.meta.base).toBe(true);
    expect(record.meta.nested).toEqual({ attempt: 2 });
  });

  it('skips empty messages and returns null', () => {
    const logger = createModuleLogger('scheduler', { emitToStdStreams: false });

    const result = logger.info(null);

    expect(result).toBeNull();
    expect(logChannel.getSnapshot({ limit: 1 })).toHaveLength(0);
  });

  it('filters debug logs unless DEBUG_MODE is true', () => {
    const logger = createModuleLogger('scheduler', { emitToStdStreams: false });

    const dropped = logger.debug('hidden');
    expect(dropped).toBeNull();
    expect(logChannel.getSnapshot({ limit: 1 })).toHaveLength(0);

    process.env.DEBUG_MODE = 'true';
    const emitted = logger.debug('visible');
    expect(emitted).toBeTruthy();

    const snapshot = logChannel.getSnapshot({ limit: 1 });
    expect(snapshot).toHaveLength(1);
    const [record] = snapshot;
    expect(record.level).toBe('debug');
    expect(record.message).toBe('visible');
  });

  it('creates child loggers with namespaced sources', () => {
    const logger = createModuleLogger('scheduler', { emitToStdStreams: false });
    const child = logger.child('worker', { baseMeta: { role: 'worker' } });

    const entry = child.warn('processing', { jobId: 'j-42' });
    expect(entry).toBeTruthy();

    const [record] = logChannel.getSnapshot({ limit: 1 });
    expect(record.source).toBe('scheduler:worker');
    expect(record.level).toBe('warn');
    expect(record.meta).toEqual({ role: 'worker', jobId: 'j-42' });
  });

  it('normalizes meta and message helpers', () => {
    const error = new Error('boom');
    const formatted = formatLogMessage(error);
    expect(formatted).toContain('Error: boom');

    const meta = { payload: { value: 1 } };
    const cloned = normalizeLogMeta(meta);
    expect(cloned).toEqual(meta);
    expect(cloned).not.toBe(meta);

    cloned.payload.value = 5;
    expect(meta.payload.value).toBe(1);

    expect(normalizeLogLevel('warning')).toBe('warn');
    expect(normalizeLogLevel('INFO')).toBe('info');
  });
});
