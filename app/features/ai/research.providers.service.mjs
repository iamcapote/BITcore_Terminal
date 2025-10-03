/**
 * Why: Encapsulate core research provider logic (prompt building, fallback, parsing) for maintainability.
 * What: Implements main flows for query generation, learning extraction, and summary synthesis.
 * How: Delegates LLM calls to llm.mjs, uses utils for parsing, and exposes contract-based async functions.
 * Contract
 *   Inputs: structured params including apiKey/query/context plus output/error handlers.
 *   Outputs: parsed result objects or markdown strings with fallbacks applied.
 */

import { systemPrompt, queryExpansionTemplate } from '../../utils/research.prompt.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';
import {
  getDefaultResearchCharacterSlug,
  getDefaultTokenClassifierCharacterSlug
} from '../../infrastructure/ai/venice.characters.mjs';
import { processResponse, trimPrompt } from './research.providers.utils.mjs';
import { callVeniceLLM } from './research.providers.llm.mjs';
import { computeFallbackTopic, buildFallbackQueries } from './research.providers.fallbacks.mjs';

const moduleLogger = createModuleLogger('ai.research.providers.service');

function normalizeLogArg(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null
    };
  }
  if (value == null) {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return String(value);
    }
  }
  return value;
}

function defaultOutput(...args) {
  if (args.length === 0) {
    return;
  }
  const [message, ...rest] = args;
  if (rest.length === 0) {
    moduleLogger.info(message);
    return;
  }
  moduleLogger.info(message, { args: rest.map(normalizeLogArg) });
}

function defaultError(...args) {
  if (args.length === 0) {
    return;
  }
  const [message, ...rest] = args;
  if (message instanceof Error && rest.length === 0) {
    moduleLogger.error(message.message, {
      name: message.name,
      stack: message.stack || null
    });
    return;
  }
  if (rest.length === 0) {
    moduleLogger.error(message);
    return;
  }
  moduleLogger.error(message, { args: rest.map(normalizeLogArg) });
}

function ensureApiKey(apiKey) {
  return apiKey || process.env.VENICE_API_KEY;
}

function determineCharacterSlug(type) {
  if (type === 'research') return getDefaultResearchCharacterSlug();
  if (type === 'token_classifier') return getDefaultTokenClassifierCharacterSlug();
  return undefined;
}

export async function generateOutput({
  apiKey,
  type,
  system,
  prompt,
  temperature = 0.7,
  maxTokens = 1000,
  outputFn = defaultOutput,
  errorFn = defaultError,
  llmClient = null
}) {
  const effectiveKey = ensureApiKey(apiKey);
  if (!effectiveKey) {
    errorFn('[generateOutput] Error: API key is missing.');
    return { success: false, error: 'API key is required for generateOutput.', isApiError: true };
  }

  const characterSlug = determineCharacterSlug(type);
  outputFn(`[generateOutput] Calling LLM for type: ${type}. Max Tokens: ${maxTokens}, Temp: ${temperature}`);

  const result = await callVeniceLLM({
    apiKey: effectiveKey,
    type,
    system,
    prompt,
    temperature,
    maxTokens,
    outputFn,
    errorFn,
    character_slug: characterSlug,
    llmClient
  });

  if (!result.success) {
    return { success: false, error: result.error, isApiError: result.isApiError };
  }

  const rawContent = result.content;
  outputFn(`[generateOutput] LLM Raw Response (type: ${type}):\n---START---\n${rawContent}\n---END---`);

  const parsed = processResponse(type, rawContent);
  if (parsed.success) {
    outputFn(`[generateOutput] Initial parsing successful for type ${type}.`);
    return { success: true, data: parsed };
  }

  errorFn(`[generateOutput] Initial parsing failed for type ${type}. Error: ${parsed.error}.`);
  return {
    success: false,
    error: parsed.error || 'Failed to parse LLM response.',
    rawContent
  };
}

