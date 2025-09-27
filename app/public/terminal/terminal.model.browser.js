/**
 * Terminal Model Browser Widget
 * Why: Hydrate the model browser panel with Venice catalog metadata and responsive filters.
 * What: Fetches the catalog, renders model cards, tracks preference visibility, and surfaces feature status.
 * How: Uses the model-browser service endpoint with graceful degradation when the feature is disabled.
 */

(function registerModelBrowser(global) {
  const API_ENDPOINT = '/api/models/venice';

  const state = {
    container: null,
    grid: null,
    controls: null,
    status: null,
    footer: null,
    activeFilter: 'all',
    catalog: null,
    modelIndex: new Map(),
    filterLabels: new Map(),
    observer: null,
  };

  function setBusy(isBusy) {
    if (!state.container || !state.status) return;
    state.container.setAttribute('aria-busy', String(isBusy));
    if (isBusy) {
      state.container.classList.remove('is-disabled');
      state.status.textContent = 'Loading model catalog…';
    }
  }

  function updateVisibility() {
    if (!state.container) return;
    const enabled = document.body.classList.contains('model-browser-enabled');
    state.container.classList.toggle('is-hidden', !enabled);
  }

  function attachVisibilityObserver() {
    if (!document.body || state.observer) {
      updateVisibility();
      return;
    }
    state.observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'class')) {
        updateVisibility();
      }
    });
    state.observer.observe(document.body, { attributes: true });
    updateVisibility();
  }

  function normalizeFilterKey(rawKey) {
    if (!rawKey) return 'all';
    const normalized = String(rawKey).trim().toLowerCase();
    return normalized || 'all';
  }

  function resolveDescriptor(modelId) {
    return state.modelIndex.get(modelId) || null;
  }

  function formatContextTokens(tokens) {
    if (!Number.isFinite(tokens)) {
      return 'Context: n/a';
    }
    if (tokens >= 1000) {
      const thousands = (tokens / 1000).toFixed(tokens % 1000 === 0 ? 0 : 1);
      return `Context: ${thousands}k tokens`;
    }
    return `Context: ${tokens} tokens`;
  }

  function createBadgeElement(badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = `model-badge model-badge--${badge.tone || 'neutral'}`;
    badgeEl.textContent = badge.label;
    badgeEl.title = badge.label;
    return badgeEl;
  }

  function createModelCard(descriptor) {
    const card = document.createElement('article');
    card.className = 'model-card';
    card.setAttribute('role', 'listitem');
    card.dataset.modelId = descriptor.id;

    const header = document.createElement('header');
    header.className = 'model-card-header';

    const title = document.createElement('h3');
    title.className = 'model-card-title';
    title.textContent = descriptor.label;
    header.appendChild(title);

    const id = document.createElement('span');
    id.className = 'model-card-id';
    id.textContent = descriptor.id;
    header.appendChild(id);

    const meta = document.createElement('div');
    meta.className = 'model-card-meta';
    meta.textContent = formatContextTokens(descriptor.contextTokens);
    header.appendChild(meta);

    card.appendChild(header);

    if (Array.isArray(descriptor.badges) && descriptor.badges.length > 0) {
      const badgeRow = document.createElement('div');
      badgeRow.className = 'model-badge-row';
      descriptor.badges.forEach((badge) => {
        badgeRow.appendChild(createBadgeElement(badge));
      });
      card.appendChild(badgeRow);
    }

    const footer = document.createElement('div');
    footer.className = 'model-card-footer';

    const highlights = [];
    if (descriptor.recommendations.chat) highlights.push('chat');
    if (descriptor.recommendations.research) highlights.push('research');
    if (descriptor.recommendations.coding) highlights.push('coding');
    if (descriptor.recommendations.vision) highlights.push('vision');
    if (descriptor.recommendations.reasoning) highlights.push('reasoning');
    if (descriptor.recommendations.uncensored) highlights.push('uncensored');
    if (descriptor.recommendations.speed) highlights.push('speed');

    const highlightLabel = document.createElement('span');
    highlightLabel.textContent = highlights.length
      ? `Best for: ${highlights.join(', ')}`
      : 'Best for: exploration';
    footer.appendChild(highlightLabel);

    if (descriptor.sourceUrl) {
      const link = document.createElement('a');
      link.href = descriptor.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Docs ↗';
      footer.appendChild(link);
    }

    card.appendChild(footer);
    return card;
  }

  function applyFilter(descriptor) {
    if (state.activeFilter === 'all') return true;
    return descriptor.categories.includes(state.activeFilter);
  }

  function renderCards() {
    if (!state.grid) return;
    state.grid.replaceChildren();

    if (!state.catalog) {
      const empty = document.createElement('div');
      empty.className = 'model-card-placeholder';
      empty.textContent = 'Model catalog unavailable.';
      state.grid.appendChild(empty);
      return;
    }

    const filtered = state.catalog.models.filter(applyFilter);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'model-card-placeholder';
      empty.textContent = 'No models match the selected filter.';
      state.grid.appendChild(empty);
      return;
    }

    filtered.forEach((descriptor) => {
      state.grid.appendChild(createModelCard(descriptor));
    });
  }

  function updateFilterChips() {
    if (!state.controls || !state.catalog) return;

    const total = state.catalog.models.length;
    const counts = new Map();
    counts.set('all', total);

    Object.entries(state.catalog.categories || {}).forEach(([key, ids]) => {
      counts.set(key, Array.isArray(ids) ? ids.length : 0);
    });

    const metadata = state.catalog.meta?.categoryMetadata || {};

    const buttons = Array.from(state.controls.querySelectorAll('.model-filter-chip'));
    buttons.forEach((button) => {
      const filterKey = normalizeFilterKey(button.dataset.filter);
      if (!state.filterLabels.has(button)) {
        state.filterLabels.set(button, button.textContent.trim());
      }
      const baseLabel = state.filterLabels.get(button) || button.textContent.trim();
      const count = counts.get(filterKey) ?? 0;
      button.textContent = `${baseLabel} (${count})`;
      button.setAttribute('aria-selected', filterKey === state.activeFilter ? 'true' : 'false');
      button.classList.toggle('is-active', filterKey === state.activeFilter);
      if (metadata[filterKey]) {
        button.title = metadata[filterKey].label;
      }
    });
  }

  function updateFooter() {
    if (!state.footer || !state.catalog) return;
    state.footer.replaceChildren();

    const defaults = state.catalog.defaults || {};
    const descriptors = {
      global: resolveDescriptor(defaults.global),
      chat: resolveDescriptor(defaults.chat),
      research: resolveDescriptor(defaults.research),
      token: resolveDescriptor(defaults.token),
    };

    const defaultsBlock = document.createElement('div');
    defaultsBlock.className = 'model-browser-defaults';
    defaultsBlock.innerHTML = `Defaults → Global: <strong>${descriptors.global?.label || defaults.global}</strong> • Chat: <strong>${descriptors.chat?.label || defaults.chat}</strong> • Research: <strong>${descriptors.research?.label || defaults.research}</strong>`;
    state.footer.appendChild(defaultsBlock);

    const feature = state.catalog.feature || {};
    if (!feature.hasApiKey) {
      const warning = document.createElement('div');
      warning.className = 'model-browser-warning';
      warning.textContent = 'Venice API key not detected – calls will use the configured defaults only.';
      state.footer.appendChild(warning);
    }
  }

  function renderCatalog(catalog) {
    if (!state.status || !state.container) return;
    state.container.classList.remove('is-disabled');
    state.status.textContent = `Loaded ${catalog.meta?.total ?? catalog.models.length} models.`;
    state.container.setAttribute('aria-busy', 'false');

    state.modelIndex.clear();
    catalog.models.forEach((descriptor) => {
      state.modelIndex.set(descriptor.id, descriptor);
    });

    updateFilterChips();
    renderCards();
    updateFooter();
  }

  function handleFeatureDisabled(message) {
    if (!state.container || !state.status || !state.grid) return;
    state.container.classList.add('is-disabled');
    state.container.setAttribute('aria-busy', 'false');
    state.status.textContent = message || 'Model browser feature disabled.';
    state.grid.replaceChildren();
    const info = document.createElement('div');
    info.className = 'model-card-placeholder';
    info.textContent = 'Model browser unavailable.';
    state.grid.appendChild(info);
  }

  async function loadCatalog({ refresh = false } = {}) {
    if (!state.container) return;
    setBusy(true);
    try {
      const url = new URL(API_ENDPOINT, global.location.origin);
      if (refresh) {
        url.searchParams.set('refresh', '1');
      }
      const response = await fetch(url.toString(), { credentials: 'include' });
      if (response.status === 403) {
        const { error } = await response.json().catch(() => ({ error: null }));
        handleFeatureDisabled(error || 'Model browser disabled.');
        return;
      }
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const catalog = await response.json();
      state.catalog = catalog;
      renderCatalog(catalog);
    } catch (error) {
      console.warn('[model-browser] Failed to load catalog:', error);
      handleFeatureDisabled('Model catalog unavailable.');
    } finally {
      setBusy(false);
    }
  }

  function handleFilterClick(event) {
    const button = event?.target?.closest('.model-filter-chip');
    if (!button || !state.catalog) {
      return;
    }
    const selected = normalizeFilterKey(button.dataset.filter);
    if (selected === state.activeFilter) {
      return;
    }
    state.activeFilter = selected;
    updateFilterChips();
    renderCards();
  }

  function initialize() {
    state.container = document.getElementById('model-browser');
    if (!state.container) {
      return;
    }

    state.grid = document.getElementById('model-browser-grid');
    state.controls = document.getElementById('model-browser-controls');
    state.status = document.getElementById('model-browser-status');
    state.footer = document.getElementById('model-browser-footer');

    attachVisibilityObserver();

    if (state.controls) {
      state.controls.addEventListener('click', handleFilterClick);
    }

    loadCatalog();
  }

  document.addEventListener('DOMContentLoaded', initialize);
})(window);
