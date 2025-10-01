import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitHubActivityWebComm } from '../app/features/research/github-activity.webcomm.mjs';
import {
  recordGitHubActivity,
  clearGitHubActivityFeed
} from '../app/features/research/github-activity.channel.mjs';

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe('createGitHubActivityWebComm', () => {
  beforeEach(() => {
    clearGitHubActivityFeed();
    vi.restoreAllMocks();
  });

  it('emits snapshot on attach and streams live events', () => {
    recordGitHubActivity({ action: 'verify', message: 'Verified repo', level: 'info' });

    const sent = [];
    const stream = createGitHubActivityWebComm({
      send: (type, payload) => sent.push({ type, payload }),
      snapshotLimit: 10,
      logger: noopLogger
    });

    stream.attach({ limit: 10 });

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('github-activity:snapshot');
    expect(Array.isArray(sent[0].payload.entries)).toBe(true);
    expect(sent[0].payload.entries[0].message).toBe('Verified repo');

    recordGitHubActivity({ action: 'push', message: 'Pushed files', level: 'info' });

    expect(sent).toHaveLength(2);
    expect(sent[1].type).toBe('github-activity:event');
    expect(sent[1].payload.entry.message).toContain('Pushed files');

    stream.dispose();
  });

  it('handles snapshot and stats commands', () => {
    recordGitHubActivity({ action: 'verify', message: 'Verified repo', level: 'info' });
    recordGitHubActivity({ action: 'push', message: 'Uploaded file', level: 'info' });

    const sent = [];
    const stream = createGitHubActivityWebComm({
      send: (type, payload) => sent.push({ type, payload }),
      snapshotLimit: 5,
      logger: noopLogger
    });

    stream.attach({ limit: 2 });
    sent.length = 0; // Clear initial snapshot

    const snapshotResult = stream.handleRequest({ command: 'snapshot', limit: 1 });
    expect(snapshotResult).toMatchObject({ ok: true, count: 1 });
    expect(sent[0].type).toBe('github-activity:snapshot');
    expect(sent[0].payload.meta.limit).toBe(1);

    const statsResult = stream.handleRequest({ command: 'stats' });
    expect(statsResult).toMatchObject({ ok: true });
    const statsMessage = sent.find((entry) => entry.type === 'github-activity:stats');
    expect(statsMessage).toBeTruthy();
    expect(statsMessage.payload.stats.total).toBeGreaterThan(0);

    stream.dispose();
  });

  it('returns error for unsupported commands without throwing', () => {
    const stream = createGitHubActivityWebComm({
      send: () => {},
      logger: noopLogger
    });

    stream.attach();

    const result = stream.handleRequest({ command: 'unknown-cmd' });
    expect(result).toEqual({ ok: false, error: "Unsupported command 'unknown-cmd'." });

    stream.dispose();
  });
});
