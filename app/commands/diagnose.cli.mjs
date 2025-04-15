/**
 * MCP System Diagnostic Tool
 * 
 * This CLI tool provides administrators with system health checks
 * and diagnostics for the MCP application. It can be used to
 * quickly identify and potentially repair common system issues.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { UserManager } from '../features/auth/user-manager.mjs';
import { SystemValidator } from '../tests/system-validation.mjs';

// Constants
const USER_FILES_DIR = process.env.MCP_USER_DIR || path.join(os.homedir(), '.mcp', 'users');
const RESEARCH_DIR = path.join(process.cwd(), 'research');
const API_TIMEOUT = 5000; // 5 seconds timeout for API checks

/**
 * Display help for diagnose command
 */
function printHelp(output) {
  output(`
Diagnose Command: Check system health and troubleshoot issues

Usage: /diagnose [option]

Options:
  all             Run all diagnostics (default)
  users           Check user database integrity
  api             Validate API connectivity
  permissions     Check file and directory permissions
  storage         Check storage usage and availability
  sessions        Validate active sessions
  fix             Attempt to fix common issues automatically
  test            Run automated system validation tests

Examples:
  /diagnose all
  /diagnose users
  /diagnose fix
  `);
}

/**
 * Execute diagnose command
 */
async function executeDiagnose(args = [], options = {}, output = console.log) {
  // Get the current user from session
  const userManager = new UserManager();
  
  // Check if user is admin using isAdmin method
  if (!userManager.isAdmin()) {
    output('⛔ Access denied: The diagnose command requires admin privileges.');
    return;
  }

  // Parse args
  const action = args[0] || 'all';

  // Process command
  try {
    switch (action) {
      case 'help':
        printHelp(output);
        break;
        
      case 'all':
        output('🔍 Running full system diagnostics...');
        await checkUsers(output);
        await checkApi(output);
        await checkPermissions(output);
        await checkStorage(output);
        await checkSessions(output);
        output('✅ System diagnostics completed.');
        break;
        
      case 'users':
        await checkUsers(output);
        break;
        
      case 'api':
        await checkApi(output);
        break;
        
      case 'permissions':
        await checkPermissions(output);
        break;
        
      case 'storage':
        await checkStorage(output);
        break;
        
      case 'sessions':
        await checkSessions(output);
        break;
        
      case 'fix':
        await fixCommonIssues(output);
        break;
        
      case 'test':
        await runSystemTests(output);
        break;
        
      default:
        output(`⚠️ Unknown diagnose option: ${action}`);
        printHelp(output);
    }
  } catch (error) {
    output(`❌ Error during diagnostics: ${error.message}`);
    if (options.debug) {
      output(error.stack);
    }
  }
}

/**
 * Check user database integrity
 */
async function checkUsers(output) {
  output('\n🔍 Checking user database integrity...');
  
  try {
    // Check if user directory exists
    let userDirExists = false;
    try {
      await fs.access(USER_FILES_DIR);
      userDirExists = true;
      output(`✅ User directory exists: ${USER_FILES_DIR}`);
    } catch {
      output(`❌ User directory not found: ${USER_FILES_DIR}`);
    }

    // List user files if directory exists
    if (userDirExists) {
      const userFiles = await fs.readdir(USER_FILES_DIR);
      output(`📄 Found ${userFiles.length} user files.`);
      
      // Check for admin user
      const hasAdmin = userFiles.some(file => file === 'admin.json');
      if (hasAdmin) {
        output('✅ Admin user exists.');
      } else {
        output('⚠️ Warning: No admin user found. System will create one on next start.');
      }
      
      // Validate user files
      let validUsers = 0;
      let invalidUsers = 0;
      
      for (const userFile of userFiles) {
        try {
          if (userFile.endsWith('.json')) {
            const userData = JSON.parse(await fs.readFile(path.join(USER_FILES_DIR, userFile), 'utf8'));
            
            // Basic validation of user data
            if (userData && userData.username && userData.passwordHash && userData.role) {
              validUsers++;
            } else {
              invalidUsers++;
              output(`⚠️ Warning: User file ${userFile} has invalid format.`);
            }
          }
        } catch (error) {
          invalidUsers++;
          output(`❌ Error reading user file ${userFile}: ${error.message}`);
        }
      }
      
      output(`✅ Valid users: ${validUsers}`);
      if (invalidUsers > 0) {
        output(`❌ Invalid users: ${invalidUsers}`);
      }
    }
  } catch (error) {
    output(`❌ Error checking users: ${error.message}`);
  }
}

