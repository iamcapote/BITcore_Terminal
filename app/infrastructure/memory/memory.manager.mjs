/**
 * Memory Manager Orchestrator
 * Why: Coordinate validation, retrieval, summarization, and persistence for chat memories.
 * What: Provides the public API consumed by services/controllers while delegating state to the MemoryStore adapter.
 * How: Validates configuration, manages LLM interactions, and routes memory data through store and GitHub integrations.
 *
 * Contract
 * Inputs:
 *   - new MemoryManager({ depth?, user, githubEnabled? })
 *   - Methods accept plain objects/strings representing memory content or query parameters.
 * Outputs:
 *   - Methods return memory objects, stats snapshots, or operation summaries consumed elsewhere in the app.
 * Error modes:
 *   - Throws for invalid configuration (depth/user).
 *   - Returns { success: false, error } for recoverable runtime errors.
 * Performance:
 *   - Memory operations bound by configuration; LLM calls dominate latency (soft 2s, hard 5s upstream).
 * Side effects:
 *   - Optional GitHub persistence via GitHubMemoryIntegration.
 */

import { LLMClient } from '../ai/venice.llm-client.mjs';
import { GitHubMemoryIntegration } from './github-memory.integration.mjs';
import { MemoryStore } from './memory.store.mjs';
import { ensureValidDepth, ensureValidUser } from './memory.validators.mjs';
import {
  SCORING_SYSTEM_PROMPT,
  VALIDATION_SYSTEM_PROMPT,
  GROUP_SUMMARY_SYSTEM_PROMPT,
  CONVERSATION_SUMMARY_PROMPT
} from './memory.prompts.mjs';
import {
  calculateSimilarity,
  extractKeyConcepts,
  buildScoringUserPrompt,
  extractJsonPayload
} from './memory.helpers.mjs';

export const MEMORY_DEPTHS = {
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
};

const MEMORY_SETTINGS = {
  [MEMORY_DEPTHS.SHORT]: { maxMemories: 10, retrievalLimit: 2, threshold: 0.7, summarizeEvery: 10 },
  [MEMORY_DEPTHS.MEDIUM]: { maxMemories: 50, retrievalLimit: 5, threshold: 0.5, summarizeEvery: 20 },
  [MEMORY_DEPTHS.LONG]: { maxMemories: 100, retrievalLimit: 8, threshold: 0.3, summarizeEvery: 30 }
};


export class MemoryManager {
  /**
   * @param {{ depth?: string, user: { username: string }, githubEnabled?: boolean }} [options]
   */
  constructor(options = {}) {
    const { depth = MEMORY_DEPTHS.MEDIUM, user, githubEnabled = false } = options;
    const { depth: normalizedDepth, settings } = ensureValidDepth(depth, MEMORY_SETTINGS);
    this.user = ensureValidUser(user);

    this.depth = normalizedDepth;
    this.settings = settings;
    this.llmClient = null;
    this.initialized = false;

    this.store = new MemoryStore({ depth: this.depth, settings: this.settings });
    this.stats = this.store.stats;

    this.githubIntegration = githubEnabled
      ? new GitHubMemoryIntegration({ username: this.user.username, enabled: true })
      : null;
  }

  async initialize() {
    this.initialized = true;
  }

  getDepthLevel() {
    return this.depth;
  }

  getStats() {
    return this.store.snapshot();
  }

  generateMemoryId() {
    return this.store.generateMemoryId();
  }

  async storeMemory(content, role = 'user') {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.store.createEphemeralMemory({ content, role, score: 0.5 });
  }

  async retrieveRelevantMemories(query, includeShortTerm = true, includeLongTerm = true, includeMeta = true) {
    if (!this.initialized) {
      await this.initialize();
    }

    const candidateMemories = [];

    if (includeShortTerm) {
      candidateMemories.push(...this.store.getEphemeral());
    }

    if (includeLongTerm) {
      candidateMemories.push(...this.store.getValidated().filter((memory) => !memory.isMeta));
      if (this.githubIntegration) {
        try {
          const longTerm = await this.retrieveLongTermMemories();
          candidateMemories.push(...longTerm);
        } catch (error) {
          console.error(`Error retrieving long-term memories: ${error.message}`);
        }
      }
    }

    if (includeMeta) {
      candidateMemories.push(...this.store.getValidated().filter((memory) => memory.isMeta));
    }

    if (candidateMemories.length === 0) {
      return [];
    }

    const queryConcepts = extractKeyConcepts(query);

    try {
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }

      const userPrompt = buildScoringUserPrompt(query, queryConcepts, candidateMemories);
      const response = await this.llmClient.complete({
        system: SCORING_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.2,
        maxTokens: 1500
      });

      const payload = extractJsonPayload(response.content);
      if (Array.isArray(payload)) {
        const scored = payload
          .map((entry) => {
            const memory = candidateMemories.find((candidate) => candidate.id === entry.id);
            if (!memory) {
              return null;
            }
            return {
              ...memory,
              similarity: Number.parseFloat(entry.score) || 0,
              matchReason: entry.reason || ''
            };
          })
          .filter(Boolean);

        const relevant = scored
          .filter((memory) => memory.similarity >= this.settings.threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, this.settings.retrievalLimit);

        this.store.recordRetrieval(relevant.length);
        return relevant;
      }
    } catch (error) {
      console.error(`Error in LLM-based memory scoring: ${error.message}`);
    }

