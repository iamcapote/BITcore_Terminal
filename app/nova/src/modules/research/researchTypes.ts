/**
 * Why: Declare the research telemetry schema so Nova surfaces can reason about context, payload bounds, and immutable state.
 * What: Shared types, constants, and frozen initial states for research telemetry collections and aggregates.
 * How: Export type aliases and object literals that reducers and providers can compose without duplicating contracts.
 */

export type Nullable<T> = T | null;

export type UnknownRecord = Record<string, unknown>;

export interface ResearchStatusState {
  readonly stage: string;
  readonly message: string;
  readonly detail: Nullable<string>;
  readonly meta: UnknownRecord;
  readonly lastUpdated: Nullable<number>;
}

export interface ResearchProgressState {
  readonly percent: number;
  readonly completed: number;
  readonly total: number;
  readonly status: string;
  readonly currentAction: Nullable<string>;
  readonly depth: Nullable<number>;
  readonly breadth: Nullable<number>;
  readonly etaMs: Nullable<number>;
  readonly lastUpdated: Nullable<number>;
}

export interface ResearchThoughtEntry {
  readonly id: string;
  readonly text: string;
  readonly stage: Nullable<string>;
  readonly source: Nullable<string>;
  readonly meta: UnknownRecord;
  readonly timestamp: Nullable<number>;
}

export interface ResearchSuggestionEntry {
  readonly id: string;
  readonly prompt: string;
  readonly focus: Nullable<string>;
  readonly layer: Nullable<string>;
  readonly tags: readonly string[];
  readonly score: Nullable<number>;
  readonly memoryId: Nullable<string>;
  readonly source: string;
  readonly generatedAt: Nullable<number>;
}

export interface ResearchReportEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly authoredAt: string;
  readonly lastEditedAt: string;
  readonly status: "draft" | "published" | "failed";
  readonly success: boolean;
  readonly durationMs: Nullable<number>;
  readonly learnings: number;
  readonly sources: number;
  readonly suggestedFilename: Nullable<string>;
}

export interface MemoryStatsState {
  readonly stored: number;
  readonly retrieved: number;
  readonly validated: number;
  readonly summarized: number;
  readonly ephemeralCount: number;
  readonly validatedCount: number;
}

export interface MemoryRecordState {
  readonly id: Nullable<string>;
  readonly layer: Nullable<string>;
  readonly preview: string;
  readonly tags: readonly string[];
  readonly source: Nullable<string>;
  readonly score: Nullable<number>;
  readonly timestamp: Nullable<number>;
}

export interface ResearchMemoryState {
  readonly query: Nullable<string>;
  readonly stats: Nullable<MemoryStatsState>;
  readonly records: readonly MemoryRecordState[];
}

export interface GithubEntryState {
  readonly id: string;
  readonly sequence: number;
  readonly level: string;
  readonly message: string;
  readonly timestamp: number;
  readonly action: Nullable<string>;
  readonly meta: UnknownRecord | null;
}

export interface GithubAggregateState {
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly lastMessage: Nullable<string>;
  readonly lastAction: Nullable<string>;
  readonly lastTimestamp: Nullable<number>;
}

export interface GithubState {
  readonly entries: readonly GithubEntryState[];
  readonly aggregate: GithubAggregateState;
}

export interface ResearchSummaryState {
  readonly title: string;
  readonly description: string;
  readonly lead: string;
  readonly lastUpdated: Nullable<number>;
  readonly success: Nullable<boolean>;
  readonly durationMs: Nullable<number>;
  readonly summary: Nullable<string>;
  readonly suggestedFilename: Nullable<string>;
  readonly learnings: number;
  readonly sources: number;
  readonly query: Nullable<string>;
}

export interface ResearchState {
  readonly summary: ResearchSummaryState;
  readonly status: ResearchStatusState;
  readonly progress: ResearchProgressState;
  readonly thoughts: readonly ResearchThoughtEntry[];
  readonly suggestions: readonly ResearchSuggestionEntry[];
  readonly reports: readonly ResearchReportEntry[];
  readonly memory: ResearchMemoryState;
  readonly github: GithubState;
}

export interface ResearchContextValue extends ResearchState {
  readonly reset: () => void;
}

export const MAX_THOUGHTS = 24;
export const MAX_REPORTS = 6;
export const MAX_SUGGESTIONS = 6;
export const MAX_GITHUB_ENTRIES = 40;

export const INITIAL_SUMMARY: ResearchSummaryState = Object.freeze({
  title: "Research telemetry",
  description: "Launch a research run from the terminal to populate live telemetry.",
  lead: "Awaiting live data.",
  lastUpdated: null,
  success: null,
  durationMs: null,
  summary: null,
  suggestedFilename: null,
  learnings: 0,
  sources: 0,
  query: null,
});

export const INITIAL_STATUS: ResearchStatusState = Object.freeze({
  stage: "Idle",
  message: "Waiting for telemetry…",
  detail: null,
  meta: {},
  lastUpdated: null,
});

export const INITIAL_PROGRESS: ResearchProgressState = Object.freeze({
  percent: 0,
  completed: 0,
  total: 0,
  status: "Idle",
  currentAction: null,
  depth: null,
  breadth: null,
  etaMs: null,
  lastUpdated: null,
});

export const INITIAL_MEMORY: ResearchMemoryState = Object.freeze({
  query: null,
  stats: null,
  records: [],
});

export const INITIAL_GITHUB: GithubState = Object.freeze({
  entries: [],
  aggregate: {
    total: 0,
    errors: 0,
    warnings: 0,
    lastMessage: null,
    lastAction: null,
    lastTimestamp: null,
  },
});

export const INITIAL_STATE: ResearchState = Object.freeze({
  summary: INITIAL_SUMMARY,
  status: INITIAL_STATUS,
  progress: INITIAL_PROGRESS,
  thoughts: [],
  suggestions: [],
  reports: [],
  memory: INITIAL_MEMORY,
  github: INITIAL_GITHUB,
});
