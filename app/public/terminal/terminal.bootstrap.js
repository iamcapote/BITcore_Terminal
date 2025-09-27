/**
 * Terminal Bootstrap Wiring
 * Why: Orchestrate client-side initialization for the modular terminal stack.
 * What: Creates or reuses the WebComm client, instantiates the Terminal, and wires the command processor.
 * How: Defers setup until DOMContentLoaded, guards against double instantiation, and ensures the WebSocket connects.
 */
(function bootstrapTerminal(global) {
  if (!global || typeof global !== 'object') {
    return;
  }

  const document = global.document;
  if (!document) {
    console.error('[terminal.bootstrap] Document context unavailable.');
    return;
  }

  /**
   * Resolve the WebSocket URL based on the current location.
   * @returns {string}
   */
  const resolveWebSocketUrl = () => {
    const protocol = global.location?.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = global.location?.host || 'localhost';
    return `${protocol}//${host}/api/research/ws`;
  };

  /**
   * Ensure a singleton WebComm instance exists and is stored on window.
   * @returns {WebComm|null}
   */
  const ensureWebComm = () => {
    const WebCommCtor = global.WebComm;
    if (!WebCommCtor || typeof WebCommCtor !== 'function') {
      console.error('[terminal.bootstrap] WebComm constructor not found.');
      return null;
    }

    const desiredUrl = resolveWebSocketUrl();

    if (!global.webcomm) {
      global.webcomm = new WebCommCtor(desiredUrl);
      return global.webcomm;
    }

    if (global.webcomm.url !== desiredUrl) {
      global.webcomm.url = desiredUrl;
    }

    return global.webcomm;
  };

  /**
   * Ensure the Terminal instance exists and is exposed on window.
   * @returns {Terminal|null}
   */
  const ensureTerminal = () => {
    const TerminalCtor = global.Terminal;
    if (!TerminalCtor || typeof TerminalCtor !== 'function') {
      console.error('[terminal.bootstrap] Terminal constructor not found.');
      return null;
    }

    if (!global.terminal) {
      global.terminal = new TerminalCtor('terminal-output');
    }

    return global.terminal;
  };

  /**
   * Ensure the CommandProcessor instance exists and is set on window.
   * @param {Terminal|null} terminal
   * @param {WebComm|null} client
   * @returns {CommandProcessor|null}
   */
  const ensureCommandProcessor = (terminal, client) => {
    const CommandProcessorCtor = global.CommandProcessor;
    if (!CommandProcessorCtor || typeof CommandProcessorCtor !== 'function') {
      console.warn('[terminal.bootstrap] CommandProcessor constructor not yet available.');
      return null;
    }

    if (!terminal || !client) {
      return null;
    }

    if (!global.commandProcessor) {
      global.commandProcessor = new CommandProcessorCtor(terminal, client);
    }

    return global.commandProcessor;
  };

  /**
   * Start the WebSocket connection if required.
   * @param {WebComm|null} client
   */
  const startWebSocket = (client) => {
    if (!client) {
      return;
    }

    if (!client.isConnected?.() && !client.isConnecting) {
      client.connect();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const client = ensureWebComm();
    const terminal = ensureTerminal();

    if (client && terminal && client.setTerminal && client.terminal !== terminal) {
      client.setTerminal(terminal);
    }

    ensureCommandProcessor(terminal, client);

    startWebSocket(client);

    if (terminal) {
      try {
        global.dispatchEvent(new CustomEvent('terminal-ready', { detail: { terminal } }));
      } catch (error) {
        console.warn('[terminal.bootstrap] Failed to dispatch terminal-ready event:', error);
      }
    }
  });
})(window);
