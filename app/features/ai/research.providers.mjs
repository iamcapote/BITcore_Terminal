import { LLMClient, LLMError } from '../../infrastructure/ai/venice.llm-client.mjs'; // Import LLMError
import { systemPrompt, queryExpansionTemplate } from '../../utils/research.prompt.mjs';
import { VENICE_CHARACTERS, getDefaultResearchCharacterSlug, getDefaultTokenClassifierCharacterSlug } from '../../infrastructure/ai/venice.characters.mjs';

function processQueryResponse(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  // Handle optional leading characters like '*', '-', or '1.' before the question word
  const queries = lines
    .map(line => line.replace(/^[\*\-\d\.]+\s*/, '')) // Remove list markers
    .filter(line => line.match(/^(What|How|Why|When|Where|Which)/i));
  if (queries.length > 0) {
    return { success: true, queries };
  }
  // Log the raw text if parsing fails to help debug
  console.error('[processQueryResponse] Failed to parse queries. Raw text:', rawText);
  return { success: false, error: 'No valid questions found starting with What/How/Why/etc.' };
}

function processLearningResponse(rawText) {
  console.log('[processLearningResponse] Raw text received:\n---START---\n', rawText, '\n---END---'); // DEBUG LOG

  // More robust regex: Find headers, capture content until next known header or end of string
  // Use non-greedy matching ([\s\S]*?)
  const learningsMatch = rawText.match(/Key Learnings:([\s\S]*?)(Follow-up Questions:|$)/i);
  const questionsMatch = rawText.match(/Follow-up Questions:([\s\S]*)/i);

  console.log('[processLearningResponse] Learnings Match Group 1:', learningsMatch ? learningsMatch[1].trim() : 'null'); // DEBUG LOG
  console.log('[processLearningResponse] Questions Match Group 1:', questionsMatch ? questionsMatch[1].trim() : 'null'); // DEBUG LOG

  const parseSection = (sectionText) => {
    if (!sectionText) return [];
    return sectionText
      .split('\n')
      .map(l => l.trim().replace(/^-|^\*|^\d+\.?\s*/, '').trim()) // More robust list marker removal
      .filter(Boolean);
  };

  const learnings = parseSection(learningsMatch ? learningsMatch[1] : null);
  const followUpQuestions = parseSection(questionsMatch ? questionsMatch[1] : null);

  console.log('[processLearningResponse] Parsed Learnings:', learnings); // DEBUG LOG
  console.log('[processLearningResponse] Parsed Follow-up Questions:', followUpQuestions); // DEBUG LOG

  if (learnings.length > 0 || followUpQuestions.length > 0) { // Require at least one learning OR question
    return { success: true, learnings, followUpQuestions };
  }

  // Log specific reasons for failure
  if (!learningsMatch && !questionsMatch) {
    console.error('[processLearningResponse] Failed to find "Key Learnings:" or "Follow-up Questions:" headers.');
    return { success: false, error: 'Could not find required sections (Key Learnings/Follow-up Questions) in the response.' };
  } else if (learnings.length === 0 && followUpQuestions.length === 0) {
     console.warn('[processLearningResponse] Found headers but content was empty or invalid after cleaning.');
     // Return success: false but indicate it was a parsing/content issue, not header issue
     return { success: false, error: 'Found learning/question sections but content was empty or invalid after cleaning.' };
  } else {
      // Should not be reached with current logic, but as a fallback
      console.error('[processLearningResponse] Unknown parsing failure state.');
      return { success: false, error: 'Unknown error parsing learnings and questions.' };
  }
}

function processReportResponse(rawText) {
  if (!rawText.trim()) {
    return { success: false, error: 'Empty report text' };
  }
  return { success: true, reportMarkdown: rawText };
}

