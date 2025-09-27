/**
 * Terminal Legacy Shim
 * Why: Preserve a helpful message for contexts that still reference the historical terminal.js.
 * What: Warns developers and points them to the modular terminal bundle now living under /terminal/.
 * How: Emits a console warning and dispatches a best-effort bootstrap event when the new stack is already loaded.
 */
(function legacyTerminalShim(global) {
  const hasModularStack = Boolean(global.Terminal && global.webcomm && global.CommandProcessor);

  if (!hasModularStack) {
    console.warn(
      '[terminal.js] The monolithic terminal bundle has been retired. Include the modular scripts from /public/terminal/ instead.'
    );
    return;
  }

  console.info('[terminal.js] Legacy shim detected the modular terminal stack. Dispatching terminal-ready event.');

  try {
    global.dispatchEvent(new CustomEvent('terminal-ready', { detail: { terminal: global.terminal || null } }));
  } catch (error) {
    console.debug('[terminal.js] Failed to dispatch terminal-ready event from legacy shim:', error);
  }
})(window);
