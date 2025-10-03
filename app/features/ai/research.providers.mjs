/**
 * Why: Preserve the legacy research provider entry point while the logic decomposes into dedicated modules.
 * What: Re-exports service-layer implementations and shared utilities so existing imports keep working without rewrites.
 * How: Aggregates named exports from the service and utility modules without mutating behaviour or state.
 */

export {
  generateOutput,
  generateQueries,
  processResults,
  generateSummary,
  generateQueriesLLM,
  generateSummaryLLM,
  processResultsLLM
} from './research.providers.service.mjs';

export { trimPrompt } from './research.providers.utils.mjs';
