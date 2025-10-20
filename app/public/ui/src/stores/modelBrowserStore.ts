/**
 * Why: Centralize model browser filters, sorting, and selection so UI components stay declarative.
 * What: Holds provider and capability filters, sort state, selected model, and derived helpers for filtered lists.
 * How: Uses Zustand with pure functions for toggles, resets, and selection while capping derived computations for tests.
 */

import { create } from 'zustand';

import type { ModelCatalogEntry, ModelCapability } from '../data/modelCatalog';
import { MODEL_CATALOG, listModelCapabilities, listProviders } from '../data/modelCatalog';

export type ModelSortKey = 'name' | 'latency' | 'context' | 'price';
export type SortDirection = 'asc' | 'desc';

export interface ModelBrowserState {
  providerFilters: Set<ModelCatalogEntry['provider']>;
  capabilityFilters: Set<ModelCapability>;
  sortKey: ModelSortKey;
  sortDirection: SortDirection;
  selectedModelId: string | null;
}

export interface ModelBrowserActions {
  toggleProvider: (provider: ModelCatalogEntry['provider']) => void;
  toggleCapability: (capability: ModelCapability) => void;
  clearFilters: () => void;
  setSort: (key: ModelSortKey) => void;
  selectModel: (id: string | null) => void;
}

export type ModelBrowserStore = ModelBrowserState & ModelBrowserActions;

const INITIAL_STATE: ModelBrowserState = Object.freeze({
  providerFilters: new Set<ModelCatalogEntry['provider']>(),
  capabilityFilters: new Set<ModelCapability>(),
  sortKey: 'latency',
  sortDirection: 'asc',
  selectedModelId: null
});

function cloneSet<T>(source: Set<T>): Set<T> {
  return new Set(source);
}

function sortModels(models: ModelCatalogEntry[], key: ModelSortKey, direction: SortDirection): ModelCatalogEntry[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...models].sort((a, b) => {
    if (key === 'name') {
      return a.name.localeCompare(b.name) * multiplier;
    }
    if (key === 'latency') {
      return (a.latencyMs - b.latencyMs) * multiplier;
    }
    if (key === 'context') {
      return (a.contextTokens - b.contextTokens) * multiplier;
    }
    return (a.pricePerMillionTokens - b.pricePerMillionTokens) * multiplier;
  });
}

function filterModels(state: ModelBrowserState): ModelCatalogEntry[] {
  let models = MODEL_CATALOG;
  if (state.providerFilters.size > 0) {
    models = models.filter((entry) => state.providerFilters.has(entry.provider));
  }
  if (state.capabilityFilters.size > 0) {
    models = models.filter((entry) => entry.capabilities.some((capability) => state.capabilityFilters.has(capability)));
  }
  return sortModels(models, state.sortKey, state.sortDirection);
}

export const useModelBrowserStore = create<ModelBrowserStore>((set, get) => ({
  ...INITIAL_STATE,
  toggleProvider: (provider) =>
    set((state) => {
      const next = cloneSet(state.providerFilters);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return { providerFilters: next, selectedModelId: state.selectedModelId };
    }),
  toggleCapability: (capability) =>
    set((state) => {
      const next = cloneSet(state.capabilityFilters);
      if (next.has(capability)) {
        next.delete(capability);
      } else {
        next.add(capability);
      }
      return { capabilityFilters: next, selectedModelId: state.selectedModelId };
    }),
  clearFilters: () =>
    set((state) => ({
      providerFilters: new Set<ModelCatalogEntry['provider']>(),
      capabilityFilters: new Set<ModelCapability>(),
      selectedModelId: state.selectedModelId
    })),
  setSort: (key) =>
    set((state) => ({
      sortKey: key,
      sortDirection: state.sortKey === key && state.sortDirection === 'asc' ? 'desc' : 'asc'
    })),
  selectModel: (id) => set({ selectedModelId: id })
}));

export function getModelBrowserSnapshot(): ModelBrowserState {
  const state = useModelBrowserStore.getState();
  return {
    providerFilters: cloneSet(state.providerFilters),
    capabilityFilters: cloneSet(state.capabilityFilters),
    sortKey: state.sortKey,
    sortDirection: state.sortDirection,
    selectedModelId: state.selectedModelId
  };
}

export function getFilteredModels(): ModelCatalogEntry[] {
  return filterModels(useModelBrowserStore.getState());
}

export function getSelectedModel(): ModelCatalogEntry | undefined {
  const { selectedModelId } = useModelBrowserStore.getState();
  return MODEL_CATALOG.find((entry) => entry.id === selectedModelId);
}

export function listFilterableProviders(): ModelCatalogEntry['provider'][] {
  return listProviders();
}

export function listFilterableCapabilities(): ModelCapability[] {
  return listModelCapabilities();
}
