class Research {
  constructor(terminal) {
    this.terminal = terminal;
    this.ws = null;
    this.running = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    this.reconnectDelay = 1000;
    this.connectToServer();
  }

  connectToServer() {
    try {
      // Clear previous connection if exists
      if (this.ws) {
        this.ws.onclose = null; // Prevent the old onclose from triggering
        this.ws.close();
      }

      this.connectionAttempts++;
      
      // Get the correct protocol (wss for https, ws for http)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsURL = `${protocol}//${window.location.host}`;
      
      this.terminal.appendOutput(`Connecting to server (attempt ${this.connectionAttempts})...`);
      console.log(`Connecting to WebSocket server at ${wsURL}`);
      
      this.ws = new WebSocket(wsURL);
      
      this.ws.onopen = () => {
        console.log("WebSocket connection established");
        this.terminal.appendOutput("Connected to research server!");
        this.connectionAttempts = 0; // Reset connection attempts on success
      };
      
      this.ws.onmessage = (event) => {
        console.log("Received message:", event.data);
        try {
          const { type, data } = JSON.parse(event.data);
          
          switch(type) {
            case 'prompt':
              this.terminal.setPrompt(data);
              break;
              
            case 'output':
              this.terminal.appendOutput(data);
              break;
              
            case 'log':
              this.terminal.appendOutput(data);
              break;
              
            case 'progress':
              if (data.message) {
                this.terminal.updateLastLine(data.message);
              } else if (data.completedQueries !== undefined && data.totalQueries !== undefined) {
                const percent = Math.round((data.completedQueries / data.totalQueries) * 100);
                const barBlocks = Math.floor(percent / 5);
                const bar = `[${'█'.repeat(barBlocks)}${'░'.repeat(20 - barBlocks)}]`;
                this.terminal.updateLastLine(`Progress: ${bar} ${percent}%`);
              }
              break;
              
            case 'error':
              this.terminal.appendOutput(`Error: ${data}`);
              this.running = false;
              break;
              
            default:
              console.warn("Unknown message type:", type);
              break;
          }
        } catch (e) {
          console.error("Error processing message:", e, event.data);
          this.terminal.appendOutput(`Error processing server message: ${e.message}`);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.terminal.appendOutput('Connection error. Attempting to reconnect...');
        this.running = false;
      };
      
      this.ws.onclose = (event) => {
        console.log("WebSocket connection closed", event.code, event.reason);
        this.running = false;
        
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          this.terminal.appendOutput(`Connection lost. Reconnecting in ${this.reconnectDelay/1000}s...`);
          setTimeout(() => this.connectToServer(), this.reconnectDelay);
          this.reconnectDelay *= 2; // Exponential backoff
        } else {
          this.terminal.appendOutput('Cannot connect to server after multiple attempts. Please refresh the page.');
        }
      };
    } catch (e) {
      console.error("Error setting up WebSocket:", e);
      this.terminal.appendOutput(`Connection error: ${e.message}. Retrying...`);
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        setTimeout(() => this.connectToServer(), this.reconnectDelay);
        this.reconnectDelay *= 2;
      } else {
        this.terminal.appendOutput('Failed to connect after multiple attempts. Please check your network or refresh the page.');
      }
    }
  }

  isRunning() {
    return this.running;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  start(userInput) {
    if (!this.isConnected()) {
      this.terminal.appendOutput('Not connected to server. Attempting to reconnect...');
      this.connectToServer();
      // Store the input to send after connection
      this.pendingInput = userInput;
      return;
    }
    
    // Set running state based on the current step
    if (userInput.trim()) {
      this.running = true;
    }
    
    try {
      console.log("Sending input:", userInput);
      this.ws.send(JSON.stringify({ input: userInput }));
    } catch (e) {
      console.error("Error sending message:", e);
      this.terminal.appendOutput(`Error sending message: ${e.message}`);
      this.running = false;
      this.connectToServer(); // Try to reconnect
    }
  }
}
