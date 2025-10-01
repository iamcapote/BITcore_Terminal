/**
 * Research Renderers: Stats
 * Why: Keep aggregate counts and taxonomy numbers current for the dashboard.
 * What: Registers window.renderStats consumed by telemetry updates.
 * How: Measures unique layers/tags derived from telemetryState.memory.
 */
(function registerResearchStatsRender(global) {
  if (!global) {
    return;
  }

  global.renderStats = function renderStats() {
    if (!els.statsDocs) return;
    els.statsDocs.textContent = telemetryState.completedRuns;

    const layers = telemetryState.memory.uniqueLayers;
    const tags = telemetryState.memory.uniqueTags;

    const layerCount = layers instanceof Set
      ? layers.size
      : Array.isArray(layers)
        ? layers.length
        : 0;
    const tagCount = tags instanceof Set
      ? tags.size
      : Array.isArray(tags)
        ? tags.length
        : 0;

    els.statsCategories.textContent = layerCount;
    els.statsTags.textContent = tagCount;
  };
})(typeof window !== 'undefined' ? window : undefined);
