(function bootstrapStatus(global) {
  const StatusClient = global.StatusClient;
  if (!StatusClient) {
    console.error('Status bootstrap failed: StatusClient unavailable.');
    return;
  }

  let singletonClient = null;

  function ensureClient() {
    if (!singletonClient) {
      singletonClient = new StatusClient();
    }
    return singletonClient;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const client = ensureClient();
    if (client.hasTargets() || client.hasPresenceTargets()) {
      client.start();
    }
  });

  global.refreshStatusIndicators = function refreshStatusIndicators() {
    const client = ensureClient();
    if (client.hasTargets() || client.hasPresenceTargets()) {
      client.refresh();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
