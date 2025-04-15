import readline from 'readline';
import { output } from '../utils/research.output-manager.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import { MemoryManager } from '../infrastructure/memory/memory.manager.mjs';
import { 
  handleCliError, 
  ErrorTypes, 
  logCommandStart, 
  logCommandSuccess 
} from '../utils/cli-error-handler.mjs';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { generateQueries } from '../features/ai/research.providers.mjs';
import { cleanChatResponse } from '../infrastructure/ai/venice.response-processor.mjs';

// Initialize LLMClient instance
const llmClient = new LLMClient();

// Keep track of active readline interface to prevent duplicate instances
let activeRlInstance = null;

/**
 * CLI command for executing the chat interface with memory capabilities
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.memory - Enable memory mode (default: false)
 * @param {string} options.depth - Memory depth level: 'short', 'medium', 'long' (default: 'medium')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {boolean} options._testMode - Internal flag for testing
 * @returns {Promise<Object>} Chat session results
 */
export async function executeChat(options = {}) {
  // Increase timeout value from e.g. 10s to 30s
  const timeoutMs = options.timeout || 30000;

  try {
    // Log command execution start
    logCommandStart('chat', options, options.verbose);
    
    if (!userManager.isAuthenticated()) {
      return handleCliError(
        'You must be logged in to use the chat feature',
        ErrorTypes.AUTHENTICATION,
        { 
          command: 'chat',
          recoveryHint: 'Use /login to authenticate first'
        }
      );
    }

    if (!await userManager.hasApiKey('venice')) {
      return handleCliError(
        'Missing Venice API key required for chat',
        ErrorTypes.API_KEY,
        { 
          command: 'chat',
          recoveryHint: 'Use /keys set to configure your Venice API key'
        }
      );
    }

    // Extract and validate options
    const { 
      memory = false,
      depth = 'medium',
      verbose = false,
      password,
      _testMode = false
    } = options;
    
    // If test mode, skip interactive parts
    if (_testMode) {
      console.log("Running in test mode, skipping interactive chat");
      return {
        success: true,
        testMode: true,
        memoryEnabled: memory
      };
    }
    
    // If no password provided, prompt for it (required to decrypt API keys)
    let userPassword = password;
    if (!userPassword) {
      userPassword = await promptHidden('Please enter your password to decrypt API keys: ');
      if (!userPassword) {
        return handleCliError(
          'Password is required to decrypt API keys',
          ErrorTypes.API_KEY,
          { command: 'chat' }
        );
      }
    }
    
    // Retrieve decrypted API key
    const veniceKey = await userManager.getApiKey('venice', userPassword);
    
    if (!veniceKey) {
      return handleCliError(
        'Failed to decrypt Venice API key with the provided password',
        ErrorTypes.API_KEY,
        { command: 'chat' }
      );
    }
    
    // Set the API key in the environment for this operation
    process.env.VENICE_API_KEY = veniceKey;
    
    // Initialize memory manager if memory mode is enabled
    let memoryManager = null;
    if (memory) {
      try {
        memoryManager = new MemoryManager({
          depth,
          user: userManager.currentUser
        });
        output.log('Memory mode enabled. Use /exitmemory to finalize and exit memory mode.');
      } catch (error) {
        return handleCliError(
          `Failed to initialize memory system: ${error.message}`,
          ErrorTypes.INITIALIZATION,
          { command: 'chat' }
        );
      }
    }
    
    // Start interactive chat
    return await startInteractiveChat(memoryManager, verbose);
    
  } catch (error) {
    return handleCliError(
      error,
      error.name === 'LLMError' ? ErrorTypes.API : ErrorTypes.UNKNOWN,
      { 
        command: 'chat',
        verbose: options.verbose
      }
    );
  }
}

/**
 * Get password input from console using fixed method that prevents duplicate characters
 * @returns {Promise<string>} Password
 */
