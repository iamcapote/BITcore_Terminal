/**
 * Why: Supply LangChain-friendly prompt templates that mirror the legacy research prompts so chains can be swapped in without behavioural drift.
 * What: Exports chat prompt factories for query generation and summarisation that reuse existing copy while exposing structured variables.
 * How: Wraps the legacy prompt copy with LangChain `ChatPromptTemplate` builders and guards template inputs via simple helpers.
 */

import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';

const BASE_RESEARCH_SYSTEM_PROMPT = `You are an adaptive research engine assistant helping to explore topics in depth and designed for cross-domain analysis. Your responses must be:

1. Structured and organized
2. Focused on the specific task
3. Factual and precise
4. Easy to parse programmatically in minimal markdown format
5. Avoid any unnecessary information

When generating queries:
- Start each query with "What" "How" "Why" "When" "Where" or "Which"
- Make each query specific and focused and easily searchable
- Use clear and concise language
- Avoid vague or ambiguous terms
- Use active voice
- Avoid jargon unless necessary
- Use simple sentence structures
- Avoid unnecessary words
- End each query with a question mark
- Focus on different aspects of the topic
- Avoid repetition
- Ensure each query is unique

When analyzing content, if applicable:
- Focus on the main ideas and concepts
- Extract concrete facts and data
- Include specific metrics and numbers
- Note relationships between concepts
- Identify key entities and their attributes
- Highlight trends and patterns

IMPORTANT: Format your responses as lists without any introductory text or explanations.`;

const QUERY_GENERATION_INSTRUCTIONS = `Generate specific research questions about: "{topic}"

{learningsSection}

Requirements:
1. Each question must start with What How Why When Where or Which
2. Each question must end with a question mark
3. Each question must focus on a different aspect
4. Questions must be specific and detailed

Example format:
"What are the fundamental principles of quantum entanglement?"
"How does quantum superposition enable parallel computation?"
"Why are quantum computers particularly effective for cryptography?"
"What system or process enables a specific function within a target domain?"
"How does variable A compare to variable B with respect to a measurable metric?"
"Why has a given phenomenon evolved differently across multiple geographic or cultural contexts?"

DO NOT include any introductory text. Just list the questions directly.`;

export function createQueryGenerationPromptTemplate() {
  return ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(BASE_RESEARCH_SYSTEM_PROMPT),
    HumanMessagePromptTemplate.fromTemplate(QUERY_GENERATION_INSTRUCTIONS)
  ]);
}

export function buildQueryGenerationVariables({ query, learnings = [] } = {}) {
  if (!query || typeof query !== 'string') {
    throw new TypeError('buildQueryGenerationVariables requires a query string.');
  }

  const trimmedQuery = query.trim();
  const formattedLearnings = Array.isArray(learnings) && learnings.length > 0
    ? `Previous Findings:\n${learnings.map((item) => (typeof item === 'string' ? item : String(item))).join('\n')}`
    : '';

  return Object.freeze({
    topic: trimmedQuery,
    learningsSection: formattedLearnings
  });
}

export const RESEARCH_SYSTEM_PROMPT = BASE_RESEARCH_SYSTEM_PROMPT;
