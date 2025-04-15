// filepath: /workspaces/MCP/app/tests/research-pipeline.test.mjs
import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { userManager } from '../features/auth/user-manager.mjs';
import assert from 'assert';

/**
 * Validates the research pipeline with respect to user roles and API keys
 */
export async function validateResearchPipeline() {
  console.log('=== Validating Research Pipeline ===');
  
  // Test cases for different user roles
  const testCases = [
    { role: 'public', maxDepth: 2, maxBreadth: 3 },
    { role: 'client', maxDepth: 3, maxBreadth: 5 },
    { role: 'admin', maxDepth: 5, maxBreadth: 10 }
  ];
  
  const results = {
    success: true,
    roleLimits: {},
    apiKeyTests: {}
  };
  
  // 1. Test role-based limits
  console.log('Testing role-based research limits...');
  const currentUser = userManager.currentUser;
  
  for (const test of testCases) {
    try {
      console.log(`Testing limits for ${test.role} role...`);
      
      // Create a research engine with settings that exceed the role's limits
      const engine = new ResearchEngine({
        query: 'Test query',
        depth: test.maxDepth + 1,
        breadth: test.maxBreadth + 1,
        role: test.role
      });
      
      // Check if the limits are enforced correctly
      assert(engine.depth <= test.maxDepth, 
        `Depth for ${test.role} should be limited to ${test.maxDepth}`);
      assert(engine.breadth <= test.maxBreadth, 
        `Breadth for ${test.role} should be limited to ${test.maxBreadth}`);
      
      // Record the result
      results.roleLimits[test.role] = {
        success: true,
        maxDepth: test.maxDepth,
        maxBreadth: test.maxBreadth,
        enforcedDepth: engine.depth,
        enforcedBreadth: engine.breadth
      };
      
      console.log(`✅ ${test.role} role limits are correctly enforced`);
    } catch (error) {
      console.log(`❌ Error validating ${test.role} role limits: ${error.message}`);
      results.roleLimits[test.role] = {
        success: false,
        error: error.message
      };
      results.success = false;
    }
  }
  
  // 2. Test API key handling with different configurations
  console.log('\nTesting API key handling...');
  
  const testApiKeyConfigs = [
    { name: 'environment', useEnvKeys: true, checkDecryption: false },
    { name: 'user', useEnvKeys: false, checkDecryption: true }
  ];
  
  for (const config of testApiKeyConfigs) {
    try {
      console.log(`Testing ${config.name} API key configuration...`);
      
      // Create a test engine that will use appropriate keys
      const engineParams = {
        query: 'Test query',
        depth: 1,
        breadth: 2,
        useEnvKeys: config.useEnvKeys
      };
      
      // Initialize the engine which will check for keys
      const engine = new ResearchEngine(engineParams);
      
      // Validate the API key configuration
      if (config.useEnvKeys) {
        // Should be using environment variables
        assert(engine.useEnvKeys === true, 
          'Engine should use environment variables for API keys');
      } else if (config.checkDecryption && userManager.isAuthenticated()) {
        // Should be using decrypted user keys
        assert(engine.useEnvKeys === false, 
          'Authenticated users should use their stored API keys');
      }
      
      // Record the result
      results.apiKeyTests[config.name] = { 
        success: true,
      };
      
      console.log(`✅ ${config.name} API key configuration is correctly handled`);
    } catch (error) {
      console.log(`❌ Error validating ${config.name} API key configuration: ${error.message}`);
      results.apiKeyTests[config.name] = {
        success: false,
        error: error.message
      };
      results.success = false;
    }
  }
  
  // 3. Test that the research pipeline with a minimal query
  try {
    console.log('\nTesting minimal research execution...');
    
    // Create a minimal research engine
    const engine = new ResearchEngine({
      query: 'quantum computing basics',
      depth: 1,
      breadth: 2,
      onProgress: progress => console.log(`Progress: ${progress.completedQueries}/${progress.totalQueries}`)
    });
    
    // Run a minimal research
    console.log('Running minimal research...');
    const result = await engine.research();
    
    // Validate the research output
    assert(result && typeof result === 'object', 'Research should return an object');
    assert(Array.isArray(result.learnings), 'Research result should have learnings array');
    assert(result.learnings.length > 0, 'Research should produce at least one learning');
    
    // Record success
    results.minimalResearch = { 
      success: true,
      learningsCount: result.learnings.length
    };
    
    console.log(`✅ Minimal research executed successfully with ${result.learnings.length} learnings`);
  } catch (error) {
    console.log(`❌ Error executing minimal research: ${error.message}`);
    results.minimalResearch = {
      success: false,
      error: error.message
    };
    results.success = false;
  }
  
  // Summary
  console.log('\n=== Research Pipeline Validation Summary ===');
  console.log(`Overall result: ${results.success ? '✅ PASSED' : '❌ FAILED'}`);
  
  return results;
}

// Run the test if this file is executed directly
if (process.argv[1].endsWith('research-pipeline.test.mjs')) {
  validateResearchPipeline()
    .then(results => {
      console.log('Test completed.');
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}