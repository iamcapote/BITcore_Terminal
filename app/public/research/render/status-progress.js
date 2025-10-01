/**
 * Research Renderers: Status & Progress
 * Why: Keep dashboard status bars in sync with telemetry state updates.
 * What: Exposes window.renderStatus and window.renderProgress helpers.
 * How: Pulls from shared telemetryState and element cache populated during bootstrap.
 */
(function registerResearchStatusRender(global) {
  if (!global) {
    return;
  }

  global.renderStatus = function renderStatus() {
    if (!els.stage || !els.message) return;
    els.stage.textContent = telemetryState.stage;
    els.message.textContent = telemetryState.message;
    if (!els.detail) return;

    if (telemetryState.detail) {
      els.detail.textContent = telemetryState.detail;
      els.detail.classList.remove('hidden');
    } else {
      els.detail.textContent = '';
      els.detail.classList.add('hidden');
    }
  };

  global.renderProgress = function renderProgress() {
    if (!els.progressFill) return;
    const { percent, completed, total, depth, breadth } = telemetryState.progress;
    els.progressFill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
    els.progressPercent.textContent = Number.isFinite(percent) ? `${percent}%` : '0%';
    els.progressCount.textContent = `${completed}/${total}`;
    els.depth.textContent = depth !== null ? `Depth: ${depth}` : 'Depth: —';
    els.breadth.textContent = breadth !== null ? `Breadth: ${breadth}` : 'Breadth: —';
  };
})(typeof window !== 'undefined' ? window : undefined);
