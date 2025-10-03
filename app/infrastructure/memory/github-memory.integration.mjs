/**
 * Why: Persist conversational memories to GitHub (with local fallback) for long-term recall across sessions.
 * What: Wraps GitHub content APIs and local storage utilities to store, retrieve, and validate memory registries.
 * How: Maintains repository metadata per user, pushes structured markdown/JSON entries, and emits structured logs for errors and fallbacks.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('memory.github');

// Default memory repository settings
const DEFAULT_SETTINGS = {
  dataDir: path.join(process.env.HOME || process.env.USERPROFILE, '.mcp', 'github-memories'),
  repoName: 'memory-repository',
  useLocalFallback: true,
  enableSync: false
};

/**
 * GitHub Memory Integration
 * 
 * Handles storing and retrieving memories from GitHub repositories.
 */
export class GitHubMemoryIntegration {
  /**
   * Create a new GitHub Memory Integration instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.username - Username for memory ownership
   * @param {string} [options.repoName] - GitHub repository name
   * @param {string} [options.apiToken] - GitHub API token (if provided)
   * @param {boolean} [options.enabled] - Whether GitHub integration is enabled
   */
  constructor(options = {}) {
    const {
      username,
      repoName = DEFAULT_SETTINGS.repoName,
      apiToken,
      enabled = false,
      dataDir = DEFAULT_SETTINGS.dataDir
    } = options;
    
    if (!username) {
      throw new Error('Username is required for GitHub memory integration');
    }
    
    this.username = username;
    this.repoName = repoName;
    this.apiToken = apiToken;
    this.enabled = enabled;
    this.dataDir = dataDir;
    this.logger = moduleLogger.withMeta({ username, repoName, enabled });
    
    // Create local directory structure
    this.ensureDirectoryExists();
  }
  