export async function generateQueries({
  apiKey,
  query,
  numQueries = 3,
  learnings = [],
  metadata = null,
  outputFn = defaultOutput,
  errorFn = defaultError,
  llmClient = null
}) {
  const hasApiKey = !!ensureApiKey(apiKey);

  if (!query || typeof query !== 'string' || !query.trim()) {
    errorFn(`[generateQueries] Error: Invalid query provided: ${query}`);
    throw new Error('Invalid query: must be a non-empty string.');
  }

  if (query.length > 10000) {
    errorFn(`[generateQueries] Input query/context string is very long (${query.length} chars). This might affect LLM performance.`);
  }

  if (Number.isNaN(Number(numQueries)) || numQueries <= 0) {
    errorFn(`[generateQueries] Invalid numQueries (${numQueries}), defaulting to 3.`);
    numQueries = 3;
  }

  const logQuery = query.length > 300 ? `${query.substring(0, 300)}...` : query;
  outputFn(`[generateQueries] Generating ${numQueries} queries for context: "${logQuery}"${metadata ? ' with metadata: Yes' : ''}`);
  if (metadata) {
    outputFn('[generateQueries] Metadata (Venice AI response):');
    outputFn(typeof metadata === 'object' ? JSON.stringify(metadata, null, 2) : String(metadata));
  }

  let enrichedPrompt = queryExpansionTemplate(query, learnings);
  const isLikelyChatHistory = query.length > 1000 || query.includes('\nuser:') || query.includes('\nassistant:');

  if (isLikelyChatHistory) {
    enrichedPrompt += `\n\nAnalyze the entire conversation history provided above. Identify the key distinct topics or questions discussed.\nGenerate ${numQueries} simple, clear search queries that cover the *most important themes* or *different key aspects* of the conversation. Aim for breadth if multiple topics are significant.`;
  } else {
    enrichedPrompt += `\n\nGenerate ${numQueries} simple, clear search queries based on the main topic of the text above. Focus on straightforward questions that will yield relevant results.`;
  }

  enrichedPrompt += `\nDO NOT use any special search operators or syntax.\nEach query MUST be on a new line and MUST start with What, How, Why, When, Where, or Which.\nExample format:\nWhat is [topic]?\nHow does [aspect] work?\nWhy is [concept] important?`;

  if (metadata) {
    const metadataString = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata);
    enrichedPrompt = `${enrichedPrompt}\n\nAdditional context from query analysis:\n${metadataString}\n\nBased on this context and the original text, generate simple search queries that a person would naturally type.\nKeep queries plain, clear, and focused on the core concepts identified. Ensure they are formatted correctly: each on a new line, starting with What, How, Why, When, Where, or Which.`;
  }

  let result = { success: false };
  if (hasApiKey) {
    result = await generateOutput({
      apiKey,
      type: 'query',
      system: systemPrompt(),
      prompt: enrichedPrompt,
      temperature: 0.7,
      maxTokens: 500,
      outputFn,
      errorFn,
      llmClient
    });
  } else {
    errorFn('[generateQueries] No API key available. Using simple fallback queries.');
  }

  outputFn('[generateQueries] LLM result for query generation:', JSON.stringify(result));

  if (result.success && result.data.queries && result.data.queries.length > 0) {
    const queries = result.data.queries
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, numQueries)
      .map((q) => ({
        original: q,
        metadata: { goal: `Research: ${q}` }
      }));

    queries.forEach((entry, index) => {
      outputFn(`  ${index + 1}. ${entry.original}${entry.metadata ? ` [metadata: ${JSON.stringify(entry.metadata)}]` : ''}`);
    });

    return queries;
  }

  if (result && result.error) {
    errorFn(`[generateQueries] Failed to generate queries via LLM. Error: ${result.error}. Falling back to basic queries.`);
  }

  const fallbackTopic = computeFallbackTopic(query);
  errorFn(`[generateQueries] Using fallback topic: "${fallbackTopic}"`);
  return buildFallbackQueries(fallbackTopic, numQueries);
}

