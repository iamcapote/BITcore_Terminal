import 'dotenv/config';
import express from 'express';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import researchRoutes from './features/research/routes.mjs';
import { ResearchEngine } from './infrastructure/research/research.engine.mjs';
import { output } from './utils/research.output-manager.mjs';
import { commands, parseCommandArgs } from './commands/index.mjs';
import { executeResearch } from './commands/research.cli.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const PORT = process.env.PORT || 3000;

if (!process.env.BRAVE_API_KEY) {
  console.error('Missing BRAVE_API_KEY in environment variables.');
  process.exit(1);
}

// NEW: Define a shared research pipeline function
async function startResearchPipeline(inputFn, outputFn) {
  // inputFn(promptText) returns a promise that resolves to user input,
  // outputFn(text) outputs text to the terminal (CLI or Web)
  
  const researchQuery = await inputFn('What would you like to research? ');
  if (!researchQuery.trim()) {
    outputFn('Query cannot be empty.');
    return;
  }
  const breadthStr = await inputFn('Enter research breadth (2-10)? [3] ');
  const depthStr = await inputFn('Enter research depth (1-5)? [2] ');
  const breadth = parseInt(breadthStr || '3', 10);
  const depth = parseInt(depthStr || '2', 10);
  outputFn(`\nStarting research...\nQuery: ${researchQuery}\nDepth: ${depth} Breadth: ${breadth}\n`);
  
  const engine = new ResearchEngine({
    query: researchQuery,
    breadth,
    depth,
    onProgress: progress => {
      // For both modes, we update output via our output function
      outputFn(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
      // ...existing progress update logic if desired...
    }
  });
  
  const result = await engine.research();
  outputFn('\nResearch complete!');
  if (result.learnings.length === 0) {
    outputFn('No learnings were found.');
  } else {
    outputFn('\nKey Learnings:');
    result.learnings.forEach((learning, i) => {
      outputFn(`${i + 1}. ${learning}`);
    });
  }
  if (result.sources.length > 0) {
    outputFn('\nSources:');
    result.sources.forEach(source => outputFn(`- ${source}`));
  }
  outputFn(`\nResults saved to: ${result.filename || 'research folder'}`);
}

// --- CLI mode changes ---
async function cliInput(promptText) {
  return new Promise(resolve => {
    cliRl.question(promptText, resolve);
  });
}
function cliOutput(text) {
  console.log(text);
}
let cliRl = null;
async function interactiveCLI() {
  cliRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  cliRl.setPrompt('> ');
  cliRl.prompt();
  cliRl.on('line', async (line) => {
    const input = line.trim();
    if (input === '/research') {
      await startResearchPipeline(cliInput, cliOutput);
    } else if (input) {
      console.log("Unknown command. Available command: /research");
    }
    cliRl.prompt();
  });
}

// --- Web-CLI changes ---
function wsInputFactory(ws) {
  return async function(promptText) {
    // Send the prompt
    ws.send(JSON.stringify({ type: 'prompt', data: promptText }));
    // Wait for the next message that has an "input" field
    return new Promise(resolve => {
      ws.once('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          resolve(msg.input ? msg.input.trim() : raw.toString().trim());
        } catch (e) {
          resolve(raw.toString().trim());
        }
      });
    });
  };
}
function wsOutputFactory(ws) {
  return function(text) {
    ws.send(JSON.stringify({ type: 'output', data: text }));
  };
}

// --- Modify CLI branch ---
const isCliMode = process.argv.slice(2).includes('cli');

if (isCliMode) {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length === 1 && cliArgs[0] === 'cli') {
    interactiveCLI();
  } else {
    const { command, options } = parseCommandArgs(cliArgs);
    if (command && commands[command]) {
      try {
        const result = await commands[command](options);
        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error executing command '${command}':`, error.message);
        process.exit(1);
      }
      process.exit(0);
    } else if (command) {
      console.error(`Unknown command: ${command}`);
      console.log('Available commands:');
      Object.keys(commands).forEach(cmd => console.log(`  /${cmd}`));
      process.exit(1);
    } else {
      console.error('No command provided. Use /research or other commands.');
      process.exit(1);
    }
  }
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
  
  // On connection, immediately start interactive research
  wss.on('connection', (ws, req) => {
    ws.send(JSON.stringify({ type: 'output', data: 'Welcome to the Research CLI!' }));
    // Use our shared function with WebSocket input/output
    const wsInput = wsInputFactory(ws);
    const wsOutput = wsOutputFactory(ws);
    // Start research pipeline when the client types "/research"
    // Here we mimic an interactive loop: send prompt, wait for input, process command
    ws.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (e) {
        message = { input: raw.toString() };
      }
      if (message.input && message.input.trim() === '/research') {
        await startResearchPipeline(wsInput, wsOutput);
        wsOutput('What would you like to research? ');
      } else {
        ws.send(JSON.stringify({ type: 'output', data: 'Unknown command. Use /research' }));
      }
    });
  });
}