function processResponse(type, content) {
  switch (type) {
    case 'query':
      return processQueryResponse(content);
    case 'learning':
      return processLearningResponse(content);
    case 'report':
      return processReportResponse(content);
    default:
      return { success: false, error: 'Unknown type' };
  }
}


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
  // ** Add explicit checks for required parameters **
  if (!apiKey) {
      errorFn("[generateQueries] Error: API key is missing.");
      throw new Error('API key is required for generateQueries.');
  }
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

  if (metadata) {
    // Include metadata but keep instructions very simple
    // Ensure metadata is stringified if it's an object
    const metadataString = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata);
    enrichedPrompt = `${enrichedPrompt}\n\nAdditional context from query analysis:\n${metadataString}\n\n
Based on this context and the original text, generate simple search queries that a person would naturally type.
Keep queries plain, clear, and focused on the core concepts identified. Ensure they are formatted correctly: each on a new line, starting with What, How, Why, When, Where, or Which.`;
  }

  const result = await generateOutput({
    apiKey, // Pass key
    type: 'query',
    system: systemPrompt(),
    prompt: enrichedPrompt,
    temperature: 0.7,
    maxTokens: 500, // Reduced max tokens for query generation
    outputFn,
    errorFn
  });

  // --- Start: Enhanced Logging ---
  outputFn(`[generateQueries] LLM result for query generation:`, JSON.stringify(result));
  // --- End: Enhanced Logging ---

  if (result.success && result.data.queries && result.data.queries.length > 0) {
    const lines = result.data.queries;
    // Ensure queries are trimmed and filter out any potential empty lines again
    // Return objects with the 'original' property
    const queries = lines.map(q => q.trim()).filter(Boolean).slice(0, numQueries).map(q => ({
      original: q, // Use 'original' key
      metadata: { goal: `Research: ${q}` } // Store goal in metadata
    }));

    // After generating queries
    if (Array.isArray(queries)) {
        outputFn('[generateQueries] Successfully generated queries:');
        queries.forEach((q, i) => {
            outputFn(`  ${i + 1}. ${q.original}${q.metadata ? ` [metadata: ${JSON.stringify(q.metadata)}]` : ''}`);
        });
    }

    return queries;
  } else {
      // --- Start: Log the specific error from the result object ---
      errorFn(`[generateQueries] Failed to generate queries via LLM. Error: ${result?.error || 'Unknown error during generateOutput'}. Falling back to basic queries.`);
      // --- End: Log the specific error ---

      // --- Refined Fallback Logic ---
      // Try to extract a potential topic from the beginning of the query/context string
      // This is a heuristic and might need improvement.
      let fallbackTopic = "the topic";
      const firstUserMessageMatch = query.match(/user:\s*(.*?)(\n|$)/i);
      if (firstUserMessageMatch && firstUserMessageMatch[1].trim()) {
          fallbackTopic = firstUserMessageMatch[1].trim();
          // Limit topic length for fallback queries
          if (fallbackTopic.length > 50) {
              fallbackTopic = fallbackTopic.substring(0, 50) + "...";
          }
      } else if (query.length < 100) {
          // If the original query is short, use it as the topic
          fallbackTopic = query;
      }
      errorFn(`[generateQueries] Using fallback topic: "${fallbackTopic}"`);

      // Generate very simple fallback queries based on the extracted topic
      return [
        { original: `What is ${fallbackTopic}?`, metadata: { goal: `Research definition of: ${fallbackTopic}` } },
        { original: `How does ${fallbackTopic} work?`, metadata: { goal: `Research how ${fallbackTopic} works` } },
        { original: `Examples of ${fallbackTopic}`, metadata: { goal: `Research examples of: ${fallbackTopic}` } }
      ].slice(0, numQueries); // Ensure fallback respects numQueries
  }
}

