import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { callVeniceWithTokenClassifier } from '../../utils/token-classifier.mjs';
import { resolveResearchDefaults } from './research.defaults.mjs';
import { resolveApiKeys } from '../../utils/api-keys.mjs';

/**
 * Fetches research data based on a query
 */
export async function getResearchData(query = 'default research topic', depthOverride, breadthOverride, visibilityOverride) {
  try {
    const queryObject = typeof query === 'string'
      ? { original: query }
      : { original: query?.original || 'default research topic', metadata: query?.metadata || null };

    const { depth, breadth, isPublic } = await resolveResearchDefaults({
      depth: depthOverride,
      breadth: breadthOverride,
      isPublic: visibilityOverride,
    });

    const engine = new ResearchEngine({ query: queryObject, depth, breadth });
    const result = await engine.research({ query: queryObject, depth, breadth });
    return { ...result, visibility: isPublic ? 'public' : 'private' };
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
export async function runResearch(query, breadthOverride, depthOverride, useTokenClassifier = false, outputFn = console.log, errorFn = console.error, progressFn = null, username = null, password = null) {
  let enhancedQuery = typeof query === 'string' ? { original: query } : { ...query }; // Clone query object

  const { depth, breadth, isPublic } = await resolveResearchDefaults({
    depth: depthOverride,
    breadth: breadthOverride,
  });

  const { brave: braveApiKey, venice: veniceApiKey } = await resolveApiKeys();

  if (!braveApiKey) {
      errorFn('[Controller] Brave API key is missing. Configure it via environment variables or /keys set brave.');
      throw new Error('Brave API key is missing.');
  }
  if (!veniceApiKey) {
      errorFn('[Controller] Venice API key is missing. Configure it via environment variables or /keys set venice.');
      throw new Error('Venice API key is missing.');
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
  outputFn(`\nStarting research...\nQuery: "${enhancedQuery.original}"\nDepth: ${depth} Breadth: ${breadth}\nVisibility: ${isPublic ? 'Public' : 'Private'}\n${enhancedQuery.metadata ? "Using enhanced metadata from token classification" : ""}\n`);

  const engine = new ResearchEngine({
    query: enhancedQuery,
    breadth,
    depth,
    visibility: isPublic ? 'public' : 'private',
    isPublic,
    braveApiKey,
    veniceApiKey,
    outputHandler: outputFn,
    errorHandler: errorFn,
    progressHandler: progressFn
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

  return { ...result, visibility: isPublic ? 'public' : 'private' }; // Return the full result with visibility annotation
}
