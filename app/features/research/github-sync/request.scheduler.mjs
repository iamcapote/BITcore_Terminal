/**
 * Why: Automate polling of GitHub-hosted research requests so operators receive timely work without manual refresh.
 * What: Wraps a cron scheduler around the research request fetcher, orchestrates handler execution, and tracks run metadata.
 * How: Validates cron expressions, schedules ticks via node-cron, serializes fetch/handle cycles with concurrency guards, and records state snapshots for diagnostics.
 * Contract
 *   Inputs:
 *     - options?: {
 *         cronExpression: string;
 *         timezone?: string;
 *         fetcher?: (opts?: object) => Promise<{ requests?: any[] }>;
 *         handler?: (request, ctx) => Promise<any>;
 *         logger?: LoggerLike;
 *         runOnStart?: boolean;
 *         maxRequestsPerTick?: number;
 *         schedule?: (expression, callback, opts) => CronTask;
 *         validate?: (expression: string) => boolean;
 *       }
 *   Outputs:
 *     - Scheduler controls { start, stop, runNow, isRunning, getState }
 *   Error modes:
 *     - Throws RangeError for invalid cron expressions, TypeError for missing fetcher/handler contracts.
 *     - Logs and surfaces handler failures per request without aborting subsequent work.
 *   Performance:
 *     - Each tick fetches up to `maxRequestsPerTick` requests; handler concurrency is sequential to simplify resource usage.
 *   Side effects:
 *     - Uses node-cron timers, invokes fetcher/handler which may perform IO, emits structured logs via provided logger.
 */

import cron from 'node-cron';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const DEFAULT_CRON = '*/15 * * * *';
const DEFAULT_MAX_REQUESTS = Number.POSITIVE_INFINITY;

function defaultSchedule(expression, callback, options) {
  return cron.schedule(expression, callback, options);
}

function defaultValidate(expression) {
  return cron.validate(expression);
}

export async function defaultResearchRequestHandler(request, { logger }) {
  logger?.info?.(`[ResearchRequestScheduler] Received request '${request.id}' (query: ${request.query}).`);
  return { handled: true };
}

export function createResearchRequestScheduler(options = {}) {
  const {
    cronExpression = DEFAULT_CRON,
    timezone = null,
    fetcher,
    handler = defaultResearchRequestHandler,
    logger = noopLogger,
    runOnStart = true,
    maxRequestsPerTick = DEFAULT_MAX_REQUESTS,
    schedule = defaultSchedule,
    validate = defaultValidate
  } = options;

  if (typeof handler !== 'function') {
    throw new TypeError('ResearchRequestScheduler requires a request handler function.');
  }
  if (fetcher && typeof fetcher !== 'function') {
    throw new TypeError('ResearchRequestScheduler fetcher must be a function when provided.');
  }

  const effectiveFetcher = fetcher || (() => Promise.resolve({ requests: [] }));

  if (!validate(cronExpression)) {
    throw new RangeError(`Invalid cron expression '${cronExpression}'.`);
  }

  const state = {
    active: false,
    running: false,
    lastRunStartedAt: null,
    lastRunFinishedAt: null,
    lastRunTrigger: null,
    lastRunError: null,
    lastRunSummary: null,
    totalRuns: 0,
    totalErrors: 0,
    totalRequestsHandled: 0
  };

  let task = null;

  function snapshot() {
    return Object.freeze({
      ...state,
      active: Boolean(task),
      nextRun: null // node-cron does not expose next run time
    });
  }

  async function run(trigger = 'manual') {
    if (state.running) {
      logger?.debug?.('[ResearchRequestScheduler] Tick skipped because a previous run is still in progress.');
      return { skipped: true, reason: 'already-running' };
    }

    state.running = true;
    state.lastRunTrigger = trigger;
    state.lastRunStartedAt = new Date().toISOString();
    state.lastRunError = null;

    const boundedMax = Number.isFinite(maxRequestsPerTick) && maxRequestsPerTick > 0
      ? Math.trunc(maxRequestsPerTick)
      : DEFAULT_MAX_REQUESTS;

    try {
      const fetchResult = await effectiveFetcher({ limit: boundedMax, logger });
      const requests = Array.isArray(fetchResult?.requests) ? fetchResult.requests : [];
      const summaries = [];
      let handledCount = 0;
      let failedCount = 0;

      for (const request of requests) {
        try {
          const result = await handler(request, {
            logger,
            trigger,
            startedAt: state.lastRunStartedAt
          });
          summaries.push({ id: request.id, status: 'handled', result: result ?? null });
          handledCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
          summaries.push({ id: request?.id ?? 'unknown', status: 'error', error: message });
          failedCount += 1;
          state.totalErrors += 1;
          logger?.error?.(`[ResearchRequestScheduler] Handler failed for '${request?.id ?? 'unknown'}': ${message}`);
        }
      }

      state.totalRuns += 1;
      state.totalRequestsHandled += handledCount;
      state.lastRunSummary = Object.freeze({
        total: requests.length,
        handled: handledCount,
        failed: failedCount,
        trigger,
        completedAt: null
      });

      return {
        success: true,
        requests: summaries,
        total: requests.length,
        handled: handledCount,
        failed: failedCount
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      state.totalRuns += 1;
      state.totalErrors += 1;
      state.lastRunError = message;
      state.lastRunSummary = Object.freeze({
        total: 0,
        handled: 0,
        failed: 0,
        trigger,
        error: message,
        completedAt: null
      });
      logger?.error?.(`[ResearchRequestScheduler] Tick failed: ${message}`);
      return { success: false, error: message };
    } finally {
      state.lastRunFinishedAt = new Date().toISOString();
      if (state.lastRunSummary) {
        state.lastRunSummary = Object.freeze({
          ...state.lastRunSummary,
          completedAt: state.lastRunFinishedAt
        });
      }
      state.running = false;
    }
  }

  function start() {
    if (task) {
      logger?.debug?.('[ResearchRequestScheduler] Start skipped; task already active.');
      return snapshot();
    }

    const scheduleOptions = {};
    if (timezone) {
      scheduleOptions.timezone = timezone;
    }

    task = schedule(cronExpression, () => {
      run('cron').catch(error => {
        logger?.error?.(`[ResearchRequestScheduler] Cron execution error: ${error?.message || error}`);
      });
    }, scheduleOptions);

    if (!task || typeof task.start !== 'function' || typeof task.stop !== 'function') {
      task = null;
      throw new Error('Scheduler factory must return an object with start/stop methods.');
    }

    task.start();
    state.active = true;

    if (runOnStart) {
      run('startup').catch(error => {
        logger?.error?.(`[ResearchRequestScheduler] Startup fetch failed: ${error?.message || error}`);
      });
    }

    return snapshot();
  }

  function stop() {
    if (task) {
      task.stop();
      task = null;
    }
    state.active = false;
    return snapshot();
  }

  function isRunning() {
    return state.running;
  }

  return Object.freeze({
    start,
    stop,
    runNow: run,
    isRunning,
    getState: snapshot
  });
}
