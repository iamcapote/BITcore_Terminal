/**
 * Research Renderers: Summary
 * Why: Display the most recent research summary and metadata in the dashboard.
 * What: Supplies window.renderSummary for telemetry hooks.
 * How: Pulls from telemetryState aggregates and FALLBACK_SUMMARY constant.
 */
(function registerResearchSummaryRender(global) {
  if (!global) {
    return;
  }

  global.renderSummary = function renderSummary() {
    if (!els.summaryText) return;
    els.summaryText.textContent = telemetryState.latestSummary || FALLBACK_SUMMARY;
    if (els.summaryFilename) {
      els.summaryFilename.textContent = telemetryState.latestFilename ? telemetryState.latestFilename : '—';
    }
    if (els.summaryMeta) {
      els.summaryMeta.textContent = `Reports completed: ${telemetryState.completedRuns}`;
    }
  };
})(typeof window !== 'undefined' ? window : undefined);
