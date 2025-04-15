/**
 * Memory Manager for the MCP Chat System
 * 
 * Manages ephemeral and persistent memories, including storage, retrieval,
 * validation, summarization, and integration with GitHub.
 */

import crypto from 'crypto';
import { LLMClient } from '../ai/venice.llm-client.mjs';
import { GitHubMemoryIntegration } from './github-memory.integration.mjs';
import { cleanChatResponse } from '../ai/venice.response-processor.mjs';

// Memory depth options
const MEMORY_DEPTHS = {
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
};

// Memory depth settings
const MEMORY_SETTINGS = {
  [MEMORY_DEPTHS.SHORT]: {
    maxMemories: 10,    // Max memories to retain
    retrievalLimit: 2,  // Max memories to retrieve
    threshold: 0.7,     // Relevance threshold (0-1)
    summarizeEvery: 10  // Summarize after N exchanges
  },
  [MEMORY_DEPTHS.MEDIUM]: {
    maxMemories: 50,
    retrievalLimit: 5,
    threshold: 0.5,
    summarizeEvery: 20
  },
  [MEMORY_DEPTHS.LONG]: {
    maxMemories: 100,
    retrievalLimit: 8,
    threshold: 0.3,
    summarizeEvery: 30
  }
};

/**
 * Memory Manager
 * 
 * Handles all memory operations for the chat system, including
 * storage, retrieval, validation, and summarization.
 */
export class MemoryManager {
  /**
   * Create a new Memory Manager instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.depth - Memory depth ('short', 'medium', 'long')
   * @param {Object} options.user - User object
   * @param {boolean} options.githubEnabled - Enable GitHub integration
   */
  constructor(options = {}) {
    const { 
      depth = MEMORY_DEPTHS.MEDIUM,
      user,
      githubEnabled = false
    } = options;
    
    // Validate depth option
    if (!Object.values(MEMORY_DEPTHS).includes(depth)) {
      throw new Error(`Invalid memory depth: ${depth}. Must be one of: ${Object.values(MEMORY_DEPTHS).join(', ')}`);
    }
    
    // Validate user
    if (!user || !user.username) {
      throw new Error('Valid user object with username is required');
    }
    
    // Set properties
    this.user = user;
    this.depth = depth;
    this.settings = MEMORY_SETTINGS[depth];
    this.llmClient = null;
    this.initialized = false;
    this.stats = {
      memoriesStored: 0,
      memoriesRetrieved: 0,
      memoriesValidated: 0,
      memoriesSummarized: 0
    };
    
    // Initialize memory stores
    this.ephemeralMemories = []; // Short-term/working memory
    this.validatedMemories = []; // Validated memories
    
    // Initialize GitHub integration if enabled
    this.githubIntegration = githubEnabled ? 
      new GitHubMemoryIntegration({
        username: user.username,
        enabled: true
      }) : null;
      
    // Initialize when API key is set
    this.initialize();
  }
  