    console.log('Using fallback local semantic matching for memory retrieval');

    const scoredMemories = candidateMemories.map((memory) => {
      let similarity = calculateSimilarity(query, memory.content);

      if (memory.tags && queryConcepts.length > 0) {
        const tagMatch = memory.tags.some((tag) =>
          queryConcepts.some((concept) => tag.toLowerCase().includes(concept))
        );
        if (tagMatch) {
          similarity += 0.2;
        }
      }

      if (memory.timestamp) {
        const ageInHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
        const recencyBoost = Math.max(0, 0.1 - (ageInHours / 240) * 0.1);
        similarity += recencyBoost;
      }

      if (memory.score) {
        similarity += memory.score * 0.2;
      }

      return { ...memory, similarity: Math.min(1, similarity) };
    });

    const relevantMemories = scoredMemories
      .filter((memory) => memory.similarity >= this.settings.threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.settings.retrievalLimit);

    this.store.recordRetrieval(relevantMemories.length);
    return relevantMemories;
  }

  async retrieveLongTermMemories() {
    if (!this.githubIntegration) {
      return [];
    }

    try {
      return await this.githubIntegration.retrieveMemories('long_term');
    } catch (error) {
      console.error(`Error retrieving long-term memories: ${error.message}`);
      return [];
    }
  }

  async retrieveMetaMemories() {
    if (!this.githubIntegration) {
      return [];
    }

    try {
      return await this.githubIntegration.retrieveMemories('meta');
    } catch (error) {
      console.error(`Error retrieving meta memories: ${error.message}`);
      return [];
    }
  }

  async finalizeToLongTerm(memory) {
    if (!memory) {
      return { success: false, error: 'No memory provided' };
    }

    if (!this.githubIntegration) {
      return { success: false, error: 'GitHub integration not enabled' };
    }

    try {
      const result = await this.githubIntegration.storeMemory(memory.content, 'long_term', {
        tags: memory.tags || [],
        score: memory.score || 0.5,
        timestamp: memory.timestamp || new Date().toISOString(),
        role: memory.role || 'system'
      });
      return { success: true, result };
    } catch (error) {
      console.error(`Error finalizing memory to long-term storage: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async validateMemories() {
    if (!this.initialized) {
      await this.initialize();
    }

    const ephemeral = this.store.getEphemeral();
    if (ephemeral.length === 0) {
      return { validated: 0 };
    }

    try {
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }

      const memoriesToValidate = ephemeral.slice(-10);
      const userPrompt = `Please validate the following memories:\n\n${memoriesToValidate
        .map((mem) => `[ID: ${mem.id}]\n${mem.role}: ${mem.content}`)
        .join('\n\n')}`;

      const response = await this.llmClient.complete({
        system: VALIDATION_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 1500
      });

      const payload = extractJsonPayload(response.content);
      const validatedEntries = Array.isArray(payload?.memories) ? payload.memories : [];

      for (const entry of validatedEntries) {
        const memoryIndex = ephemeral.findIndex((mem) => mem.id === entry.id);
        if (memoryIndex === -1) {
          continue;
        }

        const memory = ephemeral[memoryIndex];
        memory.score = Number.parseFloat(entry.score) || 0.5;
        memory.tags = Array.isArray(entry.tags) ? entry.tags : [];
        memory.validated = true;

        if (entry.action === 'retain' && memory.score >= this.settings.threshold) {
          this.store.addValidated(memory);
        } else if (entry.action === 'summarize') {
          memory.needsSummarization = true;
          this.store.addValidated(memory);
        } else if (entry.action === 'discard') {
          this.store.removeEphemeralByIndex(memoryIndex);
        }
      }

      const validatedCount = validatedEntries.length;
      this.store.recordValidation(validatedCount);

      const summary = {
        validated: validatedCount,
        retained: validatedEntries.filter((entry) => entry.action === 'retain').length,
        summarized: validatedEntries.filter((entry) => entry.action === 'summarize').length,
        discarded: validatedEntries.filter((entry) => entry.action === 'discard').length
      };

      const toSummarize = this.store
        .getValidated()
        .filter((memory) => memory.needsSummarization);

      if (toSummarize.length >= 3) {
        await this.summarizeMemories(toSummarize);
      }

      return summary;
    } catch (error) {
      console.error(`Error validating memories: ${error.message}`);
      return { validated: 0, error: error.message };
    }
  }

  async summarizeMemories(memories) {
    if (!memories || memories.length === 0) {
      return { summarized: 0 };
    }

    try {
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }

      const userPrompt = `Please summarize the following memories:\n\n${memories
        .map((mem) => `[${mem.role}]: ${mem.content}`)
        .join('\n\n')}`;

      const response = await this.llmClient.complete({
        system: GROUP_SUMMARY_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.4,
        maxTokens: 2000
      });

      const payload = extractJsonPayload(response.content);
      const summaries = Array.isArray(payload?.summaries) ? payload.summaries : [];

      for (const summary of summaries) {
        const summaryMemory = {
          id: this.store.generateMemoryId(),
          content: summary.content,
          role: 'summary',
          timestamp: new Date().toISOString(),
          tags: Array.isArray(summary.tags) ? summary.tags : [],
          score: Number.parseFloat(summary.importance) || 0.7,
          summarized: true,
          sourceMemories: memories.map((mem) => mem.id)
        };

        this.store.addValidated(summaryMemory);

        if (this.githubIntegration) {
          this.githubIntegration.storeMemory(summaryMemory, 'meta').catch((error) => {
            console.error(`Failed to store memory in GitHub: ${error.message}`);
          });
        }
      }

      memories.forEach((memory) => {
        memory.needsSummarization = false;
        this.store.removeValidatedById(memory.id);
      });

      this.store.recordSummaries(summaries.length);

      return { summarized: summaries.length, originalCount: memories.length };
    } catch (error) {
      console.error(`Error summarizing memories: ${error.message}`);
      return { summarized: 0, error: error.message };
    }
  }

  async summarizeAndFinalize(conversationText) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }

      const response = await this.llmClient.complete({
        system: CONVERSATION_SUMMARY_PROMPT,
        prompt: `Please summarize and extract key information from the following conversation:\n\n${conversationText}`,
        temperature: 0.3,
        maxTokens: 1500
      });

      const payload = extractJsonPayload(response.content);
      const metaMemory = {
        id: this.store.generateMemoryId(),
        content: payload.summary,
        keyPoints: Array.isArray(payload.keyPoints) ? payload.keyPoints : [],
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        type: 'summary',
        timestamp: new Date().toISOString(),
        source: this.store.getEphemeral().map((memory) => memory.id)
      };

      this.store.addValidated(metaMemory);

      for (const keyPoint of metaMemory.keyPoints) {
        const matchingMemories = this.store
          .getEphemeral()
          .filter((memory) => memory.content.toLowerCase().includes(String(keyPoint).toLowerCase()));

        for (const memory of matchingMemories) {
          memory.tags = Array.from(new Set([...(memory.tags || []), ...metaMemory.tags]));
          memory.validated = true;
          this.store.addValidated(memory);
        }
      }

      this.store.clearEphemeral();
      this.store.recordSummaries(1);

      if (this.githubIntegration) {
        try {
          await this.githubIntegration.storeMemory(metaMemory, 'meta');
        } catch (error) {
          console.error(`Error storing memory in GitHub: ${error.message}`);
        }
      }

      return { success: true, summary: metaMemory };
    } catch (error) {
      console.error(`Error summarizing memories: ${error.message}`);
      const fallbackSummary = {
        id: this.store.generateMemoryId(),
        content: `Conversation summary (auto-generated): ${conversationText.substring(0, 100)}...`,
        type: 'summary',
        timestamp: new Date().toISOString(),
        source: this.store.getEphemeral().map((memory) => memory.id)
      };
      this.store.addValidated(fallbackSummary);
      this.store.clearEphemeral();
      this.store.recordSummaries(1);
      return { success: true, summary: fallbackSummary };
    }
  }

  getAllMemories() {
    return this.store.getAllMemories();
  }

  async _organizeMemoryLayers() {
    const layers = this.store.organizeLayers({ scoreThreshold: 0.7 });
    this.shortTermMemories = layers.shortTerm;
    this.longTermMemories = layers.longTerm;
    this.metaMemories = layers.meta;
    return {
      shortTerm: layers.counts.shortTerm,
      longTerm: layers.counts.longTerm,
      meta: layers.counts.meta,
      total: layers.counts.total
    };
  }
}
