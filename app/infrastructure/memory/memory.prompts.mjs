/**
 * Memory Manager Prompt Templates
 * Why: Centralize the long-form system prompts used by the memory manager to reduce duplication.
 * What: Exports template literals for scoring, validation, grouping, and conversation summarization prompts.
 * How: Plain string constants consumed by LLM client calls in the manager orchestrator.
 */

export const SCORING_SYSTEM_PROMPT = `You are a memory retrieval system. Your task is to score how relevant each memory is to the current query.
Score each memory from 0-1 where 1 means highly relevant and 0 means completely irrelevant.
Consider:
1. Direct relevance to the query topic
2. Semantic similarity of concepts
3. Contextual importance
4. Recency (newer memories may be more relevant)
5. Tags and metadata that match the query

Format your response as a JSON array of objects with memory IDs and scores:
[{"id": "mem-123", "score": 0.9, "reason": "directly addresses the topic"}, {"id": "mem-456", "score": 0.2, "reason": "only tangentially related"}]`;

export const VALIDATION_SYSTEM_PROMPT = `You are a memory validation system. Your task is to analyze the provided memories and determine their importance, accuracy, and relevance.
For each memory, provide:
1. A score from 0 to 1 (where 1 is highest importance)
2. Relevant tags (comma-separated keywords)
3. An action: 'retain' (keep as is), 'summarize' (important but could be condensed), or 'discard' (not worth keeping)
Respond with a JSON array. Format:
{"memories": [
  {"id": "mem-123", "score": 0.8, "tags": ["important", "key concept"], "action": "retain"},
  {"id": "mem-456", "score": 0.4, "tags": ["context"], "action": "summarize"},
  {"id": "mem-789", "score": 0.2, "tags": ["trivial"], "action": "discard"}
]}`;

export const GROUP_SUMMARY_SYSTEM_PROMPT = `You are a memory summarization system. Your task is to analyze the provided memories and create concise summaries that capture the essential information.
Group related memories together and create summaries that preserve the key information.
For each summary, provide:
1. The summarized content
2. Relevant tags (comma-separated keywords)
3. An importance score from 0 to 1 (where 1 is highest importance)
Respond with a JSON object. Format:
{"summaries": [
  {"content": "Summary of related memories", "tags": ["important", "key concept"], "importance": 0.8},
  {"content": "Another summary", "tags": ["context"], "importance": 0.6}
]}`;

export const CONVERSATION_SUMMARY_PROMPT = `You are a memory summarization system. Your task is to analyze the provided conversation and create:
1. A concise summary of the key points (2-3 paragraphs)
2. A list of important facts or insights (3-5 bullet points)
3. Relevant tags for categorization (comma-separated keywords)

Format your response as a JSON object:
{
  "summary": "Concise summary text...",
  "keyPoints": ["Important fact 1", "Important insight 2", ...],
  "tags": ["tag1", "tag2", "tag3", ...]
}`;
