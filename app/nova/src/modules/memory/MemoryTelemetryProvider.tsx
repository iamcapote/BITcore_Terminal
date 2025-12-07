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
import { useTerminal } from "@/modules/terminal/TerminalContext";
import type { WebCommMessage } from "@/modules/terminal/WebCommClient";
import {
	fetchMemoryStats,
	recallMemory as recallMemoryRequest,
	storeMemory as storeMemoryRequest,
	type AsyncStatus,
	type MemoryRecallPayload,
	type MemoryRecord,
	type MemoryStatsSnapshot,
	type MemoryStorePayload,
	isAbortError,
} from "./memoryClient";

const MAX_ACTIVITY_ENTRIES = 10;
const MAX_TELEMETRY_ENTRIES = 25;
const MAX_RESULT_ENTRIES = 20;

interface MemoryActivityEntry {
	readonly id: string;
	readonly label: string;
	readonly detail: string | null;
	readonly layer: string | null;
	readonly timestamp: number;
}

interface MemoryTelemetryEntry {
	readonly id: string;
	readonly event: string;
	readonly summary: string;
	readonly detail: string | null;
	readonly layer: string | null;
	readonly timestamp: number;
}

interface StoreState {
	readonly status: AsyncStatus;
	readonly error: string | null;
	readonly lastRecord: MemoryRecord | null;
	readonly lastSuccessAt: number | null;
}

interface RecallState {
	readonly status: AsyncStatus;
	readonly error: string | null;
	readonly lastResultsCount: number;
	readonly lastSuccessAt: number | null;
}

interface MemoryTelemetryContextValue {
	readonly stats: MemoryStatsSnapshot | null;
	readonly statsStatus: AsyncStatus;
	readonly statsError: string | null;
	readonly lastUpdatedAt: number | null;
	readonly activity: readonly MemoryActivityEntry[];
	readonly telemetry: readonly MemoryTelemetryEntry[];
	readonly recallResults: readonly MemoryRecord[];
	readonly storeState: StoreState;
	readonly recallState: RecallState;
	readonly refreshStats: () => Promise<void>;
	readonly storeMemory: (payload: MemoryStorePayload) => Promise<MemoryRecord | null>;
	readonly recallMemory: (payload: MemoryRecallPayload) => Promise<MemoryRecord[]>;
	readonly clearResults: () => void;
}

const MemoryTelemetryContext = createContext<MemoryTelemetryContextValue | null>(null);

