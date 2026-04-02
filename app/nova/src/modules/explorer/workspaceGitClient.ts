/**
 * Why: Provide typed Git primitives for explorer-led workspace recovery flows.
 * What: Wraps branch/status/history/revert endpoints exposed by /api/files/git/*.
 * How: Uses credentialed JSON requests, normalizes response shapes, and surfaces clear errors.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export interface GitStatusFile {
	readonly path: string;
	readonly code: string;
	readonly staged: boolean;
	readonly modified: boolean;
	readonly untracked: boolean;
}

export interface GitStatusSnapshot {
	readonly repoDir: string;
	readonly branch: string;
	readonly clean: boolean;
	readonly files: readonly GitStatusFile[];
}

export interface GitBranch {
	readonly name: string;
	readonly current: boolean;
}

export interface GitBranchesSnapshot {
	readonly repoDir: string;
	readonly current: string;
	readonly branches: readonly GitBranch[];
}

export interface GitCommitSummary {
	readonly hash: string;
	readonly shortHash: string;
	readonly author: string;
	readonly date: string;
	readonly subject: string;
}

export interface GitHistorySnapshot {
	readonly repoDir: string;
	readonly path: string;
	readonly commits: readonly GitCommitSummary[];
}

export async function fetchGitStatus(signal?: AbortSignal): Promise<GitStatusSnapshot> {
	const response = await fetch("/api/files/git/status", { credentials: "include", signal });
	const payload = await parseJson(response, "load git status");
	if (!response.ok) throw new Error(`Failed to load git status: ${readError(payload, response.status)}`);
	return normalizeStatus(payload);
}

export async function fetchGitBranches(signal?: AbortSignal): Promise<GitBranchesSnapshot> {
	const response = await fetch("/api/files/git/branches", { credentials: "include", signal });
	const payload = await parseJson(response, "load git branches");
	if (!response.ok) throw new Error(`Failed to load git branches: ${readError(payload, response.status)}`);
	return normalizeBranches(payload);
}

export async function createGitBranch(name: string, from?: string): Promise<GitBranchesSnapshot> {
	const response = await fetch("/api/files/git/branches", {
		method: "POST",
		headers: JSON_HEADERS,
		credentials: "include",
		body: JSON.stringify({ name, from }),
	});
	const payload = await parseJson(response, "create branch");
	if (!response.ok) throw new Error(`Failed to create branch: ${readError(payload, response.status)}`);
	return normalizeBranches(payload);
}

export async function checkoutGitBranch(branch: string): Promise<GitStatusSnapshot> {
	const response = await fetch("/api/files/git/checkout", {
		method: "POST",
		headers: JSON_HEADERS,
		credentials: "include",
		body: JSON.stringify({ branch }),
	});
	const payload = await parseJson(response, "checkout branch");
	if (!response.ok) throw new Error(`Failed to checkout branch: ${readError(payload, response.status)}`);
	return normalizeStatus(payload);
}

export async function fetchFileGitHistory(path: string, signal?: AbortSignal): Promise<GitHistorySnapshot> {
	const params = new URLSearchParams({ path });
	const response = await fetch(`/api/files/git/history?${params.toString()}`, { credentials: "include", signal });
	const payload = await parseJson(response, "load file history");
	if (!response.ok) throw new Error(`Failed to load file history: ${readError(payload, response.status)}`);
	return normalizeHistory(payload);
}

export async function revertFileViaGit(path: string): Promise<GitStatusSnapshot> {
	const response = await fetch("/api/files/git/revert", {
		method: "POST",
		headers: JSON_HEADERS,
		credentials: "include",
		body: JSON.stringify({ path }),
	});
	const payload = await parseJson(response, "revert file");
	if (!response.ok) throw new Error(`Failed to revert file: ${readError(payload, response.status)}`);
	return normalizeStatus(payload);
}

async function parseJson(response: Response, action: string): Promise<unknown> {
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	if (!contentType.includes("application/json")) {
		const raw = await response.text().catch(() => "");
		throw new Error(`Failed to ${action}: expected JSON response${raw ? ` (${raw.slice(0, 80)})` : ""}`);
	}
	try {
		return await response.json();
	} catch {
		throw new Error(`Failed to ${action}: invalid JSON payload`);
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

function normalizeStatus(raw: unknown): GitStatusSnapshot {
	const record = unwrapData(raw);
	const files = Array.isArray(record.files)
		? record.files
				.map((entry) => normalizeStatusFile(entry))
				.filter((entry): entry is GitStatusFile => Boolean(entry))
		: [];
	return Object.freeze({
		repoDir: asString(record.repoDir, ""),
		branch: asString(record.branch, "detached"),
		clean: Boolean(record.clean),
		files: Object.freeze(files),
	});
}

function normalizeBranches(raw: unknown): GitBranchesSnapshot {
	const record = unwrapData(raw);
	const branches = Array.isArray(record.branches)
		? record.branches
				.map((entry) => normalizeBranch(entry))
				.filter((entry): entry is GitBranch => Boolean(entry))
		: [];
	return Object.freeze({
		repoDir: asString(record.repoDir, ""),
		current: asString(record.current, ""),
		branches: Object.freeze(branches),
	});
}

function normalizeHistory(raw: unknown): GitHistorySnapshot {
	const record = unwrapData(raw);
	const commits = Array.isArray(record.commits)
		? record.commits
				.map((entry) => normalizeCommit(entry))
				.filter((entry): entry is GitCommitSummary => Boolean(entry))
		: [];
	return Object.freeze({
		repoDir: asString(record.repoDir, ""),
		path: asString(record.path, ""),
		commits: Object.freeze(commits),
	});
}

function normalizeStatusFile(raw: unknown): GitStatusFile | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const path = asString(record.path, "");
	if (!path) return null;
	return Object.freeze({
		path,
		code: asString(record.code, "??"),
		staged: Boolean(record.staged),
		modified: Boolean(record.modified),
		untracked: Boolean(record.untracked),
	});
}

function normalizeBranch(raw: unknown): GitBranch | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const name = asString(record.name, "");
	if (!name) return null;
	return Object.freeze({ name, current: Boolean(record.current) });
}

function normalizeCommit(raw: unknown): GitCommitSummary | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const hash = asString(record.hash, "");
	if (!hash) return null;
	return Object.freeze({
		hash,
		shortHash: asString(record.shortHash, hash.slice(0, 7)),
		author: asString(record.author, "unknown"),
		date: asString(record.date, ""),
		subject: asString(record.subject, ""),
	});
}

function unwrapData(raw: unknown): Record<string, unknown> {
	if (!raw || typeof raw !== "object") return {};
	const record = raw as Record<string, unknown>;
	if (record && typeof record === "object" && "feature" in record) {
		return record;
	}
	return record;
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}
