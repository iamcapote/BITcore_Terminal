import { strict as assert } from 'assert';
import { userManager } from '../app/features/auth/user-manager.mjs';
import { encryptApiKey, decryptApiKey, deriveKey } from '../app/features/auth/encryption.mjs';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import argon2 from 'argon2';

// Modify createInitialAdmin to use argon2 for password hashing
async function createInitialAdmin() {
  // Create directory if it doesn't exist
  await fs.mkdir(userManager.userDir, { recursive: true });

  const username = 'adminuser';
  const password = '$adminpassword'; // Ensure password starts with $
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
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

describe('User Authentication and API Key Management', () => {
  before(async () => {
    // Initialize the user manager
    await userManager.initialize();
    
    // Create admin user directly (bypassing admin check)
    await createInitialAdmin();
    
    // Login as admin
    await userManager.login('adminuser', '$adminpassword');
  });

  beforeEach(async () => {
    // Ensure we're logged in as admin before each test
    await userManager.login('adminuser', '$adminpassword');
  });

  it('should create a public profile on initialization', async () => {
    const publicUser = await userManager.loadUser('public');
    assert.equal(publicUser.username, 'public');
    assert.equal(publicUser.role, 'public');
  });

  it('should create a new user with a hashed password', async () => {
    const newUser = await userManager.createUser('testuser', 'client', 'testpassword');
    assert.equal(newUser.username, 'testuser');
    assert.equal(newUser.role, 'client');
    assert.ok(newUser.passwordHash);
  });

  it('should encrypt and decrypt API keys correctly', async () => {
    const password = 'testpassword';
    const salt = '1234567890abcdef1234567890abcdef';
    const key = await deriveKey(password, salt);
    const apiKey = 'testapikey';
    const encrypted = await encryptApiKey(apiKey, key);
    const decrypted = await decryptApiKey(encrypted, key);
    assert.equal(decrypted, apiKey);
  });

  it('should allow a user to log in with the correct password', async () => {
    const user = await userManager.login('testuser', 'testpassword');
    assert.equal(user.username, 'testuser');
    assert.equal(user.role, 'client');
  });

  it('should reject login with an incorrect password', async () => {
    try {
      await userManager.login('testuser', 'wrongpassword');
      assert.fail('Login should have failed');
    } catch (error) {
      // Check that the error message contains 'Invalid password'
      assert.ok(error.message.includes('Invalid password'));
    }
  });

  it('should allow setting and retrieving API keys', async () => {
    // Log in as a non-public user
    await userManager.login('testuser', 'testpassword');

    const password = 'testpassword';
    await userManager.setApiKey('venice', 'veniceapikey', password);
    const apiKey = await userManager.getApiKey('venice', password);
    assert.equal(apiKey, 'veniceapikey');
  });

  it('should allow changing the user password and re-encrypt API keys', async () => {
    // Log in as a non-public user
    await userManager.login('testuser', 'testpassword');

    const oldPassword = 'testpassword';
    const newPassword = 'newpassword';
    await userManager.changePassword(oldPassword, newPassword);
    const apiKey = await userManager.getApiKey('venice', newPassword);
    assert.equal(apiKey, 'veniceapikey');
  });
});

describe('Admin Account Creation', () => {
  it('should prompt for admin creation if no admin exists', async () => {
    // Simulate no admin existing
    await fs.rm(userManager.userDir, { recursive: true, force: true });
    await userManager.initialize();

    const adminExists = await userManager.adminExists();
    assert.equal(adminExists, false);

    // Create admin
    const adminUser = await userManager.createInitialAdmin('admin', 'adminpassword');
    assert.equal(adminUser.username, 'admin');
    assert.equal(adminUser.role, 'admin');
  });
});
