import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { MemoryManager } from '../app/infrastructure/memory/memory.manager.mjs';
import { LLMClient } from '../app/infrastructure/ai/venice.llm-client.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { GitHubMemoryIntegration } from '../app/infrastructure/memory/github-memory.integration.mjs';

// Mock dependencies
vi.mock('../app/infrastructure/ai/venice.llm-client.mjs');
vi.mock('../app/features/auth/user-manager.mjs');
vi.mock('../app/infrastructure/memory/github-memory.integration.mjs');

describe('Memory Subsystem', () => {
  let memoryManager;
  let mockUser;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create mock user
    mockUser = {
      username: 'testuser',
      role: 'client'
    };
    
    // Set up mock for LLMClient
    LLMClient.prototype.complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        score: 0.85,
        tags: ['knowledge', 'technical'],
        summary: 'This is a summarized memory'
      })
    });
    
    // Set up mock for GitHub integration
    GitHubMemoryIntegration.prototype.storeMemory = vi.fn().mockResolvedValue({
      success: true,
      commitId: 'abc123'
    });
    
    GitHubMemoryIntegration.prototype.retrieveMemories = vi.fn().mockResolvedValue([
      { id: 'mem1', content: 'Test long term memory 1', tags: ['technical'] },
      { id: 'mem2', content: 'Test long term memory 2', tags: ['knowledge'] }
    ]);
    
    // Initialize memory manager
    memoryManager = new MemoryManager({
      depth: 'medium',
      user: mockUser
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Memory Storage', () => {
    it('should store memories correctly', async () => {
      const memory = await memoryManager.storeMemory('This is a test memory', 'user');
      
      expect(memory).toBeTruthy();
      expect(memory.content).toEqual('This is a test memory');
      expect(memory.role).toEqual('user');
      expect(memory.id).toBeTruthy();
    });
    
    it('should generate a unique ID for each memory', async () => {
      const memory1 = await memoryManager.storeMemory('Memory 1', 'user');
      const memory2 = await memoryManager.storeMemory('Memory 2', 'user');
      
      expect(memory1.id).not.toEqual(memory2.id);
    });
    
    it('should store memories with creation timestamp', async () => {
      const memory = await memoryManager.storeMemory('Test memory', 'user');
      
      expect(memory.createdAt).toBeTruthy();
      expect(typeof memory.createdAt).toEqual('number');
    });
  });
  
  describe('Memory Retrieval', () => {
    beforeEach(async () => {
      // Add some test memories
      await memoryManager.storeMemory('Memory about quantum computing', 'user');
      await memoryManager.storeMemory('Memory about artificial intelligence', 'assistant');
      await memoryManager.storeMemory('Memory about machine learning algorithms', 'user');
    });
    
    it('should retrieve relevant memories based on query', async () => {
      const memories = await memoryManager.retrieveRelevantMemories('Tell me about AI and machine learning');
      
      expect(memories).toBeInstanceOf(Array);
      expect(memories.length).toBeGreaterThan(0);
    });
    
    it('should retrieve memories with similarity score', async () => {
      // Mock the similarity function
      memoryManager.calculateSimilarity = vi.fn().mockReturnValue(0.85);
      
      const memories = await memoryManager.retrieveRelevantMemories('quantum');
      
      expect(memories[0]).toHaveProperty('similarity');
      expect(typeof memories[0].similarity).toBe('number');
    });
    
    it('should limit retrieved memories based on depth setting', async () => {
      // Add many memories
      for (let i = 0; i < 20; i++) {
        await memoryManager.storeMemory(`Additional memory ${i}`, 'user');
      }
      
      // Test with different depth settings
      memoryManager.depthSetting = 'short';
      const shortMemories = await memoryManager.retrieveRelevantMemories('test');
      
      memoryManager.depthSetting = 'long';
      const longMemories = await memoryManager.retrieveRelevantMemories('test');
      
      expect(longMemories.length).toBeGreaterThanOrEqual(shortMemories.length);
    });
  });
  
  describe('Memory Validation', () => {
    it('should validate memories using LLM', async () => {
      await memoryManager.storeMemory('Important fact: Water boils at 100°C at sea level', 'user');
      
      const result = await memoryManager.validateMemories();
      
      expect(LLMClient.prototype.complete).toHaveBeenCalled();
      expect(result.validated).toBeGreaterThan(0);
    });
    
    it('should tag memories during validation', async () => {
      await memoryManager.storeMemory('Technical fact: JavaScript is a single-threaded language', 'user');
      
      await memoryManager.validateMemories();
      
      // Get all memories to check if tags were added
      const allMemories = memoryManager.getAllMemories();
      const validatedMemory = allMemories.find(m => m.isValidated);
      
      expect(validatedMemory).toBeTruthy();
      expect(validatedMemory.tags).toContain('technical');
    });
    
    it('should assign scores to memories during validation', async () => {
      await memoryManager.storeMemory('Critical information about the project architecture', 'assistant');
      
      await memoryManager.validateMemories();
      
      // Get all memories to check if scores were added
      const allMemories = memoryManager.getAllMemories();
      const validatedMemory = allMemories.find(m => m.isValidated);
      
      expect(validatedMemory).toBeTruthy();
      expect(validatedMemory.score).toBeGreaterThan(0);
    });
  });
  
  describe('Memory Layers', () => {
    it('should move validated memories to long-term storage', async () => {
      const memory = await memoryManager.storeMemory('Important fact to remember long-term', 'user');
      
      // Mock validation response with high score
      LLMClient.prototype.complete = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          score: 0.95, // High score to ensure promotion to long-term
          tags: ['important'],
          summary: 'Important fact'
        })
      });
      
      await memoryManager.validateMemories();
      
      // Check if memory was moved to long-term storage
      expect(GitHubMemoryIntegration.prototype.storeMemory).toHaveBeenCalled();
    });
    
    it('should handle different memory layers correctly', async () => {
      // Short-term memory (working memory)
      await memoryManager.storeMemory('Temporary fact', 'user');
      
      // Long-term memory
      const importantMemory = await memoryManager.storeMemory('Very important fact', 'user');
      importantMemory.score = 0.95;
      importantMemory.isValidated = true;
      
      // Meta memory
      const metaMemory = await memoryManager.storeMemory('Meta information about the conversation', 'system');
      metaMemory.score = 0.98;
      metaMemory.isValidated = true;
      metaMemory.isMeta = true;
      
      // Force memory layers assignment
      await memoryManager._organizeMemoryLayers();
      
      // Test retrieveRelevantMemories with different layers
      const allMemories = await memoryManager.retrieveRelevantMemories('fact', true, true, true);
      const onlyLongTerm = await memoryManager.retrieveRelevantMemories('fact', false, true, false);
      
      expect(allMemories.length).toBeGreaterThan(onlyLongTerm.length);
    });
  });
  
  describe('Memory Summarization and Finalization', () => {
    it('should summarize memories when finalizing', async () => {
      // Add multiple memories
      await memoryManager.storeMemory('Fact 1: JavaScript is dynamically typed', 'user');
      await memoryManager.storeMemory('Fact 2: TypeScript adds static typing to JavaScript', 'assistant');
      await memoryManager.storeMemory('Fact 3: Both run in the browser or Node.js', 'user');
      
      // Mock the summarization response
      LLMClient.prototype.complete = vi.fn().mockResolvedValue({
        content: 'Summary: JavaScript is dynamically typed while TypeScript adds static typing, and both run in browsers and Node.js.'
      });
      
      const result = await memoryManager.summarizeAndFinalize();
      
      expect(LLMClient.prototype.complete).toHaveBeenCalled();
      expect(result.summary).toBeTruthy();
      expect(result.finalized).toBe(true);
    });
    
    it('should store meta memories during finalization', async () => {
      // Add multiple memories
      await memoryManager.storeMemory('First message about project requirements', 'user');
      await memoryManager.storeMemory('Response about implementation details', 'assistant');
      await memoryManager.storeMemory('Follow-up question about timeline', 'user');
      
      // Mock the meta-analysis response
      LLMClient.prototype.complete = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          summary: 'Discussion about project requirements, implementation, and timeline',
          importance: 'high',
          topics: ['project management', 'requirements', 'timeline']
        })
      });
      
      await memoryManager.summarizeAndFinalize();
      
      // Check if meta memory was stored
      expect(GitHubMemoryIntegration.prototype.storeMemory)
        .toHaveBeenCalledWith(expect.any(String), 'meta', expect.any(Object));
    });
  });
  
  describe('Memory Integration with GitHub', () => {
    it('should store long-term memories in GitHub', async () => {
      const memory = await memoryManager.storeMemory('Important technical detail to store in GitHub', 'user');
      memory.score = 0.92;
      memory.isValidated = true;
      
      await memoryManager.finalizeToLongTerm(memory);
      
      // Check if GitHub integration was called correctly
      expect(GitHubMemoryIntegration.prototype.storeMemory)
        .toHaveBeenCalledWith(expect.stringContaining('Important technical detail'), 'long_term', expect.any(Object));
    });
    
    it('should retrieve memories from GitHub', async () => {
      // Set up test
      GitHubMemoryIntegration.prototype.retrieveMemories.mockResolvedValue([
        { 
          id: 'github1', 
          content: 'Previously stored memory 1', 
          commitId: 'abc123',
          tags: ['historical']
        },
        { 
          id: 'github2', 
          content: 'Previously stored memory 2', 
          commitId: 'def456',
          tags: ['important']
        }
      ]);
      
      const memories = await memoryManager.retrieveLongTermMemories();
      
      expect(GitHubMemoryIntegration.prototype.retrieveMemories).toHaveBeenCalled();
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].commitId).toBeTruthy();
    });
    
    it('should handle GitHub memory retrieval failures gracefully', async () => {
      // Mock a GitHub error
      GitHubMemoryIntegration.prototype.retrieveMemories.mockRejectedValue(
        new Error('GitHub API error')
      );
      
      // This should not throw but return empty array
      const memories = await memoryManager.retrieveLongTermMemories();
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(0);
    });
  });
  
  describe('Memory Utility Functions', () => {
    it('should provide memory statistics', () => {
      // Add test memories
      memoryManager.shortTermMemories = [{ id: 'short1' }, { id: 'short2' }];
      memoryManager.longTermMemories = [{ id: 'long1' }];
      memoryManager.metaMemories = [{ id: 'meta1' }, { id: 'meta2' }, { id: 'meta3' }];
      
      const stats = memoryManager.getStats();
      
      expect(stats).toHaveProperty('shortTerm', 2);
      expect(stats).toHaveProperty('longTerm', 1);
      expect(stats).toHaveProperty('meta', 3);
      expect(stats).toHaveProperty('total', 6);
    });
    
    it('should report the memory depth level', () => {
      memoryManager.depthSetting = 'medium';
      expect(memoryManager.getDepthLevel()).toBe('medium');
      
      memoryManager.depthSetting = 'long';
      expect(memoryManager.getDepthLevel()).toBe('long');
    });
  });
});