import readline from 'readline';
import { userManager } from '../features/auth/user-manager.mjs';
import fetch from 'node-fetch';

/**
 * CLI command for API key management
 * Usage: /keys set [--venice=XXXX] [--brave=YYYY] [--password=ZZZZ]
 *        /keys check
 *        /keys test
 */
export async function executeKeys(options = {}) {
  // Extract the action from command structure
  let { action = 'check', password, arg0 } = options;
  
  // If the first positional argument is 'set', 'check', or 'test', use that as the action
  if (arg0 && ['set', 'check', 'test'].includes(arg0)) {
    action = arg0;
  }
  
  console.log(`[DEBUG] executeKeys called with action: ${action}`);

  // Check if user is authenticated (not public)
  if (!userManager.isAuthenticated()) {
    console.error('Error: You must be logged in to manage API keys');
    return { success: false, error: 'Authentication required' };
  }

  switch (action) {
    case 'set':
      return await setKeys(options);
    case 'check':
      return await checkKeys();
    case 'test':
      return await testKeys(options);
    default:
      console.error('Unknown action for /keys command');
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Get password input securely from console
 * @returns {Promise<string>} Password
 */
function getPassword() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Enter your password: ', (password) => {
      rl.close();
      resolve(password);
    });
  });
}

/**
 * Get API key input from console
 * @param {string} service - Service name (venice or brave)
 * @returns {Promise<string>} API key
 */
function getApiKey(service) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`Enter your ${service} API Key: `, (apiKey) => {
      rl.close();
      resolve(apiKey);
    });
  });
}

/**
 * Set API keys for the current user
 * @param {Object} options - Options with API keys
 * @returns {Promise<Object>} Result of set operation
 */
async function setKeys(options = {}) {
  // Extract the options, handling both named and positional arguments
  const { venice, brave, password: providedPassword, arg0 } = options;

  try {
    console.log('[DEBUG] setKeys called with options:', options);
    let password = providedPassword;
    let veniceKey = venice;
    let braveKey = brave;

    // Interactive mode if password or keys not provided
    if (!password) {
      password = await getPassword();
    }

    if (!veniceKey) {
      veniceKey = await getApiKey('Venice');
      console.log(`[DEBUG] Venice key received: ${veniceKey ? 'yes' : 'no'}`);
    }

    if (!braveKey) {
      braveKey = await getApiKey('Brave');
      console.log(`[DEBUG] Brave key received: ${braveKey ? 'yes' : 'no'}`);
    }

    // Set Venice key if provided
    if (veniceKey) {
      console.log('[DEBUG] Setting Venice API Key');
      await userManager.setApiKey('venice', veniceKey, password);
    }
    
    // Set Brave key if provided
    if (braveKey) {
      console.log('[DEBUG] Setting Brave API Key');
      await userManager.setApiKey('brave', braveKey, password);
    }

    // Verify keys were set successfully
    const veniceKeyExists = await userManager.hasApiKey('venice');
    const braveKeyExists = await userManager.hasApiKey('brave');
    
    console.log('=== API Keys Status ===');
    console.log(`Venice API Key: ${veniceKeyExists ? '✓ Configured' : '✗ Not configured'}`);
    console.log(`Brave Search API Key: ${braveKeyExists ? '✓ Configured' : '✗ Not configured'}`);
    
    return { 
      success: true,
      veniceKeySet: veniceKeyExists,
      braveKeySet: braveKeyExists
    };
  } catch (error) {
    console.error(`[Key Management] Error setting API keys: ${error.message}`);
    return { success: false, error: `Failed to set API keys. Please check your input and try again. Details: ${error.message}` };
  }
}

/**
 * Check the status of stored API keys
 * @returns {Promise<Object>} Status of API keys
 */
