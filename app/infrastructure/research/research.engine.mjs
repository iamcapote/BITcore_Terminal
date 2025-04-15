import { output } from '../../utils/research.output-manager.mjs';
import { ResearchPath } from './research.path.mjs';
import fs from 'fs/promises';
import path from 'path';
import { generateSummary } from '../../features/ai/research.providers.mjs';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import { LLMClient } from '../ai/venice.llm-client.mjs';
import { generateQueries } from '../../features/ai/research.providers.mjs';

/**
 * Main research engine that coordinates research paths
 */
export class ResearchEngine {
  constructor(config) {
    this.config = config;
    this.overrideQueries = null; // For queries generated from chat context
  }

  async research() {
    try {
      // Initialize progress tracking
      const progress = {
        currentDepth: this.config.depth,
        totalDepth: this.config.depth,
        currentBreadth: this.config.breadth,
        totalBreadth: this.config.breadth,
        totalQueries: 0,
        completedQueries: 0,
      };

      // Create and start research path
      const path = new ResearchPath(this.config, progress);
      
      // Store path instance for testing and overriding
      this.path = path;
      
      // Initialize default result structure
      let result;
      
      // Check if we have override queries from chat context
      if (this.overrideQueries && Array.isArray(this.overrideQueries) && this.overrideQueries.length > 0) {
        output.log(`[research] Using ${this.overrideQueries.length} queries from chat context`);
        
        // Use the override queries instead of generating new ones
        result = await this.executeWithOverrideQueries(path);
      } else {
        // Use standard research flow
        result = await path.research();
      }

      const summary = await generateSummary({
        query: this.config.query.original || this.config.query,
        learnings: result.learnings,
        // Ensure metadata is passed to summary generation
        metadata: this.config.query.metadata || null
      });

      // Save results after research
      const filename = await this.saveResults(
        this.config.query.original || this.config.query,
        result.learnings,
        result.sources,
        summary
      );

      return { ...result, filename };
    } catch (error) {
      output.log(`[research] Error during research: ${error.message || error}`);
      return {
        learnings: [`Research attempted on: ${this.config.query.original || this.config.query}`],
        sources: [],
      };
    }
  }
  
  /**
   * Execute research using override queries from chat context
   * 
   * @param {ResearchPath} path - The research path instance
   * @returns {Promise<Object>} Research results
   */
  async executeWithOverrideQueries(path) {
    const learnings = [];
    const sources = [];
    
    // Process each query from the chat context
    for (let i = 0; i < this.overrideQueries.length; i++) {
      const query = this.overrideQueries[i];
      
      output.log(`[research] Processing chat-derived query ${i+1}/${this.overrideQueries.length}: "${query.query}"`);
      
      // Use standard depth/breadth config but with the override query
      const queryResult = await path.processQuery(
        query, 
        1, // Use depth 1 for each chat query to avoid too many recursive searches
        this.config.breadth,
        learnings,
        sources
      );
      
      // Add results to our collections
      if (queryResult.learnings && queryResult.learnings.length > 0) {
        learnings.push(...queryResult.learnings);
      }
      
      if (queryResult.sources && queryResult.sources.length > 0) {
        sources.push(...queryResult.sources);
      }
    }
    
    // Return combined results
    return { learnings, sources };
  }

  /**
   * Generate research queries from chat context
   * 
   * @param {Array} chatHistory - Chat history array
   * @param {Array} memoryBlocks - Memory blocks from previous conversations if available
   * @param {number} numQueries - Number of queries to generate (default: 3)
   * @returns {Promise<Array<Object>>} Array of generated query objects
   */
  async generateQueriesFromChatContext(chatHistory, memoryBlocks = [], numQueries = 3) {
    if (!chatHistory || chatHistory.length < 2) {
      throw new Error('Chat history is too short to generate meaningful queries');
    }
    
    // Create context extraction prompt
    const contextPrompt = `Based on the following conversation, identify the main topics that would be valuable to research further:

${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

${
    memoryBlocks.length > 0 ? 
    `\nRELEVANT MEMORIES:\n${memoryBlocks.map(block => block.content).join('\n\n')}` : 
    ''
}

Extract 3-5 main topics from this conversation that would benefit from deeper research. Format your response as a list of topics only, one per line.`;

    // Create LLM client for topic extraction
    const llmClient = new LLMClient();
    
    try {
      // Get topic suggestions from LLM
      const topicsResponse = await llmClient.complete({
        system: 'You are a topic extraction specialist focused on identifying research-worthy topics from conversations.',
        prompt: contextPrompt,
        temperature: 0.3,
        maxTokens: 500
      });

      // Process the response to extract topics
      const topics = topicsResponse.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('-') && !line.match(/^[0-9]+\./) && line.length > 5)
        .map(line => line.replace(/^[^a-zA-Z0-9]+/, '').trim())
        .slice(0, 5); // Take at most 5 topics

      if (topics.length === 0) {
        throw new Error('Failed to extract research topics from conversation');
      }

      // Generate research queries for each topic
      const allQueries = [];
      for (const topic of topics) {
        // Generate queries for this topic using the standard query generation function
        const topicQueries = await generateQueries({
          query: topic,
          numQueries: Math.ceil(numQueries / topics.length) + 1,
          metadata: null
        });

        allQueries.push(...topicQueries);
      }

      // Return the unique queries, up to the requested number
      return Array.from(new Set(allQueries.map(q => JSON.stringify(q))))
        .map(q => JSON.parse(q))
        .slice(0, numQueries);
    } catch (error) {
      console.error(`Error generating research queries from chat context: ${error.message}`);
      
      // Fallback to basic topic extraction
      return [
        {
          query: chatHistory[chatHistory.length - 1].content,
          researchGoal: `Research the latest user query: ${chatHistory[chatHistory.length - 1].content}`
        }
      ];
    }
  }

  async saveResults(query, learnings, sources, summary = 'No summary available.') {
    try {
      await ensureDir('research');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const subject = query.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().substring(0, 30);
      const filename = path.join('research', `research-${subject}-${timestamp}.md`);

      // Generate a properly structured markdown document with all sections
      const markdown = [
        '# Research Results',
        '---',
        `## Query\n\n${query}`,
        '',
        `## Summary\n\n${summary}`,
        '',
        `## Key Learnings\n`,
        // Use bullet points for learnings to prevent duplicate numbers
        ...learnings.map(l => `- ${l}`),
        '',
        `## References\n`,
        ...sources.map(s => `- ${s}`),
      ].join('\n');

      await fs.writeFile(filename, markdown);
      output.log(`[saveResults] Results saved to ${filename}`);
      return filename;
    } catch (error) {
      output.log(`[saveResults] Error saving research results: ${error.message || error}`);
      return null;
    }
  }
}
