/**
 * Organizer Bootstrapper
 * Why: Capture DOM references, wire event listeners, and kick off initial data loads for the organizer dashboard.
 * What: Coordinates scheduler, mission, and prompt modules after the DOM is ready.
 * How: Relies on shared state/elements/utilities initialized by companion scripts.
 */
(function bootstrapOrganizer(global) {
  if (!global) {
    return;
  }

  const els = global.organizerEls;
  const state = global.organizerState;
  const utils = global.organizerUtils;
  const scheduler = global.organizerScheduler;
  const missions = global.organizerMissions;
  const prompts = global.organizerPrompts;

  if (!els || !state || !utils || !scheduler || !missions || !prompts) {
    return;
  }

  function captureElements() {
    Object.assign(els, {
      schedulerStatusText: utils.byId('scheduler-status-text'),
      schedulerInterval: utils.byId('scheduler-interval'),
      schedulerLastTick: utils.byId('scheduler-last-tick'),
      schedulerActiveRuns: utils.byId('scheduler-active-runs'),
      schedulerStart: utils.byId('scheduler-start'),
      schedulerStop: utils.byId('scheduler-stop'),
      schedulerTick: utils.byId('scheduler-tick'),
      missionCount: utils.byId('mission-count'),
      missionSummary: utils.byId('mission-summary'),
      missionsStatus: utils.byId('missions-status'),
      missionList: utils.byId('mission-list'),
      missionsRefresh: utils.byId('missions-refresh'),
      promptCount: utils.byId('prompt-count'),
      promptSummary: utils.byId('prompt-summary'),
      promptsStatus: utils.byId('prompts-status'),
      promptList: utils.byId('prompt-list'),
      promptSearch: utils.byId('prompt-search'),
      promptsRefresh: utils.byId('prompts-refresh')
    });
  }

  function bindEvents() {
    els.schedulerStart?.addEventListener('click', () => scheduler.runSchedulerAction('/api/missions/start', 'Scheduler started.'));
    els.schedulerStop?.addEventListener('click', () => scheduler.runSchedulerAction('/api/missions/stop', 'Scheduler stopped.'));
    els.schedulerTick?.addEventListener('click', () => scheduler.runSchedulerAction('/api/missions/tick', 'Manual tick triggered.'));
    els.missionsRefresh?.addEventListener('click', () => missions.loadMissions(true));
    els.promptsRefresh?.addEventListener('click', () => prompts.loadPrompts(true));
    els.promptSearch?.addEventListener('input', prompts.handlePromptSearch);
    els.missionList?.addEventListener('click', missions.handleMissionListClick);
    els.promptList?.addEventListener('click', prompts.handlePromptListClick);
  }

  async function start() {
    captureElements();
    bindEvents();

    await scheduler.loadSchedulerState();
    await missions.loadMissions();
    await prompts.loadPrompts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      start().catch((error) => {
        console.error('Organizer bootstrap failed:', error);
      });
    }, { once: true });
  } else {
    start().catch((error) => {
      console.error('Organizer bootstrap failed:', error);
    });
  }
})(typeof window !== 'undefined' ? window : undefined);
