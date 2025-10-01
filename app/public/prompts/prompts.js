/**
 * Prompt Library Bootstrapper
 * Why: Wire modular prompt actions to DOM events for the dashboard UI.
 * What: Binds listeners for CRUD, search, and GitHub sync controls, then triggers the initial load.
 * How: Relies on promptEls, promptActions, and companion modules registered on the window.
 */
(function bootstrapPromptLibrary(global) {
  if (!global) {
    return;
  }

  function run() {
    const els = global.promptEls;
    const actions = global.promptActions;

    if (!els || !actions) {
      console.error('Prompt library bootstrap failed: missing modules.');
      return;
    }

    const bind = (element, event, handler) => {
      if (!element || typeof handler !== 'function') {
        return;
      }

      element.addEventListener(event, handler);
    };

    bind(els.refreshButton, 'click', () => actions.loadSummaries());
    bind(els.newButton, 'click', () => actions.resetForm());
    bind(els.deleteButton, 'click', () => actions.handleDelete());
    bind(els.form, 'submit', (event) => actions.handleSubmit(event));
    bind(els.searchInput, 'input', (event) => {
      const value = event.currentTarget ? event.currentTarget.value : '';
      actions.handleSearchInput(value);
    });

    bind(els.githubPullButton, 'click', () => actions.runGitHubAction('pull'));
    bind(els.githubPushButton, 'click', () => actions.runGitHubAction('push'));
    bind(els.githubSyncButton, 'click', () => actions.runGitHubAction('sync'));

    actions.init();
  }

  if (global.document?.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})(typeof window !== 'undefined' ? window : undefined);
