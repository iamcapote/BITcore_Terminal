const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface MemoryTotals {
	readonly stored: number;
	readonly retrieved: number;
	readonly validated: number;
	readonly summarized: number;
	readonly ephemeralCount: number;
	readonly validatedCount: number;
	readonly layers: number;
}

export interface MemoryLayerSnapshot {
	readonly layer: string;
	readonly depth: string;
	readonly stored: number;
	readonly retrieved: number;
	readonly validated: number;
	readonly summarized: number;
	readonly ephemeralCount: number;
	readonly validatedCount: number;
	readonly githubEnabled: boolean;
}

export interface MemoryStatsSnapshot {
	readonly layers: readonly MemoryLayerSnapshot[];
	readonly totals: MemoryTotals;
}

export interface MemoryRecord {
	readonly id: string;
	readonly layer: string;
	readonly role: string;
	readonly content: string;
	readonly tags: readonly string[];
	readonly metadata: Record<string, unknown>;
	readonly source: string | null;
	readonly timestamp: string | null;
	readonly score: number | null;
}

export interface MemoryStorePayload {
	readonly content: string;
	readonly role?: string;
	readonly layer?: string;
	readonly source?: string | null;
	readonly tags?: readonly string[];
	readonly metadata?: Record<string, unknown>;
	readonly githubEnabled?: boolean;
}

export interface MemoryRecallPayload {
	readonly query: string;
	readonly layer?: string;
	readonly limit?: number | null;
	readonly includeShortTerm?: boolean;
	readonly includeLongTerm?: boolean;
	readonly includeMeta?: boolean;
	readonly githubEnabled?: boolean;
}

export interface FetchMemoryStatsOptions {
	readonly layer?: string;
	readonly githubEnabled?: boolean;
	readonly signal?: AbortSignal;
}

export async function fetchMemoryStats(options: FetchMemoryStatsOptions = {}): Promise<MemoryStatsSnapshot> {
	const params = new URLSearchParams();
	if (options.layer) {
		params.set("layer", options.layer);
	}
	if (typeof options.githubEnabled === "boolean") {
		params.set("githubEnabled", options.githubEnabled ? "1" : "0");
	}

	const endpoint = params.size > 0 ? `/api/memory/stats?${params.toString()}` : "/api/memory/stats";
	const response = await fetch(endpoint, {
		credentials: "include",
		signal: options.signal,
	});

	const body = await safeParseJson(response);
	if (!response.ok) {
		throw createApiError(response, body, "Unable to load memory stats");
	}

	return normalizeMemoryStats(body);
}

export async function storeMemory(payload: MemoryStorePayload): Promise<MemoryRecord> {
	const response = await fetch("/api/memory/store", {
		method: "POST",
		headers: JSON_HEADERS,
		credentials: "include",
		body: JSON.stringify(payload),
	});

	const body = await safeParseJson(response);
	if (!response.ok) {
		throw createApiError(response, body, "Failed to store memory");
	}

	return normalizeMemoryRecord(body, { fallbackLayer: payload.layer });
}

export async function recallMemory(payload: MemoryRecallPayload): Promise<MemoryRecord[]> {
	const response = await fetch("/api/memory/recall", {
		method: "POST",
		headers: JSON_HEADERS,
		credentials: "include",
		body: JSON.stringify(payload),
	});

	const body = await safeParseJson(response);
	if (!response.ok) {
		throw createApiError(response, body, "Failed to recall memories");
	}

	if (!Array.isArray(body)) {
		return [];
	}

	return body.map((entry) => normalizeMemoryRecord(entry, { fallbackLayer: payload.layer })).filter(Boolean) as MemoryRecord[];
}

export function isAbortError(error: unknown): boolean {
	if (!error) return false;
	if (error instanceof DOMException && error.name === "AbortError") {
		return true;
	}
	if (typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "AbortError") {
		return true;
	}
	return false;
}

