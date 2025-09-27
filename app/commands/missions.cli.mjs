/**
 * Mission CLI entrypoints expose lightweight operational controls for mission
 * scheduling without coupling callers to internal services.
 */

import fs from 'fs/promises';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';
import {
  getMissionController,
  getMissionScheduler,
  getMissionTemplatesRepository,
  getMissionConfig,
  getMissionGitHubSyncController
} from '../features/missions/index.mjs';

const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE.has(String(value).trim().toLowerCase());
}

function logJson(outputFn, payload) {
  outputFn(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
}

function formatMissionLine(mission) {
  const parts = [
    `${mission.id} :: ${mission.name}`,
    `status=${mission.status}`,
    `priority=${mission.priority ?? 0}`,
    `next=${mission.nextRunAt ?? 'n/a'}`
  ];
  return parts.join(' | ');
}

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
  const outputFn = typeof wsOutput === 'function' ? wsOutput : console.log;
  const errorFn = typeof wsError === 'function' ? wsError : console.error;

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
        const templateActionRaw = positionalArgs.length ? positionalArgs.shift() : null;
        const templateAction = templateActionRaw ? templateActionRaw.toLowerCase() : 'list';

        if (templateAction === 'list') {
          const templates = await templatesRepository.listTemplates();
          if (jsonOutput) {
            logJson(outputFn, templates);
          } else if (templates.length === 0) {
            outputFn('No mission templates available.');
          } else {
            templates.forEach(template => {
              outputFn(`${template.slug} :: ${template.name} | every=${describeSchedule(template.schedule)} | tags=${template.tags.join(', ') || 'none'}`);
            });
          }
          return { success: true, templates };
        }

        if (templateAction === 'show' || templateAction === 'get' || templateAction === 'inspect') {
          const slug = positionalArgs.shift() || flags.slug;
          if (!slug) {
            const message = 'Usage: /missions templates show <templateSlug>';
            errorFn(message);
            return { success: false, error: message, handled: true };
          }
          const template = await templatesRepository.getTemplate(slug);
          if (!template) {
            const message = `Template '${slug}' not found.`;
            errorFn(message);
            return { success: false, error: message, handled: true };
          }
          if (jsonOutput) {
            logJson(outputFn, template);
          } else {
            outputFn(`${template.slug} :: ${template.name}`);
            if (template.description) {
              outputFn(`  Description: ${template.description}`);
            }
            outputFn(`  Schedule: ${JSON.stringify(template.schedule)}`);
            outputFn(`  Priority: ${template.priority ?? 0}`);
            outputFn(`  Tags: ${template.tags.join(', ') || 'none'}`);
            outputFn(`  Enabled: ${template.enable !== false}`);
            if (template.payload) {
              outputFn(`  Payload: ${JSON.stringify(template.payload)}`);
            }
          }
          return { success: true, template };
        }

        if (templateAction === 'save' || templateAction === 'upsert' || templateAction === 'write') {
          const slugArg = positionalArgs.length ? positionalArgs.shift() : undefined;
          try {
            const definition = await buildTemplateSaveDefinition({
              slug: slugArg ?? flags.slug,
              flags,
              templatesRepository,
              errorFn
            });
            const saved = await templatesRepository.saveTemplate(definition);
            if (jsonOutput) {
              logJson(outputFn, saved);
            } else {
              outputFn(`Template '${saved.slug}' saved (${describeSchedule(saved.schedule)}).`);
            }
            return { success: true, template: saved };
          } catch (error) {
            errorFn(error.message);
            return { success: false, error: error.message, handled: true };
          }
        }

        if (templateAction === 'delete' || templateAction === 'remove') {
          const slug = positionalArgs.shift() || flags.slug;
          if (!slug) {
            const message = 'Usage: /missions templates delete <templateSlug>';
            errorFn(message);
            return { success: false, error: message, handled: true };
          }
          try {
            await templatesRepository.deleteTemplate(slug);
            if (jsonOutput) {
              logJson(outputFn, { success: true, slug });
            } else {
              outputFn(`Template '${slug}' deleted.`);
            }
            return { success: true };
          } catch (error) {
            errorFn(error.message);
            return { success: false, error: error.message, handled: true };
          }
        }

        const message = `Unknown missions templates action: ${templateAction}.`;
        errorFn(message);
        return { success: false, error: message, handled: true };
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

        const syncAction = (positionalArgs.shift() || flags.action || 'status').toLowerCase();
        const overrides = buildGitHubSyncOverrides(flags);

        switch (syncAction) {
          case 'status': {
            const result = await githubSyncController.status(overrides);
            if (jsonOutput) {
              logJson(outputFn, result);
            } else {
              outputFn(`Repo: ${overrides.repoPath ?? githubSyncController.config.repoPath}`);
              outputFn(`Branch: ${overrides.branch ?? githubSyncController.config.branch}`);
              const report = result.statusReport;
              if (!report) {
                outputFn(result.message);
              } else {
                outputFn(`Ahead: ${report.ahead} | Behind: ${report.behind}`);
                if (report.conflicts.length) {
                  outputFn(`Conflicts: ${report.conflicts.join(', ')}`);
                }
                if (report.modified.length) {
                  outputFn(`Modified: ${report.modified.join(', ')}`);
                }
                if (report.staged.length) {
                  outputFn(`Staged: ${report.staged.join(', ')}`);
                }
                if (report.clean) {
                  outputFn('Working tree is clean.');
                }
              }
            }
            return { success: result.status !== 'error', result };
          }

          case 'pull':
          case 'load': {
            const result = await githubSyncController.load(overrides);
            if (jsonOutput) {
              logJson(outputFn, result);
            } else {
              outputFn(result.message);
              if (typeof result.payload === 'string') {
                outputFn(result.payload);
              }
            }
            return { success: result.status === 'ok', result };
          }

          case 'push':
          case 'save': {
            const content = await getSyncContent(flags);
            if (content == null) {
              const message = 'Provide --content="..." or --from-file=<path> for sync push.';
              errorFn(message);
              return { success: false, error: message, handled: true };
            }
            const result = await githubSyncController.save(overrides, { content });
            if (jsonOutput) {
              logJson(outputFn, result);
            } else {
              outputFn(result.message);
              if (result.status === 'conflict' && result.statusReport?.conflicts?.length) {
                outputFn(`Conflicts detected: ${result.statusReport.conflicts.join(', ')}`);
              }
            }
            return { success: result.status === 'ok', result };
          }

          case 'resolve': {
            const result = await githubSyncController.resolve(overrides, {
              filePath: flags['file-path'] || flags.file,
              strategy: flags.strategy
            });
            if (jsonOutput) {
              logJson(outputFn, result);
            } else {
              outputFn(result.message);
              if (result.statusReport?.conflicts?.length) {
                outputFn(`Remaining conflicts: ${result.statusReport.conflicts.join(', ')}`);
              }
            }
            return { success: result.status === 'ok', result };
          }

          default: {
            const message = `Unknown missions sync action: ${syncAction}.`;
            errorFn(message);
            return { success: false, error: message, handled: true };
          }
        }
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

function describeSchedule(schedule) {
  if (!schedule) return 'n/a';
  if (schedule.intervalMinutes) {
    return `${schedule.intervalMinutes}m${schedule.timezone ? `@${schedule.timezone}` : ''}`;
  }
  if (schedule.cron) {
    return `cron(${schedule.cron})${schedule.timezone ? `@${schedule.timezone}` : ''}`;
  }
  return 'n/a';
}

function parseTags(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function buildScheduleOverrides(flags = {}) {
  const overrides = {};
  const intervalValue = flags['interval-minutes'];
  const cronValue = flags.cron;
  const timezone = flags.timezone;

  if (intervalValue != null && cronValue != null) {
    throw new Error('Provide either --interval-minutes or --cron, not both.');
  }
  if (intervalValue != null) {
    const interval = Number(intervalValue);
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new Error('--interval-minutes must be a positive number.');
    }
    overrides.intervalMinutes = interval;
  }
  if (cronValue != null) {
    const cron = String(cronValue).trim();
    if (!cron) {
      throw new Error('--cron must be a non-empty string.');
    }
    overrides.cron = cron;
  }
  if (timezone != null) {
    overrides.timezone = String(timezone).trim();
  }
  return overrides;
}

function buildGitHubSyncOverrides(flags = {}) {
  const overrides = {};
  if (flags['repo-path']) {
    overrides.repoPath = path.resolve(flags['repo-path']);
  }
  if (flags.repo) {
    overrides.repoPath = path.resolve(flags.repo);
  }
  if (flags['file-path']) {
    overrides.filePath = flags['file-path'];
  }
  if (flags.file) {
    overrides.filePath = flags.file;
  }
  if (flags.branch) {
    overrides.branch = flags.branch;
  }
  if (flags.remote) {
    overrides.remote = flags.remote;
  }
  if (flags['commit-message']) {
    overrides.commitMessage = flags['commit-message'];
  }
  if (flags.message) {
    overrides.commitMessage = flags.message;
  }
  if (flags.strategy) {
    overrides.strategy = flags.strategy;
  }
  return overrides;
}

async function getSyncContent(flags = {}) {
  if (typeof flags.content === 'string') {
    return flags.content;
  }
  const fromFile = flags['from-file'] || flags.source;
  if (fromFile) {
    const filePath = path.resolve(fromFile);
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read content from ${filePath}: ${error.message}`);
    }
  }
  return null;
}

async function buildTemplateSaveDefinition({ slug, flags, templatesRepository }) {
  const filePath = flags['from-file'] || flags.source;
  let definition = {};
  if (filePath) {
    definition = await loadTemplateDefinitionFromFile(filePath);
  }

  const existing = slug ? await templatesRepository.getTemplate(slug) : null;
  if (slug) {
    definition.slug = slug;
  }

  if (flags.name != null) {
    definition.name = String(flags.name);
  }
  if (flags.description != null) {
    definition.description = String(flags.description);
  }

  const scheduleOverride = buildScheduleOverrides(flags);
  let schedule = definition.schedule ? { ...definition.schedule } : null;
  if (scheduleOverride.intervalMinutes != null || scheduleOverride.cron != null) {
    schedule = { ...scheduleOverride };
  } else if (scheduleOverride.timezone) {
    if (schedule) {
      schedule = { ...schedule, timezone: scheduleOverride.timezone };
    } else if (existing?.schedule) {
      schedule = { ...existing.schedule, timezone: scheduleOverride.timezone };
    } else {
      throw new Error('Provide --interval-minutes or --cron before setting --timezone.');
    }
  }

  if (!schedule && existing?.schedule) {
    schedule = { ...existing.schedule };
  }
  if (!schedule) {
    throw new Error('Template save requires a schedule. Provide --interval-minutes or --cron, or include one in the file.');
  }
  definition.schedule = schedule;

  if (flags.priority != null) {
    definition.priority = parsePriorityFlag(flags.priority);
  }

  const tags = parseTags(flags.tags);
  if (tags) {
    definition.tags = tags;
  }

  if (flags.enable != null) {
    definition.enable = coerceBooleanFlag(flags.enable);
  }

  if (flags.payload != null) {
    definition.payload = parsePayloadFlag(flags.payload);
  }

  if (!definition.name && !existing?.name) {
    throw new Error('Template save requires --name or a name defined in the file.');
  }

  return definition;
}

async function loadTemplateDefinitionFromFile(filePath) {
  const absolute = path.resolve(filePath);
  let raw;
  try {
    raw = await fs.readFile(absolute, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read template file ${absolute}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = parseYaml(raw);
  } catch (yamlError) {
    try {
      parsed = JSON.parse(raw);
    } catch (jsonError) {
      throw new Error(`Template file ${absolute} must be valid YAML or JSON.`);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Template file ${absolute} must contain an object definition.`);
  }

  return { ...parsed };
}

function coerceBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  throw new Error('--enable must be a boolean-like value.');
}

function parsePriorityFlag(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('--priority must be a number when provided.');
  }
  return parsed;
}

function parsePayloadFlag(value) {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error('--payload must be provided as a JSON string.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error('--payload must be valid JSON.');
  }
}
