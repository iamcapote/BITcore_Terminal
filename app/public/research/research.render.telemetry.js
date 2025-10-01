/**
 * Research Telemetry Rendering Layer
 * Why: Render status, progress, thoughts, memory, suggestions, summary, and report surfaces for the research dashboard.
 * What: Provides focused DOM update helpers that map the shared telemetry state into interactive UI elements.
 * How: Reads from `telemetryState` and cached `els` references while delegating orchestration to the dashboard bootstrap.
 */
function renderStatus() {
  if (!els.stage || !els.message) return;
  els.stage.textContent = telemetryState.stage;
  /**
   * Research Telemetry Legacy Bridge
   * Why: Maintain backward compatibility for deployments that still reference the
   *       historical monolithic telemetry renderer while the new modular
   *       renderers take over.
   * What: Validates that the modular renderers are registered and surfaces a
   *       diagnostic warning when one is missing.
   * How: Runs once on load, inspects the global namespace, and avoids redoing
   *       work that the dedicated modules now handle.
   */
  (function bridgeLegacyResearchTelemetry(global) {
    if (!global || global.__legacyTelemetryBridge__) {
      return;
    }

    global.__legacyTelemetryBridge__ = true;

    const expectedRenderers = [
      'renderStatus',
      'renderProgress',
      'renderThoughts',
      'renderMemory',
      'renderSuggestions',
      'renderSummary',
      'renderStats',
      'renderRecentReports'
    ];

    expectedRenderers.forEach((name) => {
      if (typeof global[name] === 'function') {
        return;
      }

      console.warn(
        '[research.telemetry] Missing telemetry renderer:',
        name,
        'Ensure the modular scripts under /research/render/ are loaded before the bridge.'
      );
    });
  })(typeof window !== 'undefined' ? window : undefined);
  if (!els.summaryText) return;
  els.summaryText.textContent = telemetryState.latestSummary || FALLBACK_SUMMARY;
  if (els.summaryFilename) {
    els.summaryFilename.textContent = telemetryState.latestFilename ? telemetryState.latestFilename : '—';
  }
  if (els.summaryMeta) {
    els.summaryMeta.textContent = `Reports completed: ${telemetryState.completedRuns}`;
  }
}

function renderStats() {
  if (!els.statsDocs) return;
  els.statsDocs.textContent = telemetryState.completedRuns;
  const layerCount = telemetryState.memory.uniqueLayers instanceof Set
    ? telemetryState.memory.uniqueLayers.size
    : Array.isArray(telemetryState.memory.uniqueLayers)
      ? telemetryState.memory.uniqueLayers.length
      : 0;
  const tagCount = telemetryState.memory.uniqueTags instanceof Set
    ? telemetryState.memory.uniqueTags.size
    : Array.isArray(telemetryState.memory.uniqueTags)
      ? telemetryState.memory.uniqueTags.length
      : 0;
  els.statsCategories.textContent = layerCount;
  els.statsTags.textContent = tagCount;
}

function renderRecentReports() {
  if (!els.recentReports) return;
  els.recentReports.innerHTML = '';

  if (!telemetryState.reports.length) {
    const info = document.createElement('div');
    info.className = 'telemetry-empty';
    info.textContent = 'Research completions streamed here once runs finish in the terminal.';
    els.recentReports.appendChild(info);
    return;
  }

  const fragment = document.createDocumentFragment();
  telemetryState.reports.forEach((report, index) => {
    const card = document.createElement('article');
    card.className = 'research-report-card';
    card.dataset.index = index.toString();

    const heading = document.createElement('header');
    heading.className = 'research-report-header';

    const title = document.createElement('h3');
    title.textContent = report.filename || 'Untitled Research Summary';
    heading.appendChild(title);

    if (report.timestamp) {
      const time = document.createElement('time');
      time.dateTime = new Date(report.timestamp).toISOString();
      time.textContent = formatAbsoluteTime(report.timestamp);
      heading.appendChild(time);
    }

    const summary = document.createElement('p');
    summary.className = 'research-report-summary';
    summary.textContent = report.summary;

    const meta = document.createElement('div');
    meta.className = 'research-report-meta';
    const metaParts = [];
    if (report.durationMs !== null) metaParts.push(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
    if (report.learnings !== null) metaParts.push(`Learnings: ${report.learnings}`);
    if (report.sources !== null) metaParts.push(`Sources: ${report.sources}`);
    meta.textContent = metaParts.join(' • ') || 'Awaiting detailed metrics.';

    card.append(heading, summary, meta);

    if (report.error) {
      const errorBanner = document.createElement('div');
      errorBanner.className = 'research-report-error';
      errorBanner.textContent = report.error;
      card.appendChild(errorBanner);
    }

    fragment.appendChild(card);
  });

  els.recentReports.appendChild(fragment);
}
