/**
 * Why: Keep reducer logic isolated so provider setup stays readable and telemetry updates remain testable in isolation.
 * What: Redux-style reducer handling research telemetry actions plus exported discriminated union for dispatchers.
 * How: Import shared state contracts, normalize payload data, and return immutable slices for each transition.
 */

import {
  INITIAL_PROGRESS,
  INITIAL_STATE,
  INITIAL_STATUS,
  INITIAL_SUMMARY,
  MAX_GITHUB_ENTRIES,
  MAX_REPORTS,
  MAX_SUGGESTIONS,
  MAX_THOUGHTS,
  type GithubEntryState,
  type MemoryRecordState,
  type Nullable,
  type ResearchReportEntry,
  type ResearchState,
  type ResearchSuggestionEntry,
  type ResearchThoughtEntry,
  type UnknownRecord,
} from "./researchTypes";
import {
  buildGithubState,
  coercePositiveInt,
  createEventId,
  formatStage,
  mergeGithubStats,
  normalizeGithubEntry,
  normalizeMemoryRecord,
  normalizeMemoryStats,
  normalizeSuggestionEntry,
  normalizeTimestamp,
  resolvePercent,
} from "./researchNormalizers";

export type ResearchAction =
  | { readonly type: "RESET"; readonly timestamp: Nullable<number> }
  | { readonly type: "STATUS"; readonly payload: UnknownRecord; readonly timestamp: Nullable<number> }
  | { readonly type: "PROGRESS"; readonly payload: UnknownRecord; readonly timestamp: Nullable<number> }
  | { readonly type: "THOUGHT"; readonly payload: UnknownRecord; readonly timestamp: Nullable<number>; readonly eventId: string }
  | { readonly type: "SUGGESTIONS"; readonly payload: UnknownRecord; readonly timestamp: Nullable<number>; readonly eventId: Nullable<string> }
  | { readonly type: "MEMORY"; readonly payload: UnknownRecord; readonly timestamp: Nullable<number>; readonly eventId: Nullable<string> }
  | { readonly type: "COMPLETE"; readonly payload: UnknownRecord; readonly timestamp: Nullable<number>; readonly eventId: string }
  | { readonly type: "GITHUB_SNAPSHOT"; readonly entries: readonly UnknownRecord[]; readonly timestamp: Nullable<number> }
  | { readonly type: "GITHUB_EVENT"; readonly entry: UnknownRecord; readonly timestamp: Nullable<number> }
  | { readonly type: "GITHUB_STATS"; readonly stats: UnknownRecord; readonly timestamp: Nullable<number> };

