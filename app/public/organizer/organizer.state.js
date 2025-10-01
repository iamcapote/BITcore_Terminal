/**
 * Organizer State Container
 * Why: Share mutable scheduler/mission/prompt state between organizer modules without globals scattering.
 * What: Initializes `organizerState` and `organizerEls` singletons on the window object.
 * How: Runs once at load time and reuses existing objects when navigating between sections.
 */
(function initializeOrganizerState(global) {
  if (!global) {
    return;
  }

  if (!global.organizerState) {
    global.organizerState = {
      scheduler: null,
      missions: [],
      missionsLoading: false,
      missionsError: null,
      prompts: [],
      promptsLoading: false,
      promptsError: null,
      promptSearch: '',
      promptDebounceId: null
    };
  }

  if (!global.organizerEls) {
    global.organizerEls = {};
  }
})(typeof window !== 'undefined' ? window : undefined);