export function MemoryTelemetryProvider({ children }: PropsWithChildren): JSX.Element {
	const { registerWebCommHandler, connection } = useTerminal();
	const [stats, setStats] = useState<MemoryStatsSnapshot | null>(null);
	const [statsStatus, setStatsStatus] = useState<AsyncStatus>("idle");
	const [statsError, setStatsError] = useState<string | null>(null);
	const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
	const [activity, setActivity] = useState<MemoryActivityEntry[]>([]);
	const [telemetry, setTelemetry] = useState<MemoryTelemetryEntry[]>([]);
	const [recallResults, setRecallResults] = useState<MemoryRecord[]>([]);
	const [storeState, setStoreState] = useState<StoreState>({ status: "idle", error: null, lastRecord: null, lastSuccessAt: null });
	const [recallState, setRecallState] = useState<RecallState>({ status: "idle", error: null, lastResultsCount: 0, lastSuccessAt: null });
	const abortRef = useRef<AbortController | null>(null);
	const connectionRef = useRef(connection.connected);

	const refreshStats = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setStatsStatus("loading");
		setStatsError(null);
		try {
			const snapshot = await fetchMemoryStats({ signal: controller.signal });
			if (controller.signal.aborted) {
				setStatsStatus("idle");
				return;
			}
			setStats(snapshot);
			setStatsStatus("success");
			setLastUpdatedAt(Date.now());
		} catch (error) {
			if (isAbortError(error)) {
				setStatsStatus("idle");
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to load memory stats.";
			setStatsStatus("error");
			setStatsError(message);
		} finally {
			if (abortRef.current === controller) {
				abortRef.current = null;
			}
		}
	}, []);

	const pushActivity = useCallback((entry: Omit<MemoryActivityEntry, "id">) => {
		setActivity((previous) => {
			const next = [{ id: createId(), ...entry }, ...previous];
			return next.slice(0, MAX_ACTIVITY_ENTRIES);
		});
	}, []);

	const pushTelemetry = useCallback((entry: Omit<MemoryTelemetryEntry, "id">) => {
		setTelemetry((previous) => {
			const next = [{ id: createId(), ...entry }, ...previous];
			return next.slice(0, MAX_TELEMETRY_ENTRIES);
		});
	}, []);

	const handleMemoryEvent = useCallback((message: WebCommMessage) => {
		if (!message || message.type !== "memory_event") {
			return;
		}
		const payload = message as Record<string, unknown>;
		const eventName = typeof payload.event === "string" ? payload.event : "";
		if (!eventName) {
			return;
		}
		const layer = typeof payload.layer === "string" ? payload.layer : null;
		const timestamp = resolveTimestamp(payload.timestamp);
		const data = payload.data as Record<string, unknown> | undefined;

		switch (eventName) {
			case "store": {
				const record = data?.record;
				const preview = extractPreview(record);
				const tags = Array.isArray((record as { tags?: unknown })?.tags)
					? ((record as { tags: unknown[] }).tags
						.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
						.slice(0, 4))
					: [];
				const detailParts: string[] = [];
				if (preview) detailParts.push(preview);
				if (tags.length) detailParts.push(tags.map((tag) => `#${tag}`).join(" "));
				pushActivity({
					label: "Memory stored",
					detail: detailParts.join(" • ") || null,
					layer,
					timestamp,
				});
				pushTelemetry({
					event: "store",
					summary: "Memory stored",
					detail: preview ?? "New memory recorded.",
					layer,
					timestamp,
				});
				void refreshStats();
				break;
			}
			case "recall": {
				const query = typeof data?.query === "string" ? data.query : "";
				const count = toPositiveInteger(data?.resultsCount);
				const topRecord = data?.topRecord as Record<string, unknown> | undefined;
				const derivedLayer = typeof topRecord?.layer === "string" ? topRecord.layer : layer;
				const preview = extractPreview(topRecord);
				pushActivity({
					label: "Memory recalled",
					detail: `${query || "Query"} • ${count} result${count === 1 ? "" : "s"}`,
					layer: derivedLayer,
					timestamp,
				});
				pushTelemetry({
					event: "recall",
					summary: query ? `Recall: ${query}` : "Recall executed",
					detail: preview ?? `Retrieved ${count} memories.`,
					layer: derivedLayer,
					timestamp,
				});
				break;
			}
			case "stats": {
				pushTelemetry({
					event: "stats",
					summary: "Stats updated",
					detail: "Memory stats broadcast received.",
					layer,
					timestamp,
				});
				void refreshStats();
				break;
			}
			case "summarize": {
				const success = data?.success !== false;
				pushActivity({
					label: success ? "Memory summarized" : "Memory summary failed",
					detail: null,
					layer,
					timestamp,
				});
				pushTelemetry({
					event: "summarize",
					summary: success ? "Summary completed" : "Summary failed",
					detail: success ? "Memories summarized and finalized." : "Summarize operation failed.",
					layer,
					timestamp,
				});
				if (success) {
					void refreshStats();
				}
				break;
			}
			case "reset": {
				pushActivity({
					label: "Memory cache reset",
					detail: null,
					layer: null,
					timestamp,
				});
				pushTelemetry({
					event: "reset",
					summary: "Memory cache reset",
					detail: "Memory managers reset.",
					layer: null,
					timestamp,
				});
				void refreshStats();
				break;
			}
			default: {
				pushTelemetry({
					event: eventName,
					summary: eventName,
					detail: null,
					layer,
					timestamp,
				});
			}
		}
	}, [pushActivity, pushTelemetry, refreshStats]);

	const handleStoreMemory = useCallback(async (payload: MemoryStorePayload) => {
		setStoreState({ status: "loading", error: null, lastRecord: null, lastSuccessAt: null });
		try {
			const record = await storeMemoryRequest(payload);
			setStoreState({ status: "success", error: null, lastRecord: record, lastSuccessAt: Date.now() });
			setRecallResults((previous) => {
				const next = [record, ...previous.filter((entry) => entry.id !== record.id)];
				return next.slice(0, MAX_RESULT_ENTRIES);
			});
			void refreshStats();
			return record;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to store memory.";
			setStoreState({ status: "error", error: message, lastRecord: null, lastSuccessAt: null });
			return null;
		}
	}, [refreshStats]);

	const handleRecallMemory = useCallback(async (payload: MemoryRecallPayload) => {
		setRecallState({ status: "loading", error: null, lastResultsCount: 0, lastSuccessAt: null });
		try {
			const results = await recallMemoryRequest(payload);
			setRecallResults(results.slice(0, MAX_RESULT_ENTRIES));
			setRecallState({ status: "success", error: null, lastResultsCount: results.length, lastSuccessAt: Date.now() });
			return results;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to recall memories.";
			setRecallState({ status: "error", error: message, lastResultsCount: 0, lastSuccessAt: null });
			return [];
		}
	}, []);

	const clearResults = useCallback(() => {
		setRecallResults([]);
		setRecallState((previous) => ({ ...previous, status: "idle", error: null, lastResultsCount: 0 }));
	}, []);

	useEffect(() => {
		refreshStats().catch(() => undefined);
		return () => {
			abortRef.current?.abort();
		};
	}, [refreshStats]);

	useEffect(() => {
		if (!connectionRef.current && connection.connected) {
			refreshStats().catch(() => undefined);
		}
		connectionRef.current = connection.connected;
	}, [connection.connected, refreshStats]);

	useEffect(() => {
		const dispose = registerWebCommHandler("memory_event", handleMemoryEvent);
		return () => {
			try {
				dispose?.();
			} catch (error) {
				console.warn("[MemoryTelemetryProvider] Failed to release memory_event handler", error);
			}
		};
	}, [handleMemoryEvent, registerWebCommHandler]);

	const value = useMemo<MemoryTelemetryContextValue>(
		() => ({
			stats,
			statsStatus,
			statsError,
			lastUpdatedAt,
			activity,
			telemetry,
			recallResults,
			storeState,
			recallState,
			refreshStats,
			storeMemory: handleStoreMemory,
			recallMemory: handleRecallMemory,
			clearResults,
		}),
		[activity, clearResults, handleRecallMemory, handleStoreMemory, lastUpdatedAt, recallResults, recallState, stats, statsError, statsStatus, storeState, telemetry, refreshStats],
	);

	return <MemoryTelemetryContext.Provider value={value}>{children}</MemoryTelemetryContext.Provider>;
}

export function useMemoryTelemetry(): MemoryTelemetryContextValue {
	const context = useContext(MemoryTelemetryContext);
	if (!context) {
		throw new Error("useMemoryTelemetry must be used within a MemoryTelemetryProvider");
	}
	return context;
}

function resolveTimestamp(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value) {
		const parsed = Date.parse(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return Date.now();
}

function extractPreview(candidate: unknown): string | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}
	const record = candidate as Record<string, unknown>;
	if (typeof record.preview === "string" && record.preview.trim()) {
		return record.preview.trim();
	}
	if (typeof record.content === "string" && record.content.trim()) {
		return record.content.trim();
	}
	return null;
}

function toPositiveInteger(value: unknown): number {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue) || numberValue <= 0) {
		return 0;
	}
	return Math.round(numberValue);
}

function createId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
}

