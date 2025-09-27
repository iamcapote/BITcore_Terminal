import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptController } from '../app/features/prompts/prompt.controller.mjs';

describe('PromptController', () => {
  let controller;
  let service;
  let logger;

  beforeEach(() => {
    service = {
      listSummaries: vi.fn(async () => [{ id: 'daily-check-in', title: 'Daily Check-In', tags: [] }]),
      getPrompt: vi.fn(async () => ({ id: 'status-update', title: 'Status Update' })),
      savePrompt: vi.fn(async (payload) => ({ ...payload, id: payload.id ?? 'status-update' })),
      deletePrompt: vi.fn(async () => {}),
      searchPrompts: vi.fn(async () => [{ id: 'incident-review', title: 'Incident Review' }]),
      exists: vi.fn(async () => true)
    };

    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    controller = new PromptController({ service, logger });
  });

  it('lists prompt summaries with filters', async () => {
    const results = await controller.list({ tags: ['daily'], limit: 5 });

    expect(service.listSummaries).toHaveBeenCalledWith({ tags: ['daily'], limit: 5 });
    expect(results).toHaveLength(1);
    expect(logger.debug).toHaveBeenCalledWith('prompt.list', { count: 1 });
  });

  it('retrieves prompt by identifier and logs action', async () => {
    const prompt = await controller.get({ id: 'status-update' });

    expect(service.getPrompt).toHaveBeenCalledWith('status-update');
    expect(prompt.id).toBe('status-update');
    expect(logger.debug).toHaveBeenCalledWith('prompt.get', { id: 'status-update' });
  });

  it('saves prompt and records actor', async () => {
    await controller.save({ title: 'Retro Guide', body: 'Lead the retro.' }, { actor: 'tester' });

    expect(service.savePrompt).toHaveBeenCalledWith({ title: 'Retro Guide', body: 'Lead the retro.' }, { actor: 'tester' });
    expect(logger.info).toHaveBeenCalledWith('prompt.save', { id: 'status-update', actor: 'tester' });
  });

  it('removes prompt and logs deletion', async () => {
    await controller.remove('daily-check-in', { actor: 'admin' });

    expect(service.deletePrompt).toHaveBeenCalledWith('daily-check-in', { actor: 'admin' });
    expect(logger.info).toHaveBeenCalledWith('prompt.delete', { id: 'daily-check-in', actor: 'admin' });
  });

  it('searches prompts via service and logs', async () => {
    const results = await controller.search({ query: 'incident' });

    expect(service.searchPrompts).toHaveBeenCalledWith({ query: 'incident' });
    expect(results[0].id).toBe('incident-review');
    expect(logger.debug).toHaveBeenCalledWith('prompt.search', { query: 'incident', tags: [], count: 1 });
  });

  it('checks prompt existence with normalized identifiers', async () => {
    const exists = await controller.exists(' status-update ');

    expect(service.exists).toHaveBeenCalledWith('status-update');
    expect(exists).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith('prompt.exists', { id: 'status-update', exists: true });
  });
});