  /**
   * Initialize the memory manager
   * 
   * @private
   */
  async initialize() {
    try {
      // Initialize LLM client when needed (lazy initialization)
      this.initialized = true;
    } catch (error) {
      console.error(`Failed to initialize memory manager: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get the current memory depth level
   * 
   * @returns {string} Memory depth level
   */
  getDepthLevel() {
    return this.depth;
  }
  
  /**
   * Get memory statistics
   * 
   * @returns {Object} Memory statistics
   */
  getStats() {
    return {
      ...this.stats,
      depthLevel: this.depth,
      ephemeralCount: this.ephemeralMemories.length,
      validatedCount: this.validatedMemories.length
    };
  }
  
  /**
   * Generate a unique memory ID
   * 
   * @returns {string} Unique memory ID
   */
  generateMemoryId() {
    return 'mem-' + crypto.randomBytes(4).toString('hex');
  }
  
  /**
   * Store a new memory
   * 
   * @param {string} content - Memory content
   * @param {string} role - Memory role ('user' or 'assistant')
   * @returns {Promise<Object>} Stored memory object
   */
  async storeMemory(content, role = 'user') {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Create memory object
    const memory = {
      id: this.generateMemoryId(),
      content,
      role,
      timestamp: new Date().toISOString(),
      tags: [],
      score: 0.5 // Default score, will be updated during validation
    };
    
    // Add to ephemeral memories
    this.ephemeralMemories.push(memory);
    
    // Limit the size of ephemeral memories
    if (this.ephemeralMemories.length > this.settings.maxMemories) {
      this.ephemeralMemories = this.ephemeralMemories.slice(-this.settings.maxMemories);
    }
    
    this.stats.memoriesStored++;
    
    return memory;
  }
  
  /**
   * Calculate semantic similarity between two text strings
   * 
   * @param {string} text1 - First text string
   * @param {string} text2 - Second text string
   * @returns {number} Similarity score between 0 and 1
   * @private
   */
  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    try {
      // Normalize texts
      const norm1 = text1.toLowerCase().replace(/[^\w\s]/g, '');
      const norm2 = text2.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Split into words
      const words1 = new Set(norm1.split(/\s+/).filter(Boolean));
      const words2 = new Set(norm2.split(/\s+/).filter(Boolean));
      
      // Calculate Jaccard similarity
      const intersection = new Set([...words1].filter(word => words2.has(word)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;
    } catch (error) {
      console.error(`Error calculating similarity: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Extract key concepts from text
   * 
   * @param {string} text - Text to extract concepts from
   * @returns {string[]} Array of key concepts
   * @private
   */
  extractKeyConcepts(text) {
    if (!text) return [];
    
    try {
      // Simple naive implementation - extract nouns, entities, and technical terms
      const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      
      // Filter common stop words
      const stopWords = new Set(['the', 'and', 'that', 'this', 'with', 'for', 'from', 'was', 'were', 'what', 'when', 'where', 'who', 'how', 'why', 'which']);
      const filteredWords = words.filter(word => !stopWords.has(word));
      
      // Count word frequency
      const wordCounts = {};
      filteredWords.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
      
      // Get top N words by frequency
      return Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);
    } catch (error) {
      console.error(`Error extracting key concepts: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Retrieve relevant memories based on a query using improved semantic matching
   * 
   * @param {string} query - Query to retrieve memories for
   * @param {boolean} includeShortTerm - Whether to include short-term memories
   * @param {boolean} includeLongTerm - Whether to include long-term memories 
   * @param {boolean} includeMeta - Whether to include meta memories
   * @returns {Promise<Array>} Array of relevant memories
   */
  async retrieveRelevantMemories(query, includeShortTerm = true, includeLongTerm = true, includeMeta = true) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Get candidate memories based on inclusion flags
    const candidateMemories = [];
    
    if (includeShortTerm) {
      candidateMemories.push(...this.ephemeralMemories);
    }
    
    if (includeLongTerm) {
      // Add validated memories
      candidateMemories.push(...this.validatedMemories.filter(m => !m.isMeta));
      
      // Fetch long-term memories from GitHub if enabled
      if (this.githubIntegration && includeLongTerm) {
        try {
          const longTermMemories = await this.retrieveLongTermMemories();
          candidateMemories.push(...longTermMemories);
        } catch (error) {
          console.error(`Error retrieving long-term memories: ${error.message}`);
        }
      }
    }
    
    if (includeMeta) {
      // Add meta memories
      candidateMemories.push(...this.validatedMemories.filter(m => m.isMeta));
    }
    
    if (candidateMemories.length === 0) {
      return [];
    }
    
    // First attempt: Use LLM-based scoring if available
    try {
      if (this.llmClient) {
        // Extract key concepts from query to improve matching
        const queryConcepts = this.extractKeyConcepts(query);
        
        // Create system prompt for scoring memories
        const systemPrompt = `You are a memory retrieval system. Your task is to score how relevant each memory is to the current query.
Score each memory from 0-1 where 1 means highly relevant and 0 means completely irrelevant.
Consider:
1. Direct relevance to the query topic
2. Semantic similarity of concepts
3. Contextual importance
4. Recency (newer memories may be more relevant)
5. Tags and metadata that match the query

Format your response as a JSON array of objects with memory IDs and scores:
[{"id": "mem-123", "score": 0.9, "reason": "directly addresses the topic"}, {"id": "mem-456", "score": 0.2, "reason": "only tangentially related"}]`;
      
        // Create user prompt with query and memories
        const userPrompt = `Query: ${query}
Key concepts: ${queryConcepts.join(', ')}

Memories to score (ID, role, content, tags):
${candidateMemories.map(mem => 
          `[ID: ${mem.id}] [${mem.role}] ${mem.content.substring(0, 200)}${mem.content.length > 200 ? '...' : ''} 
Tags: ${mem.tags?.join(', ') || 'none'}`
        ).join('\n\n')}`;
        
        // Get scores from LLM
        const response = await this.llmClient.complete({
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.2, // Lower temperature for more consistent scoring
          maxTokens: 1500
        });
        
        // Parse response to get scored memories
        const responseContent = cleanChatResponse(response.content);
        let jsonMatch = responseContent.match(/\[\s*\{.*\}\s*\]/s);
        
        if (jsonMatch) {
          const jsonArray = JSON.parse(jsonMatch[0]);
          
          // Map scores to memory objects
          const scoredMemories = jsonArray.map(item => {
            const memory = candidateMemories.find(m => m.id === item.id);
            if (memory) {
              return {
                ...memory,
                similarity: parseFloat(item.score) || 0,
                matchReason: item.reason || ''
              };
            }
            return null;
          }).filter(Boolean);
          
          // Sort by score and filter by threshold
          const relevantMemories = scoredMemories
            .filter(memory => memory.similarity >= this.settings.threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.settings.retrievalLimit);
          
          this.stats.memoriesRetrieved += relevantMemories.length;
          return relevantMemories;
        }
      }
    } catch (error) {
      console.error(`Error in LLM-based memory scoring: ${error.message}`);
      // Continue to fallback approach
    }
    
    // Fallback approach: Local semantic matching
    console.log('Using fallback local semantic matching for memory retrieval');
    
    // Calculate semantic similarity for each memory
    const scoredMemories = candidateMemories.map(memory => {
      // Calculate base similarity
      let similarity = this.calculateSimilarity(query, memory.content);
      
      // Boost score based on tags matching
      const queryConcepts = this.extractKeyConcepts(query);
      if (memory.tags && queryConcepts.length > 0) {
        const tagMatch = memory.tags.some(tag => 
          queryConcepts.some(concept => tag.toLowerCase().includes(concept))
        );
        if (tagMatch) {
          similarity += 0.2; // Boost for tag matching
        }
      }
      
      // Apply recency bias for short-term memories
      if (memory.timestamp) {
        const ageInHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
        const recencyBoost = Math.max(0, 0.1 - (ageInHours / 240) * 0.1); // Small boost for recent memories
        similarity += recencyBoost;
      }
      
      // Apply existing score if available
      if (memory.score) {
        similarity += memory.score * 0.2; // Weight the pre-validated score
      }
      
      // Cap at 1.0
      similarity = Math.min(1, similarity);
      
      return { ...memory, similarity };
    });
    
    // Sort by similarity score and apply threshold and limit
    const relevantMemories = scoredMemories
      .filter(memory => memory.similarity >= this.settings.threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.settings.retrievalLimit);
    
    this.stats.memoriesRetrieved += relevantMemories.length;
    return relevantMemories;
  }
  
  /**
   * Retrieve long-term memories from GitHub
   * 
   * @returns {Promise<Array>} Array of long-term memories
   */
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
  
  /**
   * Retrieve meta memories from GitHub
   * 
   * @returns {Promise<Array>} Array of meta memories
   */
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
  
  /**
   * Finalize a memory to long-term storage
   * 
   * @param {Object} memory - Memory to finalize
   * @returns {Promise<Object>} Result of the operation
   */
  async finalizeToLongTerm(memory) {
    if (!memory) {
      return { success: false, error: 'No memory provided' };
    }
    
    try {
      if (!this.githubIntegration) {
        return { 
          success: false, 
          error: 'GitHub integration not enabled' 
        };
      }
      
      // Store in GitHub
      const result = await this.githubIntegration.storeMemory(
        memory.content,
        'long_term',
        {
          tags: memory.tags || [],
          score: memory.score || 0.5,
          timestamp: memory.timestamp || new Date().toISOString(),
          role: memory.role || 'system'
        }
      );
      
      return { success: true, result };
    } catch (error) {
      console.error(`Error finalizing memory to long-term storage: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Validate memories by analyzing and scoring them
   * 
   * @returns {Promise<Object>} Validation result
   */
  async validateMemories() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.ephemeralMemories.length === 0) {
      return { validated: 0 };
    }
    
    try {
      // Initialize LLM client if needed
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }
      
      // Prepare memories for validation
      const memoriesToValidate = this.ephemeralMemories.slice(-10); // Validate last 10 memories
      
      // Create system prompt for validation
      const systemPrompt = `You are a memory validation system. Your task is to analyze the provided memories and determine their importance, accuracy, and relevance.
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
      
      // Create user prompt with memories
      const userPrompt = `Please validate the following memories:\n\n` + 
        memoriesToValidate.map(mem => `[ID: ${mem.id}]\n${mem.role}: ${mem.content}`).join('\n\n');
      
      // Get validation from LLM
      const response = await this.llmClient.complete({
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 1500
      });
      
      // Process validation result
      try {
        // Extract JSON object from response
        const responseContent = cleanChatResponse(response.content);
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const validationResult = JSON.parse(jsonMatch[0]);
          
          if (validationResult.memories && Array.isArray(validationResult.memories)) {
            // Process each validated memory
            for (const validatedMem of validationResult.memories) {
              const memoryIndex = this.ephemeralMemories.findIndex(m => m.id === validatedMem.id);
              
              if (memoryIndex !== -1) {
                const memory = this.ephemeralMemories[memoryIndex];
                
                // Update memory with validation results
                memory.score = parseFloat(validatedMem.score) || 0.5;
                memory.tags = Array.isArray(validatedMem.tags) ? validatedMem.tags : [];
                memory.validated = true;
                
                // Handle actions
                if (validatedMem.action === 'retain' && memory.score >= this.settings.threshold) {
                  this.validatedMemories.push(memory);
                } else if (validatedMem.action === 'summarize') {
                  // Mark for summarization but keep for now
                  memory.needsSummarization = true;
                  this.validatedMemories.push(memory);
                } else if (validatedMem.action === 'discard') {
                  // Remove from ephemeral memories
                  this.ephemeralMemories.splice(memoryIndex, 1);
                }
              }
            }
            
            // If any memories need summarization and we have enough, summarize them
            const memoriesToSummarize = this.validatedMemories.filter(m => m.needsSummarization);
            if (memoriesToSummarize.length >= 3) {
              await this.summarizeMemories(memoriesToSummarize);
            }
            
            this.stats.memoriesValidated += validationResult.memories.length;
            
            return { 
              validated: validationResult.memories.length,
              retained: validationResult.memories.filter(m => m.action === 'retain').length,
              summarized: validationResult.memories.filter(m => m.action === 'summarize').length,
              discarded: validationResult.memories.filter(m => m.action === 'discard').length
            };
          }
        }
        
        // Fallback if parsing fails
        throw new Error('Invalid validation result format');
        
      } catch (error) {
        console.error(`Error processing memory validation: ${error.message}`);
        return { validated: 0, error: error.message };
      }
    } catch (error) {
      console.error(`Error validating memories: ${error.message}`);
      return { validated: 0, error: error.message };
    }
  }
  
  /**
   * Summarize a group of memories
   * 
   * @param {Array} memories - Memories to summarize
   * @returns {Promise<Object>} Summarization result
   * @private
   */
  async summarizeMemories(memories) {
    if (!memories || memories.length === 0) {
      return { summarized: 0 };
    }
    
    try {
      // Initialize LLM client if needed
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }
      
      // Create system prompt for summarization
      const systemPrompt = `You are a memory summarization system. Your task is to analyze the provided memories and create concise summaries that capture the essential information.
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
      
      // Create user prompt with memories
      const userPrompt = `Please summarize the following memories:\n\n` + 
        memories.map(mem => `[${mem.role}]: ${mem.content}`).join('\n\n');
      
      // Get summarization from LLM
      const response = await this.llmClient.complete({
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.4,
        maxTokens: 2000
      });
      
      // Process summarization result
      try {
        // Extract JSON object from response
        const responseContent = cleanChatResponse(response.content);
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const summaryResult = JSON.parse(jsonMatch[0]);
          
          if (summaryResult.summaries && Array.isArray(summaryResult.summaries)) {
            // Create new memory entries for summaries
            for (const summary of summaryResult.summaries) {
              const summaryMemory = {
                id: this.generateMemoryId(),
                content: summary.content,
                role: 'summary',
                timestamp: new Date().toISOString(),
                tags: Array.isArray(summary.tags) ? summary.tags : [],
                score: parseFloat(summary.importance) || 0.7,
                summarized: true,
                sourceMemories: memories.map(m => m.id)
              };
              
              // Add to validated memories
              this.validatedMemories.push(summaryMemory);
              
              // Store in GitHub if enabled
              if (this.githubIntegration) {
                this.githubIntegration.storeMemory(summaryMemory, 'meta').catch(error => {
                  console.error(`Failed to store memory in GitHub: ${error.message}`);
                });
              }
            }
            
            // Remove original memories that were summarized
            memories.forEach(memory => {
              const index = this.validatedMemories.findIndex(m => m.id === memory.id);
              if (index !== -1) {
                this.validatedMemories.splice(index, 1);
              }
            });
            
            this.stats.memoriesSummarized += summaryResult.summaries.length;
            
            return { 
              summarized: summaryResult.summaries.length,
              originalCount: memories.length
            };
          }
        }
        
        // Fallback if parsing fails
        throw new Error('Invalid summarization result format');
        
      } catch (error) {
        console.error(`Error processing memory summarization: ${error.message}`);
        return { summarized: 0, error: error.message };
      }
    } catch (error) {
      console.error(`Error summarizing memories: ${error.message}`);
      return { summarized: 0, error: error.message };
    }
  }
  
  /**
   * Summarize and finalize all memories
   * 
   * @param {string} conversationText - Text of the entire conversation
   * @returns {Promise<Object>} Finalization result
   */
  async summarizeAndFinalize(conversationText) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Initialize LLM client if needed
      if (!this.llmClient) {
        this.llmClient = new LLMClient();
      }
      
      // Create system prompt for summarization
      const systemPrompt = `You are a memory summarization system. Your task is to analyze the provided conversation and create:
1. A concise summary of the key points (2-3 paragraphs)
2. A list of important facts or insights (3-5 bullet points)
3. Relevant tags for categorization (comma-separated keywords)

Format your response as a JSON object:
{
  "summary": "Concise summary text...",
  "keyPoints": ["Important fact 1", "Important insight 2", ...],
  "tags": ["tag1", "tag2", "tag3", ...]
}`;
      
      // Create user prompt with conversation text
      const userPrompt = `Please summarize and extract key information from the following conversation:\n\n${conversationText}`;
      
      // Get summary from LLM
      const response = await this.llmClient.complete({
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 1500
      });
      
      // Parse response
      try {
        // Clean response and extract JSON
        const responseContent = cleanChatResponse(response.content);
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const summaryData = JSON.parse(jsonMatch[0]);
          
          // Create meta-memory from summary
          const metaMemory = {
            id: this.generateMemoryId(),
            content: summaryData.summary,
            keyPoints: summaryData.keyPoints || [],
            tags: summaryData.tags || [],
            type: 'summary',
            timestamp: new Date().toISOString(),
            source: this.ephemeralMemories.map(m => m.id)
          };
          
          // Add to validated memories
          this.validatedMemories.push(metaMemory);
          
          // Move important ephemeral memories to validated based on key points
          for (const keyPoint of summaryData.keyPoints) {
            const matchingMemories = this.ephemeralMemories.filter(
              mem => mem.content.toLowerCase().includes(keyPoint.toLowerCase())
            );
            
            for (const mem of matchingMemories) {
              // Add tags
              mem.tags = [...new Set([...(mem.tags || []), ...summaryData.tags])];
              
              // Mark as validated
              mem.validated = true;
              
              // Add to validated memories if not already present
              if (!this.validatedMemories.some(m => m.id === mem.id)) {
                this.validatedMemories.push(mem);
              }
            }
          }
          
          // Clear ephemeral memories
          this.ephemeralMemories = [];
          
          // Update stats
          this.stats.memoriesSummarized++;
          
          // Integrate with GitHub if enabled
          if (this.githubIntegration) {
            try {
              await this.githubIntegration.storeMemory(metaMemory);
            } catch (error) {
              console.error(`Error storing memory in GitHub: ${error.message}`);
            }
          }
          
          return {
            success: true,
            summary: metaMemory
          };
        }
      } catch (error) {
        console.error(`Error parsing summary: ${error.message}`);
      }
      
