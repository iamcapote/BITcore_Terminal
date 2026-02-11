/**
 * @license INTERNAL ONLY — Chat provider
 *
 * Why: Mirror the legacy chat bootstrap inside Nova while sharing the terminal command bus for strict CLI/Web parity.
 * What: Wraps chat state in a React context, subscribes to WebComm events, and exposes helpers for launching and messaging sessions.
 * How: Reduce incoming events with the chat store, reuse the terminal client for IO, and normalise command flags before dispatching.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	type PropsWithChildren,
} from "react";
import { useTerminal } from "@/modules/terminal/TerminalContext";
import {
	chatReducer,
	createChatMessage,
	INITIAL_CHAT_STATE,
	DEFAULT_CHAT_PROMPT,
	normalizeSessionConfig,
} from "@/modules/chat/chatStore";
import type {
	ChatPersona,
	ChatSessionConfig,
	ChatState,
	MemoryContextEntry,
} from "@/modules/chat/chatTypes";

interface ChatContextValue extends ChatState {
	readonly startChat: (config?: Partial<ChatSessionConfig>) => Promise<void>;
	readonly sendMessage: (message: string) => Promise<void>;
	readonly sendCommand: (command: string) => Promise<void>;
	readonly cancelResponse: () => void;
	readonly exitChat: () => Promise<void>;
	readonly resetChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: PropsWithChildren): JSX.Element {
	const {
		runCommand,
		sendChatMessage,
		registerWebCommHandler,
		mode,
		prompt,
	} = useTerminal();
	const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);

	useEffect(() => {
		dispatch({ type: "SET_MODE", mode, prompt });
	}, [mode, prompt]);

	useEffect(() => {
		const unsubscribers = [
			registerWebCommHandler("chat-ready", (message: Record<string, unknown>) => {
				const persona = resolvePersona(message.persona, message.character);
				const nextPrompt = typeof message.prompt === "string" && message.prompt.length > 0 ? message.prompt : DEFAULT_CHAT_PROMPT;
				const model = typeof message.model === "string" && message.model.length > 0 ? message.model : null;
				dispatch({ type: "CHAT_READY", prompt: nextPrompt, persona, model });
				const welcome = typeof message.welcome === "string" && message.welcome.trim().length > 0
					? message.welcome.trim()
					: "Chat session ready. Type /exit to leave.";
				dispatch({ type: "APPEND_MESSAGE", message: createChatMessage("system", welcome) });
			}),
			registerWebCommHandler("chat-response", (message: Record<string, unknown>) => {
				const raw = selectString(message, ["message", "data", "text"]);
				if (!raw) {
					return;
				}
				dispatch({ type: "RECEIVE_RESPONSE", content: raw });
			}),
			registerWebCommHandler("chat-exit", () => {
				dispatch({ type: "CHAT_EXIT" });
				dispatch({ type: "APPEND_MESSAGE", message: createChatMessage("system", "Chat session ended.") });
			}),
			registerWebCommHandler("memory_context", (message: Record<string, unknown>) => {
				const entries = Array.isArray(message.data)
					? (message.data as MemoryContextEntry[])
					: [];
				dispatch({ type: "SET_MEMORY_CONTEXT", entries });
			}),
			registerWebCommHandler("memory_commit", (message: Record<string, unknown>) => {
				const commit = selectString(message, ["commitSha", "commit"], true);
				const text = commit ? `Memory finalized. Commit: ${commit}` : "Memory finalized.";
				dispatch({ type: "APPEND_MESSAGE", message: createChatMessage("system", text) });
			}),
			registerWebCommHandler("error", (message: Record<string, unknown>) => {
				const detail = selectString(message, ["error", "message", "data"], true);
				if (!detail) {
					return;
				}
				if (!/chat/i.test(detail)) {
					return;
				}
				dispatch({ type: "CHAT_ERROR", error: detail });
			}),
		];
		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe());
		};
	}, [registerWebCommHandler]);

	const startChat = useCallback(
		async (config?: Partial<ChatSessionConfig>) => {
			const normalized = normalizeSessionConfig(config, state.lastConfig);
			if (state.pending) {
				return;
			}
			dispatch({ type: "REQUEST_START", config: normalized });
			try {
				runCommand(buildChatCommand(normalized));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				dispatch({ type: "CHAT_ERROR", error: message });
			}
		},
		[state.lastConfig, state.pending, runCommand],
	);

	const sendMessage = useCallback(
		async (raw: string) => {
			const trimmed = raw.trim();
			if (!trimmed) {
				return;
			}
			if (!state.active) {
				throw new Error("Chat session not active.");
			}
			if (state.pendingResponseId) {
				throw new Error("Wait for the current response to finish.");
			}
			const outgoing = createChatMessage("user", trimmed);
			dispatch({ type: "APPEND_MESSAGE", message: outgoing });
			dispatch({ type: "START_RESPONSE", message: createChatMessage("assistant", "…", "streaming") });
			try {
				await sendChatMessage(trimmed);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				dispatch({ type: "MESSAGE_FAILED", id: outgoing.id, error: message });
				dispatch({ type: "RESPONSE_FAILED", error: message });
				throw new Error(message);
			}
		},
		[state.active, state.pendingResponseId, sendChatMessage],
	);

	const sendCommand = useCallback(
		async (raw: string) => {
			const trimmed = raw.trim();
			if (!trimmed) {
				return;
			}
			const outgoing = createChatMessage("user", trimmed);
			dispatch({ type: "APPEND_MESSAGE", message: outgoing });
			try {
				runCommand(trimmed);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				dispatch({ type: "MESSAGE_FAILED", id: outgoing.id, error: message });
				throw new Error(message);
			}
		},
		[runCommand],
	);

	const exitChat = useCallback(async () => {
		await sendCommand("/exit");
	}, [sendCommand]);

	const cancelResponse = useCallback(() => {
		dispatch({ type: "CANCEL_RESPONSE" });
	}, []);

	const resetChat = useCallback(() => {
		dispatch({ type: "RESET" });
	}, []);

	const value = useMemo<ChatContextValue>(
		() => ({
			...state,
			startChat,
			sendMessage,
			sendCommand,
			cancelResponse,
			exitChat,
			resetChat,
		}),
		[state, startChat, sendMessage, sendCommand, cancelResponse, exitChat, resetChat],
	);

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error("useChat must be used within a ChatProvider");
	}
	return context;
}

function buildChatCommand(config: ChatSessionConfig): string {
	const parts = ["chat"];
	parts.push(config.memoryEnabled ? "--memory=true" : "--memory=false");
	if (config.memoryEnabled) {
		parts.push(`--depth=${config.memoryDepth}`);
		parts.push(config.memoryGithubEnabled ? "--memory-github=true" : "--memory-github=false");
	} else if (config.memoryGithubEnabled) {
		parts.push("--memory-github=true");
	} else {
		parts.push("--memory-github=false");
	}
	if (config.character) {
		parts.push(`--character=${config.character}`);
	}
	if (config.model) {
		parts.push(`--model=${config.model}`);
	}
	return parts.join(" ");
}

function resolvePersona(candidate: unknown, fallbackSlug: unknown): ChatPersona | null {
	if (!candidate && typeof fallbackSlug === "string" && fallbackSlug.length > 0) {
		return { slug: fallbackSlug, name: fallbackSlug };
	}
	if (!candidate || typeof candidate !== "object") {
		return null;
	}
	const record = candidate as Record<string, unknown>;
	const slug = selectString(record, ["slug"]);
	const name = selectString(record, ["name"]) ?? slug;
	if (!slug && !name) {
		return null;
	}
	return {
		slug: slug ?? name ?? "persona",
		name: name ?? slug ?? "persona",
		description: selectString(record, ["description"], true) ?? undefined,
	};
}

function selectString(source: Record<string, unknown>, keys: readonly string[], allowTrim = false): string | null {
	for (const key of keys) {
		const value = source[key];
		if (typeof value === "string") {
			const result = allowTrim ? value.trim() : value;
			if (result.length > 0) {
				return result;
			}
		}
	}
	return null;
}