export async function processResults({
  apiKey,
  query,
  content,
  numLearnings = 3,
  numFollowUpQuestions = 3,
  metadata = null,
  outputFn = defaultOutput,
  errorFn = defaultError,
  llmClient = null
}) {
  const hasApiKey = !!ensureApiKey(apiKey);

  if (!Array.isArray(content) || content.length === 0) {
    errorFn(`[processResults] Error: Invalid content provided for query "${query}". Must be a non-empty array.`);
    return { learnings: [], followUpQuestions: [] };
  }

  if (Number.isNaN(Number(numLearnings)) || numLearnings < 0) numLearnings = 3;
  if (Number.isNaN(Number(numFollowUpQuestions)) || numFollowUpQuestions < 0) numFollowUpQuestions = 3;

  let analysisPrompt = `Analyze the following content related to "${query}":\n\n`;

  if (metadata) {
    const metadataString = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata);
    analysisPrompt += `Context from query analysis:\n${metadataString}\n\nUse this context to better interpret the query "${query}" and extract the most relevant information from the content below.\n\n`;
  }

  const combinedContent = content.map((txt) => `---\n${txt}\n---`).join('\n');
  const maxContentLength = 50000;
  const trimmedContent = trimPrompt(combinedContent, maxContentLength);
  if (combinedContent.length > maxContentLength) {
    errorFn(`[processResults] Content truncated to ${maxContentLength} characters for analysis.`);
  }
  outputFn(`[processResults] Combined content length for analysis: ${trimmedContent.length} characters.`);

  analysisPrompt += `Content:\n${trimmedContent}\n\n`;
  analysisPrompt += `Based *only* on the content provided above, extract:\n1. Key Learnings (at least ${numLearnings}):\n   - Focus on specific facts, data points, or summaries found in the text.\n   - Each learning should be a concise statement.\n2. Follow-up Questions (at least ${numFollowUpQuestions}):\n   - Generate questions that arise *directly* from the provided content and would require further research.\n   - Must start with What, How, Why, When, Where, or Which.\n\nFormat the output strictly as:\nKey Learnings:\n- [Learning 1]\n- [Learning 2]\n...\n\nFollow-up Questions:\n- [Question 1]\n- [Question 2]\n...`;

  let result = { success: false };
  if (hasApiKey) {
    result = await generateOutput({
      apiKey,
      type: 'learning',
      system: systemPrompt(),
      prompt: analysisPrompt,
      temperature: 0.5,
      maxTokens: 1000,
      outputFn,
      errorFn,
      llmClient
    });
  } else {
    errorFn('[processResults] No API key available. Using simple fallback analysis.');
  }

  outputFn('[processResults] LLM result for learning extraction (query:', JSON.stringify(result), ')');

  if (result.success && result.data) {
    const extractedLearnings = result.data.learnings || [];
    const extractedFollowUpQuestions = result.data.followUpQuestions || [];
    outputFn(`[processResults] Successfully extracted ${extractedLearnings.length} learnings and ${extractedFollowUpQuestions.length} follow-up questions for query: "${query}"`);
    return {
      learnings: extractedLearnings.slice(0, numLearnings),
      followUpQuestions: extractedFollowUpQuestions.slice(0, numFollowUpQuestions)
    };
  }

  if (result.isApiError && hasApiKey) {
    errorFn(`[processResults] CRITICAL: LLM API call failed for query "${query}". Error: ${result.error}`);
    throw new Error(`LLM API call failed during learning extraction: ${result.error}`);
  }

  errorFn(`[processResults] WARNING: Failed to parse LLM response structure for learning extraction (query: "${query}"). Error: ${result.error || 'Unknown parsing error'}. Attempting fallback extraction.`);

  if (result.rawContent) {
    const fallbackLines = result.rawContent
      .split('\n')
      .map((line) => line.trim().replace(/^[\*\-\d\.]+\s*/, '').trim())
      .filter((line) => line.length > 10)
      .filter((line) => !/^key learnings:/i.test(line))
      .filter((line) => !/^follow-up questions:/i.test(line))
      .filter((line) => !/^based only on the content/i.test(line))
      .filter((line) => !/^analyze the following content/i.test(line))
      .filter((line) => !/^content:/i.test(line))
      .filter((line) => !/^---$/.test(line))
      .filter((line) => !/^[\d\.\s]*$/.test(line));

    if (fallbackLines.length > 0) {
      errorFn(`[processResults] Fallback extraction yielded ${fallbackLines.length} potential learnings.`);
      return {
        learnings: fallbackLines.slice(0, numLearnings),
        followUpQuestions: []
      };
    }

    errorFn('[processResults] Fallback extraction failed to find usable lines in raw content.');
    return { learnings: [], followUpQuestions: [] };
  }

  const base = content.map((entry) => String(entry).trim()).filter(Boolean);
  const learnings = base.length > 0 ? [base[0]] : [String(query || 'General topic')];
  return { learnings: learnings.slice(0, numLearnings || 1), followUpQuestions: [] };
}

