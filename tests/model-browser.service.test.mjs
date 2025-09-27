import { describe, it, expect } from 'vitest';
import { createModelBrowserService } from '../app/features/ai/model-browser/model-browser.service.mjs';

describe('model-browser service', () => {
  it('produces immutable descriptors with derived metadata', () => {
    const service = createModelBrowserService({
      models: {
        'alpha-model': {
          availableContextTokens: 4096,
          traits: ['default'],
          modelSource: 'https://example.com/alpha',
        },
        'beta-model': {
          availableContextTokens: 32768,
          traits: ['default_code', 'fastest'],
          modelSource: 'https://example.com/beta',
        },
      },
      defaults: {
        global: 'alpha-model',
        chat: 'alpha-model',
        research: 'beta-model',
        token: 'beta-model',
      },
      timeProvider: () => 1_735_000_000_000,
    });

    const snapshot = service.listModels();

    expect(snapshot.updatedAt).toBe(1_735_000_000_000);
    expect(snapshot.models).toHaveLength(2);
    expect(snapshot.defaults.research).toBe('beta-model');

    const alpha = snapshot.models.find((descriptor) => descriptor.id === 'alpha-model');
    const beta = snapshot.models.find((descriptor) => descriptor.id === 'beta-model');

    expect(alpha.recommendations.chat).toBe(true);
    expect(alpha.recommendations.research).toBe(false);
    expect(beta.recommendations.coding).toBe(true);
    expect(beta.recommendations.speed).toBe(true);
    expect(beta.badges.some((badge) => badge.key === 'trait-speed')).toBe(true);

    expect(Object.isFrozen(alpha)).toBe(true);
    expect(Object.isFrozen(beta)).toBe(true);
    expect(Object.isFrozen(snapshot.models)).toBe(true);
    expect(Object.isFrozen(snapshot.defaults)).toBe(true);
    expect(Object.isFrozen(snapshot.meta)).toBe(true);

    expect(snapshot.categories.coding).toContain('beta-model');
    expect(snapshot.categories.chat).toContain('alpha-model');
    expect(snapshot.meta.total).toBe(2);
    expect(snapshot.meta.categoryMetadata.coding.label).toBeDefined();
  });

  it('supports ascending sort order', () => {
    const service = createModelBrowserService({
      models: {
        'gamma-model': { availableContextTokens: 2048, traits: ['default_reasoning'] },
        'delta-model': { availableContextTokens: 8192, traits: ['default_code'] },
      },
      defaults: {
        global: 'gamma-model',
        chat: 'gamma-model',
        research: 'gamma-model',
        token: 'delta-model',
      },
    });

    const snapshot = service.listModels({ sortDescending: false });
    expect(snapshot.models.map((model) => model.id)).toEqual(['delta-model', 'gamma-model']);
    expect(snapshot.models[0].score).toBeLessThanOrEqual(snapshot.models[1].score);
  });
});
