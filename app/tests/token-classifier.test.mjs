// filepath: /workspaces/MCP/app/tests/token-classifier.test.mjs
import { callVeniceWithTokenClassifier } from '../utils/token-classifier.mjs';
import assert from 'assert';

/**
 * Validates token classifier integration with the research pipeline
 * This validates that token classification produces usable metadata
 */
export async function validateTokenClassifier() {
  console.log('=== Validating Token Classification ===');
  
  try {
    // Check if API key is available
    if (!process.env.VENICE_API_KEY) {
      console.log('❌ VENICE_API_KEY not found in environment. Cannot run validation');
      return { success: false, error: 'Missing API key' };
    }
    
    // Test with a simple query
    const testQuery = 'What are the benefits of quantum computing?';
    console.log(`Testing with query: "${testQuery}"`);
    
    try {
      const metadata = await callVeniceWithTokenClassifier(testQuery);
      
      // Validate metadata format and content
      assert(metadata, 'Metadata should not be null or empty');
      assert(typeof metadata === 'string', 'Metadata should be a string');
      assert(metadata.length > 10, 'Metadata should have meaningful content');
      
      console.log('✅ Token classifier successfully generated metadata');
      console.log(`Metadata sample: ${metadata.substring(0, 100)}...`);
      
      // Test metadata integration with query object format
      const queryObject = { 
        original: testQuery, 
        metadata 
      };
      
      // Verify object structure is as expected
      assert(queryObject.original === testQuery, 'Original query should be preserved');
      assert(queryObject.metadata === metadata, 'Metadata should be stored correctly');
      
      console.log('✅ Token classification integration validation complete');
      return { success: true, metadata: metadata.substring(0, 100) + '...' };
    } catch (error) {
      console.log(`❌ Error during token classification: ${error.message}`);
      return { success: false, error: error.message };
    }
  } catch (error) {
    console.log(`❌ Validation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the test if this file is executed directly 
if (process.argv[1].endsWith('token-classifier.test.mjs')) {
  validateTokenClassifier()
    .then(result => {
      console.log(`Test ${result.success ? 'passed' : 'failed'}: ${result.success ? result.metadata : result.error}`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}