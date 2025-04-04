import { getResearchData } from '../features/research/research.controller.mjs';
import { cleanQuery } from '../utils/research.clean-query.mjs';
import { ensureDir } from '../utils/research.ensure-dir.mjs';
import path from 'path';
import fs from 'fs/promises';

/**
 * CLI command for executing the research pipeline
 * 
 * @param {Object} options - Command options
 * @param {string} options.query - The research query
 * @param {number} options.depth - Research depth (1-5)
 * @param {number} options.breadth - Research breadth (2-10)
 * @param {string} options.outputDir - Custom output directory
 * @param {boolean} options.verbose - Enable verbose logging
 * @returns {Promise<Object>} Research results
 */
export async function executeResearch(options = {}) {
  // Extract and validate options
  const { 
    query, 
    depth = 2, 
    breadth = 3, 
    outputDir = './research', 
    verbose = false 
  } = options;
  
  if (!query) {
    console.error('Error: No research query provided');
    console.log('Usage: /research "Your research query" [--depth=2] [--breadth=3]');
    return { success: false, error: 'No query provided' };
  }
  
  // Clean the query
  const cleanedQuery = cleanQuery(query);
  
  // Validate depth and breadth
  const validatedDepth = Math.min(Math.max(1, parseInt(depth)), 5);
  const validatedBreadth = Math.min(Math.max(2, parseInt(breadth)), 10);
  
  if (verbose) {
    console.log(`Starting research for: "${cleanedQuery}"`);
    console.log(`Parameters: depth=${validatedDepth}, breadth=${validatedBreadth}`);
    console.log(`Results will be saved to: ${outputDir}`);
  }
  
  try {
    // Ensure the output directory exists
    await ensureDir(outputDir);
    
    // Execute research using the getResearchData function instead of ResearchController
    const results = await getResearchData(
      cleanedQuery,
      validatedDepth,
      validatedBreadth
    );
    
    // Generate output filename based on the query
    const safeFilename = cleanedQuery.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `${safeFilename}_${timestamp}.md`;
    const outputPath = path.join(outputDir, filename);
    
    // Convert results to markdown format
    const markdown = generateMarkdown(cleanedQuery, results);
    
    // Save results to file
    await fs.writeFile(outputPath, markdown);
    
    if (verbose) {
      console.log(`Research completed successfully`);
      console.log(`Results saved to: ${outputPath}`);
    }
    
    return { 
      success: true, 
      results: results,
      outputPath
    };
  } catch (error) {
    console.error('Research failed:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Generate markdown content from research results
 * 
 * @param {string} query - The original research query
 * @param {Object} results - Research results object
 * @returns {string} Formatted markdown content
 */
function generateMarkdown(query, results) {
  return [
    '# Research Results',
    '----------------',
    `## Query: ${query}`,
    '',
    results.filename ? `Original file: ${results.filename}` : '',
    '',
    '## Key Learnings',
    ...results.learnings.map((l, i) => `${i + 1}. ${l}`),
    '',
    '## Sources',
    ...results.sources.map(s => `- ${s}`),
  ].join('\n');
}
