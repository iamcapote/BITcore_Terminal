/**
 * Why: Supply a curated catalog of models for the browser prototype without wiring live provider discovery.
 * What: Exports typed metadata describing models, throughput, latency, and capabilities used by the UI store.
 * How: Uses a static array seeded from architecture plans; future versions can fetch dynamically.
 */

export type ModelCapability = 'chat' | 'code' | 'vision' | 'audio' | 'tool-use';

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: 'Venice' | 'OpenAI' | 'Anthropic' | 'Google' | 'Groq' | 'Together';
  contextTokens: number;
  outputTokensPerMin: number;
  latencyMs: number;
  pricePerMillionTokens: number;
  capabilities: ModelCapability[];
  availability: 'ga' | 'beta' | 'experimental';
  description: string;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'venice-pro-32k',
    name: 'Venice Pro 32k',
    provider: 'Venice',
    contextTokens: 32000,
    outputTokensPerMin: 180000,
    latencyMs: 850,
    pricePerMillionTokens: 2.4,
    capabilities: ['chat', 'code', 'tool-use'],
    availability: 'ga',
    description: 'Balanced Venice flagship tuned for research synthesis and structured tool calling.'
  },
  {
    id: 'venice-vision-128k',
    name: 'Venice Vision 128k',
    provider: 'Venice',
    contextTokens: 128000,
    outputTokensPerMin: 110000,
    latencyMs: 1250,
    pricePerMillionTokens: 3.1,
    capabilities: ['chat', 'vision', 'tool-use'],
    availability: 'beta',
    description: 'Vision-capable Venice variant optimized for screenshot and document reasoning.'
  },
  {
    id: 'gpt-4.5-preview',
    name: 'GPT-4.5 Preview',
    provider: 'OpenAI',
    contextTokens: 128000,
    outputTokensPerMin: 160000,
    latencyMs: 900,
    pricePerMillionTokens: 10.0,
    capabilities: ['chat', 'code', 'vision', 'tool-use'],
    availability: 'beta',
    description: 'OpenAI preview model combining code and multimodal reasoning with higher cost.'
  },
  {
    id: 'claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    contextTokens: 200000,
    outputTokensPerMin: 150000,
    latencyMs: 980,
    pricePerMillionTokens: 6.5,
    capabilities: ['chat', 'code'],
    availability: 'ga',
    description: 'Claude mid-tier model offering longer context with balanced reasoning speed.'
  },
  {
    id: 'gemini-2.1-ultra',
    name: 'Gemini 2.1 Ultra',
    provider: 'Google',
    contextTokens: 1000000,
    outputTokensPerMin: 95000,
    latencyMs: 1350,
    pricePerMillionTokens: 3.8,
    capabilities: ['chat', 'vision', 'audio', 'tool-use'],
    availability: 'beta',
    description: 'Google flagship with million-token context and multimodal coverage across vision and audio.'
  },
  {
    id: 'groq-mixtral-8x7b',
    name: 'Groq Mixtral 8x7B',
    provider: 'Groq',
    contextTokens: 32000,
    outputTokensPerMin: 320000,
    latencyMs: 210,
    pricePerMillionTokens: 0.8,
    capabilities: ['chat', 'code'],
    availability: 'ga',
    description: 'Groq-accelerated Mixtral targeting ultra-low latency command execution and tool routing.'
  },
  {
    id: 'nous-hermes-3',
    name: 'Nous Hermes 3',
    provider: 'Together',
    contextTokens: 64000,
    outputTokensPerMin: 140000,
    latencyMs: 620,
    pricePerMillionTokens: 1.2,
    capabilities: ['chat', 'code', 'tool-use'],
    availability: 'experimental',
    description: 'Community-favorite Hermes tuned for agentic workflows with steady latency and low cost.'
  }
];

export function listModelCapabilities(): ModelCapability[] {
  return Array.from(new Set(MODEL_CATALOG.flatMap((entry) => entry.capabilities))).sort();
}

export function listProviders(): ModelCatalogEntry['provider'][] {
  return Array.from(new Set(MODEL_CATALOG.map((entry) => entry.provider))).sort();
}
