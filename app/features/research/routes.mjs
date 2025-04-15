import express from 'express';
import crypto from 'crypto';
import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { cleanQuery } from '../../utils/research.clean-query.mjs';
import { commands, parseCommandArgs } from '../../commands/index.mjs';
import { output } from '../../utils/research.output-manager.mjs';
import { userManager } from '../auth/user-manager.mjs';
import { runResearch } from './research.controller.mjs';
import { MemoryManager } from '../../infrastructure/memory/memory.manager.mjs';
import { startResearchFromChat } from '../../commands/chat.cli.mjs';
import { WebSocketServer } from 'ws';
import { LLMClient } from '../../infrastructure/ai/venice.llm-client.mjs';
import { callVeniceWithTokenClassifier } from '../../utils/token-classifier.mjs';

const router = express.Router();

// Store active chat sessions with their memory managers
const activeChatSessions = new Map();

router.post('/', async (req, res) => {
  try {
    const { query, depth = 2, breadth = 3 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    const engine = new ResearchEngine({ query, depth, breadth });
    const result = await engine.research();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle WebSocket connection for the research interface
 * @param {WebSocket} ws WebSocket connection
 */
export function handleResearchSocket(ws) {
  // Create a map to track active prompts and prevent duplicate processing
  const activePrompts = new Map();
  // Flag to track if research is in progress
  let researchInProgress = false;
  
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = new Set();
  
  // Send initial welcome message
  ws.send(JSON.stringify({
    type: 'output',
    data: 'Welcome to the Research WebSocket interface!',
    messageId: `welcome-${Date.now()}`
  }));
  
  // Ensure we're starting fresh with no lingering message listeners
  ws.removeAllListeners('message');
  
  ws.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      console.log(`[WebSocket] Research socket received message:`, JSON.stringify(message).substring(0, 100));
      
      // Check for duplicate messages using messageId
      const messageId = message.messageId || `msg-${Date.now()}`;
      if (processedMessageIds.has(messageId)) {
        console.log(`Skipping duplicate message with ID: ${messageId}`);
        return;
      }
      
      // Add this message ID to the processed set
      processedMessageIds.add(messageId);
      
      // Limit the size of the processed IDs set
      if (processedMessageIds.size > 100) {
        // Convert to array, take the last 50 items, and convert back to set
        processedMessageIds = new Set([...processedMessageIds].slice(-50));
      }
      
      // Handle cancel command
      if (message.input && message.input.trim().toLowerCase() === '/cancel') {
        if (researchInProgress) {
          researchInProgress = false;
          ws.send(JSON.stringify({
            type: 'system-message',
            message: 'Research cancelled by user',
            messageId: `cancel-${Date.now()}`
          }));
          
          // Clear all active prompts
          activePrompts.forEach((handler, id) => {
            ws.removeListener('message', handler);
          });
          activePrompts.clear();
        }
        return;
      }

      // Handle /chat command specifically
      if (message.input && message.input.trim().toLowerCase().startsWith('/chat')) {
        wsOutput("Executing command: chat");
        
        // Parse the chat command options
        const inputParts = message.input.trim().split(' ');
        const chatOptions = {};
        
        // Extract options like --memory=true from the command
        for (let i = 1; i < inputParts.length; i++) {
          if (inputParts[i].startsWith('--')) {
            const [key, value] = inputParts[i].substring(2).split('=');
            chatOptions[key] = value === 'true' ? true : 
                             value === 'false' ? false : 
                             value || true;
          }
        }
        
        // Set websocket flag to indicate this is running in web mode
        chatOptions.websocket = true;
        chatOptions.webSocketClient = ws;
        
        // Initialize chat session for web
        await initializeWebChatSession(ws, chatOptions);
        
        // Notify client to switch to chat mode
        ws.send(JSON.stringify({
          type: 'mode_change',
          mode: 'chat',
          messageId: `mode-${Date.now()}`
        }));
        
        return;
      }
      
      // Block new inputs if research is already in progress
      if (researchInProgress && activePrompts.size === 0) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Research already in progress. Please wait or type /cancel to stop.',
          messageId: `busy-${Date.now()}`
        }));
        return;
      }
      
      // Start new research session
      if (message.input && message.input.trim().toLowerCase() === '/research') {
        // Prevent multiple simultaneous research processes
        if (researchInProgress) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Research already in progress. Please wait or type /cancel to stop.',
            messageId: `busy-${Date.now()}`
          }));
          return;
        }
        
        researchInProgress = true;
        
        // Tell client to enter research mode
        ws.send(JSON.stringify({
          type: 'research_start',
          messageId: `start-${Date.now()}`
        }));
        
        // Gather inputs for research
        const researchParams = await gatherResearchInputs();
        
        if (!researchParams) {
          researchInProgress = false;
          ws.send(JSON.stringify({
            type: 'research_complete',
            messageId: `complete-cancelled-${Date.now()}`
          }));
          return;
        }
        
        try {
          // Run the research
          await runResearch(researchParams.query, researchParams.breadth, researchParams.depth);
          
          ws.send(JSON.stringify({
            type: 'research_complete',
            messageId: `complete-${Date.now()}`
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: `Error during research: ${error.message}`,
            messageId: `error-${Date.now()}`
          }));
          
          // Still send research_complete to reset client state
          ws.send(JSON.stringify({
            type: 'research_complete',
            messageId: `complete-error-${Date.now()}`
          }));
        } finally {
          researchInProgress = false;
        }
      } 
      // Handle direct input (for prompts)
      else if (message.input !== undefined) {
        console.log('[WebSocket] Processing input in handleResearchSocket:', message.input);
        // If there's an active prompt waiting for this input, it will be handled by the prompt's message handler
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: `Error processing message: ${error.message}`,
        messageId: `error-${Date.now()}`
      }));
    }
  });
  
  // Helper function to prompt the user for input via WebSocket
  async function wsPrompt(prompt) {
    return new Promise(resolve => {
      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const messageHandler = function(raw) {
        try {
          const message = JSON.parse(raw.toString());
          if (message.input !== undefined) {
            // Remove this specific listener to prevent duplicate processing
            ws.removeListener('message', messageHandler);
            activePrompts.delete(promptId);
            resolve(message.input ? message.input.trim() : '');
          }
        } catch (e) {
          // In case of parse error, just continue
        }
      };
      
      // Add message handler for this specific prompt
      ws.addListener('message', messageHandler);
      activePrompts.set(promptId, messageHandler);
      
      // Send prompt to client
      ws.send(JSON.stringify({
        type: 'prompt',
        data: prompt,
        messageId: promptId
      }));
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (activePrompts.has(promptId)) {
          ws.removeListener('message', messageHandler);
          activePrompts.delete(promptId);
          resolve(''); // Resolve with empty string after timeout
          ws.send(JSON.stringify({
            type: 'output',
            data: 'Input timed out.',
            messageId: `timeout-${Date.now()}`
          }));
        }
      }, 60000); // 1 minute timeout
    });
  }
  
  // Helper function to send output to client
  function wsOutput(message) {
    const outputId = `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    ws.send(JSON.stringify({
      type: 'output',
      data: message,
      messageId: outputId
    }));
  }
  
  // Helper function to gather research inputs from user
  async function gatherResearchInputs() {
    try {
      // Get research query
      wsOutput("Enter your research query:");
      const researchQuery = await wsPrompt("Query: ");
      
      if (!researchQuery || researchQuery.trim().length === 0) {
        wsOutput("Empty query. Research cancelled.");
        return null;
      }
      
      // Get research depth
      wsOutput("Enter research depth (1-5):");
      const depthStr = await wsPrompt("Depth [2]: ");
      let depth = parseInt(depthStr || '2', 10);
      
      if (isNaN(depth) || depth < 1 || depth > 5) {
        wsOutput(`Invalid depth: ${depthStr}. Using default depth: 2`);
        depth = 2;
      }
      
      // Get research breadth
      wsOutput("Enter research breadth (2-10):");
      const breadthStr = await wsPrompt("Breadth [3]: ");
      let breadth = parseInt(breadthStr || '3', 10);
      
      if (isNaN(breadth) || breadth < 2 || breadth > 10) {
        wsOutput(`Invalid breadth: ${breadthStr}. Using default breadth: 3`);
        breadth = 3;
      }
      
      // Ask about token classification
      wsOutput("Would you like to use token classification to enhance your query? (y/n)");
      const useTokenClassifierStr = await wsPrompt("[y/n]: ");
      const useTokenClassifier = useTokenClassifierStr.toLowerCase() === 'y';
      
      // Create enhanced query object
      let enhancedQuery = { original: researchQuery };
      
      if (useTokenClassifier) {
        try {
          wsOutput("Classifying query with token classifier...");
          const tokenMetadata = await callVeniceWithTokenClassifier(researchQuery);
          enhancedQuery.metadata = tokenMetadata;
          
          ws.send(JSON.stringify({
            type: 'classification_result',
            metadata: tokenMetadata,
            messageId: `class-${Date.now()}`
          }));
          
        } catch (error) {
          wsOutput(`Error during token classification: ${error.message}`);
          wsOutput("Continuing with basic query...");
        }
      }
      
      return { query: enhancedQuery, breadth, depth };
    } catch (error) {
      wsOutput(`Error gathering research inputs: ${error.message}`);
      return null;
    }
  }
  
  // Helper function to run research with the gathered inputs
  async function runResearch(query, breadth, depth) {
    wsOutput(`\nStarting research...\nQuery: "${query.original}"\nDepth: ${depth} Breadth: ${breadth}` 
      + `${query.metadata ? "\nUsing enhanced metadata from token classification" : ""}\n`);
    
    const engine = new ResearchEngine({
      query,
      breadth,
      depth,
      onProgress: (progress) => {
        ws.send(JSON.stringify({
          type: 'progress',
          data: `${progress.completedQueries}/${progress.totalQueries}`,
          messageId: `progress-${Date.now()}`
        }));
      }
    });
    
    const result = await engine.research();
    
    wsOutput("\nResearch complete!");
    if (result.learnings.length === 0) {
      wsOutput("No learnings were found.");
    } else {
      wsOutput("\nKey Learnings:");
      result.learnings.forEach((learning, i) => {
        wsOutput(`${i + 1}. ${learning}`);
      });
    }
    
    if (result.sources.length > 0) {
      wsOutput("\nSources:");
      result.sources.forEach(source => {
        wsOutput(`- ${source}`);
      });
    }
    
    wsOutput(`\nResults saved to: ${result.filename || "research folder"}`);
    return result;
  }
}

/**
 * Handle WebSocket connection for the chat interface
 * @param {WebSocket} ws WebSocket connection
 */
export function handleChatSocket(ws) {
  // Track this client's session
  const sessionId = crypto.randomUUID();
  let memoryManager = null;
  
  ws.on('message', async (message) => {
    console.log(`[WebSocket] Received message in handleChatSocket:`, message.toString().substring(0, 100)); // Log incoming message
    try {
      const data = JSON.parse(message);
      
      // Log parsed data
      console.log('[WebSocket] Parsed message data:', data);
      
      // Handle direct /chat command from the web-CLI
      if (data.input && data.input.trim().toLowerCase().startsWith('/chat')) {
        console.log('[WebSocket] Processing /chat command in handleChatSocket');
        
        // Parse the chat command options
        const inputParts = data.input.trim().split(' ');
        const chatOptions = {};
        
        // Extract options like --memory=true from the command
        for (let i = 1; i < inputParts.length; i++) {
          if (inputParts[i].startsWith('--')) {
            const [key, value] = inputParts[i].substring(2).split('=');
            chatOptions[key] = value === 'true' ? true : 
                            value === 'false' ? false : 
                            value || true;
          }
        }
        
        // Set websocket flag to indicate this is running in web mode
        chatOptions.websocket = true;
        chatOptions.webSocketClient = ws;
        
        // Acknowledge command receipt before initialization
        ws.send(JSON.stringify({
          type: 'output',
          data: 'Executing command: chat',
          messageId: `chat-cmd-${Date.now()}`
        }));
        
        // Initialize chat session for web
        await initializeWebChatSession(ws, chatOptions);
        return;
      }
      
      // Handle other message types
      if (data.type === 'chat-init') {
        // Initialize chat session
        const username = data.username;
        const password = data.password;
        const memoryEnabled = data.memoryEnabled || false;
        const memoryDepth = data.memoryDepth || 'medium';
        
        try {
          // Authenticate user
          const authResult = await userManager.authenticateUser(username, password);
          if (!authResult.success) {
            ws.send(JSON.stringify({
              type: 'auth-error',
              error: 'Authentication failed'
            }));
            return;
          }
          
          // Check for Venice API key
          const hasVeniceKey = await userManager.hasApiKey('venice');
          if (!hasVeniceKey) {
            ws.send(JSON.stringify({
              type: 'api-key-error',
              error: 'Venice API key is required for chat'
            }));
            return;
          }
          
          // Get Venice API key
          const veniceKey = await userManager.getApiKey('venice', password);
          if (!veniceKey) {
            ws.send(JSON.stringify({
              type: 'api-key-error',
              error: 'Failed to decrypt Venice API key'
            }));
            return;
          }
          
          // Set API key for the session
          process.env.VENICE_API_KEY = veniceKey;
          
          // Initialize memory manager if enabled
          if (memoryEnabled) {
            memoryManager = new MemoryManager({
              depth: memoryDepth,
              user: userManager.currentUser
            });
            
            // Store active session
            activeChatSessions.set(sessionId, {
              username,
              memoryManager,
              chatHistory: [],
              lastActivity: Date.now()
            });
          } else {
            // Store session without memory manager
            activeChatSessions.set(sessionId, {
              username,
              memoryManager: null,
              chatHistory: [],
              lastActivity: Date.now()
            });
          }
          
          // Send successful initialization
          ws.send(JSON.stringify({
            type: 'chat-ready',
            sessionId,
            memoryEnabled,
            memoryDepth: memoryManager ? memoryManager.getDepthLevel() : null
          }));
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: `Failed to initialize chat: ${error.message}`
          }));
        }
      } 
      else if (data.type === 'chat-message') {
        console.log('[WebSocket] Processing chat message:', data.message); // Log chat message
        // Handle chat message
        const userMessage = data.message;
        
        // Check session validity
        if (data.sessionId && activeChatSessions.has(data.sessionId)) {
          // Update last activity
          const session = activeChatSessions.get(data.sessionId);
          session.lastActivity = Date.now();
          memoryManager = session.memoryManager;
          
          // Add user message to chat history
          if (!session.chatHistory) {
            session.chatHistory = [];
          }
          session.chatHistory.push({ role: 'user', content: userMessage });
        }
        
        try {
          // Process special commands
          if (userMessage.trim().toLowerCase() === '/exitmemory' && memoryManager) {
            // Finalize memories
            await commands.exitmemory({ sessionId });
            
            ws.send(JSON.stringify({
              type: 'system-message',
              message: 'Memory finalization complete. Memory mode disabled.'
            }));
            
            // Remove memory manager
            memoryManager = null;
            if (activeChatSessions.has(data.sessionId)) {
              const session = activeChatSessions.get(data.sessionId);
              session.memoryManager = null;
            }
            
            return;
          }
          
          // Handle research command
          if (userMessage.trim().toLowerCase() === '/research') {
            // Check if session exists
            if (!activeChatSessions.has(data.sessionId)) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'No active chat session found'
              }));
              return;
            }
            
            const session = activeChatSessions.get(data.sessionId);
            const chatHistory = session.chatHistory || [];
            
            // Check if there's enough conversation context
            if (chatHistory.length < 2) {
              ws.send(JSON.stringify({
                type: 'system-message',
                message: 'Not enough conversation context to generate research queries. Continue chatting first.'
              }));
              return;
            }
            
            ws.send(JSON.stringify({
              type: 'system-message',
              message: 'Generating research queries from chat context...'
            }));
            
            // Get memory blocks if available
            let memoryBlocks = [];
            if (session.memoryManager) {
              // Get all recent memories for research context
              const lastMessage = chatHistory[chatHistory.length - 1].content;
              memoryBlocks = await session.memoryManager.retrieveRelevantMemories(lastMessage);
            }
            
            // Request research parameters
            const depth = 2; // Default depth
            const breadth = 3; // Default breadth
            
            // Start research process
            ws.send(JSON.stringify({
              type: 'system-message',
              message: 'Starting research based on chat context...'
            }));
            
            ws.send(JSON.stringify({
              type: 'research_start'
            }));
            
            // Execute research
            const result = await startResearchFromChat(chatHistory, memoryBlocks, {
              depth,
              breadth,
              verbose: true
            }, (output) => {
              ws.send(JSON.stringify({
                type: 'output',
                data: output
              }));
            });
            
            if (result.success) {
              ws.send(JSON.stringify({
                type: 'research_complete'
              }));
              
              ws.send(JSON.stringify({
                type: 'system-message',
                message: 'Research completed successfully!'
              }));
              
              // Send research results
              ws.send(JSON.stringify({
                type: 'chat-response',
                message: `Research on topic "${result.topic}" completed. Here are the key learnings:\n\n${
                  result.results.learnings.map((learning, i) => `${i+1}. ${learning}`).join('\n')
                }`,
                timestamp: new Date().toISOString()
              }));
              
              // Store research results in memory if enabled
              if (session.memoryManager) {
                const researchSummary = `Research on "${result.topic}" found: ${result.results.learnings.join(' ')}`;
                await session.memoryManager.storeMemory(researchSummary, 'research-summary');
                
                // Add to chat history
                session.chatHistory.push({ 
                  role: 'assistant', 
                  content: `I conducted research on "${result.topic}" and found: ${result.results.learnings.join(' ')}`
                });
              }
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                error: `Failed to complete research: ${result.error}`
              }));
              
              ws.send(JSON.stringify({
                type: 'research_complete'
              }));
            }
            
            return;
          }
          
          // Process regular chat message
          const responseTimeout = setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Response from LLMClient timed out.'
            }));
          }, 30000); // 30-second timeout

          try {
            // Get the session to access chat history
            const session = activeChatSessions.get(data.sessionId);
            const chatHistory = session ? session.chatHistory : [];

            // Bail out if we don't have a valid session or API key
            if (!session) {
              clearTimeout(responseTimeout);
              ws.send(JSON.stringify({
                type: 'error',
                error: 'No active chat session found. Please restart your chat session.'
              }));
              return;
            }
            
            // Initialize LLMClient for this request
            if (!process.env.VENICE_API_KEY) {
              clearTimeout(responseTimeout);
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Missing Venice API key. Please restart your chat session.'
              }));
              return;
            }
            
            const llmClient = new LLMClient({
              apiKey: process.env.VENICE_API_KEY,
              model: 'llama-3.3-70b'
            });
            
            // Complete the chat with the user's message
            const response = await llmClient.completeChat({
              messages: chatHistory,
              temperature: 0.7,
              maxTokens: 1000
            });
            
            clearTimeout(responseTimeout);
            
            // Add assistant message to chat history
            const assistantMessage = { role: 'assistant', content: response.content };
            session.chatHistory.push(assistantMessage);
            
            // Send response back to client
            ws.send(JSON.stringify({
              type: 'chat-response',
              message: response.content,
              model: response.model,
              timestamp: response.timestamp,
              memoryEnabled: !!memoryManager,
              messageId: `response-${Date.now()}`
            }));
            
            // Store in memory if enabled
            if (memoryManager) {
              try {
                await memoryManager.storeMemory(response.content, 'assistant-message');
              } catch (memError) {
                console.error('Error storing memory:', memError);
              }
            }
            
          } catch (error) {
            clearTimeout(responseTimeout);
            console.error('Chat error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: `Chat error: ${error.message}`
            }));
          }
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: `Chat error: ${error.message}`
          }));
        }
      }
      else if (data.type === 'memory-stats' && data.sessionId) {
        // Get memory stats if session exists
        if (activeChatSessions.has(data.sessionId)) {
          const session = activeChatSessions.get(data.sessionId);
          if (session.memoryManager) {
            const stats = session.memoryManager.getStats();
            ws.send(JSON.stringify({
              type: 'memory-stats',
              stats
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'memory-stats',
              stats: null,
              enabled: false
            }));
          }
        }
      }
      // Fix: Check for chat messages without relying on this.activeMode
      // Chat messages can come from regular input with mode='chat'
      else if (data.input && (data.mode === 'chat' || data.sessionId)) {
        console.log('[WebSocket] Processing chat message in chat mode:', data.input);
        
        // Check if we have a session
        if (!data.sessionId || !activeChatSessions.has(data.sessionId)) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'No active chat session found. Please start a new chat session.',
            messageId: `error-${Date.now()}`
          }));
          return;
        }
        
        // Get the session and update activity
        const session = activeChatSessions.get(data.sessionId);
        session.lastActivity = Date.now();
        
        // Add message to chat history
        const userMessage = { role: 'user', content: data.input };
        if (!session.chatHistory) {
          session.chatHistory = [];
        }
        session.chatHistory.push(userMessage);
        
        try {
          // Initialize LLMClient for this request
          if (!process.env.VENICE_API_KEY) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Missing Venice API key. Please restart your chat session.',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          // Create LLM client
          const llmClient = new LLMClient({
            apiKey: process.env.VENICE_API_KEY,
            model: 'llama-3.3-70b'
          });
          
          // Send thinking indicator
          ws.send(JSON.stringify({
            type: 'output',
            data: 'Assistant is thinking...',
            messageId: `thinking-${Date.now()}`
          }));
          
          // Process the message with the LLM
          const response = await llmClient.completeChat({
            messages: session.chatHistory,
            temperature: 0.7,
            maxTokens: 1000
          });
          
          // Add response to history
          session.chatHistory.push({ role: 'assistant', content: response.content });
          
          // Send response back to client
          ws.send(JSON.stringify({
            type: 'chat-response',
            message: response.content,
            mode: 'chat',
            messageId: `response-${Date.now()}`
          }));
          
        } catch (error) {
          console.error('Error processing chat message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: `Chat error: ${error.message}`,
            messageId: `error-${Date.now()}`
          }));
        }
        
        return;
      }
    } catch (error) {
      console.error(`[WebSocket] Error in handleChatSocket: ${error.message}`);
      ws.send(JSON.stringify({
        type: 'error',
        error: `Error processing message: ${error.message}`
      }));
    }
  });
  
  ws.on('close', () => {
    console.log(`[WebSocket] Connection closed for chat session: ${sessionId}`);
    // Clean up session resources
    if (activeChatSessions.has(sessionId)) {
      activeChatSessions.delete(sessionId);
    }
  });
}

/**
 * Periodically clean up inactive chat sessions
 */
function cleanupChatSessions() {
  const now = Date.now();
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of activeChatSessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      // Finalize memories if memory manager exists
      if (session.memoryManager) {
        try {
          session.memoryManager.validateMemories().catch(err => {
            console.error('Error validating memories during cleanup:', err);
          });
        } catch (error) {
          console.error('Error during session cleanup:', error);
        }
      }
      
      // Remove session
      activeChatSessions.delete(sessionId);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupChatSessions, 15 * 60 * 1000);

/**
 * Set up research routes and WebSocket handlers
 * 
 * @param {Express} app - Express application
 * @param {Server} server - HTTP server
 * @param {WebSocketServer} wss - WebSocket server instance (optional)
 */
export function setupRoutes(app, server, existingWss = null) {
  // Register REST API routes
  app.use('/api/research', router);
  
  // Either use the provided WebSocketServer or create a new one if none is provided
  // This prevents duplicate WebSocketServer instances
  const wss = existingWss || new WebSocketServer({ server });
  
  // Register output manager for WebSocket connections
  output.addWebSocketClient = function(ws) {
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
  };
  
  // Only set up connection handling if we created a new WebSocketServer
  if (!existingWss) {
    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      // Add this client to the output manager
      output.addWebSocketClient(ws);
      
      console.log('[WebSocket] New connection established');
      
      // Set initial endpoint - will be changed based on first message
      ws.endpoint = null;
      
      // Handle the first message to determine endpoint
      const handleFirstMessage = (message) => {
        try {
          console.log('[WebSocket] Processing first message:', message.toString().substring(0, 100));
          const data = JSON.parse(message);
          
          // Determine the correct endpoint based on the first message
          if (data.type === 'chat-init' || data.type === 'chat-message' || 
              (data.input && data.input.trim().toLowerCase().startsWith('/chat'))) {
            console.log('[WebSocket] Routing to chat handler');
            ws.endpoint = 'chat';
            handleChatSocket(ws);
          } else {
            console.log('[WebSocket] Routing to research handler');
            ws.endpoint = 'research';
            handleResearchSocket(ws);
          }
          
          // Remove this handler after the first message
          ws.off('message', handleFirstMessage);
          
          // Re-emit this message to be handled by the appropriate handler
          ws.emit('message', message);
        } catch (error) {
          console.error('[WebSocket] Error handling first message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }));
        }
      };
      
      // Listen for the first message to determine endpoint
      ws.on('message', handleFirstMessage);
    });
  }
}

/**
 * Initialize a chat session for web-CLI
 * @param {WebSocket} ws WebSocket connection
 * @param {Object} options Chat options
 */
async function initializeWebChatSession(ws, options = {}) {
  // Define wsPrompt without any timeout
  async function wsPrompt(promptText) {
    return new Promise((resolve, reject) => {
      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const messageHandler = (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.input !== undefined) {
            ws.removeListener('message', messageHandler);
            resolve(msg.input ? msg.input.trim() : '');
          }
        } catch (e) {
          // Ignore errors and wait for a correctly formatted message
        }
      };
      ws.send(JSON.stringify({ type: 'prompt', data: promptText, messageId: promptId }));
      ws.on('message', messageHandler);
      // Removed timeout: now waits indefinitely for user input.
    });
  }

  try {
    const { memory = false, depth = 'medium' } = options;
    
    // Send status update to client
    const wsOutput = (message) => {
      const outputId = `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ws.send(JSON.stringify({
        type: 'output',
        data: message,
        messageId: outputId
      }));
    };
    
    // Verify user authentication
    if (!userManager.isAuthenticated()) {
      wsOutput('You must be logged in to use the chat feature. Use /login first.');
      return false;
    }
    
    // Check API keys
    if (!await userManager.hasApiKey('venice')) {
      wsOutput('Missing Venice API key required for chat. Use /keys set to configure your API key.');
      return false;
    }
    
    // Create a session ID
    const sessionId = crypto.randomUUID();
    
    // For web-CLI, we need to ask for the password to decrypt API keys
    const password = await wsPrompt('Please enter your password to decrypt API keys:');
    
    // Verify the password by attempting to decrypt the API key
    if (!password) {
      wsOutput('Password is required to decrypt API keys.');
      return false;
    }
    
    try {
      // Retrieve decrypted API key
      const veniceKey = await userManager.getApiKey('venice', password);
      
      if (!veniceKey) {
        wsOutput('Failed to decrypt Venice API key with the provided password. Please try again.');
        
        // Give one more chance with a direct retry
        const retryPassword = await wsPrompt('Please re-enter your password:');
        if (!retryPassword) {
          wsOutput('Password is required to decrypt API keys.');
          return false;
        }
        
        const retryVeniceKey = await userManager.getApiKey('venice', retryPassword);
        if (!retryVeniceKey) {
          wsOutput('Failed to decrypt Venice API key. Please restart the chat session with /chat.');
          return false;
        }
        
        // If we got here, the retry worked
        process.env.VENICE_API_KEY = retryVeniceKey;
      } else {
        // First attempt worked
        process.env.VENICE_API_KEY = veniceKey;
      }
    } catch (error) {
      wsOutput(`Authentication error: ${error.message}. Please try again with /chat.`);
      return false;
    }
    
    // Initialize memory manager if enabled
    let memoryManager = null;
    if (memory) {
      try {
        memoryManager = new MemoryManager({
          depth,
          user: userManager.currentUser
        });
        wsOutput('Memory mode enabled. Use /exitmemory to finalize and exit memory mode.');
      } catch (error) {
        wsOutput(`Failed to initialize memory system: ${error.message}`);
        return false;
      }
    }
    
    // Create and store the chat session
    activeChatSessions.set(sessionId, {
      username: userManager.currentUser.username,
      memoryManager,
      chatHistory: [],
      lastActivity: Date.now()
    });
    
    // Notify the client that the chat session is ready
    ws.send(JSON.stringify({
      type: 'chat-ready',
      sessionId,
      memoryEnabled: !!memoryManager,
      memoryDepth: memoryManager ? memoryManager.getDepthLevel() : null,
      messageId: `chat-ready-${Date.now()}`
    }));
    
    wsOutput('Chat session initialized. Start chatting or type /exit to end the session.');
    return true;
  } catch (error) {
    console.error('Error initializing web chat session:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: `Failed to initialize chat: ${error.message}`,
      messageId: `error-${Date.now()}`
    }));
    return false;
  }
}

export default router;
