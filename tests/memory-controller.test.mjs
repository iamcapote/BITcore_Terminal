import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryController } from '../app/features/memory/memory.controller.mjs';
import { MEMORY_LAYERS } from '../app/features/memory/memory.schema.mjs';

const fakeRecord = Object.freeze({
  id: 'mem-1',
  layer: MEMORY_LAYERS.EPISODIC,
  role: 'user',
  content: 'Test',
  timestamp: new Date().toISOString(),
  tags: [],
  metadata: Object.freeze({})
});

describe('MemoryController', () => {
  let service;
  let enricher;
  let controller;
  let telemetry;

  beforeEach(() => {
    service = {
      store: vi.fn().mockResolvedValue(fakeRecord),
      recall: vi.fn().mockResolvedValue([fakeRecord]),
      stats: vi.fn().mockResolvedValue({ layers: [], totals: {} }),
      summarize: vi.fn().mockResolvedValue({ success: true }),
      clearCache: vi.fn()
    };
    enricher = vi.fn().mockResolvedValue({ tags: ['Context'], metadata: { score: 0.9 } });
    telemetry = vi.fn();
    controller = new MemoryController({ service, enricher, telemetry });
  });

  it('enriches store payloads before delegating', async () => {
    const stored = await controller.store({ content: 'Learn contracts', metadata: { priority: 'high' } });

    expect(enricher).toHaveBeenCalled();
    expect(service.store).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Learn contracts',
      tags: ['context'],
      metadata: { priority: 'high', score: 0.9 }
    }), expect.any(Object));
    expect(stored).toBe(fakeRecord);
    expect(telemetry).toHaveBeenCalledWith('store', expect.objectContaining({
      layer: MEMORY_LAYERS.EPISODIC,
      record: fakeRecord,
      githubEnabled: false
    }));
  });

  it('delegates recall with normalized payload', async () => {
    await controller.recall({ query: 'contracts', layer: 'WORKING', limit: 5 });

    expect(service.recall).toHaveBeenCalledWith({
      query: 'contracts',
      layer: MEMORY_LAYERS.WORKING,
      limit: 5,
      includeShortTerm: true,
      includeLongTerm: true,
      includeMeta: true
    }, expect.any(Object));
    expect(telemetry).toHaveBeenCalledWith('recall', expect.objectContaining({
      layer: MEMORY_LAYERS.WORKING,
      query: 'contracts',
      results: [fakeRecord]
    }));
  });

  it('passes through stats', async () => {
    const stats = await controller.stats();

    expect(service.stats).toHaveBeenCalled();
    expect(stats).toEqual({ layers: [], totals: {} });
    expect(telemetry).toHaveBeenCalledWith('stats', expect.objectContaining({
      layer: null,
      totals: {}
    }));
  });

  it('supports summarize with default layer', async () => {
    await controller.summarize({ conversationText: 'wrap up' });

    expect(service.summarize).toHaveBeenCalledWith({ conversationText: 'wrap up', layer: MEMORY_LAYERS.EPISODIC });
    expect(telemetry).toHaveBeenCalledWith('summarize', expect.objectContaining({
      layer: MEMORY_LAYERS.EPISODIC,
      success: true
    }));
  });

  it('clears cache through service', () => {
    controller.reset();
    expect(service.clearCache).toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith('reset', undefined);
  });
});
