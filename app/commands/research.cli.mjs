import { getResearchData } from '../features/research/research.controller.mjs';
import { cleanQuery } from '../utils/research.clean-query.mjs';
import { ensureDir } from '../utils/research.ensure-dir.mjs';
import path from 'path';
import fs from 'fs/promises';
import readline from 'readline';
import { output } from '../utils/research.output-manager.mjs';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { callVeniceWithTokenClassifier } from '../utils/token-classifier.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import { 
  handleCliError, 
  ErrorTypes, 
  validateInputs, 
  logCommandStart, 
  logCommandSuccess 
} from '../utils/cli-error-handler.mjs';

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
  try {
    // Log command execution start
    logCommandStart('research', options, options.verbose);
    
    if (!userManager.isAuthenticated()) {
      return handleCliError(
        'You must be logged in to use the research feature',
        ErrorTypes.AUTHENTICATION,
        { 
          command: 'research',
          recoveryHint: 'Use /login to authenticate first'
        }
      );
    }

    if (!await userManager.hasApiKey('venice') || !await userManager.hasApiKey('brave')) {
      return handleCliError(
        'Missing API keys required for research',
        ErrorTypes.API_KEY,
        { 
          command: 'research',
          recoveryHint: 'Use /keys set to configure your API keys'
        }
      );
    }

    // Extract and validate options
    const { 
      query, 
      depth = 2, 
      breadth = 3, 
      outputDir = './research', 
      verbose = false,
      password
    } = options;
    
    // If no query provided, start interactive mode
    if (!query) {
      return await startInteractiveResearch(depth, breadth, outputDir, verbose);
    }
    
    // Remove password handling from research command
    // Old:
    // let userPassword = password;
    // if (!userPassword) {
    //   userPassword = await promptForPassword();
    //   if (!userPassword) {
    //     return handleCliError(
    //       'Password is required to decrypt API keys',
    //       ErrorTypes.API_KEY,
    //       { command: 'research' }
    //     );
    //   }
    // }
    
    // New: directly retrieve API keys (non‑auth command)
    const braveKey = await userManager.getApiKey('brave');
    const veniceKey = await userManager.getApiKey('venice');
    if (!braveKey || !veniceKey) {
      return handleCliError(
        'Failed to retrieve one or more API keys',
        ErrorTypes.API_KEY,
        { command: 'research' }
      );
    }
    // Set the API keys in the environment for this operation
    process.env.BRAVE_API_KEY = braveKey;
    process.env.VENICE_API_KEY = veniceKey;
    
    // Clean the query
    const cleanedQuery = cleanQuery(query);
    
    // Validate depth and breadth
    const validatedDepth = Math.min(Math.max(1, parseInt(depth)), 5);
    const validatedBreadth = Math.min(Math.max(2, parseInt(breadth)), 10);
    
    if (verbose) {
      output.log(`Starting research for: "${cleanedQuery}"`);
      output.log(`Parameters: depth=${validatedDepth}, breadth=${validatedBreadth}`);
      output.log(`Results will be saved to: ${outputDir}`);
    }
    
    // Ensure the output directory exists
    await ensureDir(outputDir);
    
    // Execute research using the getResearchData function
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
    
    // Log successful completion
    logCommandSuccess('research', { outputPath }, verbose);
    
    return { 
      success: true, 
      results: results,
      outputPath
    };
  } catch (error) {
    return handleCliError(
      error,
      error.name === 'SearchError' ? ErrorTypes.NETWORK : ErrorTypes.UNKNOWN,
      { 
        command: 'research',
        verbose: options.verbose
      }
    );
  }
}

/**
 * Start interactive research mode when no query is provided
 * 
 * @param {number} initialDepth - Initial depth value
 * @param {number} initialBreadth - Initial breadth value
 * @param {string} outputDir - Output directory
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Promise<Object>} Research results
 */
