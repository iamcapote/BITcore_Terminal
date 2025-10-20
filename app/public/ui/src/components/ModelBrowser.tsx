/**
 * Why: Let operators evaluate model coverage quickly while backend wiring is pending.
 * What: Renders provider and capability filters, a sortable catalog table, and an inline detail drawer for the selected model.
 * How: Pulls state from the model browser store, maps filter toggles to chips, and keeps selection synchronized with filtered results.
 */

import { useEffect, useMemo, type CSSProperties } from 'react';

import type { ModelCatalogEntry } from '../data/modelCatalog';
import { MODEL_CATALOG } from '../data/modelCatalog';
import { Card } from './primitives/Card';
import {
  getSelectedModel,
  listFilterableCapabilities,
  listFilterableProviders,
  type ModelSortKey,
  type SortDirection,
  useModelBrowserStore
} from '../stores/modelBrowserStore';

const chipStyle = (active: boolean): CSSProperties => ({
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radii-full)',
  border: '1px solid var(--color-border)',
  backgroundColor: active ? 'color-mix(in srgb, var(--color-accent-primary) 18%, transparent)' : 'transparent',
  color: active ? 'var(--color-accent-primary)' : 'var(--color-fg-primary)',
  cursor: 'pointer',
  fontFamily: 'var(--typography-font-family-mono)',
  fontSize: 'var(--typography-font-size-xs)'
});

const headerButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-muted)',
  fontFamily: 'var(--typography-font-family-sans)',
  fontSize: 'var(--typography-font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  cursor: 'pointer'
};

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

interface CatalogTableProps {
  models: ModelCatalogEntry[];
  sortKey: ModelSortKey;
  sortDirection: SortDirection;
  highlightedId: string | null;
  onSort: (key: ModelSortKey) => void;
  onSelect: (id: string) => void;
}

