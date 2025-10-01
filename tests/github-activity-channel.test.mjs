import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordGitHubActivity, getGitHubActivitySnapshot, subscribeGitHubActivity, clearGitHubActivityFeed } from '../app/features/research/github-activity.channel.mjs';
import { outputManager } from '../app/utils/research.output-manager.mjs';

describe('github-activity channel', () => {
  beforeEach(() => {
    clearGitHubActivityFeed();
    vi.restoreAllMocks();
  });

  it('records entries and logs via output manager', () => {
    const logSpy = vi.spyOn(outputManager, 'log').mockImplementation(() => {});

    const entry = recordGitHubActivity({ action: 'verify', message: 'Verified repo', level: 'info', meta: { ok: true } });

    expect(entry).toBeTruthy();
    expect(logSpy).toHaveBeenCalledWith('[GitHubResearch] Verified repo');

    const snapshot = getGitHubActivitySnapshot({ limit: 5 });
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].message).toBe('Verified repo');
    expect(snapshot[0].meta?.action).toBe('verify');
  });

  it('notifies subscribers when new activity is recorded', () => {
    const notifications = [];
    const unsubscribe = subscribeGitHubActivity((entry) => {
      notifications.push(entry);
    });

    try {
      recordGitHubActivity({ action: 'push', message: 'Pushed 2 files', level: 'info', meta: { fileCount: 2 } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain('Pushed 2 files');
      expect(notifications[0].meta?.fileCount).toBe(2);
    } finally {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
  });

  it('sanitizes sensitive metadata on error entries', () => {
    const errSpy = vi.spyOn(outputManager, 'error').mockImplementation(() => {});
    const error = new Error('Bad credentials');
    error.status = 401;

    const entry = recordGitHubActivity({
      action: 'verify',
      message: 'Verification failed',
      level: 'error',
      meta: { token: 'super-secret', error }
    });

    expect(errSpy).toHaveBeenCalledWith('[GitHubResearch] Verification failed');
    expect(entry?.meta?.token).toBe('[redacted]');
    expect(entry?.meta?.error).toEqual({ message: 'Bad credentials', status: 401 });

    const snapshot = getGitHubActivitySnapshot();
    expect(snapshot[0].meta?.token).toBe('[redacted]');
    expect(snapshot[0].meta?.error).toEqual({ message: 'Bad credentials', status: 401 });
  });
});