async function getPasswordFixed() {
  // Clean up any previous readline instance
  if (activeRlInstance) {
    activeRlInstance.close();
    activeRlInstance = null;
  }
  
  return new Promise((resolve) => {
    process.stdout.write('Enter your password to decrypt API keys: ');
    
    // Use raw mode to handle input manually - this prevents duplication bugs
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    
    // Create a one-time input handler
    const handleInput = (char) => {
      // Ctrl+C or Ctrl+D
      if (char === '\u0003' || char === '\u0004') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handleInput);
        resolve('');
        return;
      }
      
      // Enter key
      if (char === '\r' || char === '\n') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handleInput);
        resolve(password);
        return;
      }
      
      // Backspace
      if (char === '\u0008' || char === '\u007f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      
      // Only accept printable characters
      if (char >= ' ') {
        password += char;
        process.stdout.write('*');
      }
    };
    
    // Attach the input handler
    process.stdin.on('data', handleInput);
  });
}

/**
 * Start interactive chat mode
 * 
 * @param {MemoryManager|null} memoryManager - Memory manager instance if memory mode is enabled
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Promise<Object>} Chat session results
 */
async function startInteractiveChat(memoryManager, verbose = false) {
  // Ensure readline interface is properly initialized and cleaned up
  if (activeRlInstance) {
    activeRlInstance.close();
    activeRlInstance = null;
  }
  
  // Create a new readline interface for chat mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  activeRlInstance = rl;
  
  // Set a global flag to indicate chat mode
  global.inChatMode = true;
  
  try {
    // Display a welcome message
    output.log('\nChat session started. Type /exit to end.');
    
    let chatActive = true;
    let chatHistory = [];
    
    while (chatActive) {
      // Prompt the user for input
      const userInput = await new Promise(resolve => {
        rl.question('[user] ', resolve);
      });
      
      // Handle special commands
      if (userInput.trim().toLowerCase() === '/exit') {
        output.log('Exiting chat session...');
        chatActive = false;
        continue;
      }
      
      // Process user input and generate AI response
      if (userInput.trim()) {
        chatHistory.push({ role: 'user', content: userInput });
        
        // Disable input during processing
        if (window.terminal) window.terminal.disableInput();
        
        try {
          const response = await llmClient.completeChat({
            messages: chatHistory,
            temperature: 0.7,
            maxTokens: 1000
          });
          
          chatHistory.push({ role: 'assistant', content: response.content });
          output.log(`[AI] ${response.content}`);
        } catch (error) {
          console.error('[Chat] Error executing chat command:', error);
          output.log(`Error: ${error.message || error}`);
        } finally {
          // Always re-enable input
          if (window.terminal) window.terminal.enableInput();
        }
      }
    }
    
    // Clean up readline interface
    rl.close();
    activeRlInstance = null;
    global.inChatMode = false;
    
    return {
      success: true,
      history: chatHistory
    };
  } catch (error) {
    // Handle errors and clean up
    if (rl) rl.close();
    activeRlInstance = null;
    global.inChatMode = false;
    throw error;
  }
}

/**
 * Get user input without duplicating characters
 * Uses a direct approach with promises and one-time listeners
 * 
 * @param {readline.Interface} rl - Readline interface
 * @returns {Promise<string>} User's input
 */
function getUserInput(rl) {
  return new Promise(resolve => {
    // Remove any existing 'line' listeners to prevent duplicates
    rl.removeAllListeners('line');
    
    // Use once() to ensure the listener is automatically removed after use
    rl.once('line', (line) => {
      resolve(line);
    });
  });
}

/**
 * Fixed function to ask a question in the console that prevents character doubling
 * 
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User's answer
 */
function askQuestionFixed(rl, question) {
  return new Promise(resolve => {
    // Set proper prompt and display it
    rl.setPrompt(question);
    rl.prompt();
    
    // Use a simple one-time listener
    const onLine = (line) => {
      // Remove this listener to prevent duplicates
      rl.removeListener('line', onLine);
      resolve(line);
    };
    
    // Register the listener
    rl.once('line', onLine);
  });
}

