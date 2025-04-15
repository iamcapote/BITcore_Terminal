// filepath: /workspaces/MCP/app/tests/test-setup.mjs
import path from 'path';
import fs from 'fs/promises';
import { UserManager, userManager } from '../features/auth/user-manager.mjs';
import argon2 from 'argon2';

/**
 * Sets up the test environment for validation testing
 */
export async function setupTestEnvironment() {
  // Set test mode environment variables
  process.env.MCP_TEST_MODE = 'true';
  process.env.MCP_TEST_USER_DIR = path.join('/workspaces/MCP', '.test-mcp-users');
  
  console.log(`[Test Setup] Using test user directory: ${process.env.MCP_TEST_USER_DIR}`);
  
  // Create test directory
  await fs.mkdir(process.env.MCP_TEST_USER_DIR, { recursive: true });
  
  const testManager = new UserManager();
  
  // Create public user
  await testManager.createPublicProfile();
  console.log('[Test Setup] Created public user');
  
  // Create admin user with pre-computed hash for password "test1234"
  const adminPath = path.join(process.env.MCP_TEST_USER_DIR, 'admin.json');
  const adminUser = {
    username: 'admin',
    role: 'admin',
    // Using pre-hashed password for test1234
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$Cb5ucQ3bj3hL3UG9IDZREQ$YbAfsI9KgRP9W12cL0udXQeX3/aHFYOE55fKCcfqxE8',
    salt: '9f0464547bf28502423f6504f9130cc4',
    created: new Date().toISOString(),
    limits: { maxQueriesPerDay: 100, maxDepth: 5, maxBreadth: 10 },
    encryptedApiKeys: {
      venice: '{"iv":"a1fe3f01f9e6b2bd61802eb41a91b969","encrypted":"009379961fac2007eead8d5ad9ef3480ae8e8c4c382ceb6dc3d0c329ca4d0cfe1e54a78636d57db7b5b8","authTag":"3033373767de7a965da2075e1ce326b0"}',
      brave: '{"iv":"7faf480405a7d9f2cbd49ca0c4115891","encrypted":"e40ad8234a6110ed34402ab790d2e63398ceb543f09fa2d673f6011f23757d","authTag":"170d5615bc7f60b3c85510cab2f5ed3d"}'
    }
  };
  
  await fs.writeFile(adminPath, JSON.stringify(adminUser, null, 2));
  console.log('[Test Setup] Created admin user');
  
  // Create validation test client with correctly hashed password
  const clientPassword = 'TestClient123!';
  const clientPasswordHash = await argon2.hash(clientPassword);
  const clientPath = path.join(process.env.MCP_TEST_USER_DIR, 'validation-test-client.json');
  const clientUser = {
    username: 'validation-test-client',
    role: 'client',
    passwordHash: clientPasswordHash,
    salt: 'c280ec8176b4e91c4c47fdb7db6018d2',
    created: new Date().toISOString(),
    limits: { maxQueriesPerDay: 20, maxDepth: 3, maxBreadth: 5 },
    encryptedApiKeys: {}
  };
  
  await fs.writeFile(clientPath, JSON.stringify(clientUser, null, 2));
  console.log('[Test Setup] Created validation test client user');
  
  // Create a session file for the admin user to ensure session persistence
  const sessionPath = path.join(process.env.MCP_TEST_USER_DIR, 'session.json');
  const sessionData = {
    username: 'admin',
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  await fs.writeFile(sessionPath, JSON.stringify(sessionData));
  console.log('[Test Setup] Created admin session');
  
  console.log('[Test Setup] Test environment setup complete');
  return true;
}

/**
 * Cleans up the test environment
 */
export async function cleanupTestEnvironment() {
  if (process.env.MCP_TEST_USER_DIR) {
    try {
      // Remove test user directory
      await fs.rm(process.env.MCP_TEST_USER_DIR, { recursive: true, force: true });
      console.log('[Test Cleanup] Test environment cleaned up');
    } catch (error) {
      console.error(`[Test Cleanup] Error: ${error.message}`);
    }
  }
}

/**
 * Run setup if this script is executed directly
 */
if (process.argv[1].endsWith('test-setup.mjs')) {
  console.log('Running test environment setup...');
  setupTestEnvironment()
    .then(() => console.log('Test setup complete'))
    .catch(err => console.error('Test setup failed:', err));
}
