import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { ResearchPath } from '../infrastructure/research/research.path.mjs';
import { output } from '../utils/research.output-manager.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { generateQueries, generateSummary } from '../features/ai/research.providers.mjs';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../infrastructure/research/research.path.mjs');
vi.mock('../utils/research.output-manager.mjs');
vi.mock('../infrastructure/ai/venice.llm-client.mjs');
vi.mock('../features/ai/research.providers.mjs');
vi.mock('fs/promises');
vi.mock('../utils/research.ensure-dir.mjs', () => ({
  ensureDir: vi.fn().mockResolvedValue(true)
}));

describe('ResearchEngine', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock output
    output.log = vi.fn();
    
    // Mock ResearchPath
    ResearchPath.prototype.research = vi.fn().mockResolvedValue({
      learnings: ['Learning 1', 'Learning 2'],
      sources: ['Source 1', 'Source 2']
    });
    
    // Mock generateSummary
    generateSummary.mockResolvedValue('Test summary');
    
    // Mock fs
    fs.writeFile = vi.fn().mockResolvedValue();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should research with standard query generation', async () => {
    const engine = new ResearchEngine({
      query: 'test query',
      depth: 2,
      breadth: 3
    });
    
    const result = await engine.research();
    
    expect(ResearchPath).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test query',
        depth: 2,
        breadth: 3
      }),
      expect.any(Object)
    );
    
    expect(result.learnings).toEqual(['Learning 1', 'Learning 2']);
    expect(result.sources).toEqual(['Source 1', 'Source 2']);
    expect(result.filename).toBeTruthy();
  });
  
  it('should research with metadata-enhanced query', async () => {
    const engine = new ResearchEngine({
      query: {
        original: 'test query',
        metadata: 'Additional metadata context'
      },
      depth: 2,
      breadth: 3
    });
    
    const result = await engine.research();
    
    expect(ResearchPath).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          original: 'test query',
          metadata: 'Additional metadata context'
        }
      }),
      expect.any(Object)
    );
    
    expect(generateSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test query',
        metadata: 'Additional metadata context'
      })
    );
  });
  
  it('should use override queries from chat context', async () => {
    const engine = new ResearchEngine({
      query: 'test query',
      depth: 2,
      breadth: 3
    });
    
    // Set override queries
    engine.overrideQueries = [
      { query: 'Override query 1', researchGoal: 'Goal 1' },
      { query: 'Override query 2', researchGoal: 'Goal 2' }
    ];
    
    // Mock processQuery for override queries
    ResearchPath.prototype.processQuery = vi.fn().mockResolvedValue({
      learnings: ['Chat-derived learning'],
      sources: ['Chat-derived source']
    });
    
    const result = await engine.research();
    
    expect(ResearchPath.prototype.research).not.toHaveBeenCalled();
    expect(ResearchPath.prototype.processQuery).toHaveBeenCalledTimes(2);
    
    expect(result.learnings).toContain('Chat-derived learning');
    expect(result.sources).toContain('Chat-derived source');
  });
  
  it('should generate research queries from chat context', async () => {
    const engine = new ResearchEngine({
      query: 'test query',
      depth: 2,
      breadth: 3
    });
    
    // Mock LLM client for topic extraction
    LLMClient.prototype.complete = vi.fn().mockResolvedValue({
      content: 'Topic 1\nTopic 2\nTopic 3'
    });
    
    // Mock generate queries
    generateQueries.mockResolvedValueOnce([
      { query: 'Generated query 1', researchGoal: 'Goal 1' }
    ]);
    
    generateQueries.mockResolvedValueOnce([
      { query: 'Generated query 2', researchGoal: 'Goal 2' }
    ]);
    
    generateQueries.mockResolvedValueOnce([
      { query: 'Generated query 3', researchGoal: 'Goal 3' }
    ]);
    
    const chatHistory = [
      { role: 'user', content: 'What is quantum computing?' },
      { role: 'assistant', content: 'Quantum computing uses qubits instead of classical bits.' },
      { role: 'user', content: 'Tell me more about quantum entanglement.' }
    ];
    
    const memoryBlocks = [
      { content: 'Quantum computing relies on quantum mechanical phenomena.' }
    ];
    
    const queries = await engine.generateQueriesFromChatContext(chatHistory, memoryBlocks, 3);
    
    // Verify LLM client was called for topic extraction
    expect(LLMClient.prototype.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('quantum entanglement')
      })
    );
    
    // Verify we got queries for each topic
    expect(generateQueries).toHaveBeenCalledTimes(3);
    
    // Verify we got the expected number of queries
    expect(queries.length).toEqual(3);
    
    // Verify the queries have the expected format
    expect(queries[0]).toHaveProperty('query');
    expect(queries[0]).toHaveProperty('researchGoal');
  });
  
  it('should handle errors in generateQueriesFromChatContext', async () => {
    const engine = new ResearchEngine({
      query: 'test query',
      depth: 2,
      breadth: 3
    });
    
    // Force an error in LLM client
    LLMClient.prototype.complete = vi.fn().mockRejectedValue(
      new Error('API error')
    );
    
    // Mock console.error to avoid polluting test output
    const originalConsoleError = console.error;
    console.error = vi.fn();
    
    const chatHistory = [
      { role: 'user', content: 'What is quantum computing?' },
      { role: 'assistant', content: 'It uses qubits.' }
    ];
    
    const queries = await engine.generateQueriesFromChatContext(chatHistory, [], 3);
    
    // Verify we got a fallback query
    expect(queries.length).toEqual(1);
    expect(queries[0].query).toEqual(chatHistory[chatHistory.length - 1].content);
    
    // Restore console.error
    console.error = originalConsoleError;
  });
});
