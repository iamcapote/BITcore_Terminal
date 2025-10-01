/**
 * Organizer Scheduler Module
 * Why: Encapsulate scheduler fetch/update logic so the bootstrapper can stay thin.
 * What: Provides helpers for running scheduler actions, rendering state, and broadcasting status messages.
 * How: Relies on shared organizer state, elements, and utility helpers registered on window.
 */
(function initializeOrganizerScheduler(global) {
  if (!global) {
    return;
  }

  const state = global.organizerState;
  const els = global.organizerEls;
  const utils = global.organizerUtils;

  if (!state || !els || !utils) {
    return;
  }

  async function runSchedulerAction(endpoint, successMessage) {
    disableSchedulerControls(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const details = await utils.readError(response);
        throw new Error(details || `${response.status} ${response.statusText}`);
      }
      announceSchedulerMessage(successMessage, 'success');
    } catch (error) {
      announceSchedulerMessage(error.message || 'Scheduler action failed.', 'error');
    } finally {
      disableSchedulerControls(false);
      await loadSchedulerState();
      if (global.organizerMissions?.loadMissions) {
        await global.organizerMissions.loadMissions(true);
      }
    }
  }

  async function loadSchedulerState() {
    try {
      const response = await fetch('/api/missions/state');
      if (!response.ok) {
        throw new Error(`Failed to load scheduler state (${response.status})`);
      }
      const payload = await response.json();
      state.scheduler = payload;
      renderSchedulerState();
    } catch (error) {
      state.scheduler = null;
      announceSchedulerMessage(error.message, 'error');
      renderSchedulerState();
    }
  }

  function renderSchedulerState() {
    const scheduler = state.scheduler;
    const enabled = scheduler?.featureEnabled !== false;
    const schedulerEnabled = enabled && scheduler?.schedulerEnabled !== false;
    const running = Boolean(scheduler?.state?.running);

    const intervalMs = scheduler?.state?.intervalMs;
    if (els.schedulerInterval) {
      els.schedulerInterval.textContent = Number.isFinite(intervalMs)
        ? `${Math.round(intervalMs / 1000)}s`
        : '—';
    }

    const lastTick = scheduler?.state?.lastTickCompletedAt || scheduler?.state?.lastTickStartedAt;
    if (els.schedulerLastTick) {
      els.schedulerLastTick.textContent = lastTick ? utils.formatRelativeTime(lastTick) : '—';
    }

    if (els.schedulerActiveRuns) {
      els.schedulerActiveRuns.textContent = Number.isFinite(scheduler?.state?.activeRuns)
        ? `${scheduler.state.activeRuns}`
        : '0';
    }

    if (!enabled) {
      announceSchedulerMessage('Mission scheduler is disabled by configuration.', 'warn');
    } else if (!schedulerEnabled) {
      announceSchedulerMessage('Scheduler HTTP controls disabled via feature flag.', 'warn');
    } else if (running) {
      announceSchedulerMessage('Scheduler is running.', 'success');
    } else {
      announceSchedulerMessage('Scheduler is stopped.', 'info');
    }

    const controlsDisabled = !enabled || !schedulerEnabled;
    if (els.schedulerStart) {
      els.schedulerStart.disabled = controlsDisabled || running;
    }
    if (els.schedulerStop) {
      els.schedulerStop.disabled = controlsDisabled || !running;
    }
    if (els.schedulerTick) {
      els.schedulerTick.disabled = controlsDisabled;
    }
  }

  function disableSchedulerControls(disabled) {
    [els.schedulerStart, els.schedulerStop, els.schedulerTick].forEach((button) => {
      if (button) button.disabled = disabled;
    });
  }

  function announceSchedulerMessage(message, tone = 'info') {
    if (!els.schedulerStatusText) {
      return;
    }
    els.schedulerStatusText.textContent = message;
    els.schedulerStatusText.dataset.tone = tone;
  }

  global.organizerScheduler = {
    runSchedulerAction,
    loadSchedulerState,
    renderSchedulerState,
    disableSchedulerControls,
    announceSchedulerMessage
  };
})(typeof window !== 'undefined' ? window : undefined);
