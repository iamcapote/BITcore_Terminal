/**
 * Research Renderers: Recent Reports
 * Why: Provide a rolling list of finished research runs within the dashboard.
 * What: Implements window.renderRecentReports used after telemetry updates.
 * How: Builds card UI fragments from telemetryState.reports data.
 */
(function registerResearchReportsRender(global) {
  if (!global) {
    return;
  }

  global.renderRecentReports = function renderRecentReports() {
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
  };
})(typeof window !== 'undefined' ? window : undefined);
