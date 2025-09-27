/**
 * Contract
 * Inputs:
 *   - Dependency bag { service?: PromptService, logger?: LoggerLike }.
 *   - Prompt payloads and identifiers validated via prompt schema helpers.
 * Outputs:
 *   - Delegated prompt records, summaries, and search collections.
 * Error modes:
 *   - Propagates validation errors; re-throws NotFoundError for missing prompts.
 * Performance:
 *   - Thin orchestration layer; negligible overhead beyond logging.
 * Side effects:
 *   - None directly; service handles filesystem writes.
 */

import { createPromptService } from './prompt.service.mjs';
import { normalizePromptId } from './prompt.schema.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

function requireId(input) {
  if (!input || (typeof input === 'object' && !input.id && !input.promptId)) {
    throw new Error('Prompt identifier is required.');
  }
  if (typeof input === 'string') {
    return normalizePromptId(input);
  }
  return normalizePromptId(input.id ?? input.promptId);
}

export class PromptController {
  constructor({ service = createPromptService(), logger = noopLogger } = {}) {
    this.service = service;
    this.logger = logger;
  }

  async list(options = {}) {
    const summaries = await this.service.listSummaries({
      tags: options.tags,
      limit: options.limit
    });
    this.logger.debug?.('prompt.list', { count: summaries.length });
    return summaries;
  }

  async get(request) {
    const id = requireId(request);
    const record = await this.service.getPrompt(id);
    this.logger.debug?.('prompt.get', { id });
    return record;
  }

  async save(payload, options = {}) {
    const record = await this.service.savePrompt(payload, options);
    this.logger.info?.('prompt.save', { id: record.id, actor: options.actor ?? 'system' });
    return record;
  }

  async remove(request, options = {}) {
    const id = requireId(request);
    await this.service.deletePrompt(id, options);
    this.logger.info?.('prompt.delete', { id, actor: options.actor ?? 'system' });
  }

  async search(criteria = {}) {
    const results = await this.service.searchPrompts(criteria);
    this.logger.debug?.('prompt.search', {
      query: criteria.query ?? '',
      tags: criteria.tags ?? [],
      count: results.length
    });
    return results;
  }

  async exists(request) {
    const id = requireId(request);
    const exists = await this.service.exists(id);
    this.logger.debug?.('prompt.exists', { id, exists });
    return exists;
  }
}

export function createPromptController(options) {
  return new PromptController(options);
}