async function checkKeys() {
  const veniceKeyExists = await userManager.hasApiKey('venice');
  const braveKeyExists = await userManager.hasApiKey('brave');

  console.log('=== API Keys Status ===');
  console.log(`Venice API Key: ${veniceKeyExists ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`Brave Search API Key: ${braveKeyExists ? '✓ Configured' : '✗ Not configured'}`);

  return { success: true };
}

/**
 * Test the validity of stored API keys
 * @param {Object} options - Command options including password
 * @returns {Promise<Object>} Test results
 */
async function testKeys(options = {}) {
  console.log('Testing API keys...');
  const { password: providedPassword } = options;

  const veniceKeyExists = await userManager.hasApiKey('venice');
  const braveKeyExists = await userManager.hasApiKey('brave');

  if (!veniceKeyExists && !braveKeyExists) {
    console.error('Error: No API keys configured');
    return { success: false, error: 'No API keys configured' };
  }

  // Use provided password or prompt for one
  let password = providedPassword;
  let rl;
  
  if (!password) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    try {
      // Create a more secure password input function
      const getSecurePassword = () => {
        return new Promise((resolve) => {
          process.stdout.write('Enter your password to decrypt API keys: ');
          process.stdin.setRawMode(true);
          let pwd = '';
          
          const dataHandler = (chunk) => {
            const str = chunk.toString();
            // Handle backspace
            if (str === '\u0008' || str === '\u007f') {
              if (pwd.length > 0) {
                pwd = pwd.slice(0, -1);
                process.stdout.write('\b \b');
              }
            // Handle Enter
            } else if (str === '\r' || str === '\n') {
              process.stdin.setRawMode(false);
              process.stdin.removeListener('data', dataHandler);
              process.stdout.write('\n');
              resolve(pwd);
            // Regular character
            } else if (str.length === 1 && str.charCodeAt(0) >= 32) {
              pwd += str;
              process.stdout.write('*');
            }
          };
          
          process.stdin.on('data', dataHandler);
        });
      };
      
      password = await getSecurePassword();
      
      if (!password) {
        throw new Error('Password is required to test API keys');
      }
    } catch (error) {
      console.error(`Error reading password: ${error.message}`);
      if (rl) rl.close();
      return { success: false, error: 'Failed to read password input' };
    }
  }
  
  if (rl) rl.close();

  const results = {};
  let allSuccess = true;

  if (veniceKeyExists) {
    try {
      console.log('Testing Venice API key...');
      const veniceKey = await userManager.getApiKey('venice', password);
      
      if (!veniceKey) {
        results.venice = 'Error: Could not decrypt key with provided password';
        allSuccess = false;
      } else {
        try {
          const response = await fetch('https://api.venice.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${veniceKey}` }
          });
          
          if (response.ok) {
            results.venice = 'Valid';
          } else {
            const errorText = await response.text();
            results.venice = `Invalid (HTTP ${response.status}): ${errorText || 'Unknown error'}`;
            allSuccess = false;
          }
        } catch (error) {
          results.venice = `Connection error: ${error.message}`;
          allSuccess = false;
        }
      }
    } catch (error) {
      if (error.message.includes('Password is incorrect') || error.message.includes('crypto failure')) {
        results.venice = 'Error: Password is incorrect';
      } else {
        results.venice = `Error: ${error.message}`;
      }
      allSuccess = false;
    }
  }

  if (braveKeyExists) {
    try {
      console.log('Testing Brave Search API key...');
      const braveKey = await userManager.getApiKey('brave', password);
      
      if (!braveKey) {
        results.brave = 'Error: Could not decrypt key with provided password';
        allSuccess = false;
      } else {
        try {
          const response = await fetch('https://api.search.brave.com/res/v1/status', {
            headers: { 'X-Subscription-Token': braveKey }
          });
          
          if (response.ok) {
            results.brave = 'Valid';
          } else {
            const errorText = await response.text();
            results.brave = `Invalid (HTTP ${response.status}): ${errorText || 'Unknown error'}`;
            allSuccess = false;
          }
        } catch (error) {
          results.brave = `Connection error: ${error.message}`;
          allSuccess = false;
        }
      }
    } catch (error) {
      if (error.message.includes('Password is incorrect') || error.message.includes('crypto failure')) {
        results.brave = 'Error: Password is incorrect';
      } else {
        results.brave = `Error: ${error.message}`;
      }
      allSuccess = false;
    }
  }

  // Enhanced error messages
  console.log('\n=== API Key Test Results ===');
  if (Object.keys(results).length === 0) {
    console.log('No API keys configured to test.');
  } else {
    for (const [service, result] of Object.entries(results)) {
      const icon = result === 'Valid' ? '✓' : '✗';
      console.log(`${service}: ${icon} ${result}`);
    }
  }

  if (!allSuccess) {
    console.log('\nTroubleshooting Tips:');
    console.log('- Make sure you entered the correct password');
    console.log('- Verify your API keys are valid in the respective services');
    console.log('- Check your internet connection');
  }

  return { 
    success: true, 
    apiTestsSucceeded: allSuccess,
    results 
  };
}

/**
 * Get the help text for API key related commands
 * Use this in index.mjs to display correct command usage
 */
export function getKeysHelpText() {
  return `/keys set [--venice=<key>] [--brave=<key>] [--password=<your_password>] - Set API keys
/keys check - Check if API keys are configured
/keys test [--password=<your_password>] - Test if configured API keys are valid`;
}