/**
 * Finalize memories by summarizing and storing them
 * 
 * @param {MemoryManager} memoryManager - Memory manager instance
 * @param {Array} chatHistory - Chat history array
 * @returns {Promise<void>}
 */
async function finalizeMemories(memoryManager, chatHistory) {
  try {
    // Extract conversational content for summarization
    const conversationText = chatHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
    
    // Generate summary and finalize memories
    await memoryManager.summarizeAndFinalize(conversationText);
    
  } catch (error) {
    output.error(`Error during memory finalization: ${error.message}`);
  }
}

/**
 * Get system prompt for the LLM
 * 
 * @param {MemoryManager|null} memoryManager - Memory manager instance if enabled
 * @returns {string} System prompt
 */
function getSystemPrompt(memoryManager) {
  const basePrompt = `You are an adaptive AI assistant designed to help with research and provide informative responses.
Your responses should be:

1. Clear, concise, and factual
2. Based on the conversation context
3. Helpful and informative
4. Respectful of user privacy`;

  // If memory is enabled, add memory-specific instructions
  if (memoryManager) {
    return `${basePrompt}

You have access to memory blocks from previous conversations which are marked with [memory:ID].
When relevant, refer to these memories to maintain context and continuity.
Do not explicitly mention "memory blocks" to the user, but incorporate the knowledge naturally.`;
  }
  
  return basePrompt;
}

/**
 * Implementation of the /exitmemory command
 * 
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Command result
 */
export async function exitMemory(options = {}) {
  return handleCliError(
    'The /exitmemory command is only available within an active chat session with memory enabled',
    ErrorTypes.INVALID_OPERATION,
    { 
      command: 'exitmemory',
      recoveryHint: 'Start a chat session with "/chat --memory=true" first'
    }
  );
}

/**
 * Generate research queries based on chat conversation context
 * 
 * @param {Array} chatHistory - Chat history array
 * @param {Array} memoryBlocks - Memory blocks array if available
 * @param {number} numQueries - Number of queries to generate (default: 3)
 * @returns {Promise<Array<Object>>} Array of query objects
 */
export async function generateResearchQueries(chatHistory, memoryBlocks = [], numQueries = 3) {
  try {
    if (!chatHistory || chatHistory.length < 2) {
      throw new Error('Chat history is too short to generate meaningful research queries');
    }

    // Create context extraction prompt
    const contextPrompt = `Based on the following conversation, identify the main topics that would be valuable to research further:

${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

${
  memoryBlocks.length > 0 ? 
  `\nRELEVANT MEMORIES:\n${memoryBlocks.map(block => block.content).join('\n\n')}` : 
  ''
}

Extract 3-5 main topics from this conversation that would benefit from deeper research. Format your response as a list of topics only, one per line.`;

    // Send to LLM for topic extraction
    const llmClient = new LLMClient();
    const topicsResponse = await llmClient.complete({
      system: 'You are a topic extraction specialist. Extract the main research-worthy topics from conversations.',
      prompt: contextPrompt,
      temperature: 0.3,
      maxTokens: 500
    });

    // Process the response to extract topics
    const topics = cleanChatResponse(topicsResponse.content)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('-') && !line.match(/^[0-9]+\./) && line.length > 5)
      .map(line => line.replace(/^[^a-zA-Z0-9]+/, '').trim())
      .slice(0, 5); // Take at most 5 topics

    if (topics.length === 0) {
      throw new Error('Failed to extract research topics from conversation');
    }

    // Generate research queries for each topic
    const allQueries = [];
    for (const topic of topics) {
      // Generate queries for this topic
      const topicQueries = await generateQueries({
        query: topic,
        numQueries: Math.ceil(numQueries / topics.length) + 1,
        metadata: null
      });

      allQueries.push(...topicQueries);
    }

    // Return the unique queries, up to the requested number
    return Array.from(new Set(allQueries.map(q => JSON.stringify(q))))
      .map(q => JSON.parse(q))
      .slice(0, numQueries);
    
  } catch (error) {
    output.error(`Error generating research queries: ${error.message}`);
    return [];
  }
}