/**
 * Processes search results content to extract learnings and follow-up questions.
 * @param {Object} params - Parameters for processing results.
 * @param {string} params.apiKey - The Venice API key.
 * @param {string} params.query - The original user query or sub-query.
 * @param {Array<string>} params.content - Array of text content strings from search results.
 * @param {number} [params.numLearnings=3] - Minimum number of learnings to extract.
 * @param {number} [params.numFollowUpQuestions=3] - Minimum number of follow-up questions.
 * @param {string|null} [params.metadata=null] - Metadata from token classification or other context.
 * @param {function} [params.outputFn=console.log] - Function to handle output logs.
 * @param {function} [params.errorFn=console.error] - Function to handle error logs.
 * @returns {Promise<Object>} - Object containing arrays of learnings and followUpQuestions.
 */
export async function processResults({ apiKey, query, content, numLearnings = 3, numFollowUpQuestions = 3, metadata = null, outputFn = console.log, errorFn = console.error }) {
  // ** Add explicit checks for required parameters **
  if (!apiKey) {
      errorFn("[processResults] Error: API key is missing.");
      throw new Error('API key is required for processResults.'); // Keep throwing for fatal config issues
  }
  if (!Array.isArray(content) || content.length === 0) {
      errorFn(`[processResults] Error: Invalid content provided for query "${query}". Must be a non-empty array.`);
      // If no content, we can't extract anything. Return empty results.
      return { learnings: [], followUpQuestions: [] };
  }
  // --- FIX: Use || instead of or ---
  if (isNaN(numLearnings) || numLearnings < 0) numLearnings = 3;
  if (isNaN(numFollowUpQuestions) || numFollowUpQuestions < 0) numFollowUpQuestions = 3;
  // --- END FIX ---

  // Build a prompt that better incorporates metadata if available
  let analysisPrompt = `Analyze the following content related to "${query}":\n\n`;

  // More effective use of metadata to guide analysis
  if (metadata) {
    const metadataString = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata);
    analysisPrompt += `Context from query analysis:\n${metadataString}\n\nUse this context to better interpret the query "${query}" and extract the most relevant information from the content below.\n\n`;
  }

  // Combine content, ensuring it doesn't exceed limits (simple trim for now)
  const combinedContent = content.map(txt => `---\n${txt}\n---`).join('\n');
  const maxContentLength = 50000; // Adjust as needed based on model limits
  const trimmedContent = trimPrompt(combinedContent, maxContentLength);
  if (combinedContent.length > maxContentLength) {
      errorFn(`[processResults] Content truncated to ${maxContentLength} characters for analysis.`);
  }
  outputFn(`[processResults] Combined content length for analysis: ${trimmedContent.length} characters.`);

  analysisPrompt += `Content:\n${trimmedContent}\n\n`;
  // Updated prompt format example
  analysisPrompt += `Based *only* on the content provided above, extract:\n1. Key Learnings (at least ${numLearnings}):\n   - Focus on specific facts, data points, or summaries found in the text.\n   - Each learning should be a concise statement.\n2. Follow-up Questions (at least ${numFollowUpQuestions}):\n   - Generate questions that arise *directly* from the provided content and would require further research.\n   - Must start with What, How, Why, When, Where, or Which.\n\nFormat the output strictly as:\nKey Learnings:\n- [Learning 1]\n- [Learning 2]\n...\n\nFollow-up Questions:\n- [Question 1]\n- [Question 2]\n...`;

  outputFn(`[processResults] Final prompt for learning extraction (query: "${query}"):\n---START---\n`, analysisPrompt, `\n---END---`);

  const result = await generateOutput({
    apiKey, // Pass key
    type: 'learning',
    system: systemPrompt(), // Use standard system prompt
    prompt: analysisPrompt,
    temperature: 0.5,
    maxTokens: 1000, // Allow sufficient tokens for learnings/questions
    outputFn,
    errorFn
  });

  outputFn(`[processResults] LLM result for learning extraction (query: "${query}"):`, JSON.stringify(result));

  if (result.success && result.data) { // Check result.data exists
    // Ensure arrays exist even if empty
    const extractedLearnings = (result.data.learnings || []);
    const extractedFollowUpQuestions = (result.data.followUpQuestions || []);
    outputFn(`[processResults] Successfully extracted ${extractedLearnings.length} learnings and ${extractedFollowUpQuestions.length} follow-up questions for query: "${query}"`); // DEBUG LOG
    // Slice *after* logging the total extracted count
    const finalLearnings = extractedLearnings.slice(0, numLearnings);
    const finalFollowUpQuestions = extractedFollowUpQuestions.slice(0, numFollowUpQuestions);
    return { learnings: finalLearnings, followUpQuestions: finalFollowUpQuestions };
  } else {
    // --- ADJUSTED ERROR HANDLING WITH FALLBACK ---
    if (result.isApiError) {
        // If the API call itself failed (network, key, etc.), re-throw the error.
        errorFn(`[processResults] CRITICAL: LLM API call failed for query "${query}". Error: ${result.error}`);
        throw new Error(`LLM API call failed during learning extraction: ${result.error}`);
    } else {
        // If it was a parsing failure (LLM response received but not parsable),
        // log the error and attempt fallback extraction from raw content.
        errorFn(`[processResults] WARNING: Failed to parse LLM response structure for learning extraction (query: "${query}"). Error: ${result.error || 'Unknown parsing error'}. Attempting fallback extraction.`);

        if (result.rawContent) {
            // Simple Fallback: Split by lines, remove common list markers, filter empty lines and potential headers/instructions.
            const lines = result.rawContent.split('\n');
            const potentialLearnings = lines
                .map(line => line.trim().replace(/^[\*\-\d\.]+\s*/, '').trim()) // Remove list markers
                .filter(line => line.length > 10 && // Filter very short lines (adjust threshold as needed)
                               !line.toLowerCase().startsWith('key learnings:') &&
                               !line.toLowerCase().startsWith('follow-up questions:') &&
                               !line.toLowerCase().startsWith('based only on the content') && // Filter out parts of the prompt
                               !line.toLowerCase().startsWith('analyze the following content') &&
                               !line.toLowerCase().startsWith('content:') &&
                               !line.toLowerCase().startsWith('---') && // Filter separators
                               !line.match(/^[\d\.\s]*$/) // Filter lines with only numbers/dots/spaces
                       );

            if (potentialLearnings.length > 0) {
                errorFn(`[processResults] Fallback extraction yielded ${potentialLearnings.length} potential learnings.`);
                // Return the first few potential learnings as fallback, ensure no follow-up questions from fallback
                return { learnings: potentialLearnings.slice(0, numLearnings), followUpQuestions: [] };
            } else {
                errorFn(`[processResults] Fallback extraction failed to find usable lines in raw content.`);
                return { learnings: [], followUpQuestions: [] }; // Fallback failed, return empty
            }
        } else {
            // Raw content wasn't available for some reason (shouldn't happen with generateOutput changes)
            errorFn(`[processResults] Raw content not available for fallback extraction.`);
            return { learnings: [], followUpQuestions: [] }; // Cannot perform fallback, return empty
        }
    }
    // --- END ADJUSTED ERROR HANDLING ---
  }
}

