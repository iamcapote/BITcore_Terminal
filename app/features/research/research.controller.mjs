import { ResearchEngine } from '../../infrastructure/research/research.engine.mjs';
import { callVeniceWithTokenClassifier } from '../../utils/token-classifier.mjs';

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
 * @returns {Promise<Object>} Research results
 */
export async function runResearch(query, breadth = 3, depth = 2, useTokenClassifier = false, outputFn = console.log) {
  // Prepare query object
  let enhancedQuery = typeof query === 'string' ? { original: query } : query;
  
  // Apply token classification if requested
  if (useTokenClassifier && !enhancedQuery.metadata) {
    try {
      outputFn("Classifying query with token classifier...");
      const tokenMetadata = await callVeniceWithTokenClassifier(enhancedQuery.original);
      enhancedQuery.metadata = tokenMetadata;
      outputFn("Token classification completed.");
      outputFn(`Token classification result: ${tokenMetadata}`);
      outputFn("Using token classification to enhance research quality...");
    } catch (error) {
      outputFn(`Error during token classification: ${error.message}`);
      outputFn("Continuing with basic query...");
    }
  }

  // Create research engine
  outputFn(`\nStarting research...\nQuery: "${enhancedQuery.original}"\nDepth: ${depth} Breadth: ${breadth}\n${enhancedQuery.metadata ? "Using enhanced metadata from token classification" : ""}\n`);
  
  const engine = new ResearchEngine({
    query: enhancedQuery,
    breadth,
    depth,
    onProgress: (progress) => {
      outputFn(`Progress: ${progress.completedQueries}/${progress.totalQueries}`);
    }
  });

  // Execute research
  const result = await engine.research();
  
  // Output results
  outputFn("\nResearch complete!");
  if (result.learnings.length === 0) {
    outputFn("No learnings were found.");
  } else {
    outputFn("\nKey Learnings:");
    result.learnings.forEach((learning, i) => {
      outputFn(`${i + 1}. ${learning}`);
    });
  }
  
  if (result.sources.length > 0) {
    outputFn("\nSources:");
    result.sources.forEach(source => outputFn(`- ${source}`));
  }
  
  outputFn(`\nResults saved to: ${result.filename || "research folder"}`);
  
  return result;
}
