/**
 * Why: Provide Nova surfaces with live research telemetry mirroring the legacy dashboard so operators can monitor runs without mocks.
 * What: React context that consumes WebComm events, tracks status/progress/memory feeds, aggregates GitHub activity, and exposes normalized state.
 * How: Subscribes to research-* and github-activity* WebSocket messages via TerminalProvider, delegates updates to the reducer, and offers memoized selectors.
 * Contract
 * Inputs:
 *   - Requires TerminalProvider ancestry to supply `registerWebCommHandler`.
 *   - Consumes WebComm events: research_start, research-status, research-progress, research-thought,
 *     research-memory, research-suggestions, research-complete, github-activity:snapshot/event/stats/error.
 * Outputs:
 *   - Context value with `{ summary, status, progress, thoughts, suggestions, reports, memory, github, reset }`.
 * Error modes:
 *   - Swallows malformed payloads with console.warn diagnostics; keeps previous state.
 * Performance:
 *   - Reducer updates are O(1); lists bounded (thoughts ≤ 24, reports ≤ 6, GitHub entries ≤ 40).
 */

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	type PropsWithChildren,
} from "react";
import { useTerminal } from "@/modules/terminal/TerminalContext";
import {
	INITIAL_STATE,
	MAX_THOUGHTS,
	type Nullable,
	type ResearchContextValue,
	type UnknownRecord,
} from "./researchTypes";
import { researchReducer } from "./researchReducer";
import {
	createEventId,
	isDuplicateThought,
	normalizeTimestamp,
	resetThoughtRegistry,
} from "./researchNormalizers";

const THOUGHT_REGISTRY_MAX = MAX_THOUGHTS * 10;

const ResearchContext = createContext<ResearchContextValue | null>(null);

export function ResearchProvider({ children }: PropsWithChildren): JSX.Element {
	const { registerWebCommHandler } = useTerminal();
	const [state, dispatch] = useReducer(researchReducer, INITIAL_STATE);
	const thoughtRegistryRef = useRef<{ seen: Set<string>; order: string[] }>({ seen: new Set(), order: [] });

	useEffect(() => {
		const disposers: Array<() => void> = [];

		const safeRegister = (eventType: string, handler: (message: UnknownRecord) => void) => {
			try {
				const dispose = registerWebCommHandler(eventType, handler);
				if (typeof dispose === "function") {
					disposers.push(dispose);
				}
			} catch (error) {
				console.warn(`[ResearchProvider] Failed to register handler for ${eventType}:`, error);
			}
		};

		safeRegister("research_start", (message) => {
			const { timestamp } = unwrapMessage(message);
			resetThoughtRegistry(thoughtRegistryRef.current);
			dispatch({ type: "RESET", timestamp });
		});

		safeRegister("research-status", (message) => {
			const { payload, timestamp } = unwrapMessage(message);
			dispatch({ type: "STATUS", payload, timestamp });
		});

		safeRegister("research-progress", (message) => {
			const { payload, timestamp } = unwrapMessage(message);
			dispatch({ type: "PROGRESS", payload, timestamp });
		});

		safeRegister("research-thought", (message) => {
			const { payload, timestamp, eventId } = unwrapMessage(message);
			const resolvedId = eventId ?? createEventId();
			if (isDuplicateThought(thoughtRegistryRef.current, resolvedId, THOUGHT_REGISTRY_MAX)) {
				return;
			}
			dispatch({ type: "THOUGHT", payload, timestamp, eventId: resolvedId });
		});

		safeRegister("research-memory", (message) => {
			const { payload, timestamp, eventId } = unwrapMessage(message);
			dispatch({ type: "MEMORY", payload, timestamp, eventId });
		});

		safeRegister("research-suggestions", (message) => {
			const { payload, timestamp, eventId } = unwrapMessage(message);
			dispatch({ type: "SUGGESTIONS", payload, timestamp, eventId });
		});

		safeRegister("research-complete", (message) => {
			const { payload, timestamp, eventId } = unwrapMessage(message);
			const resolvedId = eventId ?? createEventId();
			dispatch({ type: "COMPLETE", payload, timestamp, eventId: resolvedId });
		});

		safeRegister("github-activity:snapshot", (message) => {
			const payload = unwrapMessage(message);
			const entries = Array.isArray((payload.payload as UnknownRecord)?.entries)
				? ((payload.payload as UnknownRecord).entries as UnknownRecord[])
				: Array.isArray(payload.payload)
					? (payload.payload as UnknownRecord[])
					: [];
			dispatch({ type: "GITHUB_SNAPSHOT", entries, timestamp: payload.timestamp });
		});

		safeRegister("github-activity:event", (message) => {
			const { payload, timestamp } = unwrapMessage(message);
			const entry = (payload.entry ?? payload) as UnknownRecord;
			dispatch({ type: "GITHUB_EVENT", entry, timestamp });
		});

		safeRegister("github-activity:stats", (message) => {
			const { payload, timestamp } = unwrapMessage(message);
			const stats = (payload.stats ?? payload) as UnknownRecord;
			dispatch({ type: "GITHUB_STATS", stats, timestamp });
		});

		safeRegister("github-activity:error", (message) => {
			const { payload, timestamp } = unwrapMessage(message);
			const entry: UnknownRecord = {
				level: "error",
				message: typeof payload.error === "string" ? payload.error : "GitHub activity error",
				timestamp,
				meta: payload,
			};
			dispatch({ type: "GITHUB_EVENT", entry, timestamp });
		});

		safeRegister("github-activity", (message) => {
			const { payload, timestamp } = unwrapMessage(message);
			dispatch({ type: "GITHUB_EVENT", entry: payload, timestamp });
		});

		safeRegister("github-activity-snapshot", (message) => {
			const payload = unwrapMessage(message);
			const entries = Array.isArray((payload.payload as UnknownRecord)?.activities)
				? ((payload.payload as UnknownRecord).activities as UnknownRecord[])
				: Array.isArray((payload.payload as UnknownRecord)?.data)
					? ((payload.payload as UnknownRecord).data as UnknownRecord[])
					: [];
			if (entries.length) {
				dispatch({ type: "GITHUB_SNAPSHOT", entries, timestamp: payload.timestamp });
			}
		});

		return () => {
			disposers.forEach((dispose) => {
				try {
					dispose();
				} catch (error) {
					console.warn("[ResearchProvider] Failed to dispose handler", error);
				}
			});
			resetThoughtRegistry(thoughtRegistryRef.current);
		};
	}, [registerWebCommHandler]);

	const value = useMemo<ResearchContextValue>(() => ({
		...state,
		reset: () => {
			dispatch({ type: "RESET", timestamp: Date.now() });
		},
	}), [state]);

	return <ResearchContext.Provider value={value}>{children}</ResearchContext.Provider>;
}

export function useResearch(): ResearchContextValue {
	const context = useContext(ResearchContext);
	if (!context) {
		throw new Error("useResearch must be used within a ResearchProvider");
	}
	return context;
}

function unwrapMessage(raw: UnknownRecord): { readonly payload: UnknownRecord; readonly timestamp: Nullable<number>; readonly eventId: Nullable<string> } {
	const payload = (raw?.data ?? raw) as UnknownRecord;
	const timestamp = normalizeTimestamp((payload.timestamp ?? raw.timestamp) as unknown);
	const eventId = typeof payload.eventId === "string" && payload.eventId
		? payload.eventId
		: (typeof raw.eventId === "string" ? raw.eventId : null);
	return { payload, timestamp, eventId };
}
