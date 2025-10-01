/**
 * Why: Keep the public research helpers under a single import path while the implementation lives in focused modules.
 * What: Re-exports query generation, research start, and exit handlers for chat flows.
 * How: Delegates to lightweight modules in `./research/` to satisfy the AGENTS file-size guidance.
 */

export { generateResearchQueries, generateResearchQueriesFromContext } from './research/queries.mjs';
export { startResearchFromChat } from './research/start.mjs';
export { executeExitResearch } from './research/exit.mjs';
