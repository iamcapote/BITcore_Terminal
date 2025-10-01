/**
 * Why: Extract mission template subcommand handling so the root CLI stays readable.
 * What: Implements list/show/save/delete logic, including persistence helpers and validation.
 * How: Consumes repositories and flag dictionaries from the caller, performs pure data shaping, and emits output via injected loggers.
 * Contract
 *   Inputs:
 *     - positionalArgs: string[] mutable list of remaining CLI arguments for the templates namespace.
 *     - flags: Record<string, unknown> parsed key/value flags for the invocation.
 *     - jsonOutput: boolean toggling JSON vs human-readable formatting.
 *     - outputFn: (message: string) => void for standard output.
 *     - errorFn: (message: string) => void for error channel.
 *     - templatesRepository: object exposing list/get/save/delete helpers for mission templates.
 *   Outputs:
 *     - Resolves to `{ success: boolean, ... }` summaries mirroring the legacy CLI contract.
 *   Error modes:
 *     - Throws only for unexpected I/O failures; user errors are surfaced through structured return objects.
 *   Performance:
 *     - Disk access limited to template files when requested; otherwise O(1) operations on in-memory objects.
 *   Side effects:
 *     - Reads template definitions from disk when `--from-file`/`--source` provided.
 */

import fs from 'fs/promises';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import {
  describeSchedule,
  isTruthy,
  logJson,
  parseTags,
  buildScheduleOverrides
} from './helpers.mjs';

export async function handleTemplatesCommand({
  positionalArgs,
  flags,
  jsonOutput,
  outputFn,
  errorFn,
  templatesRepository
}) {
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
        templatesRepository
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

export async function buildTemplateSaveDefinition({ slug, flags, templatesRepository }) {
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