  /**
   * Ensure the local directory structure exists
   * 
   * @private
   */
  async ensureDirectoryExists() {
    try {
      // Create main directory
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Create subdirectories for different memory types
      await fs.mkdir(path.join(this.dataDir, 'long_term'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'meta'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create memory directory.', { message: error.message, stack: error.stack });
    }
  }
  
  /**
   * Store a memory in GitHub or local fallback
   * 
   * @param {string|Object} memory - Memory content or object
   * @param {string} type - Memory type ('long_term' or 'meta')
   * @param {Object} [metadata] - Optional metadata
   * @returns {Promise<Object>} Result object including success status, memoryId, and potentially commit SHA or localPath.
   */
  async storeMemory(memory, type = 'long_term', metadata = {}) {
    try {
      // Prepare memory content
      const memoryContent = typeof memory === 'string' ? memory : memory.content;
      const tags = metadata.tags || memory.tags || [];
      const memoryData = {
        id: metadata.id || memory.id || `mem-${crypto.randomBytes(4).toString('hex')}`,
        content: memoryContent,
        timestamp: metadata.timestamp || memory.timestamp || new Date().toISOString(),
        tags: tags,
        score: metadata.score || memory.score || 0.5
      };
      
      // Format memory entry
      const formattedMemory = this.formatMemoryEntry(memoryData);
      
      if (this.enabled && this.apiToken) {
        // Try GitHub first if integration is enabled
        try {
          // Get existing registry file
          const registryPath = `${type}_registry.md`;
          let registry = await this.getRegistryFile(registryPath);
          
          // Append new memory entry
          registry.content = registry.content + '\n\n' + formattedMemory;
          
          // Update registry file
          const updateResult = await this.updateRegistryFile(registryPath, registry);
          this.logger.info('Stored memory in GitHub registry.', { memoryId: memoryData.id, registryPath, sha: updateResult.sha });
          return { success: true, memoryId: memoryData.id, sha: updateResult.sha };
        } catch (error) {
          this.logger.error('GitHub memory storage failed.', { message: error.message, stack: error.stack, memoryId: memoryData.id });
          // Fall back to local storage if GitHub fails
          if (!DEFAULT_SETTINGS.useLocalFallback) {
             throw new Error(`GitHub storage failed and local fallback is disabled: ${error.message}`);
          }
          this.logger.warn('Falling back to local storage for memory.', { memoryId: memoryData.id });
        }
      }
      
      // Local fallback storage
      try {
        const filename = `${memoryData.id}.json`;
        const filePath = path.join(this.dataDir, type, filename);
        
        // Write memory to local file
        await fs.writeFile(filePath, JSON.stringify(memoryData, null, 2));
        
        // Try to add to local git repository if available
        try {
          execSync(`git add "${filePath}"`, { cwd: this.dataDir });
          execSync(`git commit -m "Add memory: ${memoryData.id}"`, { cwd: this.dataDir });
        } catch (gitError) {
          this.logger.warn('Local git commit failed during memory store.', { message: gitError.message });
        }
        
        return { success: true, memoryId: memoryData.id, localPath: filePath };
      } catch (localError) {
        this.logger.error('Local memory storage failed.', { message: localError.message, stack: localError.stack });
        throw localError;
      }
    } catch (error) {
      return { success: false };
    }
  }
  
  /**
   * Format a memory entry for storage in registry
   * 
   * @param {Object} memory - Memory object
   * @returns {string} Formatted memory entry
   */
  formatMemoryEntry(memory) {
    const timestamp = memory.timestamp || new Date().toISOString();
    const tags = Array.isArray(memory.tags) ? memory.tags.join(', ') : '';
    const score = typeof memory.score === 'number' ? memory.score.toFixed(2) : '0.50';
    
    return `## Entry: ${timestamp}
Memory ID: ${memory.id}
Tags: ${tags}
Score: ${score}
Content: ${memory.content}`;
  }
  
  /**
   * Get registry file from GitHub
   * 
   * @param {string} path - Registry file path
   * @returns {Promise<Object>} Registry data
   * @private
   */
  async getRegistryFile(path) {
    if (!this.enabled || !this.apiToken) {
      throw new Error('GitHub integration not enabled');
    }
    
    try {
      const url = `https://api.github.com/repos/${this.username}/${this.repoName}/contents/${path}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.apiToken}`
        }
      });
      
      if (response.status === 404) {
        // Create new registry file if it doesn't exist
        return {
          content: `# ${path === 'long_term_registry.md' ? 'Long-Term Memory Registry' : 'Meta Memory Registry'}\n`,
          exists: false
        };
      }
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Decode content from base64
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return {
        content,
        sha: data.sha,
        exists: true
      };
    } catch (error) {
      if (error.message.includes('404')) {
        // Create new registry file if it doesn't exist
        return {
          content: `# ${path === 'long_term_registry.md' ? 'Long-Term Memory Registry' : 'Meta Memory Registry'}\n`,
          exists: false
        };
      }
      throw error;
    }
  }
  
  /**
   * Update registry file on GitHub
   * 
   * @param {string} path - Registry file path
   * @param {Object} registry - Registry data
   * @returns {Promise<Object>} Result object including success status and commit SHA.
   * @private
   */
  async updateRegistryFile(path, registry) {
    if (!this.enabled || !this.apiToken) {
      throw new Error('GitHub integration not enabled');
    }
    
    try {
      const url = `https://api.github.com/repos/${this.username}/${this.repoName}/contents/${path}`;
      const content = Buffer.from(registry.content).toString('base64');
      
      const body = {
        message: `Update ${path} [automated]`,
        content,
        branch: 'main'
      };
      
      // Include SHA if file exists (needed for update)
      if (registry.exists && registry.sha) {
        body.sha = registry.sha;
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        sha: data.content.sha // Return the commit SHA
      };
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Retrieve memories from GitHub or local fallback
   * 
   * @param {string} type - Memory type ('long_term' or 'meta')
   * @param {string[]} [tags] - Optional tags to filter by
   * @returns {Promise<Array>} Array of memory objects
   */
  async retrieveMemories(type = 'long_term', tags) {
    try {
      // Try GitHub first if enabled
      if (this.enabled && this.apiToken) {
        try {
          const registryPath = `${type}_registry.md`;
          const registry = await this.getRegistryFile(registryPath);
          
          // Parse memory entries from registry
          const memories = this.parseRegistryContent(registry.content);
          
          // Filter by tags if provided
          if (tags && Array.isArray(tags) && tags.length > 0) {
            return memories.filter(memory => 
              tags.some(tag => memory.tags && memory.tags.includes(tag))
            );
          }
          
          return memories;
        } catch (error) {
          this.logger.error('GitHub memory retrieval failed in retrieveMemories.', { message: error.message, stack: error.stack, type, tags });
          // Fall back to local storage
        }
      }
      
      // Local fallback retrieval
      try {
        const dirPath = path.join(this.dataDir, type);
        const files = await fs.readdir(dirPath);
        
        const memories = await Promise.all(
          files.filter(file => file.endsWith('.json')).map(async file => {
            const filePath = path.join(dirPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
          })
        );
        
        // Filter by tags if provided
        if (tags && Array.isArray(tags) && tags.length > 0) {
          return memories.filter(memory => 
            tags.some(tag => memory.tags && memory.tags.includes(tag))
          );
        }
        
        return memories;
      } catch (error) {
        this.logger.error('Local memory retrieval failed in retrieveMemories.', { message: error.message, stack: error.stack, type, tags });
        return [];
      }
    } catch (error) {
      this.logger.error('Memory retrieval error.', { message: error.message, stack: error.stack, type, tags });
      return [];
    }
  }
  
  /**
   * Parse registry content into memory objects
   * 
   * @param {string} content - Registry file content
   * @returns {Array<Object>} Array of memory objects
   * @private
   */
  parseRegistryContent(content) {
    try {
      const memories = [];
      
      // Split content by entries (each starting with "## Entry")
      const entryPattern = /## Entry: (.*?)\n([\s\S]*?)(?=## Entry:|$)/g;
      let match;
      
      while ((match = entryPattern.exec(content)) !== null) {
        const timestamp = match[1].trim();
        const entryContent = match[2].trim();
        
        // Parse entry details using regex for robustness
        const idMatch = entryContent.match(/Memory ID: (.*)/);
        const tagsMatch = entryContent.match(/Tags: (.*)/);
        const scoreMatch = entryContent.match(/Score: (.*)/);
        const contentMatch = entryContent.match(/Content: ([\s\S]*)/);
        
        const memory = {
          timestamp,
          id: idMatch ? idMatch[1].trim() : `mem-${crypto.randomBytes(4).toString('hex')}`,
          tags: tagsMatch ? tagsMatch[1].split(',').map(tag => tag.trim()).filter(Boolean) : [],
          score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.5,
          content: contentMatch ? contentMatch[1].trim() : ""
        };
        
        memories.push(memory);
      }
      
      return memories;
    } catch (error) {
      this.logger.error('Error parsing registry content.', { message: error.message, stack: error.stack });
      return [];
    }
  }
  
  /**
   * Check if GitHub integration is configured and working
   * 
   * @returns {Promise<boolean>} True if GitHub integration is working
   */
  async checkGitHubIntegration() {
    if (!this.enabled || !this.apiToken) {
      return false;
    }
    
    try {
      const url = `https://api.github.com/repos/${this.username}/${this.repoName}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.apiToken}`
        }
      });
      
      return response.ok;
    } catch (error) {
      this.logger.error('GitHub integration check failed.', { message: error.message, stack: error.stack });
      return false;
    }
  }
}