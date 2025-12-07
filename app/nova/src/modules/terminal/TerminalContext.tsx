/**
 * @license INTERNAL ONLY — Terminal context
 *
 * Why: Stream real Bitcore terminal traffic into Nova surfaces without relying on the legacy DOM implementation.
 * What: React context that owns the WebSocket session, command lifecycle, prompt handling, and rendered history entries.
 * How: Guard command input, proxy events through a reducer, forward prompts back to the backend, and expose composable state hooks.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	type PropsWithChildren,
} from "react";
import { terminalPrefill, terminalShortcuts } from "@/modules/data/mockWorkspace";
import { WebCommClient, type WebCommHandler, type WebCommMessage } from "@/modules/terminal/WebCommClient";

export type TerminalEntryRole = "input" | "output" | "system";

export interface TerminalEntry {
	readonly id: string;
	readonly role: TerminalEntryRole;
	readonly text: string;
	readonly createdAt: number;
}

export interface TerminalCommandEvent {
	readonly id: string;
	readonly command: string;
	readonly issuedAt: number;
}

export type TerminalMode = "command" | "prompt" | "chat";

export interface PromptRequest {
	readonly id: string;
	readonly message: string;
	readonly isPassword: boolean;
	readonly context?: unknown;
}

export interface TerminalConnectionState {
	readonly connected: boolean;
	readonly reason: string | null;
}

export interface TerminalState {
	readonly prompt: string;
	readonly history: TerminalEntry[];
	readonly runningCommands: TerminalCommandEvent[];
	readonly shortcuts: typeof terminalShortcuts;
	readonly connection: TerminalConnectionState;
	readonly inputEnabled: boolean;
	readonly mode: TerminalMode;
	readonly promptRequest: PromptRequest | null;
}

type TerminalAction =
	| { readonly type: "BOOTSTRAP" }
	| { readonly type: "APPEND"; readonly entry: TerminalEntry }
	| { readonly type: "REPLACE_LAST"; readonly entry: TerminalEntry }
	| { readonly type: "SET_CONNECTION"; readonly connection: TerminalConnectionState }
	| { readonly type: "SET_INPUT_ENABLED"; readonly value: boolean }
	| { readonly type: "SET_PROMPT"; readonly prompt: string }
	| { readonly type: "SET_MODE"; readonly mode: TerminalMode }
	| { readonly type: "SET_PROMPT_REQUEST"; readonly request: PromptRequest | null }
	| { readonly type: "CLEAR_HISTORY" };

interface TerminalContextValue extends TerminalState {
	readonly runCommand: (command: string) => void;
	readonly clearHistory: () => void;
	readonly respondToPrompt: (response: string) => Promise<void>;
	readonly cancelPrompt: () => Promise<void>;
	readonly reconnect: () => Promise<void>;
	readonly sendChatMessage: (message: string) => Promise<void>;
	readonly registerWebCommHandler: <TMessage extends WebCommMessage>(
		type: string,
		handler: WebCommHandler<TMessage>,
	) => () => void;
	readonly requestStatusRefresh: (options?: { validate?: boolean }) => Promise<void>;
}

const PROMPT = "▶ ";
const MAX_HISTORY = 500;

const TerminalContext = createContext<TerminalContextValue | null>(null);

function createEntry(role: TerminalEntryRole, text: string): TerminalEntry {
	return {
		id: createId(),
		role,
		text,
		createdAt: Date.now(),
	};
}

function limitHistory(history: TerminalEntry[]): TerminalEntry[] {
	if (history.length <= MAX_HISTORY) {
		return history;
	}
	return history.slice(history.length - MAX_HISTORY);
}

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
	switch (action.type) {
		case "BOOTSTRAP": {
			const entries = terminalPrefill.map<TerminalEntry>((line) =>
				createEntry(line.startsWith("$") ? "input" : "system", line),
			);
			return { ...state, history: limitHistory(entries) };
		}
		case "APPEND": {
			return { ...state, history: limitHistory([...state.history, action.entry]) };
		}
		case "REPLACE_LAST": {
			if (state.history.length === 0) {
				return state;
			}
			const nextHistory = [...state.history];
			nextHistory[nextHistory.length - 1] = action.entry;
			return { ...state, history: nextHistory };
		}
		case "SET_CONNECTION": {
			return { ...state, connection: action.connection };
		}
		case "SET_INPUT_ENABLED": {
			return { ...state, inputEnabled: action.value };
		}
		case "SET_PROMPT": {
			return { ...state, prompt: action.prompt };
		}
		case "SET_MODE": {
			return { ...state, mode: action.mode };
		}
		case "SET_PROMPT_REQUEST": {
			return { ...state, promptRequest: action.request };
		}
		case "CLEAR_HISTORY": {
			return { ...state, history: [] };
		}
		default:
			return state;
	}
}

const INITIAL_STATE: TerminalState = {
	prompt: PROMPT,
	history: [],
	runningCommands: [],
	shortcuts: terminalShortcuts,
	connection: { connected: false, reason: null },
	inputEnabled: true,
	mode: "command",
	promptRequest: null,
};

export function TerminalProvider({ children }: PropsWithChildren): JSX.Element {
	const [state, dispatch] = useReducer(terminalReducer, INITIAL_STATE);
	const clientRef = useRef<WebCommClient | null>(null);
	const promptRef = useRef(state.prompt);
	const modeRef = useRef<TerminalMode>(state.mode);

	useEffect(() => {
		promptRef.current = state.prompt;
	}, [state.prompt]);

	useEffect(() => {
		modeRef.current = state.mode;
	}, [state.mode]);

	useEffect(() => {
		dispatch({ type: "BOOTSTRAP" });
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const url = resolveWebSocketUrl();
		const client = new WebCommClient({ url });
		clientRef.current = client;

		const unsubscribers = [
			client.on("connection", (message) => {
				const connected = Boolean(message.connected);
				const reason = typeof message.reason === "string" ? message.reason : null;
				dispatch({ type: "SET_CONNECTION", connection: { connected, reason } });
				if (connected) {
					dispatch({ type: "APPEND", entry: createEntry("system", "Connection established.") });
					dispatch({ type: "SET_INPUT_ENABLED", value: true });
					return;
				}
				dispatch({
					type: "APPEND",
					entry: createEntry(
						"system",
						reason ? `Connection lost: ${reason}` : "Connection lost.",
					),
				});
				dispatch({ type: "SET_INPUT_ENABLED", value: true });
				dispatch({ type: "SET_PROMPT_REQUEST", request: null });
			}),
			client.on("system-message", (message) => {
				const text = resolveText(message);
				if (!text) return;
				dispatch({ type: "APPEND", entry: createEntry("system", text) });
			}),
			client.on("output", (message) => {
				const text = resolveText(message);
				if (!text) return;
				const entry = createEntry("output", sanitizeOutput(text));
				if (isProgressLike(text)) {
					dispatch({ type: "REPLACE_LAST", entry });
				} else {
					dispatch({ type: "APPEND", entry });
				}
			}),
			client.on("error", (message) => {
				const text = typeof message.error === "string" ? message.error : resolveText(message);
				if (!text) return;
				dispatch({ type: "APPEND", entry: createEntry("system", `Error: ${text}`) });
			}),
			client.on("enable_input", () => {
				dispatch({ type: "SET_INPUT_ENABLED", value: true });
				dispatch({ type: "SET_MODE", mode: "command" });
			}),
			client.on("disable_input", () => {
				dispatch({ type: "SET_INPUT_ENABLED", value: false });
			}),
			client.on("prompt", (message) => {
				const promptMessage = resolveText(message) || "Input required";
				const isPassword = Boolean(message.isPassword);
				const request: PromptRequest = {
					id: createId(),
					message: promptMessage,
					isPassword,
					context: message.context,
				};
				dispatch({ type: "SET_PROMPT_REQUEST", request });
				dispatch({ type: "SET_MODE", mode: "prompt" });
				dispatch({ type: "SET_INPUT_ENABLED", value: false });
			}),
			client.on("mode_change", (message) => {
				const nextMode = typeof message.mode === "string" ? (message.mode as TerminalMode) : "command";
				dispatch({ type: "SET_MODE", mode: nextMode });
				if (typeof message.prompt === "string" && message.prompt.length > 0) {
					dispatch({ type: "SET_PROMPT", prompt: message.prompt });
				}
			}),
			client.on("session-expired", () => {
				dispatch({
					type: "APPEND",
					entry: createEntry("system", "Session expired. Please login again."),
				});
				dispatch({ type: "SET_MODE", mode: "command" });
				dispatch({ type: "SET_INPUT_ENABLED", value: true });
			}),
			client.on("login_success", (message) => {
				const username = typeof message.username === "string" ? message.username : "user";
				dispatch({ type: "APPEND", entry: createEntry("system", `Login successful. Welcome, ${username}!`) });
			}),
			client.on("logout_success", () => {
				dispatch({ type: "APPEND", entry: createEntry("system", "Logout successful.") });
			}),
			client.on("chat-response", (message) => {
				const text = resolveText(message);
				if (!text) return;
				dispatch({ type: "APPEND", entry: createEntry("output", text) });
			}),
			client.on("chat-ready", (message) => {
				dispatch({ type: "SET_MODE", mode: "chat" });
				const promptText = typeof message.prompt === "string" && message.prompt.length > 0 ? message.prompt : "[chat] > ";
				dispatch({ type: "SET_PROMPT", prompt: promptText });
				dispatch({ type: "SET_INPUT_ENABLED", value: true });
			}),
			client.on("chat-exit", () => {
				dispatch({ type: "SET_MODE", mode: "command" });
				dispatch({ type: "SET_PROMPT", prompt: PROMPT });
				dispatch({ type: "SET_INPUT_ENABLED", value: true });
				dispatch({ type: "APPEND", entry: createEntry("system", "Chat session ended.") });
			}),
			client.on("memory_commit", (message) => {
				const commit = typeof message.commitSha === "string" && message.commitSha.length > 0 ? message.commitSha : null;
				const text = commit ? `Memory finalized. Commit: ${commit}` : "Memory finalized.";
				dispatch({ type: "APPEND", entry: createEntry("system", text) });
			}),
			client.on("progress", (message) => {
				const text = resolveText(message);
				if (!text) return;
				const entry = createEntry("system", text);
				dispatch({ type: "REPLACE_LAST", entry });
			}),
		];

		client
			.connect()
			.catch((error) => {
				console.error("[TerminalProvider] WebSocket connection failed", error);
				dispatch({
					type: "APPEND",
					entry: createEntry("system", `Connection error: ${error.message}`),
				});
				dispatch({ type: "SET_CONNECTION", connection: { connected: false, reason: error.message } });
			});

		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe());
			client.close();
			clientRef.current = null;
		};
	}, []);

	const appendSystem = useCallback((text: string) => {
		if (!text) return;
		dispatch({ type: "APPEND", entry: createEntry("system", text) });
	}, []);

	const runCommand = useCallback(
		(command: string) => {
			const trimmed = command.trim();
			if (!trimmed) {
				return;
			}

			if (!state.inputEnabled) {
				appendSystem("Input disabled. Awaiting server response.");
				return;
			}

			const client = clientRef.current;
			if (!client) {
				appendSystem("Not connected to command bus.");
				return;
			}

			const entry = createEntry("input", `${promptRef.current}${trimmed}`);
			dispatch({ type: "APPEND", entry });
			dispatch({ type: "SET_INPUT_ENABLED", value: false });

			client
				.sendCommand(trimmed)
				.then(() => {
					// server will re-enable input via enable_input event
				})
				.catch((error) => {
					console.error("[TerminalProvider] Failed to send command", error);
					appendSystem(`Client error: ${error.message}`);
					dispatch({ type: "SET_INPUT_ENABLED", value: true });
				});
		},
		[appendSystem, state.inputEnabled],
	);

	const clearHistory = useCallback(() => {
		dispatch({ type: "CLEAR_HISTORY" });
	}, []);

	const respondToPrompt = useCallback(
		async (response: string) => {
			const client = clientRef.current;
			if (!client) {
				appendSystem("Not connected to command bus.");
				return;
			}
			try {
				dispatch({ type: "SET_PROMPT_REQUEST", request: null });
				await client.sendInput(response);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				appendSystem(`Failed to send prompt response: ${message}`);
			}
	},
		[appendSystem],
	);

	const cancelPrompt = useCallback(async () => {
		await respondToPrompt("");
	}, [respondToPrompt]);

	const sendChatMessage = useCallback(async (message: string) => {
		const client = clientRef.current;
		if (!client) {
			throw new Error("Not connected to command bus.");
		}
		dispatch({ type: "SET_INPUT_ENABLED", value: false });
		try {
			await client.sendChatMessage(message);
		} catch (error) {
			dispatch({ type: "SET_INPUT_ENABLED", value: true });
			throw error instanceof Error ? error : new Error(String(error));
		}
	}, []);

	const requestStatusRefresh = useCallback(async ({ validate = false } = {}) => {
		const client = clientRef.current;
		if (!client) {
			appendSystem("Not connected to command bus.");
			throw new Error("Command bus unavailable.");
		}
		if (!client.isConnected) {
			appendSystem("Command bus unavailable for status refresh.");
			throw new Error("Command bus disconnected.");
		}
		try {
			await client.sendMessage({ type: "status-refresh", validate });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			appendSystem(`Failed to request status refresh: ${message}`);
			throw error instanceof Error ? error : new Error(message);
		}
	}, [appendSystem]);

	const registerWebCommHandler = useCallback(<TMessage extends WebCommMessage>(
		type: string,
		handler: WebCommHandler<TMessage>,
	) => {
		const client = clientRef.current;
		if (!client) {
			console.warn("[TerminalProvider] registerWebCommHandler called before client initialised.");
			return () => undefined;
		}
		return client.on(type, handler);
	}, []);

	const reconnect = useCallback(async () => {
		const client = clientRef.current;
		if (!client) {
			appendSystem("Command bus unavailable.");
			return;
		}
		if (client.isConnected || client.isConnecting) {
			appendSystem("Already connected to command bus.");
			return;
		}
		appendSystem("Attempting to reconnect...");
		try {
			await client.connect();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			appendSystem(`Reconnect failed: ${message}`);
		}
	}, [appendSystem]);

	const value = useMemo<TerminalContextValue>(
		() => ({
			...state,
			runCommand,
			clearHistory,
			respondToPrompt,
			cancelPrompt,
			reconnect,
			sendChatMessage,
			registerWebCommHandler,
			requestStatusRefresh,
		}),
		[state, runCommand, clearHistory, respondToPrompt, cancelPrompt, reconnect, sendChatMessage, registerWebCommHandler, requestStatusRefresh],
	);

	return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal(): TerminalContextValue {
	const context = useContext(TerminalContext);
	if (!context) {
		throw new Error("useTerminal must be used within a TerminalProvider");
	}
	return context;
}

function resolveWebSocketUrl(): string {
	if (typeof window === "undefined") {
		return "";
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/research/ws`;
}

function resolveText(message: unknown): string | null {
	if (!message || typeof message !== "object") {
		return null;
	}
	const payload = message as Record<string, unknown>;
	const candidates = [payload.data, payload.message, payload.text, payload.detail];
	for (const value of candidates) {
		if (typeof value === "string" && value.length > 0) {
			return value;
		}
	}
	return null;
}

function isProgressLike(text: string): boolean {
	return text.includes("ETA:") && text.includes("%");
}

function sanitizeOutput(text: string): string {
	return text.replace(/^[[]command[]][\s:>\-]*/i, "");
}

function createId(): string {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
}