/**
 * Check API connectivity and keys
 */
async function checkApi(output) {
  output('\n🔍 Checking API connectivity...');

  // Check environment variables
  const braveApiKey = process.env.BRAVE_API_KEY;
  const veniceApiKey = process.env.VENICE_API_KEY;
  
  if (braveApiKey) {
    output('✅ Brave API key is set in environment variables.');
  } else {
    output('⚠️ Brave API key not set in environment variables. User keys will be required.');
  }
  
  if (veniceApiKey) {
    output('✅ Venice API key is set in environment variables.');
  } else {
    output('⚠️ Venice API key not set in environment variables. User keys will be required.');
  }

  // Create a simple test function to check API connectivity with a timeout
  const testApiEndpoint = async (name, url, headers = {}) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        output(`✅ ${name} API is reachable.`);
        return true;
      } else {
        output(`❌ ${name} API returned ${response.status}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        output(`❌ ${name} API request timed out after ${API_TIMEOUT / 1000}s.`);
      } else {
        output(`❌ ${name} API connection failed: ${error.message}`);
      }
      return false;
    }
  };
  
  // Test Brave Search API connectivity
  if (braveApiKey) {
    await testApiEndpoint(
      'Brave Search',
      'https://api.search.brave.com/res/v1/web/ping',
      { 'X-Subscription-Token': braveApiKey }
    );
  } else {
    output('⚠️ Skipping Brave Search API test - no key available.');
  }
  
  // Test Venice API connectivity
  if (veniceApiKey) {
    await testApiEndpoint(
      'Venice',
      'https://api.venice.ai/api/v1/models',
      { 'Authorization': `Bearer ${veniceApiKey}` }
    );
  } else {
    output('⚠️ Skipping Venice API test - no key available.');
  }
}

/**
 * Check file and directory permissions
 */
async function checkPermissions(output) {
  output('\n🔍 Checking file and directory permissions...');
  
  const checkDirAccess = async (dirPath, dirName) => {
    try {
      await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
      output(`✅ ${dirName} directory is readable and writable.`);
      return true;
    } catch (error) {
      output(`❌ ${dirName} directory is not accessible: ${error.message}`);
      return false;
    }
  };
  
  // Check user directory
  await checkDirAccess(USER_FILES_DIR, 'Users');
  
  // Check research directory
  try {
    await fs.access(RESEARCH_DIR);
    await checkDirAccess(RESEARCH_DIR, 'Research');
  } catch (error) {
    output(`⚠️ Research directory does not exist yet. It will be created when needed.`);
  }
  
  // Check temporary directory
  const tempDir = os.tmpdir();
  await checkDirAccess(tempDir, 'Temporary');
}

/**
 * Check storage usage and availability
 */
async function checkStorage(output) {
  output('\n🔍 Checking storage usage and availability...');
  
  // Function to get directory size
  const getDirSize = async (dirPath) => {
    let totalSize = 0;
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          totalSize += await getDirSize(itemPath);
        } else {
          const stat = await fs.stat(itemPath);
          totalSize += stat.size;
        }
      }
    } catch (error) {
      output(`⚠️ Error calculating size of ${dirPath}: ${error.message}`);
    }
    
    return totalSize;
  };
  
  // Format bytes to human-readable
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
  };
  
  // Check user files storage
  try {
    if (await fs.access(USER_FILES_DIR).then(() => true).catch(() => false)) {
      const userFilesSize = await getDirSize(USER_FILES_DIR);
      output(`📊 User files size: ${formatBytes(userFilesSize)}`);
    }
  } catch (error) {
    output(`⚠️ Could not calculate user files size: ${error.message}`);
  }
  
  // Check research files storage
  try {
    if (await fs.access(RESEARCH_DIR).then(() => true).catch(() => false)) {
      const researchFilesSize = await getDirSize(RESEARCH_DIR);
      output(`📊 Research files size: ${formatBytes(researchFilesSize)}`);
    }
  } catch (error) {
    output(`⚠️ Could not calculate research files size: ${error.message}`);
  }
  
  // Check disk space
  try {
    // This command might not work on all systems, especially Windows
    const df = execSync('df -h .').toString();
    output(`📊 Disk space information:`);
    output(df);
  } catch (error) {
    output(`⚠️ Could not get disk space information: ${error.message}`);
    
    // Try to get free space using fs
    try {
      const stats = await fs.statfs('.');
      const freeSpace = stats.bavail * stats.bsize;
      output(`📊 Available disk space: ${formatBytes(freeSpace)}`);
    } catch {
      output(`❌ Could not determine free disk space.`);
    }
  }
}

/**
 * Check active sessions
 */
async function checkSessions(output) {
  output('\n🔍 Checking active sessions...');
  
  try {
    const userManager = new UserManager();
    const sessions = await userManager.listActiveSessions();
    
    output(`📊 Active sessions: ${sessions.length}`);
    
    // Show session details
    sessions.forEach((session, index) => {
      const expirationDate = new Date(session.expiresAt);
      const now = new Date();
      const isExpired = expirationDate < now;
      
      output(`\n📌 Session ${index + 1}:`);
      output(`   Username: ${session.username}`);
      output(`   Role: ${session.role}`);
      output(`   Expires: ${expirationDate.toLocaleString()} (${isExpired ? '❌ EXPIRED' : '✅ VALID'})`);
    });
    
    // Check for expired sessions
    const expiredSessions = sessions.filter(s => new Date(s.expiresAt) < new Date());
    if (expiredSessions.length > 0) {
      output(`\n⚠️ Found ${expiredSessions.length} expired session(s) that should be cleaned up.`);
    }
  } catch (error) {
    output(`❌ Error checking sessions: ${error.message}`);
  }
}

/**
 * Fix common issues
 */
async function fixCommonIssues(output) {
  output('\n🔧 Attempting to fix common issues...');
  
  // Fix 1: Create missing directories
  output('\n🔧 Checking for missing directories...');
  try {
    // Check and create user directory
    if (!await fs.access(USER_FILES_DIR).then(() => true).catch(() => false)) {
      await fs.mkdir(USER_FILES_DIR, { recursive: true });
      output(`✅ Created missing user directory: ${USER_FILES_DIR}`);
    } else {
      output(`✅ User directory exists.`);
    }
    
    // Check and create research directory
    if (!await fs.access(RESEARCH_DIR).then(() => true).catch(() => false)) {
      await fs.mkdir(RESEARCH_DIR, { recursive: true });
      output(`✅ Created missing research directory: ${RESEARCH_DIR}`);
    } else {
      output(`✅ Research directory exists.`);
    }
  } catch (error) {
    output(`❌ Error creating directories: ${error.message}`);
  }
  
  // Fix 2: Clean up expired sessions
  output('\n🔧 Cleaning up expired sessions...');
  try {
    const userManager = new UserManager();
    const removed = await userManager.cleanupExpiredSessions();
    output(`✅ Removed ${removed} expired sessions.`);
  } catch (error) {
    output(`❌ Error cleaning up sessions: ${error.message}`);
  }
  
  // Fix 3: Validate user files
  output('\n🔧 Validating user files...');
  try {
    if (await fs.access(USER_FILES_DIR).then(() => true).catch(() => false)) {
      const userFiles = await fs.readdir(USER_FILES_DIR);
      let repairedCount = 0;
      
      for (const userFile of userFiles) {
        if (!userFile.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(USER_FILES_DIR, userFile);
          const userData = JSON.parse(await fs.readFile(filePath, 'utf8'));
          
          // Check for required fields
          let fixed = false;
          
          if (!userData.role) {
            userData.role = 'client'; // Default to client role
            fixed = true;
          }
          
          if (fixed) {
            await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
            repairedCount++;
            output(`✅ Repaired user file: ${userFile}`);
          }
        } catch (error) {
          output(`❌ Could not repair user file ${userFile}: ${error.message}`);
        }
      }
      
      output(`✅ Repaired ${repairedCount} user files.`);
    }
  } catch (error) {
    output(`❌ Error validating user files: ${error.message}`);
  }
  
  output('\n✅ Fix operation completed. Run /diagnose all to verify system status.');
}

/**
 * Run automated system tests
 */
async function runSystemTests(output) {
  output('\n🧪 Running automated system tests...');
  
  // Create custom output function to redirect validator output
  const testOutputs = [];
  const testOutput = (...args) => {
    const message = args.join(' ');
    testOutputs.push(message);
    output(message);
  };
  
  try {
    const validator = new SystemValidator();
    await validator.runAllTests();
    
    output('\n✅ System validation tests completed. See detailed report for results.');
  } catch (error) {
    output(`❌ Error running system tests: ${error.message}`);
  }
}

// Export the function
export { executeDiagnose };