/**
 * Research Dashboard Bootstrapper
 * Why: Coordinate state capture, module initialization, and real-time connectivity for the research UI.
 * What: Wires DOM listeners, triggers first renders, and exposes a light debug surface on window.researchDashboard.
 * How: Relies on companion modules (state, render, telemetry, prompts, GitHub, WebSocket, interactions) loaded beforehand.
 */
(function bootstrapResearchDashboard() {
  let connectionListenersBound = false;

  function attachEventListeners() {
    const suggestionHandler = window.handleSuggestionClick;
    if (els.suggestionsList && typeof suggestionHandler === 'function' && !els.suggestionsList.dataset.bound) {
      els.suggestionsList.addEventListener('click', suggestionHandler);
      els.suggestionsList.dataset.bound = 'true';
    }

    const reportHandler = window.handleReportSelection;
    if (els.recentReports && typeof reportHandler === 'function' && !els.recentReports.dataset.bound) {
      els.recentReports.addEventListener('click', reportHandler);
      els.recentReports.dataset.bound = 'true';
    }

    const enterEdit = window.enterEditMode;
    if (els.documentEdit && typeof enterEdit === 'function' && !els.documentEdit.dataset.bound) {
      els.documentEdit.addEventListener('click', enterEdit);
      els.documentEdit.dataset.bound = 'true';
    }

    const closeViewer = window.closeDocumentViewer;
    if (els.documentClose && typeof closeViewer === 'function' && !els.documentClose.dataset.bound) {
      els.documentClose.addEventListener('click', closeViewer);
      els.documentClose.dataset.bound = 'true';
    }

    const saveDocument = window.saveCurrentDocument;
    if (els.documentSave && typeof saveDocument === 'function' && !els.documentSave.dataset.bound) {
      els.documentSave.addEventListener('click', (event) => {
        event.preventDefault();
        Promise.resolve(saveDocument()).catch((error) => {
          console.error('Failed to save document through Research UI.', error);
        });
      });
      els.documentSave.dataset.bound = 'true';
    }
  }

  function renderInitialState() {
    const renderFunctions = [
      'renderStatus',
      'renderProgress',
      'renderThoughts',
      'renderMemory',
      'renderSuggestions',
      'renderSummary',
      'renderStats',
      'renderRecentReports'
    ];

    renderFunctions.forEach((name) => {
      const fn = window[name];
      if (typeof fn === 'function') {
        fn();
      }
    });
  }

  function ensureLiveConnection() {
    const ensure = window.ensureWebSocket;
    const connect = window.connectWebSocket;
    if (typeof ensure === 'function') ensure();
    if (typeof connect === 'function') connect();
  }

  function handleVisibilityReturn() {
    if (document.visibilityState === 'visible') {
      ensureLiveConnection();
    }
  }

  function start() {
    const capture = window.captureElements;
    if (typeof capture !== 'function') {
      console.error('Research dashboard bootstrap failed: captureElements is unavailable.');
      return;
    }

    capture();

    if (typeof window.wireTabs === 'function') {
      window.wireTabs();
    }

    attachEventListeners();
    renderInitialState();

    if (typeof window.initializePromptSelectors === 'function') {
      window.initializePromptSelectors();
    }

    if (typeof window.initializeGitHubDashboard === 'function') {
      window.initializeGitHubDashboard();
    }

    ensureLiveConnection();

    if (!connectionListenersBound) {
      connectionListenersBound = true;
      document.addEventListener('visibilitychange', handleVisibilityReturn);
      window.addEventListener('focus', ensureLiveConnection);
    }

    window.researchDashboard = {
      els,
      state: {
        telemetry: telemetryState,
        prompts: promptState,
        github: githubState
      },
      refreshPrompts: typeof window.loadPromptSelectors === 'function' ? window.loadPromptSelectors : undefined,
      refreshGitHub: typeof window.loadGitHubDirectory === 'function'
        ? (path = githubState.currentPath || '') => window.loadGitHubDirectory(path)
        : undefined,
      reconnect: ensureLiveConnection
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());
