/**
 * Why: Provide mission lifecycle controls through the CLI so operators can manage schedules without bespoke tooling.
 * What: Parses `/missions` subcommands, validates feature flags, and delegates execution to mission services and specialized handlers.
 * How: Normalizes CLI inputs, routes to modular command handlers, and wraps errors through the shared CLI error utility for consistent UX.
 * Contract
 *   Inputs:
 *     - options: { action?: string, positionalArgs?: string[], flags?: Record<string, unknown>, json?: boolean }
 *     - wsOutput?: (message: string) => void; defaults to module logger info emitter.
 *     - wsError?: (message: string) => void; defaults to module logger error emitter.
 *   Outputs:
 *     - Resolves to `{ success: boolean, ... }` structures matching legacy behaviour for compatibility with tests and UI bindings.
 *   Error modes:
 *     - Propagates domain errors through `handleCliError`; returns handled objects for user-facing validation issues.
 *   Performance:
 *     - O(1) administration per command aside from delegated controller calls.
 *   Side effects:
 *     - Invokes mission controllers/schedulers and optional GitHub sync flows provided by upstream dependencies.
 */

import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';
import {
  getMissionController,
  getMissionScheduler,
  getMissionTemplatesRepository,
  getMissionConfig,
  getMissionGitHubSyncController
} from '../features/missions/index.mjs';

import {
  isTruthy,
  logJson,
  formatMissionLine,
  describeSchedule,
  parseTags,
  buildScheduleOverrides
} from './missions/helpers.mjs';
import { handleTemplatesCommand } from './missions/templates.handler.mjs';
import { handleSyncCommand } from './missions/sync.handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.missions.cli');

export function getMissionsHelpText() {
  return [
    '/missions list [--status=idle] [--tag=ops] [--include-disabled] [--json]  Display stored missions.',
    '/missions inspect <missionId> [--json]  Show mission details.',
    '/missions run <missionId> [--json]  Force-run a mission immediately.',
    '/missions tick  Trigger the scheduler loop once to process due missions.',
    '/missions status [--json]  Show scheduler runtime state and feature flag status.',
    '/missions start  Enable and start the mission scheduler if allowed.',
    '/missions stop  Stop the mission scheduler loop.',
    '/missions templates [--json]  List available mission templates for scaffolding.',
  '/missions templates show <templateSlug> [--json]  Inspect a template definition.',
  '/missions templates save [<templateSlug>] [--from-file=path.yaml] [--name=] [--priority=] [--tags=] [--interval-minutes=|--cron=] [--timezone=] [--enable=true|false] [--payload="{...}"] [--json]  Create or update a template.',
  '/missions templates delete <templateSlug> [--json]  Remove a template from disk.',
    '/missions scaffold <templateSlug> [--name=] [--tags=tag1,tag2] [--priority=5] [--interval-minutes=60|--cron="*"] [--timezone=UTC] [--dry-run] [--json]  Create a mission from a template.',
    '/missions sync status [--json] [--repo-path=] [--file-path=] [--branch=]  Inspect GitHub sync status.',
    '/missions sync pull [--json] [--repo-path=] [--file-path=] [--branch=]  Load mission manifest from GitHub.',
    '/missions sync push --content="..."|--from-file=path [--json] [--commit-message=] [--strategy=ours|theirs]  Save mission manifest to GitHub.',
    '/missions sync resolve [--strategy=ours|theirs] [--file-path=] [--json]  Resolve merge conflicts for the manifest.'
  ].join('\n');
}

