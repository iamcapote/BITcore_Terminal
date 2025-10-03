#!/usr/bin/env node
/**
 * Why: Exercise core Web CLI flows programmatically before manual live testing.
 * What: Connects to the research WebSocket, sends a handful of slash commands (including keep + /export), and logs key responses.
 * How: Promisified helpers coordinate command sends, prompt replies, and chat interactions with timeout guards.
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

const WS_URL = process.env.WEBCLI_URL || 'ws://localhost:3000/api/research/ws';
const TIMEOUT_MS = 10000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) {
        reject(new Error('Server readiness timeout'));
      }
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes('Express server running.') && !ready) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk.toString());
    });

    child.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.once('exit', (code, signal) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`Server exited before readiness (code=${code}, signal=${signal})`));
      }
    });
  });
}

function waitForServerStop(child) {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function runSmoke() {
  const stopSignals = [];
  console.log('[webcli-smoke] Starting embedded web CLI server...');
  const server = spawn('node', ['app/start.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: process.env.PORT || '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServerReady(server);
  } catch (error) {
    server.kill('SIGINT');
    throw error;
  }

  console.log(`[webcli-smoke] Connecting to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  let csrfToken = null;
  let promptResolver = null;
  let promptContext = null;
  let pendingPrompt = null;

  const waitForOpen = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), TIMEOUT_MS);
    ws.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const eventLog = [];

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== 'ping' && msg.type !== 'log-snapshot' && msg.type !== 'github-activity:event') {
        eventLog.push(msg);
        console.log('[webcli-smoke] event:', JSON.stringify(msg));
      }
      if (msg.type === 'csrf_token' && typeof msg.value === 'string') {
        csrfToken = msg.value;
      } else if (msg.type === 'prompt') {
        promptContext = msg.context || null;
        const payload = { prompt: msg.data, context: promptContext, isPassword: msg.isPassword };
        if (promptResolver) {
          promptResolver(payload);
          promptResolver = null;
        } else {
          pendingPrompt = payload;
        }
      }
    } catch (error) {
      console.error('[webcli-smoke] Failed to parse message:', raw.toString(), error);
    }
  });

  const sendCommand = async (command, args = []) => {
    if (!csrfToken) {
      throw new Error('CSRF token not available yet.');
    }
    console.log(`[webcli-smoke] sending /${command} ${args.join(' ')}`.trim());
    ws.send(JSON.stringify({ type: 'command', command, args, csrfToken }));
    await delay(500);
  };

  const waitForPrompt = () => new Promise((resolve) => {
    if (pendingPrompt) {
      const payload = pendingPrompt;
      pendingPrompt = null;
      resolve(payload);
      return;
    }
    promptResolver = (payload) => {
      pendingPrompt = null;
      resolve(payload);
    };
  });

  const respondToPrompt = (value) => {
    console.log(`[webcli-smoke] responding to prompt (${promptContext || 'none'}): ${value}`);
    ws.send(JSON.stringify({ type: 'input', value }));
  };

  const sendChatMessage = async (message) => {
    console.log('[webcli-smoke] chat message:', message);
    ws.send(JSON.stringify({ type: 'chat-message', message }));
    await delay(500);
  };

  await waitForOpen;

  // Wait for initial handshake events and csrf token
  let attempts = 0;
  while (!csrfToken && attempts < 20) {
    await delay(250);
    attempts += 1;
  }
  if (!csrfToken) {
    throw new Error('Failed to obtain CSRF token from server.');
  }

  await sendCommand('status');
  await sendCommand('keys', ['check']);

  await sendCommand('chat');
  await sendChatMessage('Hello from automated smoke test.');
  await sendChatMessage('/exit');

  await sendCommand('research');
  const prompt = await waitForPrompt();
  if (prompt?.prompt) {
    respondToPrompt('Automated smoke test query about web CLI readiness');
    await delay(500);
  }
  // After research completes we expect a post-action prompt
  const postAction = await waitForPrompt();
  if (postAction?.context === 'post_research_action') {
    respondToPrompt('keep');
    await delay(750);
  }

  await sendCommand('export');
  await delay(500);

  console.log('[webcli-smoke] smoke run complete. Closing socket.');
  ws.close();

  console.log('[webcli-smoke] Stopping embedded server...');
  const waitStop = waitForServerStop(server);
  server.kill('SIGINT');
  stopSignals.push(await waitStop);

  return { events: eventLog, stopSignals };
}

runSmoke()
  .then(({ events, stopSignals }) => {
    console.log(`[webcli-smoke] captured ${events.length} notable events.`);
    if (stopSignals.length > 0) {
      console.log('[webcli-smoke] server exit:', JSON.stringify(stopSignals[0]));
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('[webcli-smoke] failed:', error);
    process.exit(1);
  });
