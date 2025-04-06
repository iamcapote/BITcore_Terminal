export class OutputManager {
  constructor() {
    this.spinnerStates = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerIndex = 0;
    this.webSocketClients = new Set();
    this.spinnerInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerStates.length;
    }, 80);
    this.lastProgressMessage = '';
    this.logHandler = console.log; // Default log handler
    this.errorHandler = console.error; // Default error handler
  }

  // Allow dynamic replacement of log and error handlers
  use({ log, error }) {
    if (typeof log === 'function') {
      this.logHandler = log;
    }
    if (typeof error === 'function') {
      this.errorHandler = error;
    }
  }

  // Broadcast logs over all connected websockets
  broadcastLog(message, type = 'log') {
    for (const client of this.webSocketClients) {
      try {
        client.send(JSON.stringify({ type, data: message }));
      } catch { /* ignore send errors */ }
    }
  }

  // Allow server to register new websocket clients
  addWebSocketClient(ws) {
    this.webSocketClients.add(ws);
    
    // Send the last progress message to new clients
    if (this.lastProgressMessage) {
      ws.send(JSON.stringify({ 
        type: 'progress', 
        data: { message: this.lastProgressMessage } 
      }));
    }
    
    ws.on('close', () => {
      this.webSocketClients.delete(ws);
    });
  }
  
  // Remove a WebSocket client
  removeWebSocketClient(ws) {
    this.webSocketClients.delete(ws);
  }

  log(...args) {
    const message = args.map(String).join(' ');
    this.logHandler(message);
    this.broadcastLog(message, 'output');
  }

  error(...args) {
    const message = args.map(String).join(' ');
    this.errorHandler(message);
    this.broadcastLog(message, 'error');
  }

  updateProgress(progress) {
    const totalSteps = progress.totalDepth * progress.totalBreadth;
    const completedSteps = progress.completedQueries || 0;
    const percent = Math.round((completedSteps / totalSteps) * 100);
    const barBlocks = Math.floor(percent / 5);
    const bar = `[${'█'.repeat(barBlocks)}${'░'.repeat(20 - barBlocks)}]`;
    const message = `Progress: ${bar} ${percent}%`;
    this.lastProgressMessage = message;
    
    // For CLI
    process.stdout.write(`\r${message}`);
    
    // For WebSocket
    this.broadcastLog({
      completedQueries: completedSteps,
      totalQueries: totalSteps,
      message
    }, 'progress');
  }

  cleanup() {
    clearInterval(this.spinnerInterval);
  }
}

export const output = new OutputManager();
