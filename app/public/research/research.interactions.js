/**
 * Research Dashboard Interaction Handlers
 * Why: Centralize click and UI event handlers shared across the research dashboard surface.
 * What: Handles suggestion copy actions, report selection previews, and tab toggling behaviour.
 * How: Uses shared state and render helpers to keep UI feedback instant while avoiding duplicate bindings.
 */
function handleSuggestionClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.dataset.action !== 'copy') return;

  const index = Number.parseInt(trigger.dataset.index, 10);
  if (!Number.isInteger(index)) return;

  const suggestion = telemetryState.suggestions.items?.[index];
  if (!suggestion || !suggestion.prompt) return;

  copyTextToClipboard(suggestion.prompt, trigger, {
    restoreLabel: trigger.dataset.restoreLabel || trigger.textContent || 'Copy prompt',
    successLabel: 'Copied!',
    failureLabel: 'Copy failed'
  }).catch((error) => {
    console.error('Failed to copy memory suggestion.', error);
  });
}

function handleReportSelection(event) {
  const card = event.target.closest('.research-report-card');
  if (!card) return;
  const index = Number.parseInt(card.dataset.index, 10);
  if (!Number.isInteger(index)) return;
  const report = telemetryState.reports[index];
  if (!report) return;

  if (els.documentViewer) {
    els.documentViewer.classList.remove('hidden');
  }
  if (els.documentTitle) {
    els.documentTitle.textContent = report.filename || 'Recent Research Summary';
  }
  if (els.documentCategories) {
    const duration = report.durationMs !== null ? `${(report.durationMs / 1000).toFixed(1)}s` : '—';
    els.documentCategories.textContent = `Duration • ${duration}`;
  }
  if (els.documentTags) {
    const tags = [];
    if (report.learnings !== null) tags.push(`${report.learnings} learnings`);
    if (report.sources !== null) tags.push(`${report.sources} sources`);
    els.documentTags.textContent = tags.length ? tags.join(' • ') : 'No metrics recorded yet.';
  }
  if (els.documentContent) {
    els.documentContent.textContent = report.summary;
  }
}

function wireTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
      contents.forEach((section) => {
        section.classList.toggle('active', section.id === target);
      });
    });
  });
}
