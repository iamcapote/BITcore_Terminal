/**
 * Prompt Library State Container
 * Why: Centralize UI state (selection, query, debounce timers) for the prompt dashboard.
 * What: Exposes a mutable promptState object shared by renderers and actions.
 * How: Initializes defaults once, avoiding accidental redefinition on subsequent loads.
 */
(function initializePromptState(global) {
  if (!global || global.promptState) {
    return;
  }

  global.promptState = {
    currentPromptId: null,
    currentQuery: '',
    searchDebounce: null
  };
})(typeof window !== 'undefined' ? window : undefined);
