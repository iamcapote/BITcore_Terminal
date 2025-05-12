import fetch from 'node-fetch';
import { output } from './research.output-manager.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { cleanChatResponse } from '../infrastructure/ai/venice.response-processor.mjs';
import { getDefaultTokenClassifierCharacterSlug } from '../infrastructure/ai/venice.characters.mjs';
// Removed VENICE_CHARACTERS import as it wasn't used

/**
 * Sends a query to the Venice API for token classification.
 * @param {string} query - The user query.
 * @param {string} veniceApiKey - The decrypted Venice API key.
 * @param {function} debugHandler - Optional debug handler for logging.
 * @returns {Promise<object|null>} The token classification response as a JSON object, or null if classification fails non-critically.
 * @throws {Error} If API key is missing or API call fails critically.
 */
export async function callVeniceWithTokenClassifier(query, veniceApiKey, debugHandler = console.log) {
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

  const systemPrompt = `You are a sophisticated token classification and query analysis AI.
Your task is to analyze the user's query and return a JSON object containing structured metadata.
This metadata should identify key entities, intents, sentiment, and any other relevant classifications that can help refine a subsequent search process.
DO NOT add any explanatory text outside the JSON object. The response MUST be only the JSON object.
Example Query: "latest advancements in mRNA vaccine technology for cancer treatment"
Example JSON Output:
{
  "query": "latest advancements in mRNA vaccine technology for cancer treatment",
  "main_topic": "mRNA vaccine technology",
  "sub_topics": ["cancer treatment", "latest advancements"],
  "key_entities": [
    {"text": "mRNA vaccine", "type": "Technology"},
    {"text": "cancer", "type": "Disease"}
  ],
  "intent": "Information seeking",
  "sentiment": "Neutral",
  "time_sensitivity": "High (latest)",
  "scope": "Specific (advancements in technology for a particular application)"
}`;

  try {
    debugHandler(`[TokenClassifier] Sending query to Venice for classification: "${query.substring(0, 100)}..." (Using character: ${characterSlug})`);
    const response = await llmClient.completeChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      maxTokens: 1000,
      venice_parameters: { character_slug: characterSlug }
    });

    const rawResponse = response.content;
    debugHandler(`[TokenClassifier] Raw response from Venice: ${rawResponse.substring(0, 200)}...`);

    const cleanedResponse = cleanChatResponse(rawResponse);
    // Try to find a JSON object within the response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/); 

    if (jsonMatch) {
      const classificationData = JSON.parse(jsonMatch[0]);
      debugHandler('[TokenClassifier] Successfully parsed JSON from classification response.');
      return classificationData;
    } else {
      debugHandler('[TokenClassifier] No valid JSON object found in the classification response. Raw response was: ' + cleanedResponse);
      return null;
    }
  } catch (error) {
    // Log the full error from LLMClient if it's an LLMError
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[TokenClassifier] Error during token classification: ${errorMessage}`, errorStack);
    
    if (errorMessage.toLowerCase().includes('api key is required')) {
        // This indicates an issue with the key passed to LLMClient or its internal fallback
        throw new Error(`Token classification failed: Venice API key issue. ${errorMessage}`);
    }
    // For other errors, return null to allow research to proceed without classification
    return null;
  }
}
