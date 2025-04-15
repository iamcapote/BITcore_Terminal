export class OutputManager {
  constructor() {
    this.webSocketClients = new Set();
    this.logHandler = console.log;
    this.lastProgressMessage = null;
    this.pendingMessages = new Map();
    this.messageTimeout = 500; // 500ms timeout for deduplication
  }

  // Broadcast logs over all connected websockets with improved error handling and deduplication
  broadcastLog(message, type = 'log') {
    // Generate a unique message ID for deduplication
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    for (const client of this.webSocketClients) {
      try {
        // Skip clients that aren't open
        if (client.readyState !== 1) { // WebSocket.OPEN
          continue;
        }
        
        client.send(JSON.stringify({
          type: type || 'output',
          data: message,
          messageId
        }));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        // Don't remove the client here - let the 'close' event handler do it
      }
    }
  }

  // Allow server to register new websocket clients
  addWebSocketClient(ws) {
    if (!ws) return;
    
    try {
      this.webSocketClients.add(ws);
      
      // Send the last progress message to new clients
      if (this.lastProgressMessage) {
        ws.send(JSON.stringify({ 
          type: 'progress', 
          data: { message: this.lastProgressMessage },
          messageId: `progress-init-${Date.now()}`
        }));
      }
      
      // Set up close event to automatically remove the client
      ws.on('close', () => {
        this.removeWebSocketClient(ws);
      });
      
      // Set up error event handler
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.removeWebSocketClient(ws);
      });
      
      // Acknowledge successful connection
      ws.send(JSON.stringify({
        type: 'system-message',
        message: 'Successfully connected to research server',
        messageId: `welcome-${Date.now()}`
      }));
      
    } catch (error) {
      console.error('Error adding WebSocket client:', error);
    }
  }
  
  // Remove a WebSocket client
  removeWebSocketClient(ws) {
    if (!ws) return;
    
    try {
      this.webSocketClients.delete(ws);
    } catch (error) {
      console.error('Error removing WebSocket client:', error);
    }
  }

  // Log message and broadcast to WebSocket clients
  log(...args) {
    const message = args.map(String).join(' ');
    
    // Call the log handler (e.g., console.log)
    if (this.logHandler) {
      this.logHandler(message);
    }
    
    // Broadcast to WebSocket clients
    this.broadcastLog(message, 'output');
  }
  
  // Error logging with special formatting
  error(...args) {
    const message = args.map(String).join(' ');
    
    // Call the log handler with error formatting
    if (this.logHandler) {
      this.logHandler(`ERROR: ${message}`);
    }
    
    // Broadcast as error type
    this.broadcastLog(message, 'error');
  }
  
  // Update progress state and broadcast to all clients
  updateProgress(progressData) {
    if (typeof progressData === 'string') {
      this.lastProgressMessage = progressData;
      this.broadcastLog(progressData, 'progress');
    } else {
      this.lastProgressMessage = progressData.message || JSON.stringify(progressData);
      
      // For all connected clients, send a progress update
      for (const client of this.webSocketClients) {
        try {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({
              type: 'progress',
              data: progressData,
              messageId: `progress-${Date.now()}`
            }));
          }
        } catch (error) {
          console.error('Error sending progress update:', error);
        }
      }
    }
  }
  
  // Send a prompt request to all clients and wait for the first response
  async prompt(promptText) {
    return new Promise((resolve) => {
      if (this.webSocketClients.size === 0) {
        resolve(''); // No clients connected
        return;
      }
      
      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Set a timeout to prevent hanging indefinitely
      const timeoutId = setTimeout(() => {
        for (const client of this.webSocketClients) {
          client.removeAllListeners(`input-${promptId}`);
        }
        console.log('Prompt timed out');
        resolve('');
      }, 60000); // 1 minute timeout
      
      // Track responses to avoid duplicate processing
      let hasResponded = false;
      
      // Broadcast the prompt to all clients
      for (const client of this.webSocketClients) {
        try {
          if (client.readyState !== 1) continue; // Skip clients that aren't open
          
          // Set up a one-time message handler for this specific client
          const messageHandler = (message) => {
            try {
              const data = JSON.parse(message);
              
              // Check if this is a response to our prompt
              if (data.messageId === promptId || data.responseId === promptId) {
                if (!hasResponded) {
                  hasResponded = true;
                  clearTimeout(timeoutId);
                  
                  // Remove all handlers
                  for (const c of this.webSocketClients) {
                    c.removeListener('message', c._promptHandler);
                    delete c._promptHandler;
                  }
                  
                  // Resolve with the input
                  resolve(data.input || '');
                }
              }
            } catch (error) {
              console.error('Error handling prompt response:', error);
            }
          };
          
          // Store the handler on the client object for later removal
          client._promptHandler = messageHandler;
          client.on('message', messageHandler);
          
          // Send the prompt request
          client.send(JSON.stringify({
            type: 'prompt',
            data: promptText,
            messageId: promptId
          }));
          
        } catch (error) {
          console.error('Error sending prompt to client:', error);
        }
      }
    });
  }
  
  // Send a direct message to a specific client
  sendToClient(ws, type, data, messageId = null) {
    if (!ws || ws.readyState !== 1) return false;
    
    try {
      ws.send(JSON.stringify({
        type,
        data,
        messageId: messageId || `direct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));
      return true;
    } catch (error) {
      console.error('Error sending direct message to client:', error);
      return false;
    }
  }
  
  // Clear all WebSocket clients (for cleanup)
  clearClients() {
    this.webSocketClients.clear();
  }
}

// Create a singleton instance
export const output = new OutputManager();
