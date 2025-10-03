#!/usr/bin/env node
/**
 * Web CLI functional sweep
 * Why: Exercise a broad set of terminal commands over the WebSocket interface with placeholder inputs.
 * What: Optionally boots the server, connects as a browser terminal client, drives commands, and records notable events.
 * How: Handles CSRF tokens, interactive prompts, chat mode transitions, and research post-action prompts before shutting down cleanly.
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

const WS_URL = process.env.WEBCLI_URL || 'ws://localhost:3000/api/research/ws';
const START_SERVER = process.env.WEBCLI_START_SERVER !== 'false';
const SERVER_PORT = process.env.PORT || '3000';
const COMMAND_DELAY_MS = Number.parseInt(process.env.WEBCLI_COMMAND_DELAY ?? '600', 10);
const PROMPT_TIMEOUT_MS = Number.parseInt(process.env.WEBCLI_PROMPT_TIMEOUT ?? '30000', 10);
const CONNECTION_TIMEOUT_MS = Number.parseInt(process.env.WEBCLI_CONNECTION_TIMEOUT ?? '15000', 10);

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessReady(child, matcher) {
	return new Promise((resolve, reject) => {
		let ready = false;
		const timeout = setTimeout(() => {
			if (!ready) {
				reject(new Error('Server readiness timeout'));
			}
		}, CONNECTION_TIMEOUT_MS);

		child.stdout.on('data', (chunk) => {
			const text = chunk.toString();
			process.stdout.write(text);
			if (!ready && matcher(text)) {
				ready = true;
				clearTimeout(timeout);
				resolve();
			}
		});

		child.stderr.on('data', (chunk) => {
			process.stderr.write(chunk.toString());
		});

		child.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});

		child.once('exit', (code, signal) => {
			if (!ready) {
				clearTimeout(timeout);
				reject(new Error(`Server exited before readiness (code=${code}, signal=${signal})`));
			}
		});
	});
}

function waitForProcessStop(child) {
	return new Promise((resolve) => {
		child.once('exit', (code, signal) => {
			resolve({ code, signal });
		});
	});
}

async function main() {
	let server = null;
	let stopPromise = null;

	if (START_SERVER) {
		console.log('[webcli-sim] Starting server...');
		server = spawn('node', ['app/start.mjs'], {
			cwd: process.cwd(),
			env: { ...process.env, PORT: SERVER_PORT },
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		stopPromise = waitForProcessStop(server);
		await waitForProcessReady(server, (text) => text.includes('Express server running.'));
		console.log('[webcli-sim] Server ready.');
	}

	console.log(`[webcli-sim] Connecting to ${WS_URL}...`);
	const ws = new WebSocket(WS_URL);

	let csrfToken = null;
	let currentMode = 'command';
	let promptResolver = null;
	let pendingPrompt = null;
	const eventLog = [];

	function recordEvent(event) {
		eventLog.push({ ...event, ts: Date.now() });
		if (event.type !== 'ping' && event.type !== 'log-snapshot' && event.type !== 'github-activity:event') {
			console.log('[webcli-sim] event:', JSON.stringify(event));
		}
	}

	const waitForOpen = new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), CONNECTION_TIMEOUT_MS);
		ws.on('open', () => {
			clearTimeout(timeout);
			resolve();
		});
		ws.on('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
	});

	ws.on('message', (raw) => {
		try {
			const payload = JSON.parse(raw.toString());
			if (payload.type === 'csrf_token' && typeof payload.value === 'string') {
				csrfToken = payload.value;
			}
					if (payload.type === 'mode_change' && typeof payload.mode === 'string') {
						currentMode = payload.mode;
					}
					if (payload.type === 'chat-ready') {
						currentMode = 'chat';
					}
			if (payload.type === 'prompt') {
				const promptData = {
					type: 'prompt',
					prompt: payload.data,
					context: payload.context ?? null,
					isPassword: payload.isPassword ?? false,
				};
				if (promptResolver) {
					promptResolver(promptData);
					promptResolver = null;
				} else {
					pendingPrompt = promptData;
				}
			}
			recordEvent(payload);
		} catch (error) {
			console.error('[webcli-sim] Failed to parse WebSocket message:', raw.toString(), error);
		}
	});

	await waitForOpen;

	const waitForCsrf = async (timeoutMs = CONNECTION_TIMEOUT_MS) => {
		const start = Date.now();
		while (!csrfToken) {
			if (Date.now() - start > timeoutMs) {
				throw new Error('Timed out waiting for CSRF token');
			}
			await delay(100);
		}
		return csrfToken;
	};

	const waitForMode = async (expectedMode, timeoutMs = PROMPT_TIMEOUT_MS) => {
		const start = Date.now();
		while (currentMode !== expectedMode) {
			if (Date.now() - start > timeoutMs) {
				throw new Error(`Timed out waiting for mode ${expectedMode}, stayed at ${currentMode}`);
			}
			await delay(100);
		}
	};

	const waitForPrompt = async () => {
		if (pendingPrompt) {
			const prompt = pendingPrompt;
			pendingPrompt = null;
			return prompt;
		}
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				promptResolver = null;
				reject(new Error('Prompt timeout'));
			}, PROMPT_TIMEOUT_MS);
			promptResolver = (prompt) => {
				clearTimeout(timeout);
				resolve(prompt);
			};
		});
	};

	const sendRaw = (data) => {
		if (ws.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not open');
		}
		ws.send(JSON.stringify(data));
	};

	const sendCommand = async (command, args = []) => {
		await waitForCsrf();
		console.log(`[webcli-sim] /${command} ${args.join(' ')}`.trim());
		sendRaw({ type: 'command', command, args, csrfToken });
		await delay(COMMAND_DELAY_MS);
	};

	const sendChatMessage = async (message) => {
		console.log(`[webcli-sim] chat> ${message}`);
		sendRaw({ type: 'chat-message', message });
		await delay(COMMAND_DELAY_MS);
	};

	const respondToPrompt = async (value) => {
		console.log(`[webcli-sim] prompt response: ${value}`);
		sendRaw({ type: 'input', value });
		await delay(COMMAND_DELAY_MS);
	};

	const scenario = async () => {
		await waitForMode('command');

		await sendCommand('status');
		await sendCommand('keys', ['set', 'brave', 'placeholder-brave-key']);
		await sendCommand('keys', ['set', 'venice', 'placeholder-venice-key']);
		await sendCommand('keys', ['check']);

		await sendCommand('memory', ['stats']);
		await sendCommand('memory', ['store', 'Web CLI simulation memory snippet.']);
		await sendCommand('memory', ['recall', 'simulation']);

		await sendCommand('prompts', ['list']);
		await sendCommand('logs', ['stats']);

		await sendCommand('diagnose');

		await sendCommand('chat', ['--memory=true', '--depth=short']);
		await waitForMode('chat');
		await sendChatMessage('Hello from the CLI simulation.');
		await sendChatMessage('/exit');
		await waitForMode('command');
		await sendCommand('exitmemory');

		await sendCommand('research');
		const researchPrompt = await waitForPrompt();
		if (researchPrompt) {
			await respondToPrompt('Placeholder research topic for regression sweep.');
		}
		const postActionPrompt = await waitForPrompt();
		if (postActionPrompt && postActionPrompt.context === 'post_research_action') {
			await respondToPrompt('keep');
		}

		await sendCommand('export');
	};

	try {
		await scenario();
		console.log('[webcli-sim] Scenario complete. Closing connection.');
	} catch (error) {
		console.error('[webcli-sim] Scenario failed:', error);
		process.exitCode = 1;
	} finally {
		try {
			ws.close();
		} catch (error) {
			console.warn('[webcli-sim] Failed to close WebSocket:', error);
		}

		if (server) {
			console.log('[webcli-sim] Terminating server...');
			server.kill('SIGINT');
			await stopPromise;
		}

		console.log(`[webcli-sim] Captured ${eventLog.length} events.`);
	}
}

main().catch((error) => {
	console.error('[webcli-sim] Unhandled failure:', error);
	process.exit(1);
});
