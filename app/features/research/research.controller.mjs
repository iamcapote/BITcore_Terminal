import ResearchEngine from '../../infrastructure/research/research.engine.mjs';
import { callVeniceWithTokenClassifier } from '../../utils/token-classifier.mjs';
import { userManager } from '../auth/user-manager.mjs'; // Assuming userManager is exported

/**
 * Fetches research data based on a query
 */
export async function getResearchData(query = 'default research topic', depth = 2, breadth = 3) {
  try {
    const engine = new ResearchEngine({ query, depth, breadth });
    return await engine.research();
  } catch (error) {
    console.error('Error in getResearchData:', error);
    return {
      learnings: [`Error researching: ${query}`],
      sources: [],
      error: error.message
    };
  }
}

/**
 * Fetches preexisting research data by path
 */
export async function getResearchByPath(path) {
  // This would be implemented to fetch research from a saved location
  throw new Error('Not implemented yet');
}

/**
 * Run a complete research operation with optional token classification
 * 
 * @param {string|Object} query - The query string or object with original and metadata properties
 * @param {number} breadth - Research breadth
 * @param {number} depth - Research depth
 * @param {boolean} useTokenClassifier - Whether to enhance query with token classification
 * @param {Function} outputFn - Function to output messages (defaults to console.log)
 * @param {Function} errorFn - Function to output errors (defaults to console.error)
 * @param {Function} progressFn - Function to report progress
 * @param {string} username - Username for retrieving API keys
 * @param {string} password - Password for retrieving API keys
 * @returns {Promise<Object>} Research results
 */
export async function runResearch(query, breadth = 3, depth = 2, useTokenClassifier = false, outputFn = console.log, errorFn = console.error, progressFn = null, username = null, password = null) {
  let enhancedQuery = typeof query === 'string' ? { original: query } : { ...query }; // Clone query object

  let braveApiKey = process.env.BRAVE_API_KEY;
  let veniceApiKey = process.env.VENICE_API_KEY;

  // Attempt to get user-specific keys if username and password provided
  if (username && password) {
    try {
      outputFn(`[Controller] Attempting to retrieve API keys for user ${username}...`);
      const userBraveKey = await userManager.getApiKey('brave', password, username);
      if (userBraveKey) {
        braveApiKey = userBraveKey;
        outputFn('[Controller] Using user-specific Brave API key.');
      } else {
        outputFn('[Controller] User-specific Brave key not found or decryption failed, falling back to environment variable.');
      }
      const userVeniceKey = await userManager.getApiKey('venice', password, username);
      if (userVeniceKey) {
        veniceApiKey = userVeniceKey;
        outputFn('[Controller] Using user-specific Venice API key.');
      } else {
        outputFn('[Controller] User-specific Venice key not found or decryption failed, falling back to environment variable.');
      }
    } catch (err) {
      errorFn(`[Controller] Error retrieving API keys for user ${username}: ${err.message}. Falling back to environment variables.`);
      // Continue with potentially undefined keys from env vars, ResearchEngine/Providers will throw if needed
    }
  } else {
    outputFn('[Controller] No user credentials provided, using API keys from environment variables.');
  }

  if (!braveApiKey) {
      errorFn('[Controller] Brave API Key is missing. Research cannot proceed.');
      throw new Error('Brave API Key is missing.');
  }
   if (!veniceApiKey) {
      errorFn('[Controller] Venice API Key is missing. Research cannot proceed without LLM.');
      throw new Error('Venice API Key is missing.');
  }


  // Apply token classification if requested
  if (useTokenClassifier && !enhancedQuery.metadata) {
    try {
      outputFn("Classifying query with token classifier...");
      const tokenMetadata = await callVeniceWithTokenClassifier(enhancedQuery.original, { apiKey: veniceApiKey, outputFn, errorFn }); // Pass necessary options
      enhancedQuery.metadata = tokenMetadata;
      outputFn("Token classification completed.");
      // outputFn(`Token classification result: ${JSON.stringify(tokenMetadata)}`); // Already logged in classifier
      outputFn("Using token classification to enhance research quality...");
    } catch (error) {
      errorFn(`Error during token classification: ${error.message}`);
      outputFn("Continuing with basic query...");
      // Do not throw, allow research to continue without metadata
    }
  }

  // Create research engine
  outputFn(`\nStarting research...\nQuery: "${enhancedQuery.original}"\nDepth: ${depth} Breadth: ${breadth}\n${enhancedQuery.metadata ? "Using enhanced metadata from token classification" : ""}\n`);

  const engine = new ResearchEngine({
    query: enhancedQuery,
    breadth,
    depth,
    braveApiKey, // Pass key
    veniceApiKey, // Pass key
    outputFn, // Pass outputFn for internal logging
    errorFn,  // Pass errorFn for internal logging
    onProgress: progressFn // Pass the progress callback directly
  });

  // Execute research
  const result = await engine.research();

  // Output final summary and learnings (optional, as engine logs this too)
  // outputFn("\nResearch complete!"); // Logged by engine
  // if (result.learnings.length === 0) {
  //   outputFn("No learnings were found.");
  // } else {
  //   outputFn("\n--- Key Learnings ---");
  //   result.learnings.forEach((learning, i) => {
  //     outputFn(`${i + 1}. ${learning}`);
  //   });
  // }
  // if (result.summary) {
  //     outputFn('\n--- Research Summary ---');
  //     outputFn(result.summary);
  // }
  // if (result.sources.length > 0) {
  //   outputFn("\n--- Sources ---");
  //   result.sources.forEach(source => outputFn(`- ${source}`));
  // }
  // outputFn(`\nResults saved to: ${result.filename || "research folder"}`); // Logged by engine

  return result; // Return the full result object including markdownContent and filename
}
