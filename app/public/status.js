/**
 * Why: Provide a legacy-compatible entrypoint for status indicators while the new modular assets load elsewhere.
 * What: Warns about the deprecated bundle and, when possible, boots a singleton `StatusClient` plus `refreshStatusIndicators` helper.
 * How: Marks the shim as initialised, consults the global scope for the modular client, and falls back to console warnings when unavailable.
 */
(function legacyStatusEntrypoint(global) {
  if (!global || global.__statusEntrypointInitialized) {
    return;
  }

  global.__statusEntrypointInitialized = true;

  const consoleRef = global.console || {};
  const warn = typeof consoleRef.warn === 'function'
    ? consoleRef.warn.bind(consoleRef)
    : () => {};

  warn('[Status] `/status.js` is deprecated. Load `/status/status.constants.js`, `/status/status.client.js`, and `/status/status.bootstrap.js` instead.');

  const StatusClient = global.StatusClient;
  if (typeof StatusClient !== 'function') {
    warn('[Status] StatusClient unavailable; modular assets were not loaded.');
    return;
  }

  let client;
  const ensureClient = () => {
    if (!client) {
      client = new StatusClient();
    }
    return client;
  };

  const hasElements = () => {
    const instance = ensureClient();
    return Boolean(instance.hasTargets?.() || instance.hasPresenceTargets?.());
  };

  if (hasElements()) {
    ensureClient().start?.();
  }

  global.refreshStatusIndicators = function refreshStatusIndicators() {
    if (!hasElements()) {
      return;
    }
    ensureClient().refresh?.();
  };
})(typeof window !== 'undefined' ? window : globalThis);