/**
 * Generates a narrative summary based on the query and accumulated learnings.
 * @param {Object} params - Parameters for summary generation.
 * @param {string} params.apiKey - The Venice API key.
 * @param {string} params.query - The original user query.
 * @param {Array<string>} [params.learnings=[]] - Accumulated key learnings.
 * @param {string|null} [params.metadata=null] - Metadata from token classification or other context.
 * @param {function} [params.outputFn=console.log] - Function to handle output logs.
 * @param {function} [params.errorFn=console.error] - Function to handle error logs.
 * @returns {Promise<string>} - The generated summary markdown text.
 */
export async function generateSummary({ apiKey, query, learnings = [], metadata = null, outputFn = console.log, errorFn = console.error }) {
  if (!apiKey) throw new Error('API key is required for generateSummary.');

  // Filter out potential error messages before checking length
  // Assumes error messages consistently start with "Error processing" or similar patterns added in ResearchPath
  const validLearnings = learnings.filter(l =>
      typeof l === 'string' &&
      l.trim() && // Ensure learning is not just whitespace
      !l.toLowerCase().startsWith('error processing') &&
      !l.toLowerCase().startsWith('error generating') &&
      !l.toLowerCase().startsWith('error during research path')
  );

  // --- ADJUSTED: Check for empty validLearnings ---
  if (validLearnings.length === 0) {
    errorFn(`[generateSummary] No valid learnings provided to generate summary for "${query}". Original learnings array (may contain errors or be empty):`, learnings);
    // Provide a more informative fallback message
    let fallbackMessage = `## Summary\n\nNo valid summary could be generated for "${query}" as no key learnings were successfully extracted during the research process.`;
    // Check if the original array had items that were filtered out (likely errors)
    const errorLearnings = learnings.filter(l => typeof l === 'string' && !validLearnings.includes(l));
    if (errorLearnings.length > 0) {
        fallbackMessage += "\n\nPotential issues encountered during research (these were filtered out):\n" + errorLearnings.map(e => `- ${e}`).join('\n');
    } else if (learnings.length === 0) {
        fallbackMessage += "\n\nReason: The research process returned no information.";
    }
    return fallbackMessage; // Return the informative fallback message
  }
  // --- END ADJUSTED ---


  // Proceed with summary generation using only valid learnings
  let prompt = `Write a comprehensive narrative summary about "${query}" based *only* on the following key learnings:\n\n`;

  if (metadata) {
    // Ensure metadata is stringified if it's an object
    const metadataString = typeof metadata === 'object' ? JSON.stringify(metadata, null, 2) : String(metadata);
    prompt += `Original Query Context:\n${metadataString}\n\nUse this context to help structure the summary around the core topic.\n\n`;
  }

  prompt += `Key Learnings:\n${validLearnings.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\n`;
  prompt += `Synthesize these learnings into a well-structured, coherent report. Ensure technical accuracy based *only* on the provided points. Format the output as Markdown. Start directly with the summary content, do not include a "Summary:" header yourself.`; // Added instruction to omit header

  const result = await generateOutput({
    apiKey, // Pass key
    type: 'report',
    system: systemPrompt(), // Use standard system prompt
    prompt,
    temperature: 0.7,
    maxTokens: 2000, // Allow more tokens for the final report
    outputFn,
    errorFn
  });

  if (result.success && result.data.reportMarkdown) {
    // Prepend the header here for consistency
    return `## Summary\n\n${result.data.reportMarkdown}`;
  }

  errorFn(`[generateSummary] Failed to generate summary via LLM. Error: ${result.error}. Returning basic list of valid learnings as fallback.`);
  // Fallback: return the valid learnings list if summary fails
  return `## Summary\n\nFailed to generate a narrative summary via LLM. Key Learnings Found:\n${validLearnings.map(l => `- ${l}`).join('\n')}`;
}

