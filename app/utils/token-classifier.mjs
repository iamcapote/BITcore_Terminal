import fetch from 'node-fetch';
import { output } from './research.output-manager.mjs';

/**
 * Sends a query to the Venice API for token classification.
 * @param {string} query - The user query.
 * @returns {Promise<string>} The token classification response in plain text.
 */
export async function callVeniceWithTokenClassifier(query) {
  const apiKey = process.env.VENICE_API_KEY;
  const baseUrl = 'https://api.venice.ai/api/v1/chat/completions';

  if (!apiKey) {
    output.log('[TokenClassifier] Missing VENICE_API_KEY in environment variables.');
    throw new Error('Missing VENICE_API_KEY in environment variables.');
  }

  const payload = {
    model: 'llama-3.3-70b',
    messages: [{ role: 'user', content: query }],
    venice_parameters: { character_slug: 'archon-01v' },
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
      const errorDetails = await response.text();
      const errorMessage = errorDetails || response.statusText || 'Unknown error';
      output.log(`[TokenClassifier] Venice API error: ${errorMessage}`);
      throw new Error(`Venice API error: ${errorMessage}`);
    }

    const data = await response.json();
    if (!data || !data.choices || !data.choices[0]?.message?.content) {
      output.log('[TokenClassifier] Invalid response format from Venice API.');
      throw new Error('Invalid response format from Venice API.');
    }

    output.log('[TokenClassifier] Token classification completed successfully.');
    return data.choices[0].message.content; // Return the plain text response
  } catch (error) {
    output.log(`[TokenClassifier] Error calling Venice API: ${error.message}`);
    throw new Error('Failed to classify query using Venice API.');
  }
}
