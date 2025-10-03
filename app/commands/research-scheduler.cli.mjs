/**
 * Why: Surface operational controls for the GitHub-backed research request scheduler to CLI and Web terminals.
 * What: Implements `/research-scheduler` subcommands (status, run, start, stop) so operators can introspect and manage the cron worker.
 * How: Reads scheduler configuration, resolves the shared scheduler instance, executes the requested action, and prints structured feedback.
 * Contract
 *   Inputs:
 *     - options?: {
 *         positionalArgs?: string[];
 *         output?: (line: string) => void;
 *         error?: (line: string) => void;
 *       }
 *   Outputs:
 *     - Promise<{ success: boolean; action: string; state?: object; message?: string; skipped?: boolean; reason?: string }>
 *   Error modes:
 *     - Returns { success: false, message } when scheduler interaction fails or an unknown action is provided.
 * Performance:
 *     - Lightweight; delegates to scheduler instance without spawning additional cron tasks when only inspecting state.
 * Side effects:
 *     - May start/stop the global scheduler or trigger an immediate polling cycle.
 */

import {
  getResearchRequestScheduler,
  getResearchSchedulerConfig
} from '../features/research/github-sync/index.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const VALID_ACTIONS = new Set(['status', 'run', 'start', 'stop']);

const moduleLogger = createModuleLogger('commands.research-scheduler.cli', { emitToStdStreams: false });

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
    moduleLogger[level](message, payloadMeta);
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

function formatState(state, config) {
  const lines = [];
  lines.push(`[Scheduler] Enabled via config: ${config.enabled ? 'yes' : 'no'}`);
  lines.push(`[Scheduler] Active: ${state.active ? 'yes' : 'no'}`);
  lines.push(`[Scheduler] Running: ${state.running ? 'yes' : 'no'}`);
  lines.push(`[Scheduler] Cron: ${config.cron}${config.timezone ? ` (${config.timezone})` : ''}`);
  lines.push(`[Scheduler] Last run trigger: ${state.lastRunTrigger || 'never'}`);
  lines.push(`[Scheduler] Last run started: ${state.lastRunStartedAt || 'never'}`);
  lines.push(`[Scheduler] Last run finished: ${state.lastRunFinishedAt || 'never'}`);
  if (state.lastRunSummary) {
    const summary = state.lastRunSummary;
    lines.push(`[Scheduler] Last summary: total=${summary.total} handled=${summary.handled} failed=${summary.failed}`);
  }
  if (state.lastRunError) {
    lines.push(`[Scheduler] Last error: ${state.lastRunError}`);
  }
  lines.push(`[Scheduler] Total runs: ${state.totalRuns}`);
  lines.push(`[Scheduler] Total handled: ${state.totalRequestsHandled}`);
  lines.push(`[Scheduler] Total errors: ${state.totalErrors}`);
  return lines;
}

export async function executeResearchScheduler(options = {}) {
  const {
    positionalArgs = [],
    output,
    error: errorOutput
  } = options;

  const outputFn = createEmitter(output, 'info');
  const errorFn = createEmitter(errorOutput, 'error');

  const rawAction = positionalArgs[0] ? String(positionalArgs[0]).toLowerCase() : 'status';
  if (!VALID_ACTIONS.has(rawAction)) {
    const message = `Unknown action '${rawAction}'. Use one of: status, run, start, stop.`;
    errorFn(message, { code: 'unknown_research_scheduler_action', action: rawAction });
    moduleLogger.warn('Research scheduler command received unknown action.', { action: rawAction });
    return { success: false, action: rawAction, message };
  }

  const config = getResearchSchedulerConfig();
  let scheduler;
  try {
    scheduler = getResearchRequestScheduler({ logger: moduleLogger });
  } catch (err) {
    const message = `Failed to resolve research scheduler: ${err.message}`;
    errorFn(message, { action: rawAction, stage: 'resolve_scheduler' });
    moduleLogger.error('Failed to resolve research scheduler.', {
      action: rawAction,
      message: err.message,
      stack: err.stack || null
    });
    return { success: false, action: rawAction, message };
  }

  moduleLogger.info('Executing research scheduler command.', {
    action: rawAction,
    hasPositionalArgs: positionalArgs.length > 0
  });

  try {
    switch (rawAction) {
      case 'status': {
        const state = scheduler.getState();
        for (const line of formatState(state, config)) {
          outputFn(line, { action: 'status' });
        }
        moduleLogger.info('Research scheduler status reported.', {
          action: 'status',
          active: state.active,
          running: state.running,
          lastRunFinishedAt: state.lastRunFinishedAt || null
        });
        return { success: true, action: 'status', state };
      }
      case 'run': {
        const result = await scheduler.runNow?.('manual');
        if (result?.skipped) {
          outputFn(`[Scheduler] Run skipped: ${result.reason}`, {
            action: 'run',
            skipped: true,
            reason: result.reason
          });
          moduleLogger.info('Research scheduler manual run skipped.', {
            action: 'run',
            reason: result.reason
          });
          return { success: true, action: 'run', skipped: true, reason: result.reason };
        }
        outputFn(`[Scheduler] Manual run complete. handled=${result?.handled ?? 0} failed=${result?.failed ?? 0}`, {
          action: 'run',
          handled: result?.handled ?? 0,
          failed: result?.failed ?? 0
        });
        moduleLogger.info('Research scheduler manual run completed.', {
          action: 'run',
          handled: result?.handled ?? 0,
          failed: result?.failed ?? 0,
          success: result?.success !== false
        });
        return { success: Boolean(result?.success !== false), action: 'run', state: scheduler.getState(), result };
      }
      case 'start': {
        const state = scheduler.start();
        outputFn('[Scheduler] Cron worker started.', { action: 'start' });
        if (config.runOnStart !== false) {
          outputFn('[Scheduler] Startup run may still be in progress; check /research-scheduler status for details.', {
            action: 'start',
            runOnStart: true
          });
        }
        moduleLogger.info('Research scheduler started.', {
          action: 'start',
          runOnStart: config.runOnStart !== false,
          state: {
            active: state?.active ?? null,
            running: state?.running ?? null
          }
        });
        return { success: true, action: 'start', state };
      }
      case 'stop': {
        const state = scheduler.stop();
        outputFn('[Scheduler] Cron worker stopped.', { action: 'stop' });
        moduleLogger.warn('Research scheduler stopped.', {
          action: 'stop',
          state: {
            active: state?.active ?? null,
            running: state?.running ?? null
          }
        });
        return { success: true, action: 'stop', state };
      }
      default:
        throw new Error(`Unhandled action '${rawAction}'`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorFn(`[Scheduler] Action '${rawAction}' failed: ${message}`, {
      action: rawAction,
      message
    });
    moduleLogger.error('Research scheduler command failed.', {
      action: rawAction,
      message,
      stack: err instanceof Error ? err.stack : null
    });
    return { success: false, action: rawAction, message };
  }
}

export function getResearchSchedulerHelpText() {
  return [
    '/research-scheduler <action>',
    '  Manage the GitHub research request scheduler.',
    '  Actions:',
    '    status – show scheduler status and last run summary (default).',
    '    run    – trigger an immediate polling run.',
    '    start  – start the cron worker using configured cadence.',
    '    stop   – stop the cron worker.'
  ].join('\n');
}