/**
 * Trims text to a maximum length.
 * @param {string} [text=''] - The text to trim.
 * @param {number} [maxLength=100000] - The maximum allowed length.
 * @param {function} [outputFn=console.log] - Function to handle output logs.
 * @param {function} [errorFn=console.error] - Function to handle error logs.
 * @returns {string} - The trimmed text.
 */
export function trimPrompt(text = '', maxLength = 100000, outputFn = console.log, errorFn = console.error) {
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

// Assuming LLMClient is imported if not already
// import { LLMClient } from '../../infrastructure/ai/venice.llm-client.mjs'; // If needed

// ... other imports ...

export async function generateQueriesLLM({ llmClient, query, numQueries, learnings, metadata, characterSlug }) {
  const systemPrompt = `You are an AI research assistant. Your task is to generate ${numQueries} diverse and insightful search queries based on the initial query and existing learnings.
Each query should explore a different facet of the topic. Avoid redundant queries.
If metadata (e.g., from token classification) is provided, use it to refine the queries for better targeting.
Focus on generating queries that will yield new information.
Previous learnings:
${learnings.length > 0 ? learnings.map(l => `- ${l}`).join('\n') : 'None'}
${metadata ? `\nToken Classification Metadata:\n${JSON.stringify(metadata, null, 2)}` : ''}
Respond with a JSON array of strings, where each string is a query. Example: ["query 1", "query 2"]`;

  const userPrompt = `Initial query: "${query}"\nGenerate ${numQueries} search queries.`;

  try {
    const response = await llmClient.completeChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 500 + (numQueries * 50),
      venice_parameters: { character_slug: characterSlug }
    });

    const responseContent = response.content;
    // Attempt to parse JSON from the response
    const jsonMatch = responseContent.match(/\[\s*".*?"\s*(,\s*".*?"\s*)*\]/s); // Regex for JSON array of strings
    if (jsonMatch) {
      const queries = JSON.parse(jsonMatch[0]);
      return queries.map(q => ({ original: q, metadata: null })); // Return in expected format
    } else {
      // Fallback: if no JSON array, try to split by newline if it looks like a list
      if (responseContent.includes('\n') && !responseContent.trim().startsWith("[")) {
        return responseContent.split('\n').map(s => s.trim()).filter(Boolean).map(q => ({ original: q, metadata: null }));
      }
      console.error("Failed to parse queries from LLM response, not a valid JSON array or simple list:", responseContent);
      throw new Error("Failed to parse queries from LLM response.");
    }
  } catch (error) {
    console.error(`Error in generateQueriesLLM: ${error.message}`);
    throw error;
  }
}

