/**
 * Why: Orchestrate research provider flows for CLI/Web/API entrypoints.
 * What: Exposes high-level async functions for query, learning, and summary operations.
 * How: Delegates to service layer, wires output/error handlers, and enforces contract boundaries.
 * Contract: Inputs are normalized request objects; outputs are frozen result objects. No direct IO.
 */

import { generateQueriesService, generateSummaryService, processResultsService } from './research.providers.service.mjs';

export async function runQueryController(params) {
  return Object.freeze(await generateQueriesService(params));
}

export async function runSummaryController(params) {
  return Object.freeze(await generateSummaryService(params));
}

export async function runProcessResultsController(params) {
  return Object.freeze(await processResultsService(params));
}
