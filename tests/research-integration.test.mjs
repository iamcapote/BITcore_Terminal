import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { ResearchEngine } from '../app/infrastructure/research/research.engine.mjs';
import { MemoryManager } from '../app/infrastructure/memory/memory.manager.mjs';
import { LLMClient } from '../app/infrastructure/ai/venice.llm-client.mjs';
import { generateResearchQueries, startResearchFromChat } from '../app/commands/chat.cli.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { output } from '../app/utils/research.output-manager.mjs';

// Mock dependencies
vi.mock('../app/infrastructure/research/research.engine.mjs');
vi.mock('../app/infrastructure/memory/memory.manager.mjs');
vi.mock('../app/infrastructure/ai/venice.llm-client.mjs');
vi.mock('../app/features/auth/user-manager.mjs');
vi.mock('../app/utils/research.output-manager.mjs');

describe('Chat and Research Integration', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock LLM client
    LLMClient.prototype.complete = vi.fn().mockResolvedValue({
      content: `{
        "topics": ["quantum computing", "qubits", "superposition"],
        "priority": "high",
        "researchQuestions": [
          "How do quantum computers utilize qubits?", 
          "What are the practical applications of quantum superposition?"
        ]
      }`
    });
    
    // Mock LLM client for chat completion
    LLMClient.prototype.completeChat = vi.fn().mockResolvedValue({
      content: "This is a response from the AI about quantum computing",
      model: "test-model",
      timestamp: new Date().toISOString()
    });
    
    // Mock ResearchEngine
    ResearchEngine.prototype.generateQueriesFromChatContext = vi.fn().mockResolvedValue([
      { query: "How do quantum computers work?", researchGoal: "Understand quantum computing fundamentals" },
      { query: "What are qubits and how do they differ from classical bits?", researchGoal: "Explore qubit properties" }
    ]);
    
    ResearchEngine.prototype.research = vi.fn().mockResolvedValue({
      learnings: [
        "Quantum computers use qubits that can exist in multiple states simultaneously",
        "Superposition allows quantum computers to process many possibilities at once"
      ],
      sources: ["Source 1", "Source 2"],
      filename: "test-research.md"
    });
    
    // Mock output manager
    output.log = vi.fn();
    output.error = vi.fn();
    
    // Mock user manager
    userManager.currentUser = { username: "testuser", role: "client" };
    userManager.isAuthenticated = vi.fn().mockReturnValue(true);
    userManager.hasApiKey = vi.fn().mockResolvedValue(true);
    userManager.getApiKey = vi.fn().mockResolvedValue("test-api-key");
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Research Query Generation from Chat', () => {
    it('should generate research queries from chat history', async () => {
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" },
        { role: "assistant", content: "Quantum computing uses quantum mechanics to perform calculations." },
        { role: "user", content: "Tell me more about qubits." }
      ];
      
      const memoryBlocks = [
        { content: "Quantum computing relies on qubits which can be in multiple states at once." }
      ];
      
      const queries = await generateResearchQueries(chatHistory, memoryBlocks);
      
      expect(LLMClient.prototype.complete).toHaveBeenCalled();
      expect(queries).toHaveLength(2);
      expect(queries[0]).toHaveProperty('query');
      expect(queries[0]).toHaveProperty('researchGoal');
    });
    
    it('should handle empty chat history', async () => {
      try {
        await generateResearchQueries([]);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Chat history is too short');
      }
    });
    
    it('should handle LLM failures gracefully', async () => {
      // Force an error in the LLM client
      LLMClient.prototype.complete = vi.fn().mockRejectedValue(new Error("API error"));
      
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" },
        { role: "assistant", content: "A type of computing that uses quantum mechanics." }
      ];
      
      // Should not throw and should return a fallback query
      const queries = await generateResearchQueries(chatHistory, []);
      
      expect(queries).toHaveLength(1);
      expect(queries[0].query).toEqual(chatHistory[chatHistory.length - 1].content);
    });
  });
  
  describe('Chat-Driven Research', () => {
    it('should start research from chat context with default options', async () => {
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" },
        { role: "assistant", content: "Quantum computing uses quantum mechanics to perform calculations." },
        { role: "user", content: "How do qubits work?" }
      ];
      
      const result = await startResearchFromChat(chatHistory, []);
      
      expect(result.success).toBe(true);
      expect(ResearchEngine).toHaveBeenCalled();
      expect(ResearchEngine.prototype.research).toHaveBeenCalled();
      expect(result).toHaveProperty('learnings');
    });
    
    it('should use custom research options when provided', async () => {
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" },
        { role: "assistant", content: "A type of computing that uses quantum mechanics." }
      ];
      
      const options = {
        depth: 4,
        breadth: 6,
        verbose: true
      };
      
      await startResearchFromChat(chatHistory, [], options);
      
      // Verify ResearchEngine was called with correct options
      expect(ResearchEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 4,
          breadth: 6
        })
      );
    });
    
    it('should integrate with memory system when memory blocks provided', async () => {
      const chatHistory = [
        { role: "user", content: "Tell me about quantum computing." }
      ];
      
      const memoryBlocks = [
        { content: "Quantum computing uses qubits instead of classical bits." },
        { content: "Quantum superposition allows qubits to be in multiple states simultaneously." }
      ];
      
      // Mock ResearchEngine to capture how memory blocks are used
      let capturedQuery;
      ResearchEngine.prototype.generateQueriesFromChatContext = vi.fn().mockImplementation((history, memories) => {
        // Capture the memory blocks to verify they're passed correctly
        capturedQuery = { history, memories };
        return Promise.resolve([
          { query: "How do quantum computers work?", researchGoal: "Understand quantum computing" }
        ]);
      });
      
      await startResearchFromChat(chatHistory, memoryBlocks);
      
      // Verify that memory blocks were passed correctly
      expect(capturedQuery.memories).toEqual(memoryBlocks);
    });
    
    it('should handle research failures gracefully', async () => {
      // Force a research error
      ResearchEngine.prototype.research = vi.fn().mockRejectedValue(
        new Error("Research API failure")
      );
      
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" }
      ];
      
      const result = await startResearchFromChat(chatHistory, []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(output.error).toHaveBeenCalled();
    });
  });
  
  describe('Research Engine Query Generation', () => {
    it('should extract key topics from chat context', async () => {
      const mockEngine = new ResearchEngine({ query: "test", depth: 2, breadth: 3 });
      
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" },
        { role: "assistant", content: "Quantum computing is based on quantum mechanics." },
        { role: "user", content: "How do quantum computers use entanglement?" }
      ];
      
      await mockEngine.generateQueriesFromChatContext(chatHistory, [], 3);
      
      // Verify the LLM was called with appropriate content
      const llmCallArgs = LLMClient.prototype.complete.mock.calls[0][0];
      
      expect(llmCallArgs.prompt).toContain("quantum computing");
      expect(llmCallArgs.prompt).toContain("entanglement");
    });
    
    it('should override queries when generated from chat context', async () => {
      const mockEngine = new ResearchEngine({ query: "original query", depth: 2, breadth: 3 });
      
      // Set override queries
      mockEngine.overrideQueries = [
        { query: "Override query 1", researchGoal: "Goal 1" },
        { query: "Override query 2", researchGoal: "Goal 2" }
      ];
      
      // Mock the process query method to verify it's called with overridden queries
      mockEngine.path = { processQuery: vi.fn().mockResolvedValue({ learnings: [], sources: [] }) };
      
      await mockEngine.research();
      
      // Verify that processQuery was called with the override queries
      expect(mockEngine.path.processQuery).toHaveBeenCalledTimes(2);
      expect(mockEngine.path.processQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: "Override query 1" }),
        expect.any(Number),
        expect.any(Number),
        expect.any(Array),
        expect.any(Array)
      );
    });
  });
  
  describe('Memory Integration with Research', () => {
    it('should store research results in memory', async () => {
      // Setup memory manager mock
      const mockMemoryManager = new MemoryManager({ user: { username: "testuser" } });
      mockMemoryManager.storeMemory = vi.fn().mockResolvedValue({ id: "mem-123", content: "test" });
      
      const chatHistory = [
        { role: "user", content: "What is quantum computing?" }
      ];
      
      // Run research from chat
      const result = await startResearchFromChat(chatHistory, [], { depth: 2, breadth: 3 }, mockMemoryManager);
      
      // Verify research results were stored in memory
      expect(mockMemoryManager.storeMemory).toHaveBeenCalled();
      expect(mockMemoryManager.storeMemory.mock.calls[0][0]).toContain("Quantum computers");
    });
    
    it('should tag research memories with appropriate metadata', async () => {
      // Create memory manager with more detailed implementation
      const mockMemoryManager = new MemoryManager({ user: { username: "testuser" } });
      
      // Track stored memories
      const storedMemories = [];
      mockMemoryManager.storeMemory = vi.fn().mockImplementation((content, role) => {
        const memory = { 
          id: `mem-${storedMemories.length}`, 
          content, 
          role,
          tags: []
        };
        storedMemories.push(memory);
        return Promise.resolve(memory);
      });
      
      // Mock validateMemories to add tags
      mockMemoryManager.validateMemories = vi.fn().mockImplementation(() => {
        storedMemories.forEach(memory => {
          memory.tags.push("research");
          if (memory.content.includes("quantum")) {
            memory.tags.push("quantum-computing");
          }
        });
        return Promise.resolve({ validated: storedMemories.length });
      });
      
      const chatHistory = [
        { role: "user", content: "Explain quantum computing to me." }
      ];
      
      await startResearchFromChat(chatHistory, [], { depth: 2, breadth: 3 }, mockMemoryManager);
      
      // Validate memories
      await mockMemoryManager.validateMemories();
      
      // Verify research memories were tagged appropriately
      expect(storedMemories.length).toBeGreaterThan(0);
      expect(storedMemories.some(m => m.tags.includes("research"))).toBe(true);
      expect(storedMemories.some(m => m.tags.includes("quantum-computing"))).toBe(true);
    });
  });
});