      // Simple fallback if parsing fails
      const fallbackSummary = {
        id: this.generateMemoryId(),
        content: `Conversation summary (auto-generated): ${conversationText.substring(0, 100)}...`,
        type: 'summary',
        timestamp: new Date().toISOString(),
        source: this.ephemeralMemories.map(m => m.id)
      };
      
      this.validatedMemories.push(fallbackSummary);
      this.ephemeralMemories = [];
      this.stats.memoriesSummarized++;
      
      return {
        success: true,
        summary: fallbackSummary
      };
    } catch (error) {
      console.error(`Error summarizing memories: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all memories (both ephemeral and validated)
   * 
   * @returns {Array} Combined array of all memories
   */
  getAllMemories() {
    return [...this.ephemeralMemories, ...this.validatedMemories];
  }
  
  /**
   * Organize memories into different layers based on validation status and scores
   * 
   * @returns {Promise<Object>} Result of organization
   * @private
   */
  async _organizeMemoryLayers() {
    // Create memory layer buckets if they don't exist
    this.shortTermMemories = this.shortTermMemories || [];
    this.longTermMemories = this.longTermMemories || [];
    this.metaMemories = this.metaMemories || [];
    
    // Clear existing categorized memories
    this.shortTermMemories = [];
    this.longTermMemories = [];
    this.metaMemories = [];
    
    // Categorize ephemeral memories as short-term
    this.shortTermMemories = [...this.ephemeralMemories];
    
    // Categorize validated memories by their properties
    for (const memory of this.validatedMemories) {
      if (memory.isMeta) {
        this.metaMemories.push(memory);
      } else if (memory.score >= 0.7) { // High score memories go to long-term
        this.longTermMemories.push(memory);
      } else {
        this.shortTermMemories.push(memory);
      }
    }
    
    return {
      shortTerm: this.shortTermMemories.length,
      longTerm: this.longTermMemories.length,
      meta: this.metaMemories.length,
      total: this.getAllMemories().length
    };
  }
}