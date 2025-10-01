/**
 * Why: Host CLI-only helpers for interactive chat flows and hidden password prompts.
 * What: Provides `promptHiddenFixed` for masked input and `startInteractiveChat` for readline-driven sessions.
 * How: Export the helpers for optional reuse; current CLI entry loads them on demand when running in TTY mode.
 */

import readline from 'readline';
import { cleanChatResponse } from '../../infrastructure/ai/venice.response-processor.mjs';

/**
 * Contract
 * Inputs: query string prompt
 * Outputs: Promise<string> resolved with entered password (empty when cancelled)
 * Error modes: resolves with empty string on I/O errors to avoid hanging callers.
 * Side effects: temporarily switches stdin to raw mode for secure input.
 */
export async function promptHiddenFixed(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let password = '';

    const cleanupAndResolve = (value) => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isRaw) process.stdin.setRawMode(false);
      process.stdin.pause();
      rl.close();
      process.stdout.write('\n');
      resolve(value);
    };

    const onKeypress = (chunk, key) => {
      if (key) {
        if (key.name === 'return' || key.name === 'enter') {
          cleanupAndResolve(password);
        } else if (key.name === 'backspace') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
          process.stdout.write('\nCancelled.\n');
          cleanupAndResolve('');
        } else if (!key.ctrl && !key.meta && chunk) {
          password += chunk;
          process.stdout.write('*');
        }
      } else if (chunk) {
        password += chunk;
        process.stdout.write('*'.repeat(chunk.length));
      }
    };

    rl.setPrompt('');
    rl.write(query);

    if (process.stdin.isRaw) process.stdin.setRawMode(false);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);

    rl.on('error', (err) => {
      console.error('Readline error during password prompt:', err);
      cleanupAndResolve('');
    });
  });
}

/**
 * Contract
 * Inputs:
 *   - llmClient: { completeChat: Function }
 *   - memoryManager?: { storeMemory: Function; retrieveRelevantMemories: Function; summarizeAndFinalize: Function }
 *   - verbose?: boolean
 *   - outputFn: Function
 *   - errorFn: Function
 *   - model: string
 *   - character?: string
 * Outputs: Promise<{ success: boolean; message: string }>
 * Error modes: surfaces LLM or memory errors via errorFn but keeps loop alive; resolves when session ends.
 * Performance: interactive; bounded by readline throughput and LLM latency.
 * Side effects: writes to stdout/stderr via provided callbacks and optionally persists memory.
 */
export async function startInteractiveChat(llmClient, memoryManager, verbose = false, outputFn, errorFn, model, character) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      prompt: '[user] ',
    });

    const chatHistory = [];
    const personaName = character || 'Bitcore';
    const systemMessageContent = `You are ${personaName}, an AI assistant powering the /chat command.

✦ Formatting rules ✦
1. Your answer MUST consist of **two distinct parts** in a single message:
   a) Your private reasoning, wrapped in a <thinking> … </thinking> tag.
   b) Your final user-visible reply, which comes immediately after the closing </thinking> tag with **no tag** around it.
2. Do **not** write “[AI] ...thinking...” or any other extra markers—the tags alone are sufficient.
3. If you have no private reasoning to share, simply omit the <thinking> block; everything you send will then be treated as the reply.
4. Keep the language of both sections consistent with the user’s language, unless the user explicitly requests otherwise.

Example
-------
User: hi

Assistant (one message):
<thinking>
Okay, the user just said “hi”. I should greet them warmly and invite a follow-up question.
</thinking>
Hello! How can I assist you today?`;

    if (systemMessageContent.trim()) {
      chatHistory.push({ role: 'system', content: systemMessageContent });
    }

    let chatEnded = false;
    const endChat = () => {
      if (!chatEnded) {
        chatEnded = true;
        outputFn('Exiting chat mode.');
        rl.close();
      }
    };

    rl.on('line', async (line) => {
      if (chatEnded) return;
      const userInput = line.trim();

      if (userInput.startsWith('/')) {
        const [cmd] = userInput.slice(1).split(/\s+/);
        if (cmd.toLowerCase() === 'exit') {
          outputFn('Exiting chat session...');
          chatEnded = true;
          rl.close();
          return;
        }
        outputFn(`Unknown in-chat command: /${cmd}`);
        rl.prompt();
        return;
      }

      if (!userInput) {
        rl.prompt();
        return;
      }

      try {
        chatHistory.push({ role: 'user', content: userInput });
        if (memoryManager) {
          await memoryManager.storeMemory(userInput, 'user');
        }

        let retrievedMemoryContext = '';
        if (memoryManager) {
          const relevantMemories = await memoryManager.retrieveRelevantMemories(userInput);
          if (relevantMemories && relevantMemories.length > 0) {
            retrievedMemoryContext = 'Relevant information from memory:\n' + relevantMemories.map((mem) => `- ${mem.content}`).join('\n') + '\n';
          }
        }

        const maxHistoryLength = 10;
        let messagesForLlm = [];
        if (chatHistory.length > 0 && chatHistory[0].role === 'system') {
          messagesForLlm.push(chatHistory[0]);
          messagesForLlm.push(...chatHistory.slice(Math.max(1, chatHistory.length - maxHistoryLength + 1)));
        } else {
          messagesForLlm = chatHistory.slice(-maxHistoryLength);
        }

        if (retrievedMemoryContext) {
          if (messagesForLlm.length > 1 && messagesForLlm[messagesForLlm.length - 1].role === 'user') {
            messagesForLlm.splice(messagesForLlm.length - 1, 0, {
              role: 'system',
              content: `Relevant information from memory:\n${retrievedMemoryContext}`,
            });
          } else {
            messagesForLlm.push({ role: 'system', content: `Relevant information from memory:\n${retrievedMemoryContext}` });
          }
        }

        const response = await llmClient.completeChat({
          messages: messagesForLlm,
          model,
          temperature: 0.7,
          maxTokens: 2048,
        });
        const assistantResponse = cleanChatResponse(response.content);

        chatHistory.push({ role: 'assistant', content: assistantResponse });
        if (memoryManager) {
          await memoryManager.storeMemory(assistantResponse, 'assistant');
        }

        outputFn(`[AI] ${assistantResponse}`);
      } catch (error) {
        errorFn(`Error: ${error.message}`);
      } finally {
        if (!chatEnded) {
          rl.prompt();
        }
      }
    });

    rl.on('close', async () => {
      if (!chatEnded) {
        outputFn('Chat session ended.');
      }

      if (memoryManager) {
        outputFn('Finalizing memory...');
        try {
          const conversationText = chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n');
          const finalizationResult = await memoryManager.summarizeAndFinalize(conversationText);
          if (finalizationResult?.commitSha) {
            outputFn(`Memory committed to GitHub: ${finalizationResult.commitSha}`);
          } else {
            outputFn('Memory finalized (local storage or commit failed/disabled).');
          }
        } catch (memError) {
          errorFn(`Error finalizing memory: ${memError.message}`);
        }
      }

      resolve({ success: true, message: 'Chat session ended.' });
    });

    rl.on('SIGINT', () => {
      outputFn('\nChat interrupted. Type /exit to leave cleanly, or Ctrl+C again to force exit.');
      rl.prompt();
    });

    outputFn('Chat session started. Type /exit to end.');
    rl.prompt();
  });
}
