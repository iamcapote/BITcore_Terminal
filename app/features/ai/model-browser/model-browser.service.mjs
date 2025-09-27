/**
 * Model Browser Service
 *
 * Contract
 * Inputs:
 *   - options.models?: Record<string, VeniceModelMeta>
 *   - options.defaults?: Partial<ModelBrowserDefaults>
 *   - options.timeProvider?: () => number
 * Outputs:
 *   - ModelBrowserSnapshot {
 *       models: ModelDescriptor[];
 *       defaults: ModelBrowserDefaults;
 *       categories: Record<string, string[]>;
 *       updatedAt: number;
 *     }
 * Error modes:
 *   - None (defensive guard rails normalise malformed metadata instead of throwing).
 * Performance:
 *   - O(n) over the number of models; metadata kept in-memory with cheap derivations.
 * Side effects:
 *   - None; pure calculations only.
 */

import {
  VENICE_MODELS,
  getDefaultChatModelId,
  getDefaultModelId,
  getDefaultResearchModelId,
  getDefaultTokenClassifierModelId,
} from '../../../infrastructure/ai/venice.models.mjs';

const TRAIT_BADGE_PRESETS = new Map([
  ['default', { key: 'trait-default', label: 'Balanced default', tone: 'primary' }],
  ['function_calling_default', { key: 'trait-functions', label: 'Function calling', tone: 'accent' }],
  ['default_code', { key: 'trait-code', label: 'Code generation', tone: 'code' }],
  ['default_vision', { key: 'trait-vision', label: 'Vision', tone: 'vision' }],
  ['most_intelligent', { key: 'trait-intelligence', label: 'Deep reasoning', tone: 'reasoning' }],
  ['most_uncensored', { key: 'trait-uncensored', label: 'Uncensored', tone: 'warning' }],
  ['fastest', { key: 'trait-speed', label: 'Fastest', tone: 'speed' }],
  ['default_reasoning', { key: 'trait-reasoning', label: 'Reasoning', tone: 'reasoning' }],
]);

const CATEGORY_METADATA = Object.freeze({
  general: Object.freeze({ key: 'general', label: 'General purpose' }),
  chat: Object.freeze({ key: 'chat', label: 'Conversational' }),
  research: Object.freeze({ key: 'research', label: 'Research & analysis' }),
  coding: Object.freeze({ key: 'coding', label: 'Coding & tooling' }),
  vision: Object.freeze({ key: 'vision', label: 'Vision' }),
  reasoning: Object.freeze({ key: 'reasoning', label: 'Reasoning' }),
  uncensored: Object.freeze({ key: 'uncensored', label: 'Uncensored' }),
  speed: Object.freeze({ key: 'speed', label: 'High throughput' }),
});

let singletonService = null;

function normaliseDefaults(overrides = {}) {
  return Object.freeze({
    global: overrides.global || getDefaultModelId(),
    chat: overrides.chat || getDefaultChatModelId(),
    research: overrides.research || getDefaultResearchModelId(),
    token: overrides.token || getDefaultTokenClassifierModelId(),
  });
}

