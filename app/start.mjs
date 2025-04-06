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
import { callVeniceWithTokenClassifier } from './utils/token-classifier.mjs';

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
  const researchQuery = await inputFn('What would you like to research? ');
  if (!researchQuery.trim()) {
    outputFn('Query cannot be empty.');
    return;
  }

  const breadthStr = await inputFn('Enter research breadth (2-10)? [3] ');
  const depthStr = await inputFn('Enter research depth (1-5)? [2] ');
  const breadth = parseInt(breadthStr || '3', 10);
  const depth = parseInt(depthStr || '2', 10);

  const useTokenClassifier = await inputFn('Would you like to use the token classifier to add metadata? (yes/no) [no] ');
  let enhancedQuery = { original: researchQuery };

  if (['yes', 'y'].includes(useTokenClassifier.trim().toLowerCase())) {
    try {
      outputFn('Classifying query with token classifier...');
      const tokenMetadata = await callVeniceWithTokenClassifier(researchQuery);

      // Ensure original property remains a non-empty string
      if (!enhancedQuery.original || typeof enhancedQuery.original !== 'string') {
        enhancedQuery.original = researchQuery;
      }

      // Safely store metadata
      enhancedQuery.metadata = tokenMetadata;

      outputFn('Token classification completed.');
      // Output formatted token classification result for better visibility
      outputFn(`Token classification result: ${enhancedQuery.metadata}`);
      outputFn('Using token classification to enhance research quality...');
    } catch (error) {
      outputFn(`Error during token classification: ${error.message}`);
      outputFn('Continuing with basic query...');
      enhancedQuery = { original: researchQuery }; // Fallback to basic query
    }
  }

  // Update display message to show proper handling
  outputFn(`\nStarting research...\nQuery: "${enhancedQuery.original}"\nDepth: ${depth} Breadth: ${breadth}\n${enhancedQuery.metadata ? 'Using enhanced metadata from token classification' : ''}\n`);

  const engine = new ResearchEngine({
    query: enhancedQuery,
    breadth,
    depth,
    onProgress: progress => {
      outputFn(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
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
  }
  outputFn(`\nResults saved to: ${result.filename || 'research folder'}`);
}

// --- CLI mode changes ---
async function cliInput(promptText) {
  return new Promise(resolve => {
    cliRl.question(promptText, resolve);
  });
}

// Override the default output manager to unify logs for both CLI and Web
function createOutputHandler(outputFn) {
  return {
    log: (msg) => {
      outputFn(msg);
    },
    error: (msg) => {
      outputFn(`[err] ${msg}`);
    }
  };
}

// For CLI, we wrap console.log
function cliOutput(text) {
  console.log(text);
  // Sync logs with our "output" manager
  output.log(text);
}

let cliRl = null;
async function interactiveCLI() {
  output.use(createOutputHandler((msg) => console.log(msg))); 
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
  
  wss.on('connection', (ws) => {
    // Create a WebSocket-based output manager for system-level logs
    const wsOutputHandler = createOutputHandler((msg) => {
      ws.send(JSON.stringify({ type: 'output', data: msg }));
    });
    output.use(wsOutputHandler);

    ws.send(JSON.stringify({ type: 'output', data: 'Welcome to the Research CLI!' }));
    ws.send(JSON.stringify({ type: 'output', data: 'Type /research to start a research session' }));
    
    const activePrompts = new Map(); // Track active prompts
    let isResearching = false;
    let isCollectingInputs = false;

    ws.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (e) {
        message = { input: raw.toString() };
      }
      
      if (message.action === 'classify' && message.query) {
        try {
          const metadata = await callVeniceWithTokenClassifier(message.query);
          ws.send(JSON.stringify({ type: 'classification_result', metadata }));
        } catch (error) {
          ws.send(JSON.stringify({ type: 'output', data: `Error during token classification: ${error.message}` }));
        }
        return;
      }

      // Block non-prompt inputs if currently researching or collecting inputs
      if (isResearching && activePrompts.size === 0) {
        ws.send(JSON.stringify({ 
          type: 'output', 
          data: 'Research in progress. Please wait until it completes.'
        }));
        return;
      }

      // Create input and output handlers for research
      const wsInput = async (promptText) => {
        return new Promise(resolve => {
          ws.send(JSON.stringify({ type: 'prompt', data: promptText }));
          
          // Store the resolver function to be called when user responds
          const messageHandler = (innerRaw) => {
            try {
              const innerMsg = JSON.parse(innerRaw.toString());
              if (innerMsg.input) {
                ws.removeListener('message', messageHandler);
                resolve(innerMsg.input);
              }
            } catch (e) {
              resolve(innerRaw.toString());
            }
          };
          
          ws.on('message', messageHandler);
          activePrompts.set(promptText, messageHandler);
        });
      };

      const wsOutput = (text) => {
        ws.send(JSON.stringify({ type: 'output', data: text }));
      };

      if (message.input) {
        const inputStr = typeof message.input === 'string' 
          ? message.input.trim() 
          : message.input.original 
            ? message.input.original.trim() 
            : String(message.input).trim();

        // We only *start* collecting user research inputs on /research
        if (inputStr === '/research') {
          if (isResearching || isCollectingInputs) {
            ws.send(JSON.stringify({ type: 'output', data: 'Already collecting or running research.' }));
            return;
          }
          try {
            isCollectingInputs = true;
            // Gather user inputs first
            const params = await gatherResearchInputs(wsInput, wsOutput);
            // If user canceled or empty query
            if (!params) {
              isCollectingInputs = false;
              return;
            }
            // Now we show progress bar and run the actual research
            isCollectingInputs = false;
            isResearching = true;
            ws.send(JSON.stringify({ type: 'research_start' }));
            await runResearch(params, wsOutput);
          } finally {
            isResearching = false;
            ws.send(JSON.stringify({ type: 'research_complete' }));
          }
        } else if (activePrompts.size > 0) {
          // If not a research command, check if we're expecting this as a response
          if (activePrompts.size === 0) {
            ws.send(JSON.stringify({ type: 'output', data: 'Unknown command. Use /research' }));
          }
        }
      }
    });

    ws.on('close', () => {
      // Clean up any active prompts
      activePrompts.clear();
      isResearching = false;
      isCollectingInputs = false;
    });
  });
}

