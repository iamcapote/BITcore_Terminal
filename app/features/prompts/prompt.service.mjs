/**
 * Contract
 * Inputs:
 *   - Prompt payloads validated by `normalizePromptDefinition` and lookup identifiers via `normalizePromptId`.
 *   - Service options { repository?: PromptRepository, logger?: LoggerLike }.
 * Outputs:
 *   - Frozen prompt records, summaries, and search result collections suitable for UI/CLI consumption.
 * Error modes:
 *   - Re-throws repository NotFoundError for absent prompts.
 *   - Propagates validation errors from schema helpers.
 * Performance:
 *   - Directory scans are cached per call; search limits trim results server-side.
 * Side effects:
 *   - Delegates persistence to PromptRepository (filesystem writes).
 */

import { PromptRepository } from './prompt.repository.mjs';
import { normalizePromptDefinition, normalizePromptId } from './prompt.schema.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const DEFAULT_PROMPT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'general-assistant',
    title: 'General Assistant',
    description: 'Balanced default prompt for day-to-day chat, planning, and coding support.',
    body: [
      'You are a practical AI assistant for engineering and operations.',
      'Be concise, structured, and action-oriented.',
      'Ask clarifying questions only when necessary.',
      'When given tasks, provide clear steps and expected outcomes.',
      'When writing code, prefer minimal, safe, testable changes.'
    ].join('\n'),
    tags: ['general', 'assistant', 'starter']
  }),
  Object.freeze({
    id: 'research-brief',
    title: 'Research Brief',
    description: 'Template for quick research summaries with decisions and next actions.',
    body: [
      'Create a research brief with the following sections:',
      '1) Objective',
      '2) Key findings',
      '3) Risks / unknowns',
      '4) Recommendation',
      '5) Next actions (owner + due date)'
    ].join('\n'),
    tags: ['research', 'brief', 'starter']
  }),
  Object.freeze({
    id: 'task-breakdown',
    title: 'Task Breakdown',
    description: 'Template to convert high-level goals into scoped implementation tasks.',
    body: [
      'Break this goal into implementation-ready tasks.',
      'For each task include: title, scope, dependencies, acceptance criteria, and estimate.',
      'Prefer small, independently shippable slices.'
    ].join('\n'),
    tags: ['tasks', 'planning', 'starter']
  })
]);

function normalizeTagsFilter(tagsLike) {
  if (!tagsLike) return Object.freeze([]);
  const array = Array.isArray(tagsLike) ? tagsLike : String(tagsLike).split(',');
  const normalized = Array.from(
    new Set(
      array
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
  return Object.freeze(normalized);
}

export class PromptService {
  constructor({ repository = new PromptRepository(), logger = noopLogger } = {}) {
    this.repository = repository;
    this.logger = logger;
  }

  async listSummaries(filters = {}) {
    const { tags, limit } = filters;
    const tagFilter = normalizeTagsFilter(tags);

    const summaries = await this.#listOrSeedSummaries();
    const filtered = summaries.filter((summary) => {
      if (!tagFilter.length) return true;
      return tagFilter.every((tag) => summary.tags.includes(tag));
    });

    const sliced = Number.isInteger(limit) && limit > 0 ? filtered.slice(0, limit) : filtered;
    return Object.freeze(sliced.map((summary) => Object.freeze({ ...summary })));
  }

  async getPrompt(idLike) {
    const id = normalizePromptId(idLike);
    return this.repository.get(id);
  }

  async savePrompt(payload, options = {}) {
    const normalized = normalizePromptDefinition(payload);
    const record = await this.repository.save(normalized);
    this.#log('info', 'prompt.save', { id: record.id, actor: options.actor ?? 'system' });
    return record;
  }

  async deletePrompt(idLike, options = {}) {
    const id = normalizePromptId(idLike);
    await this.repository.delete(id);
    this.#log('info', 'prompt.delete', { id, actor: options.actor ?? 'system' });
  }

  async exists(idLike) {
    return this.repository.exists(idLike);
  }

  async searchPrompts(criteria = {}) {
    const {
      query = '',
      tags,
      limit,
      includeBody = true
    } = criteria;

    const text = String(query || '').trim().toLowerCase();
    const tagFilter = normalizeTagsFilter(tags);

    const records = includeBody
      ? await this.#listOrSeedRecords()
      : await this.#listOrSeedSummaries();

    const matches = [];
    for (const record of records) {
      const tagsMatch = tagFilter.length ? tagFilter.every((tag) => record.tags.includes(tag)) : true;
      if (!tagsMatch) continue;

      const queryMatch = text
        ? this.#matchesQuery(record, text, includeBody)
        : true;

      if (!queryMatch) continue;

      matches.push(includeBody ? record : Object.freeze({ ...record }));
      if (Number.isInteger(limit) && limit > 0 && matches.length >= limit) {
        break;
      }
    }

    return Object.freeze(matches);
  }

  #matchesQuery(record, queryText, includeBody) {
    const haystack = [record.id, record.title, record.description, ...(record.tags || [])];
    if (includeBody && record.body) {
      haystack.push(record.body);
    }
    const combined = haystack
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return combined.includes(queryText);
  }

  async #listOrSeedRecords() {
    const existing = await this.repository.listRecords();
    if (existing.length > 0) {
      return existing;
    }

    this.#log('info', 'prompt.seed.start', { count: DEFAULT_PROMPT_TEMPLATES.length });
    for (const template of DEFAULT_PROMPT_TEMPLATES) {
      await this.repository.save(template);
    }
    const seeded = await this.repository.listRecords();
    this.#log('info', 'prompt.seed.complete', { count: seeded.length });
    return seeded;
  }

  async #listOrSeedSummaries() {
    const existing = await this.repository.listSummaries();
    if (existing.length > 0) {
      return existing;
    }

    await this.#listOrSeedRecords();
    return this.repository.listSummaries();
  }

  #log(level, msg, context) {
    if (!this.logger || typeof this.logger[level] !== 'function') {
      return;
    }
    try {
      this.logger[level](msg, context);
    } catch (error) {
      // Logging should never throw upstream.
      if (this.logger?.error && level !== 'error') {
        this.logger.error('prompt.service.log_error', { msg, context, cause: error });
      }
    }
  }
}

export function createPromptService(options) {
  return new PromptService(options);
}
