/**
 * Why: Track research telemetry so console surfaces, dashboards, and future mission control share a consistent data feed.
 * What: Maintains status, stage, progress, depth, breadth, and token usage samples with helpers to mutate state safely.
 * How: Uses a Zustand store with guard helpers to normalize inputs and clamp numeric ranges while exposing snapshot accessors.
 */

import { create } from 'zustand';

export type ResearchStage = 'planning' | 'executing' | 'synthesizing' | 'complete';
export type ResearchStatus = 'idle' | 'running' | 'complete' | 'error';

export interface TokenUsageSample {
  timestamp: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export interface ResearchTelemetryState {
  status: ResearchStatus;
  stage: ResearchStage;
  progress: number;
  depth: number;
  breadth: number;
  lastUpdated: number | null;
  tokenUsage: TokenUsageSample[];
  message?: string;
}

export interface ResearchTelemetryActions {
  start: (options?: { depth?: number; breadth?: number }) => void;
  updateStage: (stage: ResearchStage) => void;
  updateProgress: (value: number) => void;
  recordTokenUsage: (sample: TokenUsageSample) => void;
  complete: (message?: string) => void;
  fail: (message: string) => void;
  reset: () => void;
}

export type ResearchTelemetryStore = ResearchTelemetryState & ResearchTelemetryActions;

const STAGE_ORDER: ResearchStage[] = ['planning', 'executing', 'synthesizing', 'complete'];
const SAMPLE_LIMIT = 20;

const INITIAL_STATE: ResearchTelemetryState = Object.freeze({
  status: 'idle',
  stage: 'planning',
  progress: 0,
  depth: 1,
  breadth: 1,
  lastUpdated: null,
  tokenUsage: [],
  message: undefined
});

function clampProgress(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeStage(stage: ResearchStage): ResearchStage {
  return STAGE_ORDER.includes(stage) ? stage : 'planning';
}

export const useResearchTelemetryStore = create<ResearchTelemetryStore>((set) => ({
  ...INITIAL_STATE,
  start: (options) =>
    set((state) => ({
      status: 'running',
      stage: 'planning',
      progress: 0,
      depth: options?.depth ?? state.depth,
      breadth: options?.breadth ?? state.breadth,
      lastUpdated: Date.now(),
      tokenUsage: [],
      message: undefined
    })),
  updateStage: (stage) =>
    set({
      stage: normalizeStage(stage),
      status: stage === 'complete' ? 'complete' : 'running',
      lastUpdated: Date.now()
    }),
  updateProgress: (value) =>
    set({
      progress: clampProgress(value),
      lastUpdated: Date.now(),
      status: value >= 100 ? 'complete' : 'running'
    }),
  recordTokenUsage: (sample) =>
    set(({ tokenUsage }) => {
      const normalized: TokenUsageSample = {
        timestamp: sample.timestamp ?? Date.now(),
        totalTokens: Math.max(0, Math.round(sample.totalTokens)),
        promptTokens: Math.max(0, Math.round(sample.promptTokens)),
        completionTokens: Math.max(0, Math.round(sample.completionTokens))
      };

      const trimmed = [...tokenUsage, normalized].slice(-SAMPLE_LIMIT);
      return {
        tokenUsage: trimmed,
        lastUpdated: normalized.timestamp
      };
    }),
  complete: (message) =>
    set({
      status: 'complete',
      stage: 'complete',
      progress: 100,
      lastUpdated: Date.now(),
      message
    }),
  fail: (message) =>
    set({
      status: 'error',
      message,
      lastUpdated: Date.now()
    }),
  reset: () => set({ ...INITIAL_STATE })
}));

export function getResearchTelemetrySnapshot(): ResearchTelemetryState {
  const { status, stage, progress, depth, breadth, lastUpdated, tokenUsage, message } = useResearchTelemetryStore.getState();
  return {
    status,
    stage,
    progress,
    depth,
    breadth,
    lastUpdated,
    tokenUsage: [...tokenUsage],
    message
  };
}

export function getStageOrder(): ResearchStage[] {
  return [...STAGE_ORDER];
}
