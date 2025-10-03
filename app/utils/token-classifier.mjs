/**
 * Token Classification Utilities
 * Why: Offer a resilient helper for routing chat inputs through Venice token classification when available.
 * What: Provides a single function that validates inputs, invokes Venice, and returns the cleaned classification output.
 * How: Normalizes debug logging, injects the LLM client, and guards errors with structured logging and graceful fallbacks.
 */

import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { cleanChatResponse } from '../infrastructure/ai/venice.response-processor.mjs';
import { getDefaultTokenClassifierCharacterSlug } from '../infrastructure/ai/venice.characters.mjs';
import { createModuleLogger } from './logger.mjs';
// Removed VENICE_CHARACTERS import as it wasn't used

const moduleLogger = createModuleLogger('utils.token-classifier');

function defaultDebug(message) {
  moduleLogger.debug(message);
}

/**
 * Sends a query to the Venice API for token classification.
 * @param {string} query - The user query.
 * @param {string} veniceApiKey - The decrypted Venice API key.
 * @param {function} debugHandler - Optional debug handler for logging.
 * @returns {Promise<string|null>} The AI's response as a string, or null if classification fails non-critically.
 * @throws {Error} If API key is missing or API call fails critically.
 */
export async function callVeniceWithTokenClassifier(query, veniceApiKey, debugHandler = defaultDebug) {
  if (!veniceApiKey) {
    debugHandler('[TokenClassifier] Venice API key not provided. Skipping classification.');
    return null;
  }
  if (!query || query.trim() === '') {
    debugHandler('[TokenClassifier] Empty query provided. Skipping classification.');
    return null;
  }

  const llmConfig = { 
    apiKey: veniceApiKey,
    // Pass the debugHandler to LLMClient if it supports errorFn/outputFn for its own logging
    // errorFn: debugHandler, // Or a more specific error handler
    // outputFn: debugHandler // For LLMClient's own verbose logs
  };
  const llmClient = new LLMClient(llmConfig);
  const characterSlug = getDefaultTokenClassifierCharacterSlug();

  try {
    debugHandler(`[TokenClassifier] Sending query to Venice for classification: "${query.substring(0, 100)}..." (Using character: ${characterSlug})`);
    const response = await llmClient.completeChat({
      messages: [
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      maxTokens: 1000,
      venice_parameters: { character_slug: characterSlug }
    });

    const rawResponse = response.content;
    debugHandler(`[TokenClassifier] Raw response from Venice: ${rawResponse.substring(0, 200)}...`);

    const cleanedResponse = cleanChatResponse(rawResponse);
    
    if (cleanedResponse && cleanedResponse.trim() !== '') {
      debugHandler('[TokenClassifier] Successfully received and cleaned response from Venice.');
      return cleanedResponse;
    } else {
      debugHandler('[TokenClassifier] Empty or invalid response received after cleaning. Raw response was: ' + rawResponse);
      return null;
    }
  } catch (error) {
    // Log the full error from LLMClient if it's an LLMError
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    moduleLogger.error('Token classification failed.', {
      message: errorMessage,
      stack: errorStack || null
    });
    debugHandler(`[TokenClassifier] Error during token classification: ${errorMessage}`);
    
    if (errorMessage.toLowerCase().includes('api key is required')) {
        // This indicates an issue with the key passed to LLMClient or its internal fallback
        throw new Error(`Token classification failed: Venice API key issue. ${errorMessage}`);
    }
    // For other errors, return null to allow research to proceed without classification
    return null;
  }
}