export async function executeMissions(options = {}, wsOutput, wsError) {
  const outputFn = typeof wsOutput === 'function' ? wsOutput : (message) => moduleLogger.info(message);
  const errorFn = typeof wsError === 'function' ? wsError : (message) => moduleLogger.error(message);

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || (positionalArgs.shift()?.toLowerCase()) || 'list';

  const jsonOutput = isTruthy(flags.json ?? options.json);
  const missionConfig = getMissionConfig();
  if (!missionConfig.enabled) {
    const message = 'Mission controls are disabled via feature flag.';
    errorFn(message);
    return { success: false, error: message, handled: true, disabled: true };
  }
  const controller = getMissionController();
  const scheduler = getMissionScheduler();
  const templatesRepository = getMissionTemplatesRepository();
  const githubSyncController = getMissionGitHubSyncController();

  try {
    switch (subcommand) {
      case 'list': {
        const filter = {};
        if (flags.status) {
          filter.status = flags.status;
        }
        if (flags.tag) {
          filter.tag = flags.tag;
        }
        if (flags['include-disabled']) {
          filter.includeDisabled = isTruthy(flags['include-disabled']);
        }
        const missions = await controller.list(filter);
        if (jsonOutput) {
          logJson(outputFn, missions);
        } else if (missions.length === 0) {
          outputFn('No missions found.');
        } else {
          missions.forEach(mission => outputFn(formatMissionLine(mission)));
        }
        return { success: true, missions };
      }

      case 'inspect': {
        const missionId = positionalArgs[0] || flags.id;
        if (!missionId) {
          const message = 'Usage: /missions inspect <missionId>';
          errorFn(message);
          return { success: false, error: message, handled: true };
        }
        const mission = await controller.get(missionId);
        if (!mission) {
          const message = `Mission '${missionId}' not found.`;
          errorFn(message);
          return { success: false, error: message, handled: true };
        }
        if (jsonOutput) {
          logJson(outputFn, mission);
        } else {
          outputFn(`Mission: ${mission.name} (${mission.id})`);
          outputFn(`  Status: ${mission.status}`);
          outputFn(`  Priority: ${mission.priority ?? 0}`);
          outputFn(`  Enabled: ${mission.enable !== false}`);
          outputFn(`  Tags: ${(mission.tags || []).join(', ') || 'none'}`);
          outputFn(`  Schedule: ${mission.schedule ? JSON.stringify(mission.schedule) : 'none'}`);
          outputFn(`  Next Run: ${mission.nextRunAt ?? 'n/a'}`);
          outputFn(`  Last Run: ${mission.lastRunAt ?? 'n/a'}`);
          outputFn(`  Last Finished: ${mission.lastFinishedAt ?? 'n/a'}`);
          if (mission.lastRunError) {
            outputFn(`  Last Error: ${mission.lastRunError}`);
          }
        }
        return { success: true, mission };
      }

      case 'run': {
        const missionId = positionalArgs[0] || flags.id;
        if (!missionId) {
          const message = 'Usage: /missions run <missionId>';
          errorFn(message);
          return { success: false, error: message, handled: true };
        }
        const mission = await controller.get(missionId);
        if (!mission) {
          const message = `Mission '${missionId}' not found.`;
          errorFn(message);
          return { success: false, error: message, handled: true };
        }
        const result = await scheduler.runMission(mission, { forced: true });
        if (jsonOutput) {
          logJson(outputFn, result);
        } else if (result.skipped) {
          outputFn(`Mission ${missionId} skipped: ${result.reason}`);
        } else if (result.success) {
          outputFn(`Mission ${missionId} completed successfully.`);
        } else {
          outputFn(`Mission ${missionId} failed: ${result.error ?? 'Unknown error'}`);
        }
        return { success: !result.skipped && result.success !== false, result };
      }

      case 'tick': {
        if (!missionConfig.schedulerEnabled) {
          const message = 'Scheduler tick disabled: mission scheduler feature flag is off.';
          errorFn(message);
          return { success: false, error: message, handled: true, disabled: true };
        }
        await scheduler.trigger();
        outputFn('Mission scheduler tick executed.');
        return { success: true };
      }

      case 'status': {
        const state = typeof scheduler.getState === 'function'
          ? scheduler.getState()
          : { running: scheduler.isRunning?.() ?? false };
        const payload = {
          featureEnabled: missionConfig.enabled,
          schedulerEnabled: missionConfig.schedulerEnabled,
          telemetryEnabled: missionConfig.telemetryEnabled,
          state
        };
        if (jsonOutput) {
          logJson(outputFn, payload);
        } else {
          outputFn(`Scheduler feature: ${missionConfig.schedulerEnabled ? 'enabled' : 'disabled'}`);
          outputFn(`Scheduler running: ${state.running ? 'yes' : 'no'}`);
          if (state.lastTickStartedAt) {
            outputFn(`Last tick started: ${state.lastTickStartedAt}`);
          }
          if (state.lastTickCompletedAt) {
            outputFn(`Last tick completed: ${state.lastTickCompletedAt}`);
          }
          if (Number.isFinite(state.lastTickDurationMs)) {
            outputFn(`Last tick duration: ${state.lastTickDurationMs}ms`);
          }
          if (Number.isFinite(state.lastTickEvaluated)) {
            outputFn(`Missions evaluated last tick: ${state.lastTickEvaluated}`);
          }
          if (Number.isFinite(state.lastTickLaunched)) {
            outputFn(`Missions launched last tick: ${state.lastTickLaunched}`);
          }
          if (state.lastTickError) {
            outputFn(`Last tick error: ${state.lastTickError}`);
          }
          if (state.lastPersistedAt) {
            const reasonInfo = state.lastPersistReason ? ` (reason=${state.lastPersistReason})` : '';
            outputFn(`Last state persisted: ${state.lastPersistedAt}${reasonInfo}`);
          }
        }
        return { success: true, payload };
      }

      case 'start': {
        if (!missionConfig.schedulerEnabled) {
          const message = 'Mission scheduler start blocked by feature flag.';
          errorFn(message);
          return { success: false, error: message, handled: true, disabled: true };
        }
        scheduler.start();
        outputFn('Mission scheduler started.');
        return { success: true };
      }

      case 'stop': {
        if (!missionConfig.schedulerEnabled) {
          const message = 'Mission scheduler stop blocked by feature flag.';
          errorFn(message);
          return { success: false, error: message, handled: true, disabled: true };
        }
        scheduler.stop();
        outputFn('Mission scheduler stopped.');
        return { success: true };
      }

      case 'templates': {
        const result = await handleTemplatesCommand({
          positionalArgs,
          flags,
          jsonOutput,
          outputFn,
          errorFn,
          templatesRepository
        });
        return result;
      }

      case 'scaffold': {
        const slug = positionalArgs[0] || flags.slug;
        if (!slug) {
          const message = 'Usage: /missions scaffold <templateSlug> [overrides]';
          errorFn(message);
          return { success: false, error: message, handled: true };
        }

        let overrideSchedule;
        try {
          overrideSchedule = buildScheduleOverrides(flags);
        } catch (error) {
          errorFn(error.message);
          return { success: false, error: error.message, handled: true };
        }

        let overrides;
        try {
          let priorityOverride;
          if (flags.priority != null) {
            const parsedPriority = Number(flags.priority);
            if (!Number.isFinite(parsedPriority)) {
              throw new Error('--priority must be a number when provided.');
            }
            priorityOverride = parsedPriority;
          }

          overrides = {
            name: flags.name,
            description: flags.description,
            priority: priorityOverride,
            tags: parseTags(flags.tags),
            enable: flags.enable,
            payload: flags.payload,
            schedule: overrideSchedule && Object.keys(overrideSchedule).length ? overrideSchedule : undefined
          };
        } catch (error) {
          errorFn(error.message);
          return { success: false, error: error.message, handled: true };
        }

        let draft;
        try {
          draft = await templatesRepository.createDraftFromTemplate(slug, overrides);
        } catch (error) {
          errorFn(error.message);
          return { success: false, error: error.message, handled: true };
        }

        const dryRun = isTruthy(flags['dry-run']);
        if (dryRun) {
          if (jsonOutput) {
            logJson(outputFn, draft);
          } else {
            outputFn(`Draft ready from template '${slug}':`);
            outputFn(`  Name: ${draft.name}`);
            outputFn(`  Priority: ${draft.priority}`);
            outputFn(`  Tags: ${draft.tags.join(', ') || 'none'}`);
            outputFn(`  Schedule: ${JSON.stringify(draft.schedule)}`);
            if (draft.description) {
              outputFn(`  Description: ${draft.description}`);
            }
          }
          return { success: true, draft, created: false };
        }

        let mission;
        try {
          mission = await controller.create(draft);
        } catch (error) {
          errorFn(error.message);
          return { success: false, error: error.message, handled: true };
        }
        if (jsonOutput) {
          logJson(outputFn, mission);
        } else {
          outputFn(`Created mission ${mission.id} from template '${slug}'.`);
        }
        return { success: true, mission };
      }

      case 'sync': {
        if (!missionConfig.github?.enabled) {
          const message = 'Mission GitHub sync is disabled via configuration.';
          errorFn(message);
          return { success: false, error: message, handled: true, disabled: true };
        }

        const result = await handleSyncCommand({
          positionalArgs,
          flags,
          jsonOutput,
          outputFn,
          errorFn,
          githubSyncController
        });
        return result;
      }

      default: {
        const message = `Unknown missions action: ${subcommand}. See /missions help for supported subcommands.`;
        errorFn(message);
        return { success: false, error: message, handled: true };
      }
    }
  } catch (error) {
    const handled = handleCliError(
      error,
      ErrorTypes.UNKNOWN,
      { command: `missions ${subcommand}` },
      errorFn
    );
    return { ...handled, handled: true };
  }
}

