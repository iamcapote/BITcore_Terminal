/**
 * Why: Guarantee the model browser store filters, sorts, and selects entries deterministically.
 * What: Toggles providers/capabilities, flips sort directions, and verifies filtered snapshots and selections.
 * How: Calls store actions directly and asserts derived helper outputs match expected catalog entries.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  getFilteredModels,
  getModelBrowserSnapshot,
  getSelectedModel,
  listFilterableCapabilities,
  listFilterableProviders,
  useModelBrowserStore
} from './modelBrowserStore';

afterEach(() => {
  useModelBrowserStore.setState({
    providerFilters: new Set(),
    capabilityFilters: new Set(),
    sortKey: 'latency',
    sortDirection: 'asc',
    selectedModelId: null
  });
});

describe('modelBrowserStore', () => {
  it('lists providers and capabilities from catalog', () => {
    expect(listFilterableProviders()).toMatchInlineSnapshot(`
      [
        "Anthropic",
        "Google",
        "Groq",
        "OpenAI",
        "Together",
        "Venice",
      ]
    `);

    expect(listFilterableCapabilities()).toMatchInlineSnapshot(`
      [
        "audio",
        "chat",
        "code",
        "tool-use",
        "vision",
      ]
    `);
  });

  it('filters by provider and capability', () => {
    useModelBrowserStore.getState().toggleProvider('Venice');
    useModelBrowserStore.getState().toggleCapability('vision');

    const models = getFilteredModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('venice-vision-128k');
  });

  it('clears filters', () => {
    useModelBrowserStore.getState().toggleProvider('Venice');
    useModelBrowserStore.getState().toggleCapability('vision');
    useModelBrowserStore.getState().clearFilters();

    expect(getModelBrowserSnapshot().providerFilters.size).toBe(0);
    expect(getModelBrowserSnapshot().capabilityFilters.size).toBe(0);
  });

  it('sorts models and toggles direction', () => {
    useModelBrowserStore.getState().setSort('name');
    const asc = getFilteredModels().map((model) => model.name);

    useModelBrowserStore.getState().setSort('name');
    const desc = getFilteredModels().map((model) => model.name);

    expect(asc[0]).toBe('Claude 3.7 Sonnet');
    expect(desc[0]).toBe('Venice Vision 128k');
  });

  it('selects and retrieves a model', () => {
    useModelBrowserStore.getState().selectModel('groq-mixtral-8x7b');
    expect(getSelectedModel()?.provider).toBe('Groq');
  });
});