// Helper function to handle research with various input types
async function startResearchWithQuery(query, breadth, depth, outputFn) {
  // Extract the actual query content
  let queryForDisplay = query;
  let metadataInfo = '';
  
  if (typeof query === 'object') {
    if (!query.original) {
      outputFn('Error: Invalid query format. Missing original query text.');
      return;
    }
    queryForDisplay = query.original;

    // If there's classifier metadata, note it
    if (query.metadata) {
      metadataInfo = '\nUsing token classification metadata to enhance results.';
    } else {
      // Log same classification steps as CLI if relevant
      outputFn('Classifying query with token classifier...');
      try {
        const tokenMetadata = await callVeniceWithTokenClassifier(query.original);
        query.metadata = tokenMetadata;
        outputFn('Token classification completed.');
        outputFn(`Token classification result: ${tokenMetadata}`);
        outputFn('Using token classification to enhance research quality...');
        metadataInfo = '\nUsing enhanced metadata from token classification';
      } catch (error) {
        outputFn(`Error during token classification: ${error.message}`);
        outputFn('Continuing with basic query...');
      }
    }
  }

  // Match the same logging depth as CLI
  outputFn(`\nStarting research with query: "${queryForDisplay}"${metadataInfo}`);
  outputFn(`Depth: ${depth} Breadth: ${breadth}\n`);

  try {
    const engine = new ResearchEngine({
      query, // Pass the query as-is (could be string or object)
      breadth,
      depth,
      onProgress: (progress) => {
        outputFn(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
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
  } catch (error) {
    outputFn(`\nError during research: ${error.message}`);
  }
}

// We'll split out gathering research inputs from the actual research steps:
async function gatherResearchInputs(wsInput, wsOutput) {
  const researchQuery = await wsInput('What would you like to research? ');
  if (!researchQuery.trim()) {
    wsOutput('Query cannot be empty.');
    return null;
  }
  const breadthStr = await wsInput('Enter research breadth (2-10)? [3] ');
  const depthStr = await wsInput('Enter research depth (1-5)? [2] ');
  const breadth = parseInt(breadthStr || '3', 10);
  const depth = parseInt(depthStr || '2', 10);

  const useClassifier = await wsInput('Would you like to use the token classifier to add metadata? (yes/no) [no] ');
  let enhancedQuery = { original: researchQuery };
  if (['yes', 'y'].includes(useClassifier.trim().toLowerCase())) {
    try {
      wsOutput('Classifying query with token classifier...');
      const tokenMetadata = await callVeniceWithTokenClassifier(researchQuery);
      if (!enhancedQuery.original || typeof enhancedQuery.original !== 'string') {
        enhancedQuery.original = researchQuery;
      }
      enhancedQuery.metadata = tokenMetadata;
      wsOutput('Token classification completed.');
      wsOutput(`Token classification result: ${enhancedQuery.metadata}`);
      wsOutput('Using token classification to enhance research quality...');
    } catch (error) {
      wsOutput(`Error during token classification: ${error.message}`);
      wsOutput('Continuing with basic query...');
    }
  }
  return { query: enhancedQuery, breadth, depth };
}

async function runResearch(engineParams, wsOutput) {
  const { query, breadth, depth } = engineParams;
  wsOutput(`\nStarting research...\nQuery: "${query.original}"\nDepth: ${depth} Breadth: ${breadth}` 
    + `${query.metadata ? '\nUsing enhanced metadata from token classification' : ''}\n`);
  const engine = new ResearchEngine({
    query,
    breadth,
    depth,
    onProgress: (progress) => {
      wsOutput(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
    }
  });
  const result = await engine.research();
  wsOutput('\nResearch complete!');
  if (result.learnings.length === 0) {
    wsOutput('No learnings were found.');
  } else {
    wsOutput('\nKey Learnings:');
    result.learnings.forEach((learning, i) => {
      wsOutput(`${i + 1}. ${learning}`);
    });
  }
  if (result.sources.length > 0) {
    wsOutput('\nSources:');
    result.sources.forEach((source) => wsOutput(`- ${source}`));
  }
  wsOutput(`\nResults saved to: ${result.filename || 'research folder'}`);
}