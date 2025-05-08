import fetch from 'node-fetch';
import { output } from './research.output-manager.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { getDefaultTokenClassifierCharacterSlug } from '../infrastructure/ai/venice.characters.mjs';
// Removed VENICE_CHARACTERS import as it wasn't used

/**
 * Sends a query to the Venice API for token classification.
 * @param {string} query - The user query.
 * @param {string} veniceApiKey - The decrypted Venice API key.
 * @returns {Promise<string|null>} The token classification response in plain text, or null if classification fails non-critically.
 * @throws {Error} If API key is missing or API call fails critically.
 */
export async function callVeniceWithTokenClassifier(query, veniceApiKey) {
  // Use the passed-in API key
  const apiKey = veniceApiKey;
  const baseUrl = 'https://api.venice.ai/api/v1/chat/completions';

  if (!apiKey) {
    // This is a critical configuration error, throw it.
    const errorMsg = 'Missing Venice API Key for token classification.';
    output.log(`[TokenClassifier] Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const llm = new LLMClient({ apiKey: veniceApiKey });

  // Use a specific character/prompt for classification if desired, otherwise default
  // Using 'metacore' as previously defined, assuming it's suitable.
  const payload = {
    // Use a known valid model, consistent with LLMClient default
    model: 'llama-3.3-70b',
    messages: [{ role: 'user', content: query }],
    // Ensure venice_parameters and character_slug are correct
    venice_parameters: { character_slug: getDefaultTokenClassifierCharacterSlug() },
  };

  try {
    output.log('[TokenClassifier] Sending query to Venice API for classification...');
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
          errorDetails = await response.text();
      } catch (_) {
          // Ignore error reading body
      }
      // Log the specific model used in the error message
      const errorMessage = `Venice API Error for model ${payload.model} (${response.status}): ${errorDetails || response.statusText || 'Unknown error'}`;
      output.log(`[TokenClassifier] ${errorMessage}`);
      // Treat API errors as non-critical for classification, return null
      // throw new Error(errorMessage); // Don't throw, allow research to continue
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      output.log('[TokenClassifier] Invalid or empty response content from Venice API.');
      // Return null if content is missing, allow research to continue
      return null;
    }

    output.log('[TokenClassifier] Token classification completed successfully.');
    return content; // Return the plain text response
  } catch (error) {
    // Catch network errors or other unexpected issues during fetch
    // Log the specific model used in the error message
    output.log(`[TokenClassifier] Error calling Venice API (model: ${payload.model}): ${error.message}`);
    // Return null on fetch errors, allow research to continue
    // throw new Error(`Failed to classify query using Venice API: ${error.message}`);
    return null;
  }
}
