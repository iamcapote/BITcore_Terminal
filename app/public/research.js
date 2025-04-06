class Research {
  constructor(terminal) {
    this.terminal = terminal;
    this.ws = null;
    this.running = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    this.reconnectDelay = 1000;
    this.pendingPromptResolve = null;
    this.awaitingResponse = false;
    this.connectToServer();
  }

  connectToServer() {
    try {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
      }

      this.connectionAttempts++;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsURL = `${protocol}//${window.location.host}`;

      this.terminal.appendOutput(`Connecting to server (attempt ${this.connectionAttempts})...`);
      this.ws = new WebSocket(wsURL);

      this.ws.onopen = () => {
        this.terminal.appendOutput('Connected to research server!');
        this.connectionAttempts = 0;
      };

      this.ws.onclose = () => {
        const reconnectDelay = Math.pow(2, this.connectionAttempts - 1);
        if (this.connectionAttempts <= this.maxConnectionAttempts) {
          this.terminal.appendOutput(`Connection lost. Reconnecting in ${reconnectDelay}s...`);
          setTimeout(() => this.connectToServer(), reconnectDelay * 1000);
        } else {
          this.terminal.appendOutput('Cannot connect to server after multiple attempts. Please refresh the page.');
        }
      };

      this.ws.onerror = () => {
        this.terminal.appendOutput('Connection error. Attempting to reconnect...');
      };

      // Add a message handler for all incoming WebSocket messages
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'output') {
            this.terminal.appendOutput(data.data);
          } else if (data.type === 'prompt') {
            // Instead of just setting the prompt, we need to ask for input
            this.terminal.setPrompt(data.data);
            this.awaitingResponse = true;
            
            // If we have a pending promise resolver, don't create a new one
            if (!this.pendingPromptResolve) {
              this.terminal.enableInput();
            }
          } else if (data.type === 'classification_result') {
            this.terminal.appendOutput('Token classification completed.');
            this.terminal.appendOutput(`Token classification result: ${data.metadata}`);
            this.terminal.appendOutput('Using token classification to enhance research quality...');
          } else if (data.type === 'progress') {
            if (typeof data.data === 'object' && data.data.message) {
              this.terminal.updateLastLine(data.data.message);
            } else {
              this.terminal.updateLastLine(`Progress: ${data.data}`);
            }
          } else if (data.type === 'research_start') {
            this.running = true;
            this.terminal.appendOutput('Starting research session...');
            this.terminal.disableInput();
            this.terminal.showProgressBar();
          } else if (data.type === 'research_complete') {
            this.running = false;
            this.terminal.appendOutput('Research complete!');
            this.terminal.enableInput();
            this.terminal.hideProgressBar();
            this.terminal.setPrompt('> ');
          }
        } catch (error) {
          this.terminal.appendOutput(`Error processing message: ${error.message}`);
        }
      };
    } catch (e) {
      this.terminal.appendOutput(`Connection error: ${e.message}. Retrying...`);
    }
  }

  isRunning() {
    return this.running;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async start(userInput) {
    if (!this.isConnected()) {
      this.terminal.appendOutput('Not connected to server. Attempting to reconnect...');
      this.connectToServer();
      return;
    }

    if (this.running && !this.awaitingResponse) {
      this.terminal.appendOutput('Research is in progress. Please wait until it completes.');
      return;
    }

    if (this.awaitingResponse) {
      // This is a response to a prompt from the server
      this.awaitingResponse = false;
      this.ws.send(JSON.stringify({ input: userInput }));
      return;
    }

    if (!userInput.trim()) {
      this.terminal.appendOutput('Command cannot be empty.');
      return;
    }

    // Handle commands
    if (userInput.trim() === '/research') {
      // This is a command, not a query
      this.ws.send(JSON.stringify({ input: '/research' }));
    } else {
      this.terminal.appendOutput('Unknown command. Use /research');
    }
  }

  handleClassificationResult(metadata) {
    this.terminal.appendOutput('Token classification completed.');
    this.terminal.appendOutput(`Classification metadata: ${metadata}`);
  }
}
