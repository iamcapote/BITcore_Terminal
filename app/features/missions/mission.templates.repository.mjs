/**
 * MissionTemplatesRepository loads and normalizes reusable mission drafts
 * defined in YAML files so operators can scaffold new missions quickly.
 *
 * Contract
 * Inputs:
 *   - templatesDir?: absolute path to where *.mission.yaml files live.
 *   - fs?: fs/promises-compatible module for IO overrides in tests.
 *   - yaml?: parser with a `parse` function (defaults to `yaml` package).
 * Outputs:
 *   - listTemplates(): Promise<TemplateSummary[]>.
 *   - getTemplate(slug): Promise<MissionTemplate|null>.
 *   - createDraftFromTemplate(slug, overrides?): Promise<MissionDraft>.
 *   - saveTemplate(input): Promise<MissionTemplate>.
 *   - deleteTemplate(slug): Promise<boolean>.
 * Error modes:
 *   - Throws SyntaxError/RangeError when YAML is invalid or missing required fields.
 * Performance:
 *   - Templates are cached in-memory after first load; subsequent calls are O(1).
 * Side effects:
 *   - Reads and writes template files on disk.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { normalizeMissionDraft, SCHEDULE_TYPES } from './mission.schema.mjs';

const DEFAULT_TEMPLATES_DIR = path.resolve(process.cwd(), 'missions', 'templates');
const SUPPORTED_EXTENSIONS = new Set(['.yaml', '.yml']);
const DEFAULT_FILE_SUFFIX = '.mission.yaml';

function coerceArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSchedule(schedule = {}) {
  if (!isObject(schedule)) {
    throw new TypeError('Mission template schedule must be an object.');
  }
  if (schedule.intervalMinutes != null) {
    const interval = Number(schedule.intervalMinutes);
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new RangeError('schedule.intervalMinutes must be a positive number.');
    }
    return {
      intervalMinutes: Math.ceil(interval),
      timezone: schedule.timezone ? String(schedule.timezone).trim() : undefined
    };
  }
  if (schedule.cron != null) {
    const cron = String(schedule.cron).trim();
    if (!cron) {
      throw new RangeError('schedule.cron must be a non-empty string.');
    }
    return {
      cron,
      timezone: schedule.timezone ? String(schedule.timezone).trim() : undefined
    };
  }
  throw new RangeError('Mission template schedule must specify intervalMinutes or cron.');
}

function mergeSchedules(baseSchedule, overrideSchedule = {}) {
  if (!overrideSchedule || Object.keys(overrideSchedule).length === 0) {
    return baseSchedule;
  }
  if (overrideSchedule.intervalMinutes != null && overrideSchedule.cron != null) {
    throw new RangeError('Schedule overrides must specify either intervalMinutes or cron, not both.');
  }
  if (overrideSchedule.intervalMinutes != null) {
    return normalizeSchedule({
      intervalMinutes: overrideSchedule.intervalMinutes,
      timezone: overrideSchedule.timezone ?? baseSchedule?.timezone
    });
  }
  if (overrideSchedule.cron != null) {
    return normalizeSchedule({
      cron: overrideSchedule.cron,
      timezone: overrideSchedule.timezone ?? baseSchedule?.timezone
    });
  }
  if (overrideSchedule.timezone && baseSchedule) {
    return { ...baseSchedule, timezone: String(overrideSchedule.timezone).trim() };
  }
  return baseSchedule;
}

function normalizeSlug(value) {
  if (!value || (typeof value !== 'string' && typeof value !== 'number')) {
    throw new TypeError('Template slug must be a non-empty string.');
  }
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/\.(mission|template)$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) {
    throw new RangeError('Template slug resolved to an empty value.');
  }
  return normalized;
}

export class MissionTemplatesRepository {
  constructor({ templatesDir = DEFAULT_TEMPLATES_DIR, fsModule = fs, yaml = { parse: parseYaml }, logger = console } = {}) {
    this.templatesDir = templatesDir;
    this.fs = fsModule;
    this.yaml = yaml;
    this.logger = logger;
    this.cache = new Map();
    this.indexLoaded = false;
  }

  async listTemplates() {
    await this.#ensureIndex();
    return Array.from(this.cache.values()).map(template => this.#cloneTemplate(template));
  }

  async getTemplate(slug) {
    if (!slug) return null;
    await this.#ensureIndex();
    const template = this.cache.get(normalizeSlug(slug));
    return template ? this.#cloneTemplate(template) : null;
  }

  async createDraftFromTemplate(slug, overrides = {}) {
    if (!slug) {
      throw new TypeError('createDraftFromTemplate requires a template slug.');
    }
    const template = await this.getTemplate(slug);
    if (!template) {
      throw new Error(`Mission template '${slug}' not found.`);
    }

    const scheduleOverride = overrides.schedule || {};
    if (overrides.intervalMinutes != null || overrides.cron != null) {
      scheduleOverride.intervalMinutes = overrides.intervalMinutes ?? scheduleOverride.intervalMinutes;
      scheduleOverride.cron = overrides.cron ?? scheduleOverride.cron;
      scheduleOverride.timezone = overrides.timezone ?? scheduleOverride.timezone;
    }

    const draft = {
      name: overrides.name ?? template.name,
      description: overrides.description ?? template.description ?? null,
      schedule: mergeSchedules(template.schedule, scheduleOverride),
      priority: overrides.priority != null ? Number(overrides.priority) : template.priority,
      tags: coerceArray(overrides.tags).length ? coerceArray(overrides.tags) : template.tags,
      payload: overrides.payload ? this.#parsePayloadOverride(overrides.payload) : template.payload,
      enable: overrides.enable != null ? this.#coerceBoolean(overrides.enable) : template.enable
    };

    const normalized = normalizeMissionDraft(draft);

    return {
      name: normalized.name,
      description: normalized.description,
      schedule: normalized.schedule,
      priority: normalized.priority,
      tags: normalized.tags,
      payload: normalized.payload,
      enable: normalized.enable
    };
  }

  async saveTemplate(template) {
    if (!isObject(template)) {
      throw new TypeError('saveTemplate requires a template object.');
    }
    await this.#ensureIndex();

    const slug = template.slug ? normalizeSlug(template.slug) : this.#slugFromName(template.name);
    const existing = this.cache.get(slug) || null;
    const filename = this.#resolveFilename(slug, template.filename ?? existing?.sourcePath);
    const scheduleInput = this.#resolveScheduleInput(template, existing);

    const draft = normalizeMissionDraft({
      name: template.name ?? existing?.name,
      description: template.description ?? existing?.description ?? null,
      schedule: scheduleInput,
      priority: template.priority ?? existing?.priority ?? 0,
      tags: template.tags ?? existing?.tags ?? [],
      payload: template.payload ?? existing?.payload ?? {},
      enable: template.enable ?? existing?.enable ?? true
    });

    const record = {
      slug,
      name: draft.name,
      description: draft.description,
      schedule: this.#denormalizeSchedule(draft.schedule),
      priority: draft.priority,
      tags: [...draft.tags],
      payload: Object.keys(draft.payload).length ? { ...draft.payload } : null,
      enable: draft.enable,
      sourcePath: path.join(this.templatesDir, filename)
    };

    await this.fs.mkdir(this.templatesDir, { recursive: true });
    const serialized = this.#serializeTemplate(record, draft.schedule);
    await this.fs.writeFile(record.sourcePath, serialized, 'utf8');

    this.cache.set(slug, record);
    this.indexLoaded = true;
    return this.#cloneTemplate(record);
  }

  async deleteTemplate(slug) {
    const normalizedSlug = normalizeSlug(slug);
    await this.#ensureIndex();
    const existing = this.cache.get(normalizedSlug);
    if (!existing) {
      throw new Error(`Mission template '${normalizedSlug}' not found.`);
    }
    try {
      await this.fs.unlink(existing.sourcePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.logger?.warn?.(`[MissionTemplatesRepository] Template file missing for '${normalizedSlug}', continuing with cache cleanup.`);
    }
    this.cache.delete(normalizedSlug);
    return true;
  }

  #coerceBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    throw new TypeError(`Unable to coerce value '${value}' to boolean.`);
  }

  #parsePayloadOverride(payload) {
    if (payload == null) return null;
    if (isObject(payload)) return payload;
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (!trimmed) return null;
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        throw new SyntaxError('Payload override must be valid JSON when provided as a string.');
      }
    }
    throw new TypeError('Payload override must be an object or JSON string.');
  }

  async #ensureIndex() {
    if (this.indexLoaded) return;
    try {
      const entries = await this.fs.readdir(this.templatesDir, { withFileTypes: true });
      await Promise.all(entries
        .filter(entry => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(entry => this.#loadTemplate(entry.name)));
      this.indexLoaded = true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger?.warn?.(`[MissionTemplatesRepository] Templates directory '${this.templatesDir}' not found.`);
        this.indexLoaded = true;
        return;
      }
      throw error;
    }
  }

  async #loadTemplate(filename) {
    const slug = this.#deriveSlug(filename);
    const sourcePath = path.join(this.templatesDir, filename);
    const raw = await this.fs.readFile(sourcePath, 'utf8');
    const data = this.yaml.parse(raw);

    if (!isObject(data)) {
      throw new TypeError(`Mission template ${filename} must define an object.`);
    }

    const name = data.name ? String(data.name).trim() : null;
    if (!name) {
      throw new TypeError(`Mission template ${filename} is missing required 'name'.`);
    }

    const schedule = normalizeSchedule(data.schedule || {});

    const template = {
      slug,
      name,
      description: data.description ? String(data.description).trim() : null,
      schedule,
      priority: data.priority != null ? Number(data.priority) : 0,
      tags: coerceArray(data.tags).map(tag => tag.toLowerCase()),
      payload: data.payload && isObject(data.payload) ? data.payload : null,
      enable: data.enable != null ? this.#coerceBoolean(data.enable) : true,
      sourcePath
    };

    this.cache.set(slug, template);
    return template;
  }

  #deriveSlug(filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    return normalizeSlug(base);
  }

  #slugFromName(name) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('Template name is required to generate slug.');
    }
    return normalizeSlug(name);
  }

  #resolveFilename(slug, provided) {
    if (provided) {
      const resolved = path.extname(provided)
        ? path.basename(provided)
        : `${provided}${DEFAULT_FILE_SUFFIX}`;
      const ext = path.extname(resolved).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        throw new RangeError(`Template filename must use .yaml or .yml extension (received '${ext || 'none'}').`);
      }
      return resolved;
    }
    return `${slug}${DEFAULT_FILE_SUFFIX}`;
  }

  #resolveScheduleInput(template, existing) {
    if (template.schedule) {
      return template.schedule;
    }
    if (template.intervalMinutes != null) {
      return { intervalMinutes: template.intervalMinutes, timezone: template.timezone ?? existing?.schedule?.timezone };
    }
    if (template.cron != null) {
      return { cron: template.cron, timezone: template.timezone ?? existing?.schedule?.timezone };
    }
    if (existing?.schedule) {
      return existing.schedule;
    }
    throw new TypeError('Template schedule requires intervalMinutes or cron definition.');
  }

  #denormalizeSchedule(schedule) {
    if (!schedule) return null;
    if (schedule.type === SCHEDULE_TYPES.INTERVAL) {
      return {
        intervalMinutes: schedule.intervalMinutes,
        timezone: schedule.timezone
      };
    }
    if (schedule.type === SCHEDULE_TYPES.CRON) {
      return {
        cron: schedule.cron,
        timezone: schedule.timezone
      };
    }
    return null;
  }

  #serializeTemplate(record, normalizedSchedule) {
    const schedule = this.#denormalizeSchedule(normalizedSchedule ?? record.schedule) || {};
    const payload = {
      name: record.name,
      description: record.description || undefined,
      schedule,
      priority: record.priority ?? undefined,
      tags: record.tags?.length ? record.tags : undefined,
      payload: record.payload && Object.keys(record.payload).length ? record.payload : undefined,
      enable: record.enable
    };
    return `${stringifyYaml(payload, { indent: 2, lineWidth: 0 }).trimEnd()}\n`;
  }

  #cloneTemplate(template) {
    return {
      slug: template.slug,
      name: template.name,
      description: template.description,
      schedule: template.schedule ? { ...template.schedule } : null,
      priority: template.priority,
      tags: Array.isArray(template.tags) ? [...template.tags] : [],
      payload: template.payload ? { ...template.payload } : null,
      enable: template.enable,
      sourcePath: template.sourcePath
    };
  }
}

export function resolveTemplatesDir(moduleUrl = import.meta.url) {
  const currentDir = path.dirname(fileURLToPath(moduleUrl));
  return path.resolve(currentDir, '..', '..', '..', 'missions', 'templates');
}
