import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { executeChat, exitMemory, generateResearchQueries, startResearchFromChat } from '../commands/chat.cli.mjs';
import { MemoryManager } from '../infrastructure/memory/memory.manager.mjs';
import { LLMClient } from '../infrastructure/ai/venice.llm-client.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import { output } from '../utils/research.output-manager.mjs';
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { generateQueries } from '../features/ai/research.providers.mjs';
import readline from 'readline';

// Mock dependencies
vi.mock('../infrastructure/ai/venice.llm-client.mjs');
vi.mock('../features/auth/user-manager.mjs');
vi.mock('../utils/research.output-manager.mjs');
vi.mock('readline');
vi.mock('../infrastructure/memory/memory.manager.mjs');
vi.mock('../infrastructure/research/research.engine.mjs');
vi.mock('../features/ai/research.providers.mjs');

describe('Chat Command', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock authenticated user
    userManager.isAuthenticated = vi.fn().mockReturnValue(true);
    userManager.hasApiKey = vi.fn().mockResolvedValue(true);
    userManager.getApiKey = vi.fn().mockResolvedValue('fake-api-key');
    userManager.currentUser = { username: 'testuser' };
    
    // Mock LLM client
    LLMClient.prototype.completeChat = vi.fn().mockResolvedValue({
      content: 'This is a test response from the LLM',
      model: 'test-model',
      timestamp: new Date().toISOString()
    });
    
    // Mock readline
    const mockRl = {
      question: vi.fn((_, callback) => callback('test input')),
      close: vi.fn()
    };
    readline.createInterface = vi.fn().mockReturnValue(mockRl);
    
    // Mock output
    output.log = vi.fn();
    output.error = vi.fn();
    
    // Mock memory manager
    MemoryManager.prototype.storeMemory = vi.fn().mockResolvedValue({
      id: 'mem-123',
      content: 'test content',
      role: 'user'
    });
    MemoryManager.prototype.retrieveRelevantMemories = vi.fn().mockResolvedValue([]);
    MemoryManager.prototype.getDepthLevel = vi.fn().mockReturnValue('medium');
    MemoryManager.prototype.validateMemories = vi.fn();
    MemoryManager.prototype.summarizeAndFinalize = vi.fn();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.VENICE_API_KEY;
  });
  
  it('should return error if user is not authenticated', async () => {
    userManager.isAuthenticated.mockReturnValue(false);
    
    const result = await executeChat({});
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
  
  it('should return error if Venice API key is missing', async () => {
    userManager.hasApiKey.mockResolvedValue(false);
    
    const result = await executeChat({});
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
  
  it('should initialize memory manager when memory flag is true', async () => {
    // Mock readline for password prompt
    const mockRl = {
      question: vi.fn((_, callback) => callback('password')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockRl);
    
    // Mock second readline for chat interface
    const mockChatRl = {
      question: vi.fn()
        .mockImplementationOnce((_, callback) => callback('/exit')), // Exit after first message
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockChatRl);
    
    await executeChat({ memory: true, depth: 'short' });
    
    expect(MemoryManager).toHaveBeenCalledWith(expect.objectContaining({
      depth: 'short',
      user: userManager.currentUser
    }));
  });
  
  it('should handle /exitmemory command during chat session', async () => {
    // Mock readline for password prompt
    const mockRl = {
      question: vi.fn((_, callback) => callback('password')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockRl);
    
    // Mock chat interface readline
    const mockChatRl = {
      question: vi.fn()
        .mockImplementationOnce((_, cb) => cb('/exitmemory'))
        .mockImplementationOnce((_, cb) => cb('/exit')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockChatRl);
    
    const mockMemoryManager = {
      getDepthLevel: vi.fn().mockReturnValue('medium'),
      summarizeAndFinalize: vi.fn().mockResolvedValue(true),
      storeMemory: vi.fn(),
      retrieveRelevantMemories: vi.fn().mockResolvedValue([])
    };
    MemoryManager.mockImplementation(() => mockMemoryManager);
    
    await executeChat({ memory: true });
    
    expect(mockMemoryManager.summarizeAndFinalize).toHaveBeenCalled();
  });
  
  it('should call LLM client with correct parameters', async () => {
    // Mock readline for password prompt
    const mockRl = {
      question: vi.fn((_, callback) => callback('password')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockRl);
    
    // Mock chat interface readline
    const mockChatRl = {
      question: vi.fn()
        .mockImplementationOnce((_, cb) => cb('test question'))
        .mockImplementationOnce((_, cb) => cb('/exit')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockChatRl);
    
    await executeChat({});
    
    expect(LLMClient.prototype.completeChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system'
          }),
          expect.objectContaining({
            role: 'user',
            content: 'test question'
          })
        ])
      })
    );
  });
  
  it('should inject relevant memories when memory mode is enabled', async () => {
    // Mock readline for password prompt
    const mockRl = {
      question: vi.fn((_, callback) => callback('password')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockRl);
    
    // Mock chat interface readline
    const mockChatRl = {
      question: vi.fn()
        .mockImplementationOnce((_, cb) => cb('test question with context'))
        .mockImplementationOnce((_, cb) => cb('/exit')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockChatRl);
    
    const mockMemories = [
      { id: 'mem-1', content: 'relevant fact 1' },
      { id: 'mem-2', content: 'relevant fact 2' }
    ];
    
    const mockMemoryManager = {
      getDepthLevel: vi.fn().mockReturnValue('medium'),
      storeMemory: vi.fn(),
      retrieveRelevantMemories: vi.fn().mockResolvedValue(mockMemories),
      validateMemories: vi.fn()
    };
    MemoryManager.mockImplementation(() => mockMemoryManager);
    
    await executeChat({ memory: true });
    
    expect(mockMemoryManager.retrieveRelevantMemories)
      .toHaveBeenCalledWith('test question with context');
      
    expect(LLMClient.prototype.completeChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('relevant memory blocks')
          })
        ])
      })
    );
  });
  
  it('should handle exitMemory command correctly when not in chat session', async () => {
    const result = await exitMemory({});
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('Chat Research Integration', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock LLM client
    LLMClient.prototype.complete = vi.fn().mockResolvedValue({
      content: 'Topic 1\nTopic 2\nTopic 3',
      model: 'test-model',
      timestamp: new Date().toISOString()
    });
    
    // Mock research engine
    ResearchEngine.prototype.research = vi.fn().mockResolvedValue({
      learnings: ['Learning 1', 'Learning 2'],
      sources: ['Source 1', 'Source 2'],
      filename: 'test-research.md'
    });
    
    // Mock generate queries
    generateQueries.mockResolvedValue([
      { query: 'Test query 1', researchGoal: 'Goal 1' },
      { query: 'Test query 2', researchGoal: 'Goal 2' },
      { query: 'Test query 3', researchGoal: 'Goal 3' }
    ]);
    
    // Mock user manager
    userManager.currentUser = { username: 'testuser', role: 'client' };
    
    // Mock output
    output.log = vi.fn();
    output.error = vi.fn();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should extract research topics from chat history', async () => {
    const chatHistory = [
      { role: 'user', content: 'What do you know about quantum computing?' },
      { role: 'assistant', content: 'Quantum computing is a type of computing that uses quantum bits or qubits.' },
      { role: 'user', content: 'Tell me more about qubits and superposition.' }
    ];
    
    const memoryBlocks = [
      { content: 'Quantum computing uses quantum mechanics principles.' }
    ];
    
    const queries = await generateResearchQueries(chatHistory, memoryBlocks);
    
    // Verify LLM was called for topic extraction
    expect(LLMClient.prototype.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('topic extraction'),
        prompt: expect.stringContaining('superposition')
      })
    );
    
    // Verify generateQueries was called with extracted topics
    expect(generateQueries).toHaveBeenCalled();
    expect(queries.length).toBeGreaterThan(0);
  });
  
  it('should handle empty chat history in generateResearchQueries', async () => {
    try {
      await generateResearchQueries([]);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toContain('too short');
    }
  });
  
  it('should start research from chat context', async () => {
    const chatHistory = [
      { role: 'user', content: 'What do you know about quantum computing?' },
      { role: 'assistant', content: 'Quantum computing is a type of computing that uses quantum bits or qubits.' },
      { role: 'user', content: 'Tell me more about qubits and superposition.' }
    ];
    
    const memoryBlocks = [
      { content: 'Quantum computing uses quantum mechanics principles.' }
    ];
    
    // Mock LLM for extractMainTopic
    LLMClient.prototype.complete.mockResolvedValueOnce({
      content: 'Quantum Computing and Qubits',
      model: 'test-model',
      timestamp: new Date().toISOString()
    });
    
    const options = { depth: 3, breadth: 4 };
    const result = await startResearchFromChat(chatHistory, memoryBlocks, options);
    
    expect(result.success).toBe(true);
    expect(result.topic).toBe('Quantum Computing and Qubits');
    
    // Verify research engine was created with correct params
    expect(ResearchEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        depth: 3,
        breadth: expect.any(Number),
        user: userManager.currentUser
      })
    );
    
    // Verify research was executed
    expect(ResearchEngine.prototype.research).toHaveBeenCalled();
  });
  
  it('should handle research command during chat session', async () => {
    // Mock readline for password prompt
    const mockRl = {
      question: vi.fn((_, callback) => callback('password')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockRl);
    
    // Mock chat interface readline
    const mockChatRl = {
      question: vi.fn()
        .mockImplementationOnce((_, cb) => cb('What is quantum computing?'))
        .mockImplementationOnce((_, cb) => cb('/research'))
        .mockImplementationOnce((_, cb) => cb('2')) // depth
        .mockImplementationOnce((_, cb) => cb('3')) // breadth
        .mockImplementationOnce((_, cb) => cb('/exit')),
      close: vi.fn()
    };
    readline.createInterface.mockReturnValueOnce(mockChatRl);
    
    // Mock LLM responses for both chat and research
    LLMClient.prototype.completeChat.mockResolvedValue({
      content: 'Quantum computing uses quantum mechanical phenomena.',
      model: 'test-model',
      timestamp: new Date().toISOString()
    });
    
    // Mock extract main topic
    LLMClient.prototype.complete.mockResolvedValue({
      content: 'Quantum Computing',
      model: 'test-model',
      timestamp: new Date().toISOString()
    });
    
    await executeChat({});
    
    // Verify that research was started
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('Starting research'));
    
    // Verify that research engine was used
    expect(ResearchEngine.prototype.research).toHaveBeenCalled();
  });
  
  it('should handle errors in startResearchFromChat', async () => {
    const chatHistory = [
      { role: 'user', content: 'What is quantum computing?' },
      { role: 'assistant', content: 'Quantum computing uses quantum bits.' }
    ];
    
    // Force an error
    ResearchEngine.prototype.research.mockRejectedValue(new Error('Research failed'));
    
    const result = await startResearchFromChat(chatHistory, [], { depth: 2, breadth: 3 });
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Research failed');
    expect(output.error).toHaveBeenCalled();
  });
});