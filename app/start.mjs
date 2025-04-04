import 'dotenv/config';
import express from 'express';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import researchRoutes from './features/research/routes.mjs';
import { ResearchEngine } from './infrastructure/research/research.engine.mjs';
import { output } from './utils/research.output-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const PORT = process.env.PORT || 3000;

if (!process.env.BRAVE_API_KEY) {
  console.error('Missing BRAVE_API_KEY in environment variables.');
  process.exit(1);
}

async function runCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
  }

  try {
    const query = await askQuestion('What would you like to research? ');
    if (!query.trim()) throw new Error('Query cannot be empty.');

    const breadth = parseInt(await askQuestion('Enter research breadth (2-10)? [3] ') || '3', 10);
    const depth = parseInt(await askQuestion('Enter research depth (1-5)? [2] ') || '2', 10);

    console.log('\nStarting research...');
    console.log(`Query: ${query}`);
    console.log(`Depth: ${depth} Breadth: ${breadth}\n`);
    
    const engine = new ResearchEngine({
      query,
      breadth,
      depth,
      onProgress: progress => {
        output.updateProgress(progress);
      },
    });

    const result = await engine.research();

    output.cleanup();
    console.log('\nResearch complete!');
    if (result.learnings.length === 0) {
      console.log('No learnings were found.');
    } else {
      console.log('\nKey Learnings:');
      result.learnings.forEach((learning, i) => {
        console.log(`${i + 1}. ${learning}`);
      });
    }

    if (result.sources.length > 0) {
      console.log('\nSources:');
      result.sources.forEach(source => console.log(`- ${source}`));
    }

    console.log(`\nResults saved to: ${result.filename || 'research folder'}`);
    rl.close();
  } catch (error) {
    console.error('\nError:', error.message);
    rl.close();
  }
}

if (args.length > 0) {
  // CLI Mode
  runCLI();
} else {
  // SERVER (Web) Mode
  const app = express();
  app.use(express.json());
  app.use('/api/research', researchRoutes);
  app.use(express.static(path.join(__dirname, 'public')));

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Setup WebSocket
  const wss = new WebSocketServer({ server });
  console.log("WebSocket server created and ready for connections");
  
  // Track connections for debugging
  let connectionCounter = 0;
  
  wss.on('connection', (ws, req) => {
    const clientId = connectionCounter++;
    console.log(`New WebSocket connection #${clientId} established from ${req.socket.remoteAddress}`);
    
    // Send welcome message immediately
    try {
      ws.send(JSON.stringify({ type: 'output', data: 'Welcome to the Research CLI!' }));
      ws.send(JSON.stringify({ type: 'prompt', data: 'What would you like to research? ' }));
      console.log(`Sent welcome messages to client #${clientId}`);
    } catch (e) {
      console.error(`Error sending welcome message to client #${clientId}:`, e);
    }
    
    // Register with output manager after sending initial messages
    try {
      output.addWebSocketClient(ws);
      console.log(`Client #${clientId} registered with output manager`);
    } catch (e) {
      console.error(`Error registering WebSocket client #${clientId}:`, e);
    }
    
    let researchState = {
      query: null,
      breadth: null,
      depth: null,
      step: 0,
      running: false
    };
    
    // Keep connection alive with ping/pong
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30000);
    
    ws.on('message', async (raw) => {
      console.log("Received message:", raw.toString());
      // Don't process messages if research is already running
      if (researchState.running) {
        ws.send(JSON.stringify({ type: 'output', data: 'Research is already in progress. Please wait.' }));
        return;
      }
      
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (e) {
        message = { input: raw.toString() };
      }
      
      const input = message.input?.trim();
      
      // State machine to match CLI experience exactly
      if (researchState.step === 0) {
        if (!input) {
          ws.send(JSON.stringify({ type: 'error', data: 'Query cannot be empty.' }));
          ws.send(JSON.stringify({ type: 'prompt', data: 'What would you like to research? ' }));
          return;
        }
        researchState.query = input;
        researchState.step = 1;
        ws.send(JSON.stringify({ type: 'prompt', data: 'Enter research breadth (2-10)? [3] ' }));
        
      } else if (researchState.step === 1) {
        researchState.breadth = parseInt(input || '3', 10);
        researchState.step = 2;
        ws.send(JSON.stringify({ type: 'prompt', data: 'Enter research depth (1-5)? [2] ' }));
        
      } else if (researchState.step === 2) {
        researchState.depth = parseInt(input || '2', 10);
        researchState.step = 3;
        researchState.running = true;
        
        // Show the research parameters exactly like CLI
        ws.send(JSON.stringify({ type: 'output', data: '\nStarting research...' }));
        ws.send(JSON.stringify({ type: 'output', data: `Query: ${researchState.query}` }));
        ws.send(JSON.stringify({ type: 'output', data: `Depth: ${researchState.depth} Breadth: ${researchState.breadth}\n` }));
        
        // Start the research - using the same engine as CLI
        const engine = new ResearchEngine({
          query: researchState.query,
          breadth: researchState.breadth,
          depth: researchState.depth,
          onProgress: progress => {
            // This will update both console and websocket clients
            output.updateProgress(progress);
          },
        });
        
        try {
          const result = await engine.research();
          
          // Send results exactly like CLI
          ws.send(JSON.stringify({ type: 'output', data: '\nResearch complete!' }));
          
          if (result.learnings.length === 0) {
            ws.send(JSON.stringify({ type: 'output', data: 'No learnings were found.' }));
          } else {
            ws.send(JSON.stringify({ type: 'output', data: '\nKey Learnings:' }));
            result.learnings.forEach((learning, i) => {
              ws.send(JSON.stringify({ type: 'output', data: `${i + 1}. ${learning}` }));
            });
          }
          
          if (result.sources.length > 0) {
            ws.send(JSON.stringify({ type: 'output', data: '\nSources:' }));
            result.sources.forEach(source => {
              ws.send(JSON.stringify({ type: 'output', data: `- ${source}` }));
            });
          }
          
          ws.send(JSON.stringify({ 
            type: 'output', 
            data: `\nResults saved to: ${result.filename || 'research folder'}`
          }));
          
          // Reset state and prompt for new research
          researchState = { query: null, breadth: null, depth: null, step: 0, running: false };
          ws.send(JSON.stringify({ type: 'prompt', data: 'What would you like to research? ' }));
          
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', data: `\nError: ${err.message}` }));
          // Reset state and prompt for new research
          researchState = { query: null, breadth: null, depth: null, step: 0, running: false };
          ws.send(JSON.stringify({ type: 'prompt', data: 'What would you like to research? ' }));
        }
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      clearInterval(pingInterval);
      output.removeWebSocketClient(ws);
      console.log(`WebSocket connection #${clientId} closed`);
    });
  });
}