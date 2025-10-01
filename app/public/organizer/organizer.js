/**
 * Organizer Bootstrap Coordinator
 * Why: Centralize organizer DOM wiring and data refresh orchestration while delegating logic to feature modules.
 * What: Exposes a guarded `organizerBootstrap` facade with helpers to capture DOM nodes, bind events, and trigger data loads.
 * How: Validates shared state/utilities from companion modules, caches handlers, and invokes scheduler/mission/prompt loaders on demand.
 *
 * Contract
 * Inputs:
 *   - global.organizerState: OrganizerState { scheduler, missions, prompts, ... }
 *   - global.organizerEls: Mutable record for cached DOM nodes.
 *   - global.organizerUtils: { byId, formatRelativeTime, appendEmptyState, truncate, describeSchedule, formatStatus, readError, copyToClipboard }
 *   - global.organizerScheduler: { runSchedulerAction, loadSchedulerState, renderSchedulerState, disableSchedulerControls, announceSchedulerMessage }
 *   - global.organizerMissions: { loadMissions, renderMissionList, renderMissionSummary, handleMissionListClick }
 *   - global.organizerPrompts: { loadPrompts, renderPromptList, renderPromptSummary, handlePromptSearch, handlePromptListClick }
 * Outputs:
 *   - global.organizerBootstrap: { captureElements, bindEvents, start, refreshAll, refreshMissions, refreshPrompts, getState, getElements, isStarted }
 * Error modes:
 *   - Logs a console error and no-ops if required dependencies are unavailable.
 * Performance:
 *   - Time: DOM capture/bind under 5ms; async loaders reuse module-level budgets (soft 2s, hard 5s per fetch).
 *   - Space: Reuses shared state singletons; stores at most a handful of handler references.
 * Side effects:
 *   - Attaches DOM listeners and triggers fetches via delegated modules; no external IO beyond those modules.
 * Telemetry:
 *   - None here; delegated modules emit user-facing status updates.
 */
(function createOrganizerBootstrap(global) {
  if (!global || global.organizerBootstrap) {
    return;
  }

  const state = global.organizerState;
  const els = global.organizerEls;
  const utils = global.organizerUtils;
  const scheduler = global.organizerScheduler;
  const missions = global.organizerMissions;
  const prompts = global.organizerPrompts;

  const missing = Object.entries({ state, els, utils, scheduler, missions, prompts })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    global.console?.error?.('Organizer bootstrap halted: missing dependencies', { missing });
    return;
  }

  let elementsCaptured = false;
  let eventsBound = false;
  let startInFlight = null;
  let started = false;

  const actionMessages = Object.freeze({
    start: 'Scheduler started.',
    stop: 'Scheduler stopped.',
    tick: 'Manual tick triggered.'
  });

  const handlers = {
    onSchedulerStart: () => scheduler.runSchedulerAction('/api/missions/start', actionMessages.start),
    onSchedulerStop: () => scheduler.runSchedulerAction('/api/missions/stop', actionMessages.stop),
    onSchedulerTick: () => scheduler.runSchedulerAction('/api/missions/tick', actionMessages.tick),
    onMissionsRefresh: () => missions.loadMissions(true),
    onPromptsRefresh: () => prompts.loadPrompts(true),
    onPromptSearch: (event) => prompts.handlePromptSearch(event),
    onMissionListClick: (event) => missions.handleMissionListClick(event),
    onPromptListClick: (event) => prompts.handlePromptListClick(event)
  };

  function captureElements(force = false) {
    if (elementsCaptured && !force) {
      return els;
    }

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

    elementsCaptured = true;
    return els;
  }

  function bindTarget(target, type, handler) {
    if (!target) {
      return;
    }
    target.removeEventListener(type, handler);
    target.addEventListener(type, handler);
  }

  function bindEvents(force = false) {
    if (eventsBound && !force) {
      return;
    }

    captureElements(force);

    bindTarget(els.schedulerStart, 'click', handlers.onSchedulerStart);
    bindTarget(els.schedulerStop, 'click', handlers.onSchedulerStop);
    bindTarget(els.schedulerTick, 'click', handlers.onSchedulerTick);
    bindTarget(els.missionsRefresh, 'click', handlers.onMissionsRefresh);
    bindTarget(els.promptsRefresh, 'click', handlers.onPromptsRefresh);
    bindTarget(els.promptSearch, 'input', handlers.onPromptSearch);
    bindTarget(els.missionList, 'click', handlers.onMissionListClick);
    bindTarget(els.promptList, 'click', handlers.onPromptListClick);

    eventsBound = true;
  }

  async function refreshMissions({ force = false } = {}) {
    await missions.loadMissions(force);
  }

  async function refreshPrompts({ force = false } = {}) {
    await prompts.loadPrompts(force);
  }

  async function refreshAll({ forceMissions = false, forcePrompts = false } = {}) {
    await Promise.all([
      missions.loadMissions(forceMissions),
      prompts.loadPrompts(forcePrompts)
    ]);
  }

  async function start({
    forceCapture = false,
    forceBind = false,
    forceMissions = false,
    forcePrompts = false
  } = {}) {
    captureElements(forceCapture);
    bindEvents(forceBind);

    if (startInFlight) {
      return startInFlight;
    }

    startInFlight = (async () => {
      await scheduler.loadSchedulerState();
      await Promise.all([
        missions.loadMissions(forceMissions),
        prompts.loadPrompts(forcePrompts)
      ]);
      started = true;
    })().catch((error) => {
      global.console?.error?.('Organizer bootstrap start failed', error);
      throw error;
    }).finally(() => {
      startInFlight = null;
    });

    return startInFlight;
  }

  const bootstrap = Object.freeze({
    captureElements,
    bindEvents,
    start,
    refreshAll,
    refreshMissions,
    refreshPrompts,
    getState: () => state,
    getElements: () => els,
    isStarted: () => started
  });

  global.organizerBootstrap = bootstrap;
})(typeof window !== 'undefined' ? window : undefined);
