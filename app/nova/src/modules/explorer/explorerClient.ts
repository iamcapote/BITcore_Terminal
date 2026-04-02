/**
 * Why: Centralize file explorer HTTP access for Nova surfaces.
 * What: Wraps list/read/preview/search filesystem endpoints and normalizes payloads.
 * How: Uses credentialed fetch calls, validates JSON responses, and returns immutable records.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export type ExplorerEntryType = "file" | "directory";

export interface ExplorerEntry {
	readonly name: string;
	readonly path: string;
	readonly type: ExplorerEntryType;
	readonly size: number | null;
	readonly modifiedAt: string | null;
}

export interface ExplorerListResult {
	readonly root: string;
	readonly path: string;
	readonly entries: readonly ExplorerEntry[];
}

export interface ExplorerReadResult {
	readonly root: string;
	readonly path: string;
	readonly bytes: number;
	readonly truncated: boolean;
	readonly content: string;
}

export interface ExplorerSearchMatch {
	readonly name: string;
	readonly path: string;
	readonly type: ExplorerEntryType;
}

export interface ExplorerSearchResult {
	readonly root: string;
	readonly path: string;
	readonly query: string;
	readonly results: readonly ExplorerSearchMatch[];
}

export interface ExplorerTreeNode {
	readonly name: string;
	readonly path: string;
	readonly type: ExplorerEntryType;
	readonly size: number | null;
	readonly modifiedAt: string | null;
	readonly children?: readonly ExplorerTreeNode[];
}

export interface ExplorerTreeResult {
	readonly root: string;
	readonly path: string;
	readonly depth: number;
	readonly truncated: boolean;
	readonly nodes: readonly ExplorerTreeNode[];
}

export async function listExplorerDirectory(path: string, signal?: AbortSignal): Promise<ExplorerListResult> {
	const params = new URLSearchParams({ path: path || "." });
	const response = await fetch(`/api/files/list?${params.toString()}`, { credentials: "include", signal });
	const payload = await parseJson(response, "list files");
	if (!response.ok) {
		throw new Error(`Failed to list files: ${readError(payload, response.status)}`);
	}
	return normalizeListResult(payload);
}

export async function readExplorerFile(path: string, signal?: AbortSignal): Promise<ExplorerReadResult> {
	const params = new URLSearchParams({ path });
	const response = await fetch(`/api/files/read?${params.toString()}`, { credentials: "include", signal });
	const payload = await parseJson(response, "read file");
	if (!response.ok) {
		throw new Error(`Failed to read file: ${readError(payload, response.status)}`);
	}
	return normalizeReadResult(payload);
}

export async function previewExplorerFile(path: string, signal?: AbortSignal): Promise<ExplorerReadResult> {
	const params = new URLSearchParams({ path });
	const response = await fetch(`/api/files/preview?${params.toString()}`, { credentials: "include", signal });
	const payload = await parseJson(response, "preview file");
	if (!response.ok) {
		throw new Error(`Failed to preview file: ${readError(payload, response.status)}`);
	}
	return normalizeReadResult(payload);
}

export async function searchExplorerPaths(query: string, path = ".", signal?: AbortSignal): Promise<ExplorerSearchResult> {
	const response = await fetch("/api/files/search", {
		method: "POST",
		headers: JSON_HEADERS,
		credentials: "include",
		body: JSON.stringify({ query, path }),
		signal,
	});
	const payload = await parseJson(response, "search files");
	if (!response.ok) {
		throw new Error(`Failed to search files: ${readError(payload, response.status)}`);
	}
	return normalizeSearchResult(payload);
}

export async function fetchExplorerTree(path = ".", depth = 4, signal?: AbortSignal): Promise<ExplorerTreeResult> {
	const params = new URLSearchParams({ path, depth: String(depth) });
	const response = await fetch(`/api/files/tree?${params.toString()}`, { credentials: "include", signal });
	const payload = await parseJson(response, "load workspace tree");
	if (!response.ok) {
		throw new Error(`Failed to load workspace tree: ${readError(payload, response.status)}`);
	}
	return normalizeTreeResult(payload);
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

async function parseJson(response: Response, action: string): Promise<unknown> {
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	if (!contentType.includes("application/json")) {
		const text = await response.text().catch(() => "");
		throw new Error(`Failed to ${action}: expected JSON response${text ? ` (${text.slice(0, 80)})` : ""}`);
	}
	try {
		return await response.json();
	} catch {
		throw new Error(`Failed to ${action}: invalid JSON response`);
	}
}

function readError(payload: unknown, status: number): string {
	if (payload && typeof payload === "object") {
		const record = payload as Record<string, unknown>;
		if (typeof record.error === "string" && record.error.trim()) {
			return record.error.trim();
		}
	}
	return `HTTP ${status}`;
}

function normalizeListResult(raw: unknown): ExplorerListResult {
	const record = asRecord(raw);
	const entriesRaw = Array.isArray(record.entries) ? record.entries : [];
	return Object.freeze({
		root: asString(record.root, ""),
		path: asString(record.path, "."),
		entries: Object.freeze(entriesRaw.map(normalizeEntry).filter((entry): entry is ExplorerEntry => Boolean(entry))),
	});
}

function normalizeReadResult(raw: unknown): ExplorerReadResult {
	const record = asRecord(raw);
	return Object.freeze({
		root: asString(record.root, ""),
		path: asString(record.path, ""),
		bytes: asNumber(record.bytes, 0),
		truncated: Boolean(record.truncated),
		content: asString(record.content, ""),
	});
}

function normalizeSearchResult(raw: unknown): ExplorerSearchResult {
	const record = asRecord(raw);
	const resultsRaw = Array.isArray(record.results) ? record.results : [];
	return Object.freeze({
		root: asString(record.root, ""),
		path: asString(record.path, "."),
		query: asString(record.query, ""),
		results: Object.freeze(resultsRaw.map(normalizeSearchMatch).filter((entry): entry is ExplorerSearchMatch => Boolean(entry))),
	});
}

function normalizeTreeResult(raw: unknown): ExplorerTreeResult {
	const record = asRecord(raw);
	const nodesRaw = Array.isArray(record.nodes) ? record.nodes : [];
	return Object.freeze({
		root: asString(record.root, ""),
		path: asString(record.path, "."),
		depth: asNumber(record.depth, 0),
		truncated: Boolean(record.truncated),
		nodes: Object.freeze(nodesRaw.map(normalizeTreeNode).filter((entry): entry is ExplorerTreeNode => Boolean(entry))),
	});
}

function normalizeEntry(raw: unknown): ExplorerEntry | null {
	const record = asRecord(raw);
	const type = record.type === "directory" ? "directory" : record.type === "file" ? "file" : null;
	if (!type) return null;
	return Object.freeze({
		name: asString(record.name, ""),
		path: asString(record.path, ""),
		type,
		size: typeof record.size === "number" && Number.isFinite(record.size) ? record.size : null,
		modifiedAt: typeof record.modifiedAt === "string" ? record.modifiedAt : null,
	});
}

function normalizeSearchMatch(raw: unknown): ExplorerSearchMatch | null {
	const record = asRecord(raw);
	const type = record.type === "directory" ? "directory" : record.type === "file" ? "file" : null;
	if (!type) return null;
	return Object.freeze({
		name: asString(record.name, ""),
		path: asString(record.path, ""),
		type,
	});
}

function normalizeTreeNode(raw: unknown): ExplorerTreeNode | null {
	const record = asRecord(raw);
	const type = record.type === "directory" ? "directory" : record.type === "file" ? "file" : null;
	if (!type) return null;
	const childrenRaw = Array.isArray(record.children) ? record.children : null;
	const children = childrenRaw
		? Object.freeze(childrenRaw.map(normalizeTreeNode).filter((entry): entry is ExplorerTreeNode => Boolean(entry)))
		: undefined;
	return Object.freeze({
		name: asString(record.name, ""),
		path: asString(record.path, ""),
		type,
		size: typeof record.size === "number" && Number.isFinite(record.size) ? record.size : null,
		modifiedAt: typeof record.modifiedAt === "string" ? record.modifiedAt : null,
		children,
	});
}

function asRecord(raw: unknown): Record<string, unknown> {
	if (!raw || typeof raw !== "object") {
		return {};
	}
	return raw as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