function humaniseModelId(modelId) {
  if (!modelId || typeof modelId !== 'string') {
    return 'Unknown model';
  }
  return modelId
    .split('-')
    .map((segment) => segment.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(' ')
    .replace(/\bLlama\b/gi, 'LLaMA')
    .replace(/\bQwen\b/gi, 'Qwen')
    .replace(/\bVenice\b/gi, 'Venice')
    .replace(/\bDeepseek\b/gi, 'DeepSeek');
}

function normaliseTraits(traits) {
  if (!Array.isArray(traits)) {
    return [];
  }
  const unique = new Set();
  traits.forEach((trait) => {
    if (!trait) return;
    const text = String(trait).trim().toLowerCase();
    if (text) {
      unique.add(text);
    }
  });
  return Array.from(unique);
}

function deriveTraitBadges(traits) {
  const badges = [];
  const seen = new Set();

  traits.forEach((trait) => {
    const preset = TRAIT_BADGE_PRESETS.get(trait);
    if (preset) {
      if (!seen.has(preset.key)) {
        badges.push(Object.freeze({ ...preset }));
        seen.add(preset.key);
      }
      return;
    }

    const key = `trait-${trait.replace(/[^a-z0-9]+/gi, '-')}`;
    if (seen.has(key)) {
      return;
    }
    badges.push(Object.freeze({
      key,
      label: trait.replace(/[\W_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      tone: 'neutral',
    }));
    seen.add(key);
  });

  return Object.freeze(badges);
}

function deriveRecommendationFlags(modelId, traits, defaults) {
  const hasTrait = (needle) => traits.includes(needle);
  return Object.freeze({
    chat: modelId === defaults.chat || hasTrait('default'),
    research: modelId === defaults.research || hasTrait('most_intelligent') || hasTrait('default_reasoning'),
    coding: hasTrait('default_code'),
    vision: hasTrait('default_vision'),
    reasoning: hasTrait('default_reasoning') || hasTrait('most_intelligent'),
    uncensored: hasTrait('most_uncensored'),
    speed: hasTrait('fastest'),
  });
}

function deriveCategories(recommendations) {
  const categories = new Set(['general']);
  if (recommendations.chat) categories.add('chat');
  if (recommendations.research) categories.add('research');
  if (recommendations.coding) categories.add('coding');
  if (recommendations.vision) categories.add('vision');
  if (recommendations.reasoning) categories.add('reasoning');
  if (recommendations.uncensored) categories.add('uncensored');
  if (recommendations.speed) categories.add('speed');
  return Object.freeze(Array.from(categories));
}

function computeModelScore({ recommendations, traits, contextTokens }) {
  let score = 0;
  if (recommendations.chat) score += 30;
  if (recommendations.research) score += 30;
  if (recommendations.coding) score += 12;
  if (recommendations.reasoning) score += 12;
  if (recommendations.vision) score += 8;
  if (recommendations.speed) score += 5;
  if (recommendations.uncensored) score += 3;
  if (traits.includes('most_intelligent')) score += 6;
  if (traits.includes('default')) score += 4;
  if (Number.isFinite(contextTokens)) {
    score += Math.min(contextTokens / 8192, 8);
  }
  return score;
}

function createDescriptor(modelId, metadata, defaults) {
  const traits = normaliseTraits(metadata?.traits);
  const contextTokens = Number.isFinite(metadata?.availableContextTokens)
    ? Number(metadata.availableContextTokens)
    : null;
  const sourceUrl = typeof metadata?.modelSource === 'string' ? metadata.modelSource : null;
  const badges = deriveTraitBadges(traits);
  const recommendations = deriveRecommendationFlags(modelId, traits, defaults);
  const categories = deriveCategories(recommendations);
  const score = computeModelScore({ recommendations, traits, contextTokens });

  const descriptor = {
    id: modelId,
    label: humaniseModelId(modelId),
    traits,
    contextTokens,
    sourceUrl,
    badges,
    recommendations,
    categories,
    score,
  };

  return Object.freeze(descriptor);
}

function indexCategories(descriptors) {
  const categoryIndex = {};
  descriptors.forEach((descriptor) => {
    descriptor.categories.forEach((categoryKey) => {
      if (!CATEGORY_METADATA[categoryKey]) {
        return;
      }
      if (!categoryIndex[categoryKey]) {
        categoryIndex[categoryKey] = [];
      }
      categoryIndex[categoryKey].push(descriptor.id);
    });
  });

  for (const [key, list] of Object.entries(categoryIndex)) {
    categoryIndex[key] = Object.freeze([...new Set(list)]);
  }

  return Object.freeze(categoryIndex);
}

export function createModelBrowserService(options = {}) {
  const {
    models = VENICE_MODELS,
    defaults: defaultsOverride = {},
    timeProvider = () => Date.now(),
  } = options;
  const defaults = normaliseDefaults(defaultsOverride);

  return Object.freeze({
    listModels({ sortDescending = true } = {}) {
      const descriptors = Object.entries(models)
        .sort(([idA], [idB]) => idA.localeCompare(idB))
        .map(([id, metadata]) => createDescriptor(id, metadata, defaults));

      descriptors.sort((a, b) => {
        if (sortDescending) {
          return b.score - a.score || a.label.localeCompare(b.label);
        }
        return a.score - b.score || a.label.localeCompare(b.label);
      });

      const indexedCategories = indexCategories(descriptors);
      const timestamp = timeProvider();

      return Object.freeze({
        models: Object.freeze(descriptors),
        defaults,
        categories: indexedCategories,
        meta: Object.freeze({
          total: descriptors.length,
          generatedAt: timestamp,
          categoryMetadata: CATEGORY_METADATA,
        }),
        updatedAt: timestamp,
      });
    },
  });
}

export function getModelBrowserService() {
  if (!singletonService) {
    singletonService = createModelBrowserService();
  }
  return singletonService;
}

export function resetModelBrowserServiceSingleton() {
  singletonService = null;
}
