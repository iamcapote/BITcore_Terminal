/**
 * Research Preferences Provider
 * Why: Keep Nova research surfaces aligned with persisted defaults so CLI and GUI stay in sync.
 * What: React context that loads, updates, and resets research depth, breadth, and visibility flags via the preferences API.
 * How: Fetches `/api/preferences/research`, normalizes snapshots, and exposes async helpers with status tracking.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type PropsWithChildren,
} from "react";

interface ResearchPreferenceDefaults {
	readonly depth: number;
	readonly breadth: number;
	readonly isPublic: boolean;
}

type ResearchPreferencesPatch = {
	depth?: number | string | null;
	breadth?: number | string | null;
	isPublic?: boolean | string | number | null;
};

export interface ResearchPreferencesSnapshot {
	readonly defaults: ResearchPreferenceDefaults;
	readonly updatedAt: number | null;
}

type ResearchPreferencesStatus = "idle" | "loading" | "ready" | "saving";

interface ResearchPreferencesContextValue {
	readonly preferences: ResearchPreferencesSnapshot;
	readonly status: ResearchPreferencesStatus;
	readonly error: string | null;
	readonly refresh: (options?: { readonly force?: boolean }) => Promise<void>;
	readonly update: (patch: ResearchPreferencesPatch) => Promise<ResearchPreferencesSnapshot | null>;
	readonly reset: () => Promise<ResearchPreferencesSnapshot>;
	readonly dismissError: () => void;
}

const DEFAULT_SNAPSHOT: ResearchPreferencesSnapshot = Object.freeze({
	defaults: Object.freeze({ depth: 2, breadth: 3, isPublic: false }),
	updatedAt: null,
});

const DEPTH_RANGE = Object.freeze({ min: 1, max: 6 });
const BREADTH_RANGE = Object.freeze({ min: 1, max: 6 });

const ResearchPreferencesContext = createContext<ResearchPreferencesContextValue | null>(null);

function clampPreference(value: unknown, minimum: number, maximum: number, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		const clamped = Math.min(Math.max(Math.round(value), minimum), maximum);
		return clamped;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number.parseInt(value, 10);
		if (Number.isFinite(parsed)) {
			const clamped = Math.min(Math.max(parsed, minimum), maximum);
			return clamped;
		}
	}
	return fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		return value !== 0;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (!normalized) {
			return fallback;
		}
		if (["1", "true", "yes", "on", "public"].includes(normalized)) {
			return true;
		}
		if (["0", "false", "no", "off", "private"].includes(normalized)) {
			return false;
		}
	}
	return fallback;
}

function freezeSnapshot(snapshot: ResearchPreferencesSnapshot): ResearchPreferencesSnapshot {
	return Object.freeze({
		defaults: Object.freeze({
			depth: snapshot.defaults.depth,
			breadth: snapshot.defaults.breadth,
			isPublic: snapshot.defaults.isPublic,
		}),
		updatedAt: snapshot.updatedAt,
	});
}

function normalizeSnapshot(raw: unknown): ResearchPreferencesSnapshot {
	const input = (raw && typeof raw === "object" ? raw : null) as Partial<ResearchPreferencesSnapshot> | null;
	const defaults = (input?.defaults && typeof input.defaults === "object" ? input.defaults : null) as Partial<ResearchPreferenceDefaults> | null;
	const depth = clampPreference(defaults?.depth, DEPTH_RANGE.min, DEPTH_RANGE.max, DEFAULT_SNAPSHOT.defaults.depth);
	const breadth = clampPreference(defaults?.breadth, BREADTH_RANGE.min, BREADTH_RANGE.max, DEFAULT_SNAPSHOT.defaults.breadth);
	const isPublic = coerceBoolean(defaults?.isPublic, DEFAULT_SNAPSHOT.defaults.isPublic);
	const updatedAt = Number.isFinite(input?.updatedAt) ? Number(input?.updatedAt) : null;
	return freezeSnapshot({
		defaults: { depth, breadth, isPublic },
		updatedAt,
	});
}

function buildDefaultsPatch(
	patch: ResearchPreferencesPatch,
	baseline: ResearchPreferenceDefaults,
): ResearchPreferencesPatch | null {
	if (!patch || typeof patch !== "object") {
		return null;
	}
	const next: ResearchPreferencesPatch = {};
	let mutated = false;

	if (patch.depth !== undefined) {
		const depth = clampPreference(patch.depth, DEPTH_RANGE.min, DEPTH_RANGE.max, baseline.depth);
		if (depth !== baseline.depth) {
			next.depth = depth;
			mutated = true;
		}
	}

	if (patch.breadth !== undefined) {
		const breadth = clampPreference(patch.breadth, BREADTH_RANGE.min, BREADTH_RANGE.max, baseline.breadth);
		if (breadth !== baseline.breadth) {
			next.breadth = breadth;
			mutated = true;
		}
	}

	if (patch.isPublic !== undefined) {
		const isPublic = coerceBoolean(patch.isPublic, baseline.isPublic);
		if (isPublic !== baseline.isPublic) {
			next.isPublic = isPublic;
			mutated = true;
		}
	}

	return mutated ? next : null;
}

async function readJson(response: Response): Promise<unknown> {
	const body = await response.text();
	if (!body) {
		return null;
	}
	try {
		return JSON.parse(body);
	} catch (error) {
		throw new Error("Invalid JSON payload from preferences endpoint.");
	}
}

export function ResearchPreferencesProvider({ children }: PropsWithChildren): JSX.Element {
	const [snapshot, setSnapshot] = useState<ResearchPreferencesSnapshot>(DEFAULT_SNAPSHOT);
	const [status, setStatus] = useState<ResearchPreferencesStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const snapshotRef = useRef<ResearchPreferencesSnapshot>(DEFAULT_SNAPSHOT);

	const updateSnapshot = useCallback((next: ResearchPreferencesSnapshot) => {
		snapshotRef.current = next;
		setSnapshot(next);
	}, []);

	const refresh = useCallback(async ({ force = false } = {}) => {
		setStatus((previous) => (previous === "saving" ? previous : "loading"));
		setError(null);
		const controller = new AbortController();
		if (abortRef.current) {
			abortRef.current.abort();
		}
		abortRef.current = controller;
		try {
			const url = force ? "/api/preferences/research?refresh=1" : "/api/preferences/research";
			const response = await fetch(url, {
				credentials: "include",
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`);
			}
			const payload = await readJson(response);
			const normalized = normalizeSnapshot(payload);
			updateSnapshot(normalized);
			setStatus("ready");
		} catch (requestError) {
			if ((requestError as Error)?.name === "AbortError") {
				return;
			}
			setError((requestError as Error)?.message ?? "Unable to load research defaults.");
			setStatus("ready");
		} finally {
			if (abortRef.current === controller) {
				abortRef.current = null;
			}
		}
	}, [updateSnapshot]);

	const dismissError = useCallback(() => {
		setError(null);
	}, []);

	const update = useCallback(async (patch: ResearchPreferencesPatch) => {
		const baseline = snapshotRef.current;
		const normalizedPatch = buildDefaultsPatch(patch, baseline.defaults);
		if (!normalizedPatch) {
			return null;
		}
		setStatus("saving");
		setError(null);
		try {
			const response = await fetch("/api/preferences/research", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ defaults: normalizedPatch }),
			});
			if (!response.ok) {
				const reason = await response.text();
				setStatus("ready");
				setError(reason || `Failed to save research defaults (${response.status}).`);
				throw new Error(reason || "Failed to save research defaults.");
			}
			const payload = await readJson(response);
			const normalized = normalizeSnapshot(payload);
			updateSnapshot(normalized);
			setStatus("ready");
			return normalized;
		} catch (requestError) {
			setStatus("ready");
			const message = requestError instanceof Error ? requestError.message : String(requestError);
			setError(message || "Failed to save research defaults.");
			throw requestError instanceof Error ? requestError : new Error(message);
		}
	}, [updateSnapshot]);

	const reset = useCallback(async () => {
		setStatus("saving");
		setError(null);
		try {
			const response = await fetch("/api/preferences/research/reset", {
				method: "POST",
				credentials: "include",
			});
			if (!response.ok) {
				const reason = await response.text();
				setStatus("ready");
				setError(reason || `Failed to reset research defaults (${response.status}).`);
				throw new Error(reason || "Failed to reset research defaults.");
			}
			const payload = await readJson(response);
			const normalized = normalizeSnapshot(payload);
			updateSnapshot(normalized);
			setStatus("ready");
			return normalized;
		} catch (requestError) {
			setStatus("ready");
			const message = requestError instanceof Error ? requestError.message : String(requestError);
			setError(message || "Failed to reset research defaults.");
			throw requestError instanceof Error ? requestError : new Error(message);
		}
	}, [updateSnapshot]);

	useEffect(() => {
		refresh().catch(() => undefined);
		return () => {
			if (abortRef.current) {
				abortRef.current.abort();
			}
		};
	}, [refresh]);

	const value = useMemo<ResearchPreferencesContextValue>(() => ({
		preferences: snapshot,
		status,
		error,
		refresh,
		update,
		reset,
		dismissError,
	}), [dismissError, error, refresh, reset, snapshot, status, update]);

	return <ResearchPreferencesContext.Provider value={value}>{children}</ResearchPreferencesContext.Provider>;
}

export function useResearchPreferences(): ResearchPreferencesContextValue {
	const context = useContext(ResearchPreferencesContext);
	if (!context) {
		throw new Error("useResearchPreferences must be used within a ResearchPreferencesProvider");
	}
	return context;
}
