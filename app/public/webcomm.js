/**
 * WebSocket communication manager for the MCP application
 * 
 * Handles WebSocket connections and message processing between
 * client and server with improved error handling and reliability.
 */
class WebSocketCommunicator {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.pendingPrompts = new Map();
    
    // Initialize connection
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket at ${url}`);
    
    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
    }
    
    this.ws = new WebSocket(url);
    
    // Set up WebSocket event handlers
    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  handleOpen() {
    console.log('WebSocket connection established');
    this.connected = true;
    this.reconnectAttempts = 0;
    
    // Notify registered handlers of connection
    this.notifyHandlers('connection', { type: 'connection', connected: true });
  }

  handleClose() {
    console.log('WebSocket connection closed');
    this.connected = false;
    
    // Notify registered handlers of disconnection
    this.notifyHandlers('connection', { type: 'connection', connected: false });
    
    // Attempt to reconnect
    this.reconnect();
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`Reconnect attempt ${this.reconnectAttempts + 1} of ${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts));
    } else {
      console.error('Maximum reconnection attempts reached');
    }
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Special handling for prompt responses
      if (message.input !== undefined && message.messageId) {
        const promptResolve = this.pendingPrompts.get(message.messageId);
        if (promptResolve) {
          promptResolve(message.input);
          this.pendingPrompts.delete(message.messageId);
        }
      }
      
      // Dispatch to registered handlers
      if (message.type) {
        this.notifyHandlers(message.type, message);
      }
    } catch (error) {
      console.error('Error handling message:', error, event.data);
    }
  }

  handleError(error) {
    console.error('WebSocket error:', error);
  }

  // Send a command to the server
  async sendCommand(command) {
    if (!this.connected || !this.ws) {
      throw new Error('WebSocket not connected');
    }
    
    return this.sendInput(command);
  }
  
  // Send raw input to the server
  async sendInput(input, options = {}) {
    if (!this.connected || !this.ws) {
      throw new Error('WebSocket not connected');
    }
    
    const message = {
      input: input,
      ...options
    };
    
    console.log('Sending input:', message);
    this.ws.send(JSON.stringify(message));
    
    // No need to wait for a response
    return { success: true };
  }
  
  // Register a handler for a specific message type
  registerHandler(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    // Prevent duplicate handlers
    const handlers = this.messageHandlers.get(type);
    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }
  }
  
  // Remove a handler for a specific message type
  removeHandler(type, handler) {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  // Notify all registered handlers of a message
  notifyHandlers(type, message) {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in handler for ${type}:`, error);
        }
      });
    }
  }
  
  // Return connection status
  isConnected() {
    return this.connected;
  }
  
  // Get current connection status
  getStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
  
  // Wait for a prompt response
  async waitForPrompt(promptId, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingPrompts.delete(promptId);
        reject(new Error('Prompt timed out'));
      }, timeout);
      
      this.pendingPrompts.set(promptId, (input) => {
        clearTimeout(timeoutId);
        resolve(input);
      });
    });
  }
}

// Create a global instance
window.webcomm = new WebSocketCommunicator();