// ...existing code...
// This file is being refactored: core helpers and LLM adapters have moved to
//   research.providers.utils.mjs, research.providers.llm.mjs, research.providers.service.mjs, research.providers.controller.mjs
// Please migrate usages to those modules. Remaining logic will be split next.
/**
 * Generates LLM output using the Venice API.
 * @param {Object} params - Parameters for generation.
 * @param {string} params.apiKey - The Venice API key.
 * @param {string} params.type - The type of output expected ('query', 'learning', 'report').
 * @param {string} params.system - The system prompt.
 * @param {string} params.prompt - The user prompt.
 * @param {number} [params.temperature=0.7] - Sampling temperature.
 * @param {number} [params.maxTokens=1000] - Maximum tokens to generate.
 * @param {function} [params.outputFn=console.log] - Function to handle output logs.
 * @param {function} [params.errorFn=console.error] - Function to handle error logs.
 * @returns {Promise<Object>} - Result object with success status and data or error.
 */
export async function generateOutput({ apiKey, type, system, prompt, temperature = 0.7, maxTokens = 1000, outputFn = console.log, errorFn = console.error }) {
  // Ensure API key is provided
  if (!apiKey) {
      errorFn("[generateOutput] Error: API key is missing.");
      // Indicate API-level issue if possible, though this is a config error
      return { success: false, error: 'API key is required for generateOutput.', isApiError: true };
  }
  // Instantiate client with the provided key
  // Set default character_slug for research and token classifier
  let character_slug;
  if (type === 'research') character_slug = getDefaultResearchCharacterSlug();
  else if (type === 'token_classifier') character_slug = getDefaultTokenClassifierCharacterSlug();

  const client = new LLMClient({ apiKey, outputFn, errorFn });
  try {
    outputFn(`[generateOutput] Calling LLM for type: ${type}. Max Tokens: ${maxTokens}, Temp: ${temperature}`); // DEBUG LOG

    const response = await client.complete({
      system,
      prompt,
      temperature,
      maxTokens,
      type,
      venice_parameters: character_slug ? { character_slug } : {}
    });

    const rawContent = response.content; // Store raw content
    outputFn(`[generateOutput] LLM Raw Response (type: ${type}):\n---START---\n`, rawContent, `\n---END---`); // DEBUG LOG

    let parsed = processResponse(type, rawContent);
    if (parsed.success) {
      outputFn(`[generateOutput] Initial parsing successful for type ${type}.`); // DEBUG LOG
      return { success: true, data: parsed };
    }

    // --- ADJUSTMENT: Return raw content on parsing failure ---
    // Parsing failed, return success: false, the error, and the raw content
    errorFn(`[generateOutput] Initial parsing failed for type ${type}. Error: ${parsed.error}.`);
    // Removed internal fallback/retry logic
    return { success: false, error: parsed.error || 'Failed to parse LLM response.', rawContent: rawContent }; // Return raw content

  } catch (error) {
    errorFn(`[generateOutput] LLM API call failed: ${error.message}`, error);
    // Check if it's an LLMError and provide more details if possible
    const errorMessage = error instanceof LLMError ? `${error.name}: ${error.message}` : error.message;
    // --- ADJUSTMENT: Indicate it's an API error clearly ---
    return { success: false, error: `LLM API Error: ${errorMessage}`, isApiError: true }; // Add flag
  }
}

/**
 * Generates search queries based on the initial query and context.
 * @param {Object} params - Parameters for query generation.
 * @param {string} params.apiKey - The Venice API key.
 * @param {string} params.query - The original user query.
 * @param {number} [params.numQueries=3] - Number of queries to generate.
 * @param {Array<string>} [params.learnings=[]] - Key learnings from previous steps.
 * @param {string|null} [params.metadata=null] - Metadata from token classification or other context.
 * @param {function} [params.outputFn=console.log] - Function to handle output logs.
 * @param {function} [params.errorFn=console.error] - Function to handle error logs.
 * @returns {Promise<Array<Object>>} - Array of generated query objects { original: string, metadata?: any }.
 */
export async function generateQueries({ apiKey, query, numQueries = 3, learnings = [], metadata = null, outputFn = console.log, errorFn = console.error }) {
  // In single-user mode, allow running without an API key by using a deterministic fallback.
  const hasApiKey = !!apiKey || !!process.env.VENICE_API_KEY;
  // Allow potentially long query strings (like chat history) but log a warning if very long
  if (!query || typeof query !== 'string' || !query.trim()) {
      errorFn(`[generateQueries] Error: Invalid query provided: ${query}`);
      throw new Error('Invalid query: must be a non-empty string.');
  }
  if (query.length > 10000) { // Add a length warning for very long context strings
      errorFn(`[generateQueries] Input query/context string is very long (${query.length} chars). This might affect LLM performance.`);
  }
  if (isNaN(numQueries) || numQueries <= 0) {
      errorFn(`[generateQueries] Invalid numQueries (${numQueries}), defaulting to 3.`);
      numQueries = 3;
  }

  // Log input and metadata
  const logQuery = query.length > 300 ? query.substring(0, 300) + '...' : query; // Truncate long query for logging
  outputFn(`[generateQueries] Generating ${numQueries} queries for context: "${logQuery}"${metadata ? ' with metadata: Yes' : ''}`);
  if (metadata) {
      outputFn('[generateQueries] Metadata (Venice AI response):');
      outputFn(typeof metadata === 'object' ? JSON.stringify(metadata, null, 2) : String(metadata));
  }

  // Create a prompt that adapts based on input length (heuristic for chat history)
  let enrichedPrompt = queryExpansionTemplate(query, learnings);

  // --- Refined Instructions for Broader Coverage ---
  const isLikelyChatHistory = query.length > 1000 || query.includes('\nuser:') || query.includes('\nassistant:'); // Heuristic check

  if (isLikelyChatHistory) {
    enrichedPrompt += `\n\nAnalyze the entire conversation history provided above. Identify the key distinct topics or questions discussed.
Generate ${numQueries} simple, clear search queries that cover the *most important themes* or *different key aspects* of the conversation. Aim for breadth if multiple topics are significant.`;
  } else {
    enrichedPrompt += `\n\nGenerate ${numQueries} simple, clear search queries based on the main topic of the text above. Focus on straightforward questions that will yield relevant results.`;
  }

  enrichedPrompt += `\nDO NOT use any special search operators or syntax.
Each query MUST be on a new line and MUST start with What, How, Why, When, Where, or Which.
Example format:
What is [topic]?
How does [aspect] work?
Why is [concept] important?`;
  // --- End Refined Instructions ---

  /**
   * Why: Maintain backward compatibility while research provider logic migrates to modular layers.
   * What: Re-exports service utilities so existing imports continue working during the transition.
   * How: Delegates to service implementations and utilities without adding new behavior.
   */

  export {
    generateOutput,
    generateQueries,
    processResults,
    generateSummary,
    generateQueriesLLM,
    generateSummaryLLM,
    processResultsLLM
  } from './research.providers.service.mjs';

  export { trimPrompt } from './research.providers.utils.mjs';
      temperature: 0.7,
