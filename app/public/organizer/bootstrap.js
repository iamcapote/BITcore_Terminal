/**
 * Organizer Auto-Start Shim
 * Why: Preserve legacy script ordering by delegating DOM-ready startup to the shared organizer bootstrap facade.
 * What: Waits for the document to settle, then invokes `organizerBootstrap.start()` if available.
 * How: Performs a lightweight readiness check and logs a warning when the facade is missing.
 */
(function autoStartOrganizer(global) {
  if (!global) {
    return;
  }

  function run() {
    const bootstrap = global.organizerBootstrap;
    if (!bootstrap?.start) {
      global.console?.warn?.('Organizer auto-start skipped: organizerBootstrap.start() not found.');
      return;
    }
    Promise.resolve(bootstrap.start()).catch((error) => {
      global.console?.error?.('Organizer auto-start failed', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})(typeof window !== 'undefined' ? window : undefined);
