/**
 * @license INTERNAL ONLY — Chat history client
 *
 * Why: Provide Nova with typed access to the chat history REST API used by the legacy dashboard.
 * What: Wraps list/detail/export/delete operations with consistent error handling and response normalization.
 * How: Issue fetch requests with credential forwarding, parse payloads defensively, and expose helpers for UI modules.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

interface SuccessfulPayload extends Record<string, unknown> {
	success: true;
	conversations?: unknown;
	retentionDays?: unknown;
	maxMessagesPerConversation?: unknown;
	conversation?: unknown;
	error?: unknown;
}

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface ChatHistoryListResponse {
	readonly conversations: readonly ChatConversationSummary[];
	readonly retentionDays: number | null;
	readonly maxMessagesPerConversation: number | null;
}

export interface ChatConversationSummary {
	readonly id: string;
	readonly origin: string | null;
	readonly tags: readonly string[];
	readonly startedAt: string | null;
	readonly updatedAt: string | null;
	readonly endedAt: string | null;
	readonly messageCount: number;
	readonly user: ChatConversationUser | null;
}

export interface ChatConversationDetail extends ChatConversationSummary {
	readonly messages: readonly ChatConversationMessage[];
}

export interface ChatConversationMessage {
	readonly id: string | null;
	readonly role: string;
	readonly content: string;
	readonly createdAt: string | null;
}

export interface ChatConversationUser {
	readonly id: string | null;
	readonly username: string | null;
}

export interface ClearChatHistoryOptions {
	readonly olderThanDays?: number;
}

export interface ChatHistoryFetchError extends Error {
	status?: number;
}

export async function listChatConversations(): Promise<ChatHistoryListResponse> {
	const response = await fetch("/api/chat/history", {
		credentials: "include",
	});
	const body = await safeParseJson(response);
	if (!response.ok || !isSuccessful(body)) {
		throw createApiError(response, body, "Failed to load chat conversations");
	}
	const rawConversations = Array.isArray(body.conversations) ? body.conversations : [];
	const conversations = rawConversations
		.map((entry) => normalizeConversationSummary(entry))
		.filter((entry): entry is ChatConversationSummary => Boolean(entry));
	return {
		conversations,
		retentionDays: toNullableNumber(body.retentionDays),
		maxMessagesPerConversation: toNullableNumber(body.maxMessagesPerConversation),
	};
}

export async function getChatConversation(conversationId: string): Promise<ChatConversationDetail> {
	const safeId = encodeURIComponent(conversationId);
	const response = await fetch(`/api/chat/history/${safeId}`, {
		credentials: "include",
	});
	const body = await safeParseJson(response);
	if (!response.ok || !isSuccessful(body)) {
		throw createApiError(response, body, "Failed to load chat conversation");
	}
	return normalizeConversationDetail(body.conversation);
}

export async function exportChatConversation(conversationId: string): Promise<string> {
	const safeId = encodeURIComponent(conversationId);
	const response = await fetch(`/api/chat/history/${safeId}/export`, {
		credentials: "include",
	});
	if (!response.ok) {
		const body = await safeParseJson(response);
		throw createApiError(response, body, "Failed to export chat conversation");
	}
	return await response.text();
}

export async function deleteChatConversation(conversationId: string): Promise<void> {
	const safeId = encodeURIComponent(conversationId);
	const response = await fetch(`/api/chat/history/${safeId}`, {
		method: "DELETE",
		credentials: "include",
		headers: JSON_HEADERS,
	});
	const body = await safeParseJson(response);
	if (!response.ok || !isSuccessful(body)) {
		throw createApiError(response, body, "Failed to delete chat conversation");
	}
}

export async function clearChatConversations(options: ClearChatHistoryOptions = {}): Promise<void> {
	const params = new URLSearchParams();
	if (typeof options.olderThanDays === "number" && Number.isFinite(options.olderThanDays) && options.olderThanDays > 0) {
		params.set("olderThanDays", String(options.olderThanDays));
	}
	const endpoint = params.size > 0 ? `/api/chat/history?${params.toString()}` : "/api/chat/history";
	const response = await fetch(endpoint, {
		method: "DELETE",
		credentials: "include",
		headers: JSON_HEADERS,
	});
	const body = await safeParseJson(response);
	if (!response.ok || !isSuccessful(body)) {
		throw createApiError(response, body, "Failed to clear chat history");
	}
}

function normalizeConversationSummary(raw: unknown): ChatConversationSummary | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const id = toString(record.id);
	if (!id) {
		return null;
	}
	return {
		id,
		origin: toString(record.origin),
		tags: parseStringArray(record.tags),
		startedAt: toString(record.startedAt),
		updatedAt: toString(record.updatedAt),
		endedAt: toString(record.endedAt),
		messageCount: toNumber(record.messageCount),
		user: normalizeUser(record.user),
	};
}

function normalizeConversationDetail(raw: unknown): ChatConversationDetail {
	const summary = normalizeConversationSummary(raw);
	const record = (raw ?? {}) as Record<string, unknown>;
	const messagesRaw = Array.isArray(record.messages) ? record.messages : [];
	const messages = messagesRaw
		.map((entry) => normalizeMessage(entry))
		.filter((entry): entry is ChatConversationMessage => Boolean(entry));
	return {
		...(summary ?? {
			id: toString(record.id) || createId(),
			origin: toString(record.origin),
			tags: parseStringArray(record.tags),
			startedAt: toString(record.startedAt),
			updatedAt: toString(record.updatedAt),
			endedAt: toString(record.endedAt),
			messageCount: toNumber(record.messageCount),
			user: normalizeUser(record.user),
		}),
		messages,
	};
}

function normalizeMessage(raw: unknown): ChatConversationMessage | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const role = toString(record.role) || "assistant";
	return {
		id: toString(record.id),
		role,
		content: toString(record.content) ?? "",
		createdAt: toString(record.createdAt),
	};
}

function normalizeUser(raw: unknown): ChatConversationUser | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const id = toString(record.id);
	const username = toString(record.username);
	if (!id && !username) {
		return null;
	}
	return {
		id: id ?? null,
		username: username ?? null,
	};
}

async function safeParseJson(response: Response): Promise<any> {
	const text = await response.text();
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch (error) {
		console.warn("[chatHistoryClient] Failed to parse JSON response", error);
		return null;
	}
}

function createApiError(response: Response, body: unknown, fallback: string): ChatHistoryFetchError {
	const detail = typeof body === "object" && body !== null && "error" in body && typeof (body as { error?: unknown }).error === "string"
		? (body as { error: string }).error
		: fallback;
	const error = new Error(detail) as ChatHistoryFetchError;
	error.status = response.status;
	return error;
}

function toNumber(value: unknown, fallback = 0): number {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) {
		return fallback;
	}
	return Math.max(0, Math.round(numberValue));
}

function toNullableNumber(value: unknown): number | null {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) {
		return null;
	}
	return numberValue;
}

function parseStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
		.filter((entry) => entry.length > 0);
}

function toString(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	return null;
}

function isSuccessful(payload: unknown): payload is SuccessfulPayload {
	return Boolean(payload && typeof payload === "object" && (payload as { success?: unknown }).success === true);
}

function createId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
}