export async function generateSummary({
  apiKey,
  query,
  learnings = [],
  metadata = null,
  outputFn = defaultOutput,
  errorFn = defaultError,
  llmClient = null
}) {
  const effectiveKey = ensureApiKey(apiKey);
  if (!effectiveKey) {
    throw new Error('API key is required for generateSummary.');
  }

  const validLearnings = learnings.filter((entry) => (
    typeof entry === 'string'
    && entry.trim()
    && !entry.toLowerCase().startsWith('error processing')
    && !entry.toLowerCase().startsWith('error generating')
    && !entry.toLowerCase().startsWith('error during research path')
  ));

  if (validLearnings.length === 0) {
    const notice = `[generateSummary] No valid learnings provided to generate summary for "${query}". Original learnings array (may contain errors or be empty).`;
    if (typeof outputFn === 'function') {
      outputFn(notice);
      if (Array.isArray(learnings) && learnings.length > 0) {
        outputFn(`[generateSummary] Filtered learnings: ${JSON.stringify(learnings)}`);
      }
    } else if (typeof errorFn === 'function') {
      errorFn(notice, learnings);
    }
    let fallbackMessage = `## Summary\n\nNo valid summary could be generated for "${query}" as no key learnings were successfully extracted during the research process.`;
    const errorLearnings = learnings.filter((entry) => typeof entry === 'string' && !validLearnings.includes(entry));
    if (errorLearnings.length > 0) {
      fallbackMessage += `\n\nPotential issues encountered during research (these were filtered out):\n${errorLearnings.map((value) => `- ${value}`).join('\n')}`;
    } else if (learnings.length === 0) {
      fallbackMessage += '\n\nReason: The research process returned no information.';
    }
    return fallbackMessage;
  }

  let prompt = `Write a comprehensive narrative summary about "${query}" based *only* on the following key learnings:\n\n`;

  if (metadata) {
    const metadataString = typeof metadata === 'object' ? JSON.stringify(metadata, null, 2) : String(metadata);
    prompt += `Original Query Context:\n${metadataString}\n\nUse this context to help structure the summary around the core topic.\n\n`;
  }

  prompt += `Key Learnings:\n${validLearnings.map((learning, index) => `${index + 1}. ${learning}`).join('\n')}\n\n`;
  prompt += 'Synthesize these learnings into a well-structured, coherent report. Ensure technical accuracy based *only* on the provided points. Format the output as Markdown. Start directly with the summary content, do not include a "Summary:" header yourself.';

  const result = await generateOutput({
    apiKey: effectiveKey,
    type: 'report',
    system: systemPrompt(),
    prompt,
    temperature: 0.7,
    maxTokens: 2000,
    outputFn,
    errorFn,
    llmClient
  });

  if (result.success && result.data.reportMarkdown) {
    return `## Summary\n\n${result.data.reportMarkdown}`;
  }

  errorFn(`[generateSummary] Failed to generate summary via LLM. Error: ${result.error}. Returning basic list of valid learnings as fallback.`);
  return `## Summary\n\nFailed to generate a narrative summary via LLM. Key Learnings Found:\n${validLearnings.map((entry) => `- ${entry}`).join('\n')}`;
}