function normalizeMemoryStats(raw: unknown): MemoryStatsSnapshot {
	if (!raw || typeof raw !== "object") {
		return {
			layers: [],
			totals: createEmptyTotals(),
		};
	}

	const record = raw as Record<string, unknown>;
	const layersRaw = Array.isArray(record.layers) ? record.layers : [];
	const layers = layersRaw
		.map((entry) => normalizeMemoryLayer(entry))
		.filter((entry): entry is MemoryLayerSnapshot => Boolean(entry));

	const totals = normalizeTotals(record.totals);

	return {
		layers,
		totals,
	};
}

function normalizeMemoryLayer(raw: unknown): MemoryLayerSnapshot | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const layer = typeof record.layer === "string" && record.layer ? record.layer : "unknown";
	const depth = typeof record.depth === "string" && record.depth ? record.depth : "—";
	return {
		layer,
		depth,
		stored: toNumber(record.stored),
		retrieved: toNumber(record.retrieved),
		validated: toNumber(record.validated),
		summarized: toNumber(record.summarized),
		ephemeralCount: toNumber(record.ephemeralCount),
		validatedCount: toNumber(record.validatedCount),
		githubEnabled: Boolean(record.githubEnabled),
	};
}

function normalizeTotals(raw: unknown): MemoryTotals {
	if (!raw || typeof raw !== "object") {
		return createEmptyTotals();
	}
	const record = raw as Record<string, unknown>;
	return {
		stored: toNumber(record.stored),
		retrieved: toNumber(record.retrieved),
		validated: toNumber(record.validated),
		summarized: toNumber(record.summarized),
		ephemeralCount: toNumber(record.ephemeralCount),
		validatedCount: toNumber(record.validatedCount),
		layers: toNumber(record.layers, 0),
	};
}

function createEmptyTotals(): MemoryTotals {
	return {
		stored: 0,
		retrieved: 0,
		validated: 0,
		summarized: 0,
		ephemeralCount: 0,
		validatedCount: 0,
		layers: 0,
	};
}

function normalizeMemoryRecord(raw: unknown, options: { fallbackLayer?: string | null } = {}): MemoryRecord {
	if (!raw || typeof raw !== "object") {
		return {
			id: createId(),
			layer: options.fallbackLayer ?? "episodic",
			role: "user",
			content: "",
			tags: [],
			metadata: {},
			source: null,
			timestamp: null,
			score: null,
		};
	}

	const record = raw as Record<string, unknown>;
	return {
		id: typeof record.id === "string" && record.id ? record.id : createId(),
		layer: typeof record.layer === "string" && record.layer ? record.layer : options.fallbackLayer ?? "episodic",
		role: typeof record.role === "string" && record.role ? record.role : "user",
		content: typeof record.content === "string" ? record.content : "",
		tags: parseTags(record.tags),
		metadata: parseMetadata(record.metadata),
		source: typeof record.source === "string" && record.source ? record.source : parseSource(record.metadata),
		timestamp: typeof record.timestamp === "string" && record.timestamp ? record.timestamp : null,
		score: toNullableNumber(record.score ?? (record.metadata as Record<string, unknown> | undefined)?.score),
	};
}

async function safeParseJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch (error) {
		console.warn("[memoryClient] Failed to parse JSON response", error);
		return null;
	}
}

function createApiError(response: Response, body: unknown, fallback: string): Error {
	const detail = typeof body === "object" && body !== null && "error" in body && typeof (body as { error?: unknown }).error === "string"
		? (body as { error: string }).error
		: fallback;
	const error = new Error(detail);
	(error as { status?: number }).status = response.status;
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

function parseTags(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
		.filter((entry) => entry.length > 0)
		.map((entry) => entry.toLowerCase());
}

function parseMetadata(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return { ...(value as Record<string, unknown>) };
}

function parseSource(metadata: unknown): string | null {
	if (!metadata || typeof metadata !== "object") {
		return null;
	}
	const record = metadata as Record<string, unknown>;
	const source = record.source;
	if (typeof source === "string" && source.trim()) {
		return source.trim();
	}
	return null;
}


function createId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
}