export async function generateSummaryLLM({ llmClient, query, learnings, sources, characterSlug }) {
  const systemPrompt = `You are an AI research assistant. Your task is to synthesize the provided learnings and sources into a comprehensive summary for the query: "${query}".
The summary should be well-structured, informative, and directly address the query.
Highlight key findings and insights.
Learnings:
${learnings.map(l => `- ${l}`).join('\n')}
Sources:
${sources.map(s => `- ${s.url} (${s.title})`).join('\n')}
Respond with the summary as a single block of text.`;
  const userPrompt = `Generate a comprehensive summary for the query: "${query}" based on the provided learnings and sources.`;

  try {
    const response = await llmClient.completeChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      maxTokens: 2000,
      venice_parameters: { character_slug: characterSlug }
    });
    return response.content;
  } catch (error) {
    console.error(`Error in generateSummaryLLM: ${error.message}`);
    throw error;
  }
}

// Assuming processResults is the correct name of the function that extracts learnings
export async function processResultsLLM({ results, query, llmClient, characterSlug }) {
  const systemPrompt = `You are an AI research assistant. Analyze the following search result snippets for the query "${query}" and extract key learnings.
Focus on information directly relevant to the query. Each learning should be a concise statement.
Search Results:
${results.map((r, i) => `Snippet ${i + 1} (URL: ${r.url}):\n${r.snippet}`).join('\n\n')}
Respond with a JSON array of strings, where each string is a distinct learning. Example: ["learning 1", "learning 2"]`;
  const userPrompt = `Extract key learnings from the provided search results for the query: "${query}".`;

  try {
    const response = await llmClient.completeChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 1000,
      venice_parameters: { character_slug: characterSlug }
    });
    const responseContent = response.content;
    const jsonMatch = responseContent.match(/\[\s*".*?"\s*(,\s*".*?"\s*)*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      if (responseContent.includes('\n') && !responseContent.trim().startsWith("[")) {
        return responseContent.split('\n').map(s => s.trim()).filter(Boolean);
      }
      console.error("Failed to parse learnings from LLM response, not a valid JSON array or simple list:", responseContent);
      throw new Error("Failed to parse learnings from LLM response.");
    }
  } catch (error) {
    console.error(`Error in processResultsLLM: ${error.message}`);
    throw error;
  }
}

// ... other functions ...
