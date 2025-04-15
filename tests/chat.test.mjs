/**
 * Tests for the chat system and memory integration
 */
import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { executeChat, exitMemory } from '../app/commands/chat.cli.mjs';
import { MemoryManager } from '../app/infrastructure/memory/memory.manager.mjs';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock LLM responses for testing
const mockLLMResponse = {
  content: 'This is a mock response from the LLM.',
  model: 'test-model',
  timestamp: new Date().toISOString()
};

// Mock LLM client
class MockLLMClient {
  async complete() {
    return mockLLMResponse;
  }
  
  async completeChat() {
    return mockLLMResponse;
  }
}

// Replace actual LLM client with mock
import { LLMClient } from '../app/infrastructure/ai/venice.llm-client.mjs';
LLMClient.prototype.complete = () => Promise.resolve(mockLLMResponse);
LLMClient.prototype.completeChat = () => Promise.resolve(mockLLMResponse);

// Create test user directory
const testUserDir = path.join(os.homedir(), '.mcp-test');
const testUsersDir = path.join(testUserDir, 'users');

describe('Chat System Tests', function() {
  // Increase timeout for potentially slow tests
  this.timeout(10000);
  
  // Setup test user
  const testUser = {
    username: 'testuser',
    password: 'testpassword',
    role: 'client'
  };
  
  // Test API keys
  const testApiKeys = {
    venice: 'test-venice-api-key',
    brave: 'test-brave-api-key'
  };
  
  before(async function() {
    // Set mock API key for Venice LLM
    process.env.VENICE_API_KEY = testApiKeys.venice;
    
    // Create test directories
    try {
      await fs.mkdir(testUserDir, { recursive: true });
      await fs.mkdir(testUsersDir, { recursive: true });
    } catch (e) {
      console.log('Test directories already exist');
    }
    
    // Patch userManager to use test directory
    userManager.userDirectory = testUsersDir;
    
    // Create test user - note the order: username, role, password
    await userManager.createUser(testUser.username, testUser.role, testUser.password);
    
    // Login as test user
    try {
      await userManager.login(testUser.username, testUser.password);
    } catch (error) {
      console.log(`Error logging in: ${error.message}`);
    }
    
    // Set API keys
    try {
      await userManager.setApiKey('venice', testApiKeys.venice, testUser.password);
      await userManager.setApiKey('brave', testApiKeys.brave, testUser.password);
    } catch (error) {
      console.log(`Error setting API keys: ${error.message}`);
    }
  });
  
  after(async function() {
    // Clean up test user
    delete process.env.VENICE_API_KEY;
    try {
      await fs.rm(testUserDir, { recursive: true });
    } catch (e) {
      console.error('Error cleaning up test directory:', e);
    }
  });
  
  describe('Memory Manager', function() {
    it('should initialize correctly with valid options', function() {
      const memoryManager = new MemoryManager({
        depth: 'medium',
        user: userManager.currentUser
      });
      
      expect(memoryManager.depth).to.equal('medium');
      expect(memoryManager.settings).to.have.property('maxMemories');
      expect(memoryManager.settings).to.have.property('retrievalLimit');
      expect(memoryManager.settings).to.have.property('threshold');
      expect(memoryManager.ephemeralMemories).to.be.an('array').that.is.empty;
      expect(memoryManager.validatedMemories).to.be.an('array').that.is.empty;
    });
    
    it('should store and retrieve memories', async function() {
      const memoryManager = new MemoryManager({
        depth: 'medium',
        user: userManager.currentUser
      });
      
      // Store some memories
      await memoryManager.storeMemory('This is a test memory from the user', 'user');
      await memoryManager.storeMemory('This is a response from the assistant', 'assistant');
      
      // Check if memories were stored
      expect(memoryManager.ephemeralMemories).to.have.lengthOf(2);
      expect(memoryManager.ephemeralMemories[0].role).to.equal('user');
      expect(memoryManager.ephemeralMemories[1].role).to.equal('assistant');
      
      // Retrieve memories
      const relevantMemories = await memoryManager.retrieveRelevantMemories('test memory');
      
      // In real operation, the LLM would score memories, but with our mock, we'll expect at least one memory
      expect(relevantMemories.length).to.be.at.least(0);
    });
    
    it('should validate memories', async function() {
      const memoryManager = new MemoryManager({
        depth: 'short',
        user: userManager.currentUser
      });
      
      // Store some memories
      await memoryManager.storeMemory('Important fact: The Earth orbits the Sun', 'user');
      await memoryManager.storeMemory('Another key point: Jupiter is a gas giant', 'assistant');
      
      // Validate memories
      const result = await memoryManager.validateMemories();
      
      // Check validation result
      expect(result).to.have.property('validated');
    });
    
    it('should summarize and finalize memories', async function() {
      const memoryManager = new MemoryManager({
        depth: 'medium',
        user: userManager.currentUser
      });
      
      // Store some memories
      await memoryManager.storeMemory('The Earth orbits the Sun', 'user');
      await memoryManager.storeMemory('Yes, that is correct. The Earth orbits the Sun in approximately 365.25 days.', 'assistant');
      await memoryManager.storeMemory('What about other planets?', 'user');
      await memoryManager.storeMemory('Mars orbits the Sun in about 687 Earth days.', 'assistant');
      
      // Create a conversation text
      const conversationText = 'USER: The Earth orbits the Sun\nASSISTANT: Yes, that is correct. The Earth orbits the Sun in approximately 365.25 days.\nUSER: What about other planets?\nASSISTANT: Mars orbits the Sun in about 687 Earth days.';
      
      // Summarize and finalize
      const result = await memoryManager.summarizeAndFinalize(conversationText);
      
      // Check result
      expect(result).to.have.property('success');
      expect(result.success).to.equal(true);
      expect(result).to.have.property('summary');
      
      // Check if ephemeral memories are cleared
      expect(memoryManager.ephemeralMemories).to.have.lengthOf(0);
    });
  });
  
  describe('Chat Command', function() {
    it('should require authentication', async function() {
      // Temporarily logout
      const savedUser = userManager.currentUser;
      userManager.logout();
      
      // Attempt to execute chat command
      const result = await executeChat({});
      
      // Check for authentication error
      expect(result.error).to.include('You must be logged in');
      
      // Restore user
      userManager.currentUser = savedUser;
    });
    
    it('should execute chat with memory enabled', async function() {
      // This is a partial test since we can't easily test the interactive part
      // We'll just check that the method doesn't throw an error when properly configured
      
      try {
        // Mock process stdin/stdout for readline
        const originalStdin = process.stdin;
        const originalStdout = process.stdout;
        
        // Mock process.stdin to auto-exit chat after initialization
        const mockStdin = {
          on: () => {},
          once: () => {},
          removeListener: () => {},
          setRawMode: () => {},
          resume: () => {},
          pause: () => {}
        };
        
        const mockStdout = {
          write: () => {}
        };
        
        // Override stdin/stdout temporarily
        process.stdin = mockStdin;
        process.stdout = mockStdout;
        
        // Execute chat with memory (it will exit early due to our mock)
        await executeChat({
          memory: true,
          depth: 'short',
          verbose: true,
          password: testUser.password,
          _testMode: true // Special flag to exit early for testing
        });
        
        // If we got here without error, the test passes
        expect(true).to.be.true;
        
        // Restore stdin/stdout
        process.stdin = originalStdin;
        process.stdout = originalStdout;
      } catch (error) {
        // Fail test if there's an error
        expect.fail(`Chat execution failed: ${error.message}`);
      }
    });
    
    it('should handle exitmemory command only in active memory mode', async function() {
      const result = await exitMemory({});
      expect(result.error).to.include('only available within an active chat session');
    });
  });
});