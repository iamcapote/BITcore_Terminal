/**
 * Unit tests for notification-center.service — service layer only (no HTTP).
 * Pattern derived from: anything-llm untooled/safeJSON validation strategy.
 * Tests: enqueue validation, severity/category grouping, list filtering, dismiss, bounds.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNotificationCenterService,
  resetNotificationCenterService,
} from '../app/infrastructure/notification-center.service.mjs';

beforeEach(() => {
  resetNotificationCenterService();
});

describe('enqueue — input validation', () => {
  it('throws ValidationError when payload is not an object', () => {
    const svc = createNotificationCenterService();
    expect(() => svc.enqueue(null)).toThrow('ValidationError');
    expect(() => svc.enqueue('string')).toThrow('ValidationError');
    expect(() => svc.enqueue([])).toThrow('ValidationError');
  });

  it('throws ValidationError when title is missing or empty', () => {
    const svc = createNotificationCenterService();
    expect(() => svc.enqueue({ severity: 'info' })).toThrow('ValidationError: title is required');
    expect(() => svc.enqueue({ title: '   ' })).toThrow('ValidationError: title is required');
  });

  it('returns a frozen record with id, severity, category, timestamp', () => {
    const svc = createNotificationCenterService();
    const rec = svc.enqueue({ title: 'Hello', severity: 'success', category: 'mission' });
    expect(rec.id).toMatch(/^notif-/);
    expect(rec.severity).toBe('success');
    expect(rec.category).toBe('mission');
    expect(rec.dismissed).toBe(false);
    expect(typeof rec.timestamp).toBe('number');
    expect(Object.isFrozen(rec)).toBe(true);
  });

  it('defaults unknown severity to info', () => {
    const svc = createNotificationCenterService();
    const rec = svc.enqueue({ title: 'Test', severity: 'banana' });
    expect(rec.severity).toBe('info');
  });

  it('defaults unknown category to general', () => {
    const svc = createNotificationCenterService();
    const rec = svc.enqueue({ title: 'Test', category: 'unknown_cat' });
    expect(rec.category).toBe('general');
  });

  it('respects autoDismissMs when positive number', () => {
    const svc = createNotificationCenterService();
    const rec = svc.enqueue({ title: 'Auto', autoDismissMs: 3000 });
    expect(rec.autoDismissMs).toBe(3000);
  });

  it('ignores negative autoDismissMs', () => {
    const svc = createNotificationCenterService();
    const rec = svc.enqueue({ title: 'Auto', autoDismissMs: -1 });
    expect(rec.autoDismissMs).toBeNull();
  });
});

describe('list — filtering', () => {
  it('returns empty queue initially', () => {
    const svc = createNotificationCenterService();
    const snap = svc.list();
    expect(snap.total).toBe(0);
    expect(snap.queue).toHaveLength(0);
  });

  it('filters by severity', () => {
    const svc = createNotificationCenterService();
    svc.enqueue({ title: 'A', severity: 'error' });
    svc.enqueue({ title: 'B', severity: 'info' });
    const snap = svc.list({ severity: 'error' });
    expect(snap.items.every(n => n.severity === 'error')).toBe(true);
  });

  it('filters by category', () => {
    const svc = createNotificationCenterService();
    svc.enqueue({ title: 'A', category: 'mission' });
    svc.enqueue({ title: 'B', category: 'system' });
    const snap = svc.list({ category: 'mission' });
    expect(snap.items.every(n => n.category === 'mission')).toBe(true);
  });

  it('filters out dismissed when dismissed=false', () => {
    const svc = createNotificationCenterService();
    const r = svc.enqueue({ title: 'A' });
    svc.enqueue({ title: 'B' });
    svc.dismiss(r.id);
    const snap = svc.list({ dismissed: false });
    expect(snap.items.every(n => !n.dismissed)).toBe(true);
  });

  it('returns frozen snapshot', () => {
    const svc = createNotificationCenterService();
    const snap = svc.list();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.queue)).toBe(true);
  });
});

describe('dismiss', () => {
  it('throws ValidationError on missing id', () => {
    const svc = createNotificationCenterService();
    expect(() => svc.dismiss('')).toThrow('ValidationError');
    expect(() => svc.dismiss(null)).toThrow('ValidationError');
  });

  it('throws NotFound for unknown id', () => {
    const svc = createNotificationCenterService();
    expect(() => svc.dismiss('notif-does-not-exist')).toThrow('NotFound');
  });

  it('marks the notification as dismissed', () => {
    const svc = createNotificationCenterService();
    const r = svc.enqueue({ title: 'Dismiss me' });
    const result = svc.dismiss(r.id);
    expect(result.dismissed).toBe(true);
    const snap = svc.list({ dismissed: false });
    expect(snap.items.find(n => n.id === r.id)).toBeUndefined();
  });
});

describe('dismissAll / clearHistory', () => {
  it('dismissAll returns count of active notifications dismissed', () => {
    const svc = createNotificationCenterService();
    svc.enqueue({ title: 'A' });
    svc.enqueue({ title: 'B' });
    const result = svc.dismissAll();
    expect(result.dismissed).toBe(2);
  });

  it('clearHistory removes all history records', () => {
    const svc = createNotificationCenterService();
    svc.enqueue({ title: 'A' });
    svc.enqueue({ title: 'B' });
    const result = svc.clearHistory();
    expect(result.cleared).toBe(2);
    const snap = svc.list();
    expect(snap.history).toHaveLength(0);
  });
});

describe('queue bounds — maxQueue eviction', () => {
  it('evicts oldest when queue exceeds maxQueue', () => {
    const svc = createNotificationCenterService({ maxQueue: 3 });
    svc.enqueue({ title: 'First' });
    svc.enqueue({ title: 'Second' });
    svc.enqueue({ title: 'Third' });
    svc.enqueue({ title: 'Fourth' }); // should evict First
    const snap = svc.list();
    expect(snap.queue.length).toBeLessThanOrEqual(3);
  });
});
