import { strict as assert } from 'assert';
import { commands } from '../app/commands/index.mjs';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Add a special test method to bypass admin check for initial admin user
async function createInitialAdmin() {
  // Create directory if it doesn't exist
  await fs.mkdir(userManager.userDir, { recursive: true });
  
  const username = 'adminuser';
  const password = 'adminpassword';
  const passwordHash = createHash('sha256').update(password).digest('hex');
  const salt = randomBytes(16).toString('hex');
  
  const adminUser = {
    username,
    role: 'admin',
    passwordHash,
    salt,
    created: new Date().toISOString(),
    encryptedApiKeys: {},
    limits: { maxQueriesPerDay: 100, maxDepth: 5, maxBreadth: 10 }
  };
  
  await fs.writeFile(
    path.join(userManager.userDir, `${username}.json`),
    JSON.stringify(adminUser, null, 2)
  );
  
  return { ...adminUser, password };
}

describe('CLI Integration Tests', function() {
  this.timeout(5000);

  before(async () => {
    await userManager.initialize();
    
    // Create admin user directly (bypassing admin check)
    await createInitialAdmin();
    
    // Login as admin
    await userManager.login('adminuser', 'adminpassword');

    // Create a test user
    await userManager.createUser('testuser', 'client', 'testpassword');
  });

  beforeEach(async () => {
    // Reset session to public mode before each test
    await userManager.logout();
  });

  it('should log in as a client user', async () => {
    const result = await commands.login({ username: 'testuser', password: 'testpassword' });
    assert.equal(result.success, true);
    assert.equal(userManager.getUsername(), 'testuser');
  });

  it('should fail to log in with an incorrect password', async () => {
    // First log out if already logged in
    await commands.logout();
    
    // Try logging in with incorrect password
    const result = await commands.login({ username: 'testuser', password: 'wrongpassword' });
    assert.equal(result.success, false);
    // The error message should indicate an invalid password
    assert.ok(result.error.includes('Invalid password'));
  });

  it('should set API keys for the logged-in user', async () => {
    // Login first
    await commands.login({ username: 'testuser', password: 'testpassword' });
    
    // Set API keys with password
    const result = await commands.keys({ 
      action: 'set', 
      venice: 'veniceapikey', 
      brave: 'braveapikey',
      password: 'testpassword'
    });
    
    assert.equal(result.success, true);
    assert.equal(await userManager.hasApiKey('venice'), true);
    assert.equal(await userManager.hasApiKey('brave'), true);
  });

  it('should log out and switch to public mode', async () => {
    const result = await commands.logout();
    assert.equal(result.success, true);
    assert.equal(userManager.getUsername(), 'public');
  });
});
