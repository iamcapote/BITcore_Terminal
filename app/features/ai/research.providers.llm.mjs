/**
 * Why: Isolate Venice LLM client interactions for research providers.
 * What: Exports async wrappers for LLMClient calls and error handling.
 * How: Accepts config, prompt, and type; returns parsed or raw results.
 * Contract: Inputs are config/prompt objects; outputs are result objects. Handles errors and API key checks.
 */

import { LLMClient, LLMError } from '../../infrastructure/ai/venice.llm-client.mjs';

export async function callVeniceLLM({ apiKey, type, system, prompt, temperature = 0.7, maxTokens = 1000, outputFn = console.log, errorFn = console.error, character_slug }) {
  if (!apiKey) {
    errorFn('[callVeniceLLM] Error: API key is missing.');
    return { success: false, error: 'API key is required.', isApiError: true };
  }
  const client = new LLMClient({ apiKey, outputFn, errorFn });
  try {
    const response = await client.complete({
      system,
      prompt,
      temperature,
      maxTokens,
      type,
      venice_parameters: character_slug ? { character_slug } : {}
    });
    return { success: true, content: response.content };
  } catch (error) {
    const errorMessage = error instanceof LLMError ? `${error.name}: ${error.message}` : error.message;
    return { success: false, error: `LLM API Error: ${errorMessage}`, isApiError: true };
  }
}