export function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
    case "RESET":
      return {
        ...INITIAL_STATE,
        summary: {
          ...INITIAL_SUMMARY,
          lastUpdated: action.timestamp ?? Date.now(),
        },
        status: {
          ...INITIAL_STATUS,
          lastUpdated: action.timestamp ?? Date.now(),
        },
        progress: {
          ...INITIAL_PROGRESS,
          lastUpdated: action.timestamp ?? Date.now(),
        },
      };
    case "STATUS": {
      const stage = formatStage(action.payload.stage);
      const message = typeof action.payload.message === "string" && action.payload.message.trim()
        ? action.payload.message.trim()
        : state.status.message;
      const detail = typeof action.payload.detail === "string" && action.payload.detail.trim()
        ? action.payload.detail.trim()
        : state.status.detail;
      const meta = action.payload.meta && typeof action.payload.meta === "object"
        ? { ...state.status.meta, ...(action.payload.meta as UnknownRecord) }
        : state.status.meta;
      const timestamp = action.timestamp ?? Date.now();
      const query = typeof meta.query === "string" && meta.query.trim() ? meta.query.trim() : state.summary.query;

      return {
        ...state,
        status: {
          stage,
          message,
          detail,
          meta,
          lastUpdated: timestamp,
        },
        summary: {
          ...state.summary,
          title: query ?? state.summary.title,
          query,
          description: message,
          lead: detail ?? state.summary.lead,
          lastUpdated: timestamp,
        },
      };
    }
    case "PROGRESS": {
      const percent = resolvePercent(action.payload);
      const completed = coercePositiveInt(action.payload.completed ?? action.payload.completedQueries) ?? state.progress.completed;
      const total = coercePositiveInt(action.payload.total ?? action.payload.totalQueries) ?? state.progress.total;
      const depth = coercePositiveInt(action.payload.currentDepth ?? action.payload.depth) ?? state.progress.depth;
      const breadth = coercePositiveInt(action.payload.currentBreadth ?? action.payload.breadth) ?? state.progress.breadth;
      const status = typeof action.payload.status === "string" && action.payload.status.trim()
        ? action.payload.status.trim()
        : state.progress.status;
      const currentAction = typeof action.payload.currentAction === "string" && action.payload.currentAction.trim()
        ? action.payload.currentAction.trim()
        : state.progress.currentAction;
      const etaMs = coercePositiveInt(action.payload.etaMs ?? action.payload.etaMilliseconds);
      const timestamp = action.timestamp ?? Date.now();

      return {
        ...state,
        progress: {
          percent,
          completed,
          total,
          status,
          currentAction,
          depth,
          breadth,
          etaMs: typeof etaMs === "number" ? etaMs : state.progress.etaMs,
          lastUpdated: timestamp,
        },
      };
    }
    case "THOUGHT": {
      const text = typeof action.payload.text === "string" && action.payload.text.trim()
        ? action.payload.text.trim()
        : null;
      if (!text) {
        return state;
      }
      const stage = typeof action.payload.stage === "string" && action.payload.stage.trim()
        ? action.payload.stage.trim()
        : null;
      const source = typeof action.payload.source === "string" && action.payload.source.trim()
        ? action.payload.source.trim()
        : null;
      const meta = action.payload.meta && typeof action.payload.meta === "object"
        ? { ...(action.payload.meta as UnknownRecord) }
        : {};
      const timestamp = action.timestamp ?? Date.now();

      const nextThought: ResearchThoughtEntry = {
        id: action.eventId,
        text,
        stage,
        source,
        meta,
        timestamp,
      };
      const merged = [nextThought, ...state.thoughts.filter((thought) => thought.id !== action.eventId)].slice(0, MAX_THOUGHTS);
      return {
        ...state,
        thoughts: merged,
      };
    }
    case "SUGGESTIONS": {
      const source = typeof action.payload.source === "string" && action.payload.source.trim()
        ? action.payload.source.trim()
        : "memory";
      const generatedAt = normalizeTimestamp(action.payload.generatedAt);
      const suggestionsRaw = Array.isArray(action.payload.suggestions)
        ? action.payload.suggestions as UnknownRecord[]
        : Array.isArray(action.payload)
          ? (action.payload as UnknownRecord[])
          : [];

      const baseId = action.eventId ?? createEventId();
      const mapped: ResearchSuggestionEntry[] = suggestionsRaw
        .map((entry, index) => normalizeSuggestionEntry(entry, `${baseId}-${index}`, source, generatedAt))
        .filter((entry): entry is ResearchSuggestionEntry => Boolean(entry))
        .slice(0, MAX_SUGGESTIONS);

      return {
        ...state,
        suggestions: mapped,
      };
    }
    case "MEMORY": {
      const stats = normalizeMemoryStats(action.payload.stats);
      const recordsRaw = Array.isArray(action.payload.records)
        ? action.payload.records as UnknownRecord[]
        : [];
      const records = recordsRaw
        .map(normalizeMemoryRecord)
        .filter((entry): entry is MemoryRecordState => Boolean(entry));
      const query = typeof action.payload.query === "string" && action.payload.query.trim()
        ? action.payload.query.trim()
        : state.memory.query;
      return {
        ...state,
        memory: {
          query,
          stats,
          records,
        },
      };
    }
    case "COMPLETE": {
      const success = action.payload.success !== false;
      const durationMs = coercePositiveInt(action.payload.durationMs);
      const learnings = coercePositiveInt(action.payload.learnings) ?? 0;
      const sources = coercePositiveInt(action.payload.sources) ?? 0;
      const summary = typeof action.payload.summary === "string" && action.payload.summary.trim()
        ? action.payload.summary.trim()
        : (success ? "Research completed successfully." : (typeof action.payload.error === "string" ? action.payload.error.trim() : "Research failed."));
      const suggestedFilename = typeof action.payload.suggestedFilename === "string" && action.payload.suggestedFilename.trim()
        ? action.payload.suggestedFilename.trim()
        : null;
      const timestamp = action.timestamp ?? Date.now();

      const report: ResearchReportEntry = {
        id: action.eventId,
        title: suggestedFilename ?? (state.summary.query ? `Summary: ${state.summary.query}` : "Research summary"),
        summary,
        authoredAt: new Date(timestamp).toISOString(),
        lastEditedAt: new Date(timestamp).toISOString(),
        status: success ? "published" : "failed",
        success,
        durationMs,
        learnings,
        sources,
        suggestedFilename,
      };

      return {
        ...state,
        summary: {
          ...state.summary,
          lastUpdated: timestamp,
          success,
          durationMs,
          summary,
          suggestedFilename,
          learnings,
          sources,
          description: state.summary.description,
          lead: state.summary.lead,
        },
        progress: {
          ...state.progress,
          percent: success ? 100 : state.progress.percent,
          status: success ? "Complete" : "Error",
          lastUpdated: timestamp,
        },
        reports: [report, ...state.reports.filter((entry) => entry.id !== report.id)].slice(0, MAX_REPORTS),
      };
    }
    case "GITHUB_SNAPSHOT": {
      const mapped = (action.entries ?? [])
        .map(normalizeGithubEntry)
        .filter((entry): entry is GithubEntryState => Boolean(entry))
        .slice(-MAX_GITHUB_ENTRIES)
        .reverse();
      return {
        ...state,
        github: buildGithubState(mapped, state.github.aggregate),
      };
    }
    case "GITHUB_EVENT": {
      const entry = normalizeGithubEntry(action.entry);
      if (!entry) {
        return state;
      }
      const merged = [entry, ...state.github.entries.filter((existing) => existing.id !== entry.id)].slice(0, MAX_GITHUB_ENTRIES);
      return {
        ...state,
        github: buildGithubState(merged, state.github.aggregate),
      };
    }
    case "GITHUB_STATS": {
      const aggregate = mergeGithubStats(action.stats, state.github.aggregate);
      return {
        ...state,
        github: {
          entries: state.github.entries,
          aggregate,
        },
      };
    }
    default:
      return state;
  }
}
