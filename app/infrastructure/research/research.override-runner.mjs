/**
 * Why: Separate the override query execution loop from the research engine for clarity and reuse.
 * What: Sequentially runs override queries through a supplied `ResearchPath` instance, aggregating learnings and sources.
 * How: Validates each query object, invokes `pathInstance.research`, emits optional telemetry/status events, and deduplicates outputs.
 * Contract
 * Inputs:
 *   - params: {
 *       overrideQueries: Array<{ original: string; metadata?: any }>;
 *       pathInstance: { research: (input: { query: object; depth: number; breadth: number }) => Promise<{ learnings?: string[]; sources?: string[] }> };
 *       depth: number;
 *       breadth: number;
 *       log?: (line: string) => void;
 *       emitStatus?: (payload: any) => void;
 *       emitThought?: (payload: any) => void;
 *     }
 * Outputs:
 *   - Promise<{ learnings: string[]; sources: string[] }> with duplicates removed.
 * Error modes:
 *   - Propagates errors from `pathInstance.research` to let callers decide how to handle failures.
 * Performance:
 *   - Sequential execution; O(n) over overrideQueries.
 * Side effects:
 *   - Invokes logging/telemetry callbacks as provided.
 */

const noop = () => {};

export async function runOverrideQueries(params) {
  const {
    overrideQueries,
    pathInstance,
    depth,
    breadth,
    log = noop,
    emitStatus = noop,
    emitThought = noop
  } = params || {};

  if (!Array.isArray(overrideQueries) || overrideQueries.length === 0) {
    return { learnings: [], sources: [] };
  }
  if (!pathInstance?.research) {
    throw new Error('runOverrideQueries requires a pathInstance with a research method.');
  }

  const aggregatedLearnings = [];
  const aggregatedSources = new Set();

  for (let index = 0; index < overrideQueries.length; index += 1) {
    const queryObj = overrideQueries[index];
    const humanIndex = index + 1;

    if (!queryObj || typeof queryObj.original !== 'string') {
      log(`[override-runner] Skipping invalid override query at index ${index}: ${JSON.stringify(queryObj)}`);
      continue; // eslint-disable-line no-continue
    }

    log(`[override-runner] Processing override query ${humanIndex}/${overrideQueries.length}: "${queryObj.original}"`);
    emitThought({
      text: `Override query ${humanIndex}: ${queryObj.original}`,
      stage: 'engine-override',
      meta: { index: humanIndex, total: overrideQueries.length }
    });

    const pathResult = await pathInstance.research({
      query: queryObj,
      depth,
      breadth
    });

    (pathResult.learnings || []).forEach((item) => aggregatedLearnings.push(item));
    (pathResult.sources || []).forEach((item) => aggregatedSources.add(item));

    emitStatus({
      stage: 'engine-override',
      message: `Completed override query ${humanIndex} of ${overrideQueries.length}.`
    });
  }

  return {
    learnings: Array.from(new Set(aggregatedLearnings)),
    sources: Array.from(aggregatedSources)
  };
}
