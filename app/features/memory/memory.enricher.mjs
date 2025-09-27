/**
 * Venice-backed memory enrichment helper.
 *
 * Produces consistent enrichment payloads for MemoryController.store calls
 * while honouring feature flags and avoiding hard failures when Venice
 * credentials are absent. If enrichment is disabled or unavailable, the
 * returned enricher is a noop that simply yields empty tags/metadata.
 */

import { LLMClient, LLMError } from '../../infrastructure/ai/venice.llm-client.mjs';

const noopLogger = Object.freeze({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

const EMPTY_ENRICHMENT = Object.freeze({ tags: [], metadata: {} });

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function parseResponseContent(rawContent, logger = noopLogger) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { ...EMPTY_ENRICHMENT };
  }

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.debug?.('[MemoryEnricher] No JSON object found in Venice response.');
    return { ...EMPTY_ENRICHMENT };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map(tag => String(tag || '').trim().toLowerCase())
          .filter(Boolean)
      : [];

    const metadata = parsed.metadata && typeof parsed.metadata === 'object' && !Array.isArray(parsed.metadata)
      ? Object.entries(parsed.metadata)
          .reduce((acc, [key, value]) => {
            const safeKey = String(key || '').trim();
            if (!safeKey) return acc;
            const safeValue = typeof value === 'string' ? value.trim() : value;
            acc[safeKey] = safeValue;
            return acc;
          }, {})
      : {};

    const source = typeof parsed.source === 'string' ? parsed.source.trim() || undefined : undefined;

    if (!tags.length && !Object.keys(metadata).length && !source) {
      return { ...EMPTY_ENRICHMENT };
    }

    return Object.freeze({ tags, metadata, source });
  } catch (error) {
    logger.warn?.(`[MemoryEnricher] Failed to parse Venice enrichment JSON: ${error.message}`);
    return { ...EMPTY_ENRICHMENT };
  }
}

export function createVeniceMemoryEnricher(options = {}) {
  const {
    logger = noopLogger,
    client,
    enabled,
    model = process.env.MEMORY_ENRICHMENT_MODEL,
    characterSlug = process.env.MEMORY_ENRICHMENT_CHARACTER
  } = options;

  const flagEnabled = enabled ?? isTruthy(process.env.MEMORY_ENRICHMENT_ENABLED ?? 'true');
  if (!flagEnabled) {
    logger.debug?.('[MemoryEnricher] Venice enrichment disabled via feature flag.');
    return async () => ({ ...EMPTY_ENRICHMENT });
  }

  let llmClient = client;
  if (!llmClient) {
    try {
      llmClient = new LLMClient({
        model: model || process.env.VENICE_MODEL || 'llama-3.3-8b'
      });
    } catch (error) {
      const cause = error instanceof LLMError ? error.message : error?.message;
      logger.warn?.(`[MemoryEnricher] Unable to instantiate Venice client: ${cause}`);
      return async () => ({ ...EMPTY_ENRICHMENT });
    }
  }

  return async function veniceMemoryEnricher(memoryLike, options = {}) {
    if (!memoryLike || typeof memoryLike !== 'object') {
      return { ...EMPTY_ENRICHMENT };
    }

    const payload = {
      layer: memoryLike.layer || 'episodic',
      role: memoryLike.role || 'user',
      source: memoryLike.source || 'unspecified',
      tags: Array.isArray(memoryLike.tags) ? memoryLike.tags.join(', ') : 'none',
      metadata: memoryLike.metadata && typeof memoryLike.metadata === 'object'
        ? JSON.stringify(memoryLike.metadata)
        : '{}',
      content: String(memoryLike.content || '').slice(0, 4000)
    };

    if (!payload.content.trim()) {
      return { ...EMPTY_ENRICHMENT };
    }

    const systemPrompt = `You enrich memory entries for an autonomous research agent.
Return strictly JSON with keys: "tags" (array of <=5 lowercase strings), optional "metadata" (object with short string values), and optional "source" (string).
Only include high-signal tags, avoid duplicates, prefer domain nouns, projects, or entities.`;

    const userPrompt = `Memory details:
- Layer: ${payload.layer}
- Role: ${payload.role}
- Source: ${payload.source}
- Existing tags: ${payload.tags}
- Existing metadata: ${payload.metadata}

Content:
${payload.content}`;

    try {
      const response = await llmClient.complete({
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
        maxTokens: 220,
        venice_parameters: characterSlug ? { character_slug: characterSlug } : {},
        type: 'chat'
      });

      return parseResponseContent(response.content, logger);
    } catch (error) {
      const message = error instanceof LLMError ? error.message : error?.message;
      logger.warn?.(`[MemoryEnricher] Venice enrichment request failed: ${message}`);
      return { ...EMPTY_ENRICHMENT };
    }
  };
}

export { EMPTY_ENRICHMENT };