export async function startInteractiveResearch(initialDepth = 2, initialBreadth = 3, outputDir = './research', verbose = false) {
  // Removed the password parameter and any promptForPassword calls to ensure the research command does not handle passwords

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Log command start
    logCommandStart('research (interactive)', { depth: initialDepth, breadth: initialBreadth }, verbose);
    
    // Get research query
    const researchQuery = await askQuestion(rl, 'What would you like to research? ');
    if (!researchQuery.trim()) {
      rl.close();
      return handleCliError(
        'Query cannot be empty',
        ErrorTypes.INPUT_VALIDATION,
        { command: 'research', recoveryHint: 'Please provide a non-empty research query' }
      );
    }

    // Get research parameters
    const breadthStr = await askQuestion(rl, `Enter research breadth (2-10)? [${initialBreadth}] `);
    const depthStr = await askQuestion(rl, `Enter research depth (1-5)? [${initialDepth}] `);
    
    // Use token classifier
    const useClassifier = await askQuestion(rl, 'Would you like to use the token classifier to add metadata? (yes/no) [no] ');

    // Set up query and parameters
    const breadth = parseInt(breadthStr || initialBreadth.toString(), 10);
    const depth = parseInt(depthStr || initialDepth.toString(), 10);
    
    let enhancedQuery = { original: researchQuery };
    
    rl.close();

    // Retrieve decrypted API keys
    try {
      const braveKey = await userManager.getApiKey('brave');
      const veniceKey = await userManager.getApiKey('venice');
      
      if (!braveKey || !veniceKey) {
        return handleCliError(
          'Failed to decrypt one or more API keys',
          ErrorTypes.API_KEY,
          { command: 'research', recoveryHint: 'Check that your password is correct' }
        );
      }
      
      // Set the API keys in the environment for this operation
      process.env.BRAVE_API_KEY = braveKey;
      process.env.VENICE_API_KEY = veniceKey;
      
      // Use token classifier if requested (now that we have Venice API key)
      if (['yes', 'y'].includes(useClassifier.trim().toLowerCase())) {
        output.log('Classifying query with token classifier...');
        try {
          const tokenMetadata = await callVeniceWithTokenClassifier(researchQuery);
          enhancedQuery.metadata = tokenMetadata;
          output.log('Token classification completed.');
          output.log(`Token classification result: ${tokenMetadata}`);
          output.log('Using token classification to enhance research quality...');
        } catch (error) {
          output.error(`Error during token classification: ${error.message}`);
          output.log('Continuing with basic query...');
        }
      }
      
    } catch (error) {
      return handleCliError(
        error,
        ErrorTypes.API_KEY,
        { command: 'research', verbose }
      );
    }
    
    // Ensure output directory exists
    await ensureDir(outputDir);
    
    // Create and configure research engine
    output.log(`\nStarting research...\nQuery: "${researchQuery}"\nDepth: ${depth} Breadth: ${breadth}\n`);
    
    const engine = new ResearchEngine({
      query: enhancedQuery,
      breadth,
      depth,
      user: userManager.currentUser,  // Pass user for role-based limits
      onProgress: (progress) => {
        process.stdout.write(`\rProgress: ${progress.completedQueries}/${progress.totalQueries}`);
      }
    });
    
    // Execute research
    const result = await engine.research();
    output.log('\nResearch complete!');
    
    // Display results
    if (result.learnings.length === 0) {
      output.log('No learnings were found.');
    } else {
      output.log('\nKey Learnings:');
      result.learnings.forEach((learning, i) => {
        output.log(`${i + 1}. ${learning}`);
      });
    }
    
    if (result.sources.length > 0) {
      output.log('\nSources:');
      result.sources.forEach(source => output.log(`- ${source}`));
    }
    
    // Generate output filename based on the query
    const safeFilename = researchQuery.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `research-${safeFilename}-${timestamp}.md`;
    const outputPath = path.join(outputDir, filename);
    
    // Convert results to markdown format
    const markdown = generateMarkdown(researchQuery, result);
    
    // Save results to file
    await fs.writeFile(outputPath, markdown);
    
    output.log(`\nResults saved to: ${outputPath}`);
    
    // Log successful completion
    logCommandSuccess('research (interactive)', { outputPath }, verbose);
    
    return {
      success: true,
      results: result,
      outputPath
    };
  } catch (error) {
    rl.close();
    return handleCliError(
      error,
      error.name === 'SearchError' ? ErrorTypes.NETWORK : ErrorTypes.UNKNOWN,
      { command: 'research', verbose }
    );
  }
}

/**
 * Helper function to ask a question in the console
 * 
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User's answer
 */
function askQuestion(rl, question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
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