/**
 * Start a research session based on chat context
 * Refactored to decouple terminal-CLI-specific logic.
 * 
 * @param {Array} chatHistory - Chat history array
 * @param {Array} memoryBlocks - Memory blocks array
 * @param {Object} options - Research options
 * @param {number} options.depth - Research depth
 * @param {number} options.breadth - Research breadth
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Function} outputFn - Function to handle output (e.g., console.log or WebSocket send)
 * @returns {Promise<Object>} Research result object
 */
export async function startResearchFromChat(chatHistory, memoryBlocks = [], options = {}, outputFn = console.log) {
  try {
    const { depth = 2, breadth = 3, verbose = false } = options;
    
    // Identify the main topic from the query content
    const mainTopic = await extractMainTopic(chatHistory);
    
    // Prepare combined query with memory context if available
    let enhancedQuery = { original: mainTopic };
    
    // Extract relevant memory content as metadata
    if (memoryBlocks.length > 0) {
      const memoryContent = memoryBlocks
        .map(block => block.content)
        .join(' ');
      
      enhancedQuery.metadata = `Context from chat memory: ${memoryContent}`;
    }
    
    // Create a research engine with the enhanced query
    outputFn(`Starting research on topic: "${mainTopic}"`);
    
    const engine = new ResearchEngine({
      query: enhancedQuery,
      depth,
      breadth: breadth,
      user: userManager.currentUser,
      onProgress: (progress) => {
        outputFn(`Research progress: ${progress.completedQueries}/${progress.totalQueries}`);
      }
    });
    
    // Generate queries directly from chat context using the new method
    outputFn('Generating research queries from chat context...');
    const queries = await engine.generateQueriesFromChatContext(chatHistory, memoryBlocks, breadth);
    
    if (queries.length === 0) {
      return {
        success: false,
        error: 'Failed to generate research queries from chat context'
      };
    }
    
    outputFn(`Generated ${queries.length} queries for research`);
    
    // Override the engine's query generation with our chat-derived queries
    engine.overrideQueries = queries;
    
    // Execute research
    const results = await engine.research();
    
    return {
      success: true,
      topic: mainTopic,
      results
    };
    
  } catch (error) {
    outputFn(`Error during research: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract the main topic from chat history for research
 * 
 * @param {Array} chatHistory - Chat history array
 * @returns {Promise<string>} Main topic text
 */
async function extractMainTopic(chatHistory) {
  try {
    // Use the last few messages to determine the main topic
    const recentMessages = chatHistory.slice(-4);
    
    const topicPrompt = `Based on this conversation snippet, provide a concise topic that represents what the user would want to research further:

${recentMessages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

Reply with only the research topic as a short phrase, no more than 10 words.`;

    // Send to LLM for topic extraction
    const llmClient = new LLMClient();
    const topicResponse = await llmClient.complete({
      system: 'You are a topic extraction specialist.',
      prompt: topicPrompt,
      temperature: 0.3,
      maxTokens: 100
    });
    
    return cleanChatResponse(topicResponse.content).trim();
    
  } catch (error) {
    // Fallback to a generic topic based on the last user message
    const lastUserMessage = chatHistory.filter(msg => msg.role === 'user').pop();
    if (lastUserMessage) {
      return lastUserMessage.content.split(' ').slice(0, 7).join(' ') + '...';
    }
    return 'Recent conversation topic';
  }
}

// Use readline to get hidden password input
function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    // Hide the input by listening for keypress events and replacing output
    process.stdin.on('data', (char) => {
      char = char + "";
      switch (char) {
        case "\n": case "\r": case "\u0004":
          process.stdout.write("\n");
          break;
        default:
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(query + Array(rl.line.length+1).join("*"));
          break;
      }
    });
    rl.question(query, (value) => {
      rl.history = rl.history.slice(1);
      rl.close();
      resolve(value);
    });
  });
}