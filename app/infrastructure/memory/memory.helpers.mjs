/**
 * Memory Manager Helper Utilities
 * Why: Reuse shared helper logic (similarity, concept extraction, prompt builders, and JSON parsing) outside the orchestrator.
 * What: Exports pure utility functions that the memory manager consumes when ranking and preparing memory payloads.
 * How: Avoids importing manager internals by depending only on primitive inputs and returning plain data structures.
 */

import { cleanChatResponse } from '../ai/venice.response-processor.mjs';

const STOP_WORDS = new Set(['the', 'and', 'that', 'this', 'with', 'for', 'from', 'was', 'were', 'what', 'when', 'where', 'who', 'how', 'why', 'which']);

export function calculateSimilarity(textA, textB) {
  if (!textA || !textB) {
    return 0;
  }

  const normalizedA = textA.toLowerCase().replace(/[^\w\s]/g, '');
  const normalizedB = textB.toLowerCase().replace(/[^\w\s]/g, '');

  const wordsA = new Set(normalizedA.split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalizedB.split(/\s+/).filter(Boolean));

  const intersection = new Set([...wordsA].filter((word) => wordsB.has(word)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function extractKeyConcepts(text) {
  if (!text) {
    return [];
  }

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const filtered = words.filter((word) => !STOP_WORDS.has(word));
  const counts = new Map();

  filtered.forEach((word) => {
    counts.set(word, (counts.get(word) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export function buildScoringUserPrompt(query, concepts, memories) {
  const memoryLines = memories
    .map((memory) => {
      const content = memory.content.length > 200 ? `${memory.content.slice(0, 200)}...` : memory.content;
      const tags = Array.isArray(memory.tags) && memory.tags.length ? memory.tags.join(', ') : 'none';
      return `[ID: ${memory.id}] [${memory.role}] ${content}\nTags: ${tags}`;
    })
    .join('\n\n');

  return `Query: ${query}
Key concepts: ${concepts.join(', ')}

Memories to score (ID, role, content, tags):
${memoryLines}`;
}

export function extractJsonPayload(content) {
  const cleaned = cleanChatResponse(content);
  const match = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON payload detected in LLM response.');
  }
  return JSON.parse(match[0]);
}