function CatalogTable({ models, sortKey, sortDirection, highlightedId, onSort, onSelect }: CatalogTableProps): JSX.Element {
  const arrow = sortDirection === 'asc' ? '↑' : '↓';
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radii-md)', overflow: 'hidden' }}>
      <div
        role="rowgroup"
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr repeat(4, 1fr)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border)'
        }}
      >
        <button type="button" style={headerButtonStyle} onClick={() => onSort('name')}>
          Model {sortKey === 'name' ? arrow : ''}
        </button>
        <button type="button" style={headerButtonStyle} onClick={() => onSort('context')}>
          Context {sortKey === 'context' ? arrow : ''}
        </button>
        <button type="button" style={headerButtonStyle} onClick={() => onSort('latency')}>
          Latency {sortKey === 'latency' ? arrow : ''}
        </button>
        <button type="button" style={headerButtonStyle} onClick={() => onSort('price')}>
          Price {sortKey === 'price' ? arrow : ''}
        </button>
        <span style={{ ...headerButtonStyle, cursor: 'default' }}>Capabilities</span>
      </div>
      <div role="rowgroup" style={{ maxHeight: '240px', overflowY: 'auto' }}>
        {models.map((model) => {
          const isActive = highlightedId === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onSelect(model.id)}
              data-testid="model-row"
              aria-label={`Select ${model.name}`}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '2fr repeat(4, 1fr)',
                padding: 'var(--spacing-md)',
                textAlign: 'left',
                backgroundColor: isActive ? 'color-mix(in srgb, var(--color-accent-primary) 14%, transparent)' : 'transparent',
                color: 'var(--color-fg-primary)',
                border: 'none',
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                fontFamily: 'var(--typography-font-family-sans)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontFamily: 'var(--typography-font-family-mono)' }}>{model.name}</strong>
                <span style={{ color: 'var(--color-muted)', fontSize: 'var(--typography-font-size-xs)' }}>
                  {model.provider} · {model.availability.toUpperCase()}
                </span>
              </div>
              <span>{formatNumber(model.contextTokens)}</span>
              <span>{model.latencyMs} ms</span>
              <span>{formatPrice(model.pricePerMillionTokens)}</span>
              <span style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                {model.capabilities.map((capability) => (
                  <span
                    key={capability}
                    style={{
                      padding: '0 var(--spacing-xs)',
                      borderRadius: 'var(--radii-full)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--typography-font-size-xs)'
                    }}
                  >
                    {capability}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
        {models.length === 0 && (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--color-muted)' }}>No models match the selected filters.</div>
        )}
      </div>
    </div>
  );
}

export function ModelBrowser(): JSX.Element {
  const providerFilters = useModelBrowserStore((state) => state.providerFilters);
  const capabilityFilters = useModelBrowserStore((state) => state.capabilityFilters);
  const sortKey = useModelBrowserStore((state) => state.sortKey);
  const sortDirection = useModelBrowserStore((state) => state.sortDirection);
  const selectedModelId = useModelBrowserStore((state) => state.selectedModelId);
  const toggleProvider = useModelBrowserStore((state) => state.toggleProvider);
  const toggleCapability = useModelBrowserStore((state) => state.toggleCapability);
  const clearFilters = useModelBrowserStore((state) => state.clearFilters);
  const setSort = useModelBrowserStore((state) => state.setSort);
  const selectModel = useModelBrowserStore((state) => state.selectModel);

  const filteredModels = useMemo(() => {
    let models = MODEL_CATALOG;
    if (providerFilters.size > 0) {
      models = models.filter((entry) => providerFilters.has(entry.provider));
    }
    if (capabilityFilters.size > 0) {
      models = models.filter((entry) => entry.capabilities.some((capability) => capabilityFilters.has(capability)));
    }
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    return [...models].sort((a, b) => {
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name) * multiplier;
      }
      if (sortKey === 'latency') {
        return (a.latencyMs - b.latencyMs) * multiplier;
      }
      if (sortKey === 'context') {
        return (a.contextTokens - b.contextTokens) * multiplier;
      }
      return (a.pricePerMillionTokens - b.pricePerMillionTokens) * multiplier;
    });
  }, [capabilityFilters, providerFilters, sortDirection, sortKey]);

  useEffect(() => {
    if (filteredModels.length === 0) {
      selectModel(null);
      return;
    }
    if (!selectedModelId || !filteredModels.some((model) => model.id === selectedModelId)) {
      selectModel(filteredModels[0].id);
    }
  }, [filteredModels, selectModel, selectedModelId]);

  const selectedModel = getSelectedModel();

  return (
    <Card title="Model Browser" subtitle={`Explore ${filteredModels.length} curated models`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 'var(--typography-font-size-sm)' }}>Providers</strong>
            {listFilterableProviders().map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => toggleProvider(provider)}
                style={chipStyle(providerFilters.has(provider))}
              >
                {provider}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 'var(--typography-font-size-sm)' }}>Capabilities</strong>
            {listFilterableCapabilities().map((capability) => (
              <button
                key={capability}
                type="button"
                onClick={() => toggleCapability(capability)}
                style={chipStyle(capabilityFilters.has(capability))}
              >
                {capability}
              </button>
            ))}
            {(providerFilters.size > 0 || capabilityFilters.size > 0) && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  ...chipStyle(false),
                  borderStyle: 'dashed',
                  color: 'var(--color-muted)'
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <CatalogTable
          models={filteredModels}
          sortKey={sortKey}
          sortDirection={sortDirection}
          highlightedId={selectedModelId}
          onSort={setSort}
          onSelect={selectModel}
        />
        {selectedModel && (
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radii-md)',
              padding: 'var(--spacing-lg)',
              backgroundColor: 'var(--color-bg-surface)',
              display: 'grid',
              gap: 'var(--spacing-md)',
              gridTemplateColumns: '1fr 1fr'
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>{selectedModel.name}</h4>
              <p style={{ margin: 'var(--spacing-sm) 0', color: 'var(--color-muted)' }}>{selectedModel.description}</p>
              <p style={{ margin: 0, fontFamily: 'var(--typography-font-family-mono)' }}>
                Provider: {selectedModel.provider} · Availability: {selectedModel.availability.toUpperCase()}
              </p>
            </div>
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 'var(--spacing-sm)',
                fontFamily: 'var(--typography-font-family-mono)'
              }}
            >
              <div>
                <dt>Context</dt>
                <dd style={{ margin: 0 }}>{formatNumber(selectedModel.contextTokens)} tokens</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd style={{ margin: 0 }}>{selectedModel.latencyMs} ms</dd>
              </div>
              <div>
                <dt>Throughput</dt>
                <dd style={{ margin: 0 }}>{formatNumber(selectedModel.outputTokensPerMin)} tokens/min</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd style={{ margin: 0 }}>{formatPrice(selectedModel.pricePerMillionTokens)} / 1M tokens</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Card>
  );
}