export async function generateQueriesLLM({ llmClient, query, numQueries, learnings, metadata, characterSlug }) {
  const system = `You are an AI research assistant. Your task is to generate ${numQueries} diverse and insightful search queries based on the initial query and existing learnings.\nEach query should explore a different facet of the topic. Avoid redundant queries.\nIf metadata (e.g., from token classification) is provided, use it to refine the queries for better targeting.\nFocus on generating queries that will yield new information.\nPrevious learnings:\n${learnings.length > 0 ? learnings.map((learning) => `- ${learning}`).join('\n') : 'None'}\n${metadata ? `\nToken Classification Metadata:\n${JSON.stringify(metadata, null, 2)}` : ''}\nRespond with a JSON array of strings, where each string is a query. Example: ["query 1", "query 2"]`;

  const userPrompt = `Initial query: "${query}"\nGenerate ${numQueries} search queries.`;

  const response = await llmClient.completeChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    maxTokens: 500 + (numQueries * 50),
    venice_parameters: { character_slug: characterSlug }
  });

  const responseContent = response.content;
  const jsonMatch = responseContent.match(/\[\s*".*?"\s*(,\s*".*?"\s*)*\]/s);
  if (jsonMatch) {
    const queries = JSON.parse(jsonMatch[0]);
    return queries.map((entry) => ({ original: entry, metadata: null }));
  }

  if (responseContent.includes('\n') && !responseContent.trim().startsWith('[')) {
    return responseContent
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => ({ original: entry, metadata: null }));
  }

  throw new Error(`Failed to parse queries from LLM response: ${responseContent}`);
}

export async function generateSummaryLLM({ llmClient, query, learnings, sources, characterSlug }) {
  const system = `You are an AI research assistant. Your task is to synthesize the provided learnings and sources into a comprehensive summary for the query: "${query}".\nThe summary should be well-structured, informative, and directly address the query.\nHighlight key findings and insights.\nLearnings:\n${learnings.map((learning) => `- ${learning}`).join('\n')}\nSources:\n${sources.map((source) => `- ${source.url} (${source.title})`).join('\n')}\nRespond with the summary as a single block of text.`;
  const userPrompt = `Generate a comprehensive summary for the query: "${query}" based on the provided learnings and sources.`;

  const response = await llmClient.completeChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.5,
    maxTokens: 2000,
    venice_parameters: { character_slug: characterSlug }
  });

  return response.content;
}

export async function processResultsLLM({ results, query, llmClient, characterSlug }) {
  const system = `You are an AI research assistant. Analyze the following search result snippets for the query "${query}" and extract key learnings.\nFocus on information directly relevant to the query. Each learning should be a concise statement.\nSearch Results:\n${results.map((result, index) => `Snippet ${index + 1} (URL: ${result.url}):\n${result.snippet}`).join('\n\n')}\nRespond with a JSON array of strings, where each string is a distinct learning. Example: ["learning 1", "learning 2"]`;
  const userPrompt = `Extract key learnings from the provided search results for the query: "${query}".`;

  const response = await llmClient.completeChat({
    messages: [
      { role: 'system', content: system },
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
  }

  if (responseContent.includes('\n') && !responseContent.trim().startsWith('[')) {
    return responseContent.split('\n').map((entry) => entry.trim()).filter(Boolean);
  }

  throw new Error(`Failed to parse learnings from LLM response: ${responseContent}`);
}
