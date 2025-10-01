/**
 * Why: Share research-query generation helpers for chat workflows without bloating the main CLI module.
 * What: Builds heuristic fallbacks, routes to the LLM-backed generator, and exposes a reusable query API.
 * How: Normalizes inputs, resolves API keys, and returns deterministic outputs when upstream calls fail.
 */

import { generateQueries as generateResearchQueriesLLM } from '../../../features/ai/research.providers.mjs';
import { resolveServiceApiKey } from '../../../utils/api-keys.mjs';
import { output as outputManagerInstance } from '../../../utils/research.output-manager.mjs';

function buildFallbackQueries(contextString, numQueries) {
  const lines = contextString.split('\n').map((line) => line.trim()).filter(Boolean);
  const firstUserLine = lines.find((line) => line.toLowerCase().startsWith('user:')) || lines.find(Boolean);
  let topic = firstUserLine ? firstUserLine.replace(/^user:\s*/i, '') : 'the topic';
  if (topic.length > 80) {
    topic = `${topic.slice(0, 80)}...`;
  }

  const baseQueries = [
    { original: `What is ${topic}?`, metadata: { goal: `Understand the fundamentals of ${topic}` } },
    { original: `How does ${topic} work?`, metadata: { goal: `Explore how ${topic} functions` } },
    { original: `Why is ${topic} important?`, metadata: { goal: `Assess the significance of ${topic}` } },
  ];

  while (baseQueries.length < numQueries) {
    baseQueries.push({
      original: `Which key challenges exist with ${topic}?`,
      metadata: { goal: `Identify challenges for ${topic}` },
    });
  }

  return baseQueries.slice(0, numQueries);
}

/**
 * Contract
 * Inputs:
 *   - chatHistory: Array<{ role: string; content: string }>
 *   - memoryBlocks?: Array<object|string>
 *   - numQueries?: number (default 3)
 *   - veniceApiKey?: string | null
 *   - metadata?: object | null
 *   - outputFn?: (line: string | object) => void
 *   - errorFn?: (line: string | object) => void
 * Outputs: Promise<Array<{ original: string; metadata?: object }>>
 * Error modes: throws when chat history is empty, otherwise falls back to heuristic queries on failure.
 */
export async function generateResearchQueriesFromContext(
  chatHistory,
  memoryBlocks = [],
  numQueries = 3,
  veniceApiKey = null,
  metadata = null,
  outputFn = outputManagerInstance.log,
  errorFn = outputManagerInstance.error,
) {
  const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
  const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

  if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
    throw new Error('Chat history too short to generate research queries.');
  }

  let effectiveKey = veniceApiKey;
  if (!effectiveKey) {
    effectiveKey = await resolveServiceApiKey('venice');
  }

  const memoryContext = Array.isArray(memoryBlocks) && memoryBlocks.length > 0
    ? '\n---\nMemories:\n' + memoryBlocks.map((block) => `memory: ${block.content || block}`).join('\n')
    : '';

  const contextString = chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n---\n') + memoryContext;

  try {
    if (effectiveKey) {
      effectiveOutput('Generating focused research queries from chat history...');
    } else {
      effectiveOutput('[generateResearchQueriesFromContext] No Venice API key available; using deterministic fallback queries.');
    }

    const generatedQueries = await generateResearchQueriesLLM({
      apiKey: effectiveKey,
      query: contextString,
      numQueries,
      learnings: [],
      metadata,
    });

    if (Array.isArray(generatedQueries) && generatedQueries.length > 0) {
      effectiveOutput(`Generated ${generatedQueries.length} queries.`);
      return generatedQueries;
    }

    effectiveError('[generateResearchQueriesFromContext] LLM returned no queries. Falling back to heuristic queries.');
    return buildFallbackQueries(contextString, numQueries);
  } catch (error) {
    effectiveError(`Error generating research queries from context: ${error.message}`);
    return buildFallbackQueries(contextString, numQueries);
  }
}

/**
 * Contract
 * Inputs:
 *   - chatHistory?: Array<{ role: string; content: string }>
 *   - memoryBlocks?: Array<object|string>
 *   - options?: { numQueries?: number; metadata?: object; veniceApiKey?: string; output?: Function; error?: Function }
 * Outputs: Promise<Array<{ original: string; metadata?: object }>>
 * Error modes: propagates empty chat history validation, otherwise returns fallback queries when upstream calls fail.
 */
export async function generateResearchQueries(chatHistory = [], memoryBlocks = [], options = {}) {
  const {
    numQueries = 3,
    metadata = null,
    veniceApiKey = null,
    output = outputManagerInstance.log,
    error = outputManagerInstance.error,
  } = options;

  return generateResearchQueriesFromContext(
    chatHistory,
    memoryBlocks,
    numQueries,
    veniceApiKey,
    metadata,
    output,
    error,
  );
}
