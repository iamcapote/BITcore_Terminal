/**
 * Research WebSocket Wiring
 * Why: Bridge WebSocket telemetry from the backend into the dashboard's state update routines.
 * What: Establishes a single shared WebComm instance, registers event handlers, and reconnects as needed.
 * How: Configures channel subscriptions that call into telemetry, GitHub activity, and render helpers.
 */
function ensureWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/api/research/ws`;

  if (!window.webcomm) {
    window.webcomm = new WebComm(wsUrl);
  } else if (window.webcomm.url !== wsUrl) {
    window.webcomm.url = wsUrl;
  }
}

function connectWebSocket() {
  if (!window.webcomm) return;
  window.webcomm.registerHandler('connection', updateConnection);
  window.webcomm.registerHandler('research-status', (message) => {
    if (message?.data) updateStatus(message.data);
  });
  window.webcomm.registerHandler('research-progress', (message) => {
    if (message?.data) updateProgress(message.data);
  });
  window.webcomm.registerHandler('research-thought', (message) => {
    const payload = message?.data;
    if (!payload) return;
    if (Array.isArray(payload)) payload.forEach(appendThought);
    else appendThought(payload);
  });
  window.webcomm.registerHandler('research-memory', (message) => {
    if (message?.data) updateMemoryContext(message.data);
  });
  window.webcomm.registerHandler('research-suggestions', (message) => {
    if (message?.data) updateSuggestions(message.data);
  });
  window.webcomm.registerHandler('research-complete', (message) => {
    if (message?.data) handleResearchComplete(message.data);
  });
  window.webcomm.registerHandler('github-activity-snapshot', (message) => {
    const payload = Array.isArray(message?.data)
      ? message.data
      : (Array.isArray(message?.activities) ? message.activities : []);
    hydrateGitHubActivity(payload);
  });
  window.webcomm.registerHandler('github-activity', (message) => {
    const entry = message?.data || message?.activity || null;
    if (pushGitHubActivityEntry(entry)) {
      renderGitHubActivity();
    }
  });
  window.webcomm.registerHandler('research_start', () => {
    resetForNewRun();
  });

  if (!window.webcomm.isConnected() && !window.webcomm.isConnecting) {
    window.webcomm.connect().catch((error) => {
      console.error('Failed to establish WebSocket connection', error);
    });
  }
}
