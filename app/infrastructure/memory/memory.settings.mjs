/**
 * Why: Centralize memory-depth presets so orchestrators share a single source of truth.
 * What: Exports supported depth identifiers alongside their thresholds and limits.
 * How: Provides frozen configuration objects consumed by validators and managers.
 */

export const MEMORY_DEPTHS = Object.freeze({
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
});

export const MEMORY_SETTINGS = Object.freeze({
  [MEMORY_DEPTHS.SHORT]: { maxMemories: 10, retrievalLimit: 2, threshold: 0.7, summarizeEvery: 10 },
  [MEMORY_DEPTHS.MEDIUM]: { maxMemories: 50, retrievalLimit: 5, threshold: 0.5, summarizeEvery: 20 },
  [MEMORY_DEPTHS.LONG]: { maxMemories: 100, retrievalLimit: 8, threshold: 0.3, summarizeEvery: 30 }
});
