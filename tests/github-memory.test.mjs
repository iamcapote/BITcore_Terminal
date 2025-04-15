import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { GitHubMemoryIntegration } from '../app/infrastructure/memory/github-memory.integration.mjs';

// Mock modules that interact with GitHub API
vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

// Import the mocked fetch after mocking
import fetch from 'node-fetch';

describe('GitHub Memory Integration', () => {
  let githubIntegration;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create a new instance of GitHubMemoryIntegration
    githubIntegration = new GitHubMemoryIntegration({
      username: 'testuser',
      repoName: 'test-memory-repo',
      enabled: true
    });
    
    // Mock fetch responses for different GitHub API calls
    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/contents/long_term_registry.md') && options.method === 'GET') {
        // Mock getting the long-term memory registry
        return {
          ok: true,
          json: async () => ({
            sha: 'abc123',
            content: Buffer.from(`# Long-Term Memory Registry
              
## Entry: 2025-04-13T10:30:00Z
Memory ID: mem-001
Tags: javascript, react
Content: React uses a virtual DOM for efficient updates.

## Entry: 2025-04-13T11:45:00Z
Memory ID: mem-002
Tags: api, fetch
Content: Fetch API returns promises that resolve to Response objects.
`).toString('base64'),
            encoding: 'base64'
          })
        };
      } else if (url.includes('/contents/meta_memory_registry.md') && options.method === 'GET') {
        // Mock getting the meta memory registry
        return {
          ok: true,
          json: async () => ({
            sha: 'def456',
            content: Buffer.from(`# Meta Memory Registry
              
## Summary: 2025-04-13T12:00:00Z
Tags: javascript, programming
Content: Discussion about modern JavaScript frameworks and API practices.
`).toString('base64'),
            encoding: 'base64'
          })
        };
      } else if (options.method === 'PUT') {
        // Mock updating a file
        return {
          ok: true,
          json: async () => ({
            content: {
              sha: 'updated-sha-123'
            }
          })
        };
      }
      
      // Default mock response for any other request
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not found' })
      };
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Memory Storage', () => {
    it('should store a memory in the long-term registry', async () => {
      const memory = {
        content: 'TypeScript adds static typing to JavaScript',
        tags: ['typescript', 'javascript', 'programming']
      };
      
      const result = await githubIntegration.storeMemory(memory, 'long_term');
      
      // Verify fetch was called with the correct parameters
      expect(fetch).toHaveBeenCalled();
      expect(fetch.mock.calls[0][0]).toContain('/contents/long_term_registry.md');
      expect(fetch.mock.calls[0][1].method).toBe('GET');
      
      // Second fetch should be PUT to update the file
      expect(fetch.mock.calls[1][0]).toContain('/contents/long_term_registry.md');
      expect(fetch.mock.calls[1][1].method).toBe('PUT');
      expect(fetch.mock.calls[1][1].body).toContain('TypeScript adds static typing to JavaScript');
      
      // Verify result
      expect(result).toHaveProperty('success', true);
    });
    
    it('should store a memory in the meta registry', async () => {
      const memory = {
        content: 'Summary of discussion about React hooks and lifecycle methods',
        tags: ['react', 'hooks', 'lifecycle']
      };
      
      const result = await githubIntegration.storeMemory(memory, 'meta');
      
      // Verify fetch was called with the correct parameters
      expect(fetch).toHaveBeenCalled();
      expect(fetch.mock.calls[0][0]).toContain('/contents/meta_memory_registry.md');
      
      // Verify the content in the PUT request
      expect(fetch.mock.calls[1][1].body).toContain('Summary of discussion about React hooks');
      
      // Verify result
      expect(result).toHaveProperty('success', true);
    });
    
    it('should handle errors gracefully', async () => {
      // Mock fetch to simulate an error
      fetch.mockImplementation(() => {
        throw new Error('Network error');
      });
      
      const memory = { content: 'Test memory', tags: ['test'] };
      
      const result = await githubIntegration.storeMemory(memory, 'long_term');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
    
    it('should create a new registry file if it does not exist', async () => {
      // Mock fetch to first return 404, then success for creation
      fetch.mockReset();
      let fetchCallCount = 0;
      
      fetch.mockImplementation(async (url, options) => {
        fetchCallCount++;
        
        if (fetchCallCount === 1) {
          // First call - GET registry file, return 404
          return { 
            ok: false, 
            status: 404,
            json: async () => ({ message: 'Not found' })
          };
        } else {
          // Second call - PUT to create registry file
          return {
            ok: true,
            json: async () => ({
              content: {
                sha: 'new-file-sha-123'
              }
            })
          };
        }
      });
      
      const memory = { content: 'First memory in new registry', tags: ['first'] };
      
      const result = await githubIntegration.storeMemory(memory, 'long_term');
      
      // Verify PUT request was made to create the file
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[1][1].method).toBe('PUT');
      expect(fetch.mock.calls[1][1].body).toContain('First memory in new registry');
      
      // Verify no sha in the request when creating a new file
      const putRequestBody = JSON.parse(fetch.mock.calls[1][1].body);
      expect(putRequestBody.sha).toBeUndefined();
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('Memory Retrieval', () => {
    it('should retrieve memories from the long-term registry', async () => {
      const memories = await githubIntegration.retrieveMemories('long_term');
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(2);
      expect(memories[0]).toHaveProperty('id', 'mem-001');
      expect(memories[0]).toHaveProperty('content');
      expect(memories[0].tags).toContain('javascript');
    });
    
    it('should retrieve memories from the meta registry', async () => {
      const memories = await githubIntegration.retrieveMemories('meta');
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(1);
      expect(memories[0].tags).toContain('javascript');
      expect(memories[0].content).toContain('Discussion about modern JavaScript frameworks');
    });
    
    it('should handle registry retrieval errors gracefully', async () => {
      // Mock fetch to simulate an error
      fetch.mockImplementation(() => {
        throw new Error('API error');
      });
      
      const memories = await githubIntegration.retrieveMemories('long_term');
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(0);
    });
    
    it('should return empty array if registry file does not exist', async () => {
      // Mock fetch to return 404 for non-existent file
      fetch.mockImplementation(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not found' })
      }));
      
      const memories = await githubIntegration.retrieveMemories('long_term');
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(0);
    });
    
    it('should parse memory entries correctly', async () => {
      // Mock a specific registry format
      fetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          content: Buffer.from(`# Test Registry
          
## Entry: 2025-04-14T09:00:00Z
Memory ID: test-id-1
Tags: test, parsing
Content: This is a test memory entry.
Score: 0.85

## Entry: 2025-04-14T10:00:00Z
Memory ID: test-id-2
Tags: example, multiline
Content: This memory
spans multiple
lines of text.
`).toString('base64'),
          encoding: 'base64'
        })
      }));
      
      const memories = await githubIntegration.retrieveMemories('test');
      
      expect(memories.length).toBe(2);
      
      // Check first memory
      expect(memories[0].id).toBe('test-id-1');
      expect(memories[0].tags).toContain('test');
      expect(memories[0].tags).toContain('parsing');
      expect(memories[0].content).toBe('This is a test memory entry.');
      expect(memories[0].score).toBe(0.85);
      
      // Check multiline content parsing
      expect(memories[1].content).toBe('This memory\nspans multiple\nlines of text.');
    });
  });
  
  describe('Advanced Features', () => {
    it('should format memory entries correctly for storage', () => {
      const memory = {
        id: 'test-mem-123',
        content: 'This is a test memory',
        tags: ['test', 'sample'],
        score: 0.75
      };
      
      const formattedEntry = githubIntegration.formatMemoryEntry(memory);
      
      expect(formattedEntry).toContain('Memory ID: test-mem-123');
      expect(formattedEntry).toContain('Tags: test, sample');
      expect(formattedEntry).toContain('Score: 0.75');
      expect(formattedEntry).toContain('Content: This is a test memory');
    });
    
    it('should handle tag filtering when retrieving memories', async () => {
      // Mock registry with various tags
      fetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          content: Buffer.from(`# Tagged Registry
          
## Entry: 2025-04-14T09:00:00Z
Memory ID: mem-tag-1
Tags: javascript, react
Content: React is a JavaScript library.

## Entry: 2025-04-14T10:00:00Z
Memory ID: mem-tag-2
Tags: python, data
Content: Python is great for data analysis.

## Entry: 2025-04-14T11:00:00Z
Memory ID: mem-tag-3
Tags: javascript, typescript
Content: TypeScript is a superset of JavaScript.
`).toString('base64'),
          encoding: 'base64'
        })
      }));
      
      // Get memories filtered by tag
      const jsMemories = await githubIntegration.retrieveMemories('test', ['javascript']);
      
      expect(jsMemories.length).toBe(2);
      expect(jsMemories[0].id).toBe('mem-tag-1');
      expect(jsMemories[1].id).toBe('mem-tag-3');
      
      // Test intersecting tags
      const tsMemories = await githubIntegration.retrieveMemories('test', ['typescript', 'javascript']);
      expect(tsMemories.length).toBe(1);
      expect(tsMemories[0].id).toBe('mem-tag-3');
    });
  });
});