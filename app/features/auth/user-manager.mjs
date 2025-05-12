import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import argon2 from 'argon2';
import { encryptApiKey, decryptApiKey, deriveKey } from './encryption.mjs';
import readline from 'readline'; // Keep for potential future CLI interactions
import fetch from 'node-fetch'; // Needed for testApiKeys
import { Octokit } from '@octokit/rest'; // Import Octokit
import crypto from 'crypto'; // Import crypto
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import { output } from '../../utils/research.output-manager.mjs'; // Use output manager
import { outputManager } from '../../utils/research.output-manager.mjs'; // Use outputManager for logging

// Rate limiting for login attempts
class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) { // 5 attempts per 15 minutes
    this.attempts = new Map();
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  async attempt(key) {
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, firstAttempt: now, blockedUntil: 0 };

    // Check if currently blocked
    if (record.blockedUntil > now) {
      const waitTimeMinutes = Math.ceil((record.blockedUntil - now) / 60000);
      throw new Error(`Too many failed attempts. Please try again in ${waitTimeMinutes} minutes.`);
    }

    // Reset if window has passed
    if ((now - record.firstAttempt) > this.windowMs) {
      record.count = 1;
      record.firstAttempt = now;
      record.blockedUntil = 0;
      this.attempts.set(key, record);
      return true;
    }

    // Increment attempt count
    record.count += 1;

    // Block if exceeded max attempts
    if (record.count > this.maxAttempts) {
      // Exponential backoff: block time increases with each consecutive violation
      const blockMultiplier = Math.floor(record.count / this.maxAttempts);
      record.blockedUntil = now + (this.windowMs * blockMultiplier);
      this.attempts.set(key, record);
      const waitTimeMinutes = Math.ceil(this.windowMs * blockMultiplier / 60000);
      throw new Error(`Too many failed attempts. Please try again in ${waitTimeMinutes} minutes.`);
    }

    this.attempts.set(key, record);
    return true;
  }

  reset(key) {
    this.attempts.delete(key);
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (record.blockedUntil < now && (now - record.firstAttempt) > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}


export class UserManager {
  constructor() {
    // Support test environment with separate user directory
    if (process.env.MCP_TEST_USER_DIR) {
      this.userDir = process.env.MCP_TEST_USER_DIR;
      this.sessionFile = path.join(this.userDir, 'session.json');
      console.log(`[Auth] Using test user directory: ${this.userDir}`);
    } else {
      this.userDir = path.join(os.homedir(), '.mcp', 'users');
      this.sessionFile = path.join(os.homedir(), '.mcp', 'session.json');
    }

    // currentUser represents the *globally* authenticated user for the NODE PROCESS
    // This is suitable for CLI mode but NOT for multi-user WebSocket mode.
    // WebSocket sessions should manage their own user state.
    this.currentUser = null; // Represents CLI user or last loaded user
    this.sessionDuration = 30 * 24 * 60 * 60 * 1000; // 30 days (for CLI session file)
    this.loginLimiter = new RateLimiter();
    this.cliSessionPassword = null; // Cache password for current CLI session ONLY

    // Start cleanup interval
    setInterval(() => this.loginLimiter.cleanup(), 60 * 60 * 1000); // Cleanup every hour

    this.users = [];
  }

  async loadUsers() {
    // This is a simulation; a real implementation would load from files or DB
    try {
        console.log('[UserManager] Loading users (simulated)...');
        await this.ensureUserDir();
        const files = await fs.readdir(this.userDir);
        const userFiles = files.filter(f => f.endsWith('.json') && f !== 'session.json');
        this.users = []; // Clear existing simulated users
        for (const file of userFiles) {
            try {
                const username = path.basename(file, '.json');
                // Load actual user data to populate this.users if needed for getUserCount
                const userData = await this.getUserData(username);
                if (userData) {
                    // Store minimal info, or the full object if needed elsewhere
                    this.users.push({ username: userData.username, role: userData.role });
                }
            } catch (readError) {
                console.error(`[UserManager] Failed to load user data for ${file}: ${readError.message}`);
            }
        }
        console.log(`[UserManager] Loaded ${this.users.length} users from directory.`);
    } catch (error) {
        console.error('[UserManager] Failed to load users from directory:', error);
        // Fallback to default simulation if directory read fails?
        this.users = [
            { username: 'admin', role: 'admin' }, // Placeholder if load fails
            { username: 'public', role: 'public' },
        ];
        // throw error; // Decide whether to throw or continue with defaults
    }
  }

  /**
   * Initializes on startup (primarily for CLI mode). Ensures the public user exists,
   * then tries to load the last session or defaults to public.
   * If no admin exists, prompts for admin creation (one-time).
   */
  async ensureUserDir() {
    // ... existing code ...
    try {
      await fs.mkdir(this.userDir, { recursive: true });
      return true;
    } catch (error) {
      console.error(`[Auth] Error creating user directory: ${error.message}`);
      return false;
    }
  }

  async initialize() {
    await this.ensureUserDir();

    // Ensure public user JSON exists
    const publicUserPath = path.join(this.userDir, 'public.json');
    try {
      await fs.access(publicUserPath);
    } catch {
      await this.createPublicProfile();
    }

    // Check if an admin user exists
    const adminExists = await this.adminExists();
    if (!adminExists) {
      console.warn("[Auth] No admin user found. Admin creation prompt should follow if in CLI mode.");
      return null; // Return null to indicate no admin exists
    }

    // Try loading last session (relevant for CLI persistence)
    try {
      const sessionData = JSON.parse(await fs.readFile(this.sessionFile, 'utf8'));

      // Check if session exists and is still valid
      if (sessionData?.username && sessionData?.expiresAt) {
        const now = Date.now();

        if (now < sessionData.expiresAt) {
          // Session is still valid
          console.log(`[Auth] Valid CLI session found for user: ${sessionData.username}`);
          // Load user data into this.currentUser for CLI context
          await this.loadUser(sessionData.username);
        } else {
          // Session has expired
          console.log(`[Auth] CLI session expired for user: ${sessionData.username}`);
          await this.loadUser('public'); // Load public user for CLI context
          try {
            await fs.unlink(this.sessionFile);
          } catch (e) {
            // Ignore error if file doesn't exist
            if (e.code !== 'ENOENT') {
                console.error(`[Auth] Error removing expired session file: ${e.message}`);
            }
          }
        }
      } else {
        // Invalid session format
        console.log('[Auth] Invalid CLI session format, falling back to public user');
        await this.loadUser('public');
      }
    } catch (error) {
      // No session or invalid session, fallback to public
      if (error.code !== 'ENOENT') {
        console.error(`[Auth] Error reading CLI session file: ${error.message}`);
      } else {
        console.log(`[Auth] No CLI session file found.`);
      }
      await this.loadUser('public');
    }

    console.log(`[Auth] Initialized process with user context: ${this.currentUser?.username || 'public'}`);
    await this.loadUsers(); // Load users during initialization
    return this.currentUser;
  }

  /**
   * Checks if an admin user exists in the user directory.
   * @returns {Promise<boolean>} True if an admin user exists, false otherwise.
   */
  async adminExists() {
    // ... existing code ...
    try {
      const files = await fs.readdir(this.userDir);
      for (const file of files) {
        if (!file.endsWith('.json') || file === 'public.json') continue; // Skip non-json and public
        try {
            const userData = JSON.parse(await fs.readFile(path.join(this.userDir, file), 'utf8'));
            if (userData.role === 'admin') {
              return true;
            }
        } catch (readError) {
            console.error(`[Auth] Error reading user file ${file}: ${readError.message}`);
            // Continue checking other files
        }
      }
      return false;
    } catch (err) {
      console.error(`[Auth] Error checking admin existence: ${err.message}`);
      return false;
    }
  }

  /**
   * Creates an admin user with the given username and password.
   * Bypasses the normal admin-only restriction for creating users.
   * This should only be called during initialization when no admin exists.
   */
  async createInitialAdmin(username, password) {
    // ... existing code ...
    if (await this.adminExists()) {
      console.log('[Auth] Admin user already exists. Skipping admin creation.');
      // Try to load an existing admin if possible, otherwise public
      try {
          const files = await fs.readdir(this.userDir);
          const adminFile = files.find(f => f !== 'public.json' && f.endsWith('.json')); // Find first non-public user
          if (adminFile) {
              const adminData = JSON.parse(await fs.readFile(path.join(this.userDir, adminFile), 'utf8'));
              if (adminData.role === 'admin') {
                  await this.loadUser(adminData.username);
                  return this.currentUser;
              }
          }
      } catch (e) { /* Ignore errors loading existing admin */ }
      await this.loadUser('public');
      return this.currentUser;
    }

    console.log(`[Auth] Creating initial admin user: ${username}`);
    try {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const salt = randomBytes(16).toString('hex');
      const adminUser = {
        username,
        role: 'admin',
        passwordHash,
        salt,
        created: new Date().toISOString(),
        limits: {}, // Set empty limits object for admin
        encryptedApiKeys: {}
      };

      const userPath = path.join(this.userDir, `${username}.json`);
      await fs.writeFile(userPath, JSON.stringify(adminUser, null, 2));

      console.log(`[Auth] Admin user '${username}' created successfully.`);
      console.log('[Auth] Please login with this account.'); // Don't log password

      this.currentUser = adminUser; // Set for current process (CLI)
      await this.createSession(username); // Create CLI session file

      return adminUser;
    } catch (error) {
      console.error(`[Auth] Failed to create admin user: ${error.message}`);
      await this.loadUser('public');
      return this.currentUser;
    }
  }

  async createPublicProfile() {
    // ... existing code ...
    const publicUser = {
      username: 'public',
      role: 'public',
      created: new Date().toISOString(),
      limits: { maxQueriesPerHour: 3, maxDepth: 2, maxBreadth: 3 }, // Example limits
      // --- FIX: Ensure GitHub fields are initialized for public profile ---
      githubOwner: null,
      githubRepo: null,
      githubBranch: null,
      encryptedGitHubToken: null,
    };
    try {
        await fs.writeFile(
          path.join(this.userDir, 'public.json'),
          JSON.stringify(publicUser, null, 2)
        );
        console.log("[Auth] Public user profile created.");
        return publicUser;
    } catch (error) {
        console.error(`[Auth] Failed to create public profile: ${error.message}`);
        throw error; // Re-throw critical error
    }
  }

  /**
   * Loads user data into this.currentUser (for CLI context).
   * @param {string} username
   * @returns {Promise<object|null>} The loaded user data or null on failure.
   */
  async loadUser(username) {
    console.log(`[Auth] Loading user context for process: ${username}`);
    try {
      const userPath = path.join(this.userDir, `${username}.json`);
      const userData = await fs.readFile(userPath, 'utf8');
      this.currentUser = JSON.parse(userData);
      console.log(`[Auth] Process user context set to: ${this.currentUser.username}`);
      return this.currentUser;
    } catch (error) {
      console.error(`[Auth] Failed to load user ${username} into process context: ${error.message}`);
      if (username !== 'public') {
        console.log("[Auth] Falling back to public user context.");
        return this.loadUser('public'); // Fallback to public
      } else {
         console.error("[Auth] CRITICAL: Failed to load public user profile.");
         this.currentUser = null; // Ensure currentUser is null if public fails
         return null;
      }
    }
  }

  /**
   * Retrieves user data without setting this.currentUser.
   * Useful for WebSocket sessions.
   * @param {string} username
   * @returns {Promise<object|null>} User data or null if not found/error.
   */
  async getUserData(username) {
      if (!username || username === 'public') {
          try {
              const publicData = await fs.readFile(path.join(this.userDir, 'public.json'), 'utf8');
              // Ensure default GitHub fields exist for public user (even if null)
              const publicUser = JSON.parse(publicData);
              publicUser.githubOwner = publicUser.githubOwner || null;
              publicUser.githubRepo = publicUser.githubRepo || null;
              publicUser.githubBranch = publicUser.githubBranch || null;
              publicUser.encryptedGitHubToken = publicUser.encryptedGitHubToken || null;
              return publicUser;
          } catch (error) {
              console.error(`[Auth] Failed to get public user data: ${error.message}`);
              return null;
          }
      }
      try {
          const userPath = path.join(this.userDir, `${username}.json`);
          const userData = await fs.readFile(userPath, 'utf8');
          const user = JSON.parse(userData);
          // Ensure default GitHub fields exist if loading older user data
          user.githubOwner = user.githubOwner || null;
          user.githubRepo = user.githubRepo || null;
          user.githubBranch = user.githubBranch || null;
          user.encryptedGitHubToken = user.encryptedGitHubToken || null;
          return user;
      } catch (error) {
          // Don't log ENOENT as an error, just return null
          if (error.code !== 'ENOENT') {
            console.error(`[Auth] Failed to get user data for ${username}: ${error.message}`);
          }
          return null;
      }
  }


  /**
   * Authenticates a user and returns their data. Does NOT set this.currentUser.
   * Suitable for WebSocket login.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} User data object on success.
   * @throws {Error} On failure (rate limit, not found, invalid password).
   */
  async authenticateUser(username, password) {
    console.log(`[Auth] Attempting authentication for user: ${username}`);
    try {
      await this.loginLimiter.attempt(username); // Apply rate limiting

      if (username === 'public') {
          throw new Error("Cannot log in as public user.");
      }

      const userData = await this.getUserData(username);
      if (!userData) {
          throw new Error(`User ${username} not found`);
      }

      // Check if user data has password hash (public user won't)
      if (!userData.passwordHash) {
           throw new Error(`User ${username} does not have a password set.`);
      }

      console.log(`[Auth] Verifying password for ${username}`);
      let passwordValid = false;
      // Check if hash is Argon2 format
      if (userData.passwordHash.startsWith('$argon2')) {
        passwordValid = await argon2.verify(userData.passwordHash, password);
      } else {
        // Legacy SHA256 check (consider removing eventually)
        console.warn(`[Auth] User ${username} is using a legacy password hash.`);
        const { createHash } = await import('crypto');
        const legacyHash = createHash('sha256').update(password).digest('hex');
        passwordValid = userData.passwordHash === legacyHash;

        // Upgrade hash if legacy password was valid
        if (passwordValid) {
          console.log(`[Auth] Upgrading password hash for ${username} to argon2`);
          userData.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
          // Save the updated user data
          const userPath = path.join(this.userDir, `${username}.json`);
          await fs.writeFile(userPath, JSON.stringify(userData, null, 2));
        }
      }

      if (!passwordValid) {
        console.warn(`[Auth] Invalid password attempt for user: ${username}`);
        throw new Error('Invalid password');
      }

      console.log(`[Auth] Authentication successful for user: ${username}`);
      this.loginLimiter.reset(username); // Reset rate limiter on success

      // Return user data (without sensitive hash) - or maybe the full data for session use?
      // Let's return the full data for now, session handler can decide what to store.
      return userData;

    } catch (error) {
      console.error(`[Auth] Authentication failed for ${username}: ${error.message}`);
      // Re-throw the specific error message
      throw new Error(error.message);
    }
  }

  /**
   * Login function primarily for CLI mode. Sets this.currentUser and creates session file.
   * Caches the password temporarily for the CLI session.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} Current user object.
   */
  async login(username, password) {
    console.log(`[Auth CLI] Attempting login for username: ${username}`);
    try {
        const userData = await this.authenticateUser(username, password);
        // Set current user for the process (CLI context)
        this.currentUser = userData;
        // Cache the password for this CLI session
        this.cliSessionPassword = password;
        console.log(`[Auth CLI] Process user context set to: ${this.currentUser.username}`);
        // Create/update the CLI session file
        await this.createSession(username);
        return this.currentUser;
    } catch (error) {
        // Login failed, ensure CLI context is public and clear cached password
        await this.loadUser('public');
        this.cliSessionPassword = null;
        throw new Error(`Login failed: ${error.message}`);
    }
  }


  /**
   * Creates/updates the CLI session file.
   * @param {string} username
   */
  async createSession(username) {
    const session = {
      username,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.sessionDuration
    };
    console.log(`[Auth CLI] Creating/updating CLI session file for username: ${username}`);
    try {
        await fs.mkdir(path.dirname(this.sessionFile), { recursive: true });
        await fs.writeFile(this.sessionFile, JSON.stringify(session, null, 2));
        console.log(`[Auth CLI] Session file updated for ${username}.`);
    } catch (error) {
        console.error(`[Auth CLI] Failed to write session file: ${error.message}`);
        // Don't prevent login, but log the error
    }
  }

  /**
   * Logout function primarily for CLI mode. Clears this.currentUser, session file,
   * and the cached CLI password.
   */
  async logout() {
    console.log('[Auth CLI] Logging out current user...');
    const previousUser = this.currentUser?.username || 'public';
    try {
      // Attempt to remove the session file
      try {
        await fs.unlink(this.sessionFile);
        console.log('[Auth CLI] Session file removed.');
      } catch (error) {
          if (error.code !== 'ENOENT') { // Ignore if file doesn't exist
             console.error(`[Auth CLI] Error removing session file: ${error.message}`);
          }
      }
      // Clear cached password
      this.cliSessionPassword = null;
      // Set process user context back to public
      await this.loadUser('public');
      console.log('[Auth CLI] User logged out. Process user context set to public.');
      return this.currentUser;
    } catch (error) {
      console.error(`[Auth CLI] Logout failed: ${error.message}`);
      // Attempt to set to public and clear password even on error
      this.cliSessionPassword = null;
      await this.loadUser('public');
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async createUser(username, role = 'client', password = null, creatingUser) {
    // Check permissions: Need either an admin user object OR be in test mode
    const isAdmin = creatingUser && creatingUser.role === 'admin';
    // Allow creation if in test mode OR if the creating user is an admin
    if (!process.env.MCP_TEST_MODE && !isAdmin) {
        console.error(`[Auth] Permission denied: User '${creatingUser?.username || 'N/A'}' (role: ${creatingUser?.role || 'N/A'}) attempted to create user '${username}'. Admin required.`);
        throw new Error('Permission denied: Only administrators can create users.');
    }
    // ... rest of existing createUser logic ...
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username must contain only letters, numbers, underscores, and hyphens.');
    }
    if (username === 'public') {
        throw new Error('Cannot create user with reserved name "public".');
    }

    await this.ensureUserDir();
    const userPath = path.join(this.userDir, `${username}.json`);

    try {
        await fs.access(userPath);
        // If access does not throw, file exists
        throw new Error(`User '${username}' already exists.`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            // Re-throw error if it's not "file not found"
            throw error;
        }
        // If ENOENT, proceed to create
    }

    const finalPassword = password || this.generatePassword();
    if (finalPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
    }
    const passwordHash = await argon2.hash(finalPassword, { type: argon2.argon2id });
    const salt = randomBytes(16).toString('hex');
    const newUser = {
      username,
      role,
      passwordHash,
      salt,
      created: new Date().toISOString(),
      encryptedApiKeys: {},
      limits: {}, // Set empty limits object for new users
      // Initialize GitHub fields
      githubOwner: null,
      githubRepo: null,
      githubBranch: null,
      encryptedGitHubToken: null,
    };

    await fs.writeFile(userPath, JSON.stringify(newUser, null, 2));
    console.log(`[Auth] User '${username}' created successfully by '${creatingUser?.username || 'System'}'.`);
    // Add to internal list if loaded
    if (this.users) {
        this.users.push({ username: newUser.username, role: newUser.role });
    }
    // Return user data along with the generated password (if one was generated)
    return { ...newUser, generatedPassword: password ? null : finalPassword };
  }

  generatePassword(length = 12) {
    // ... existing code ...
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(bytes[i] % chars.length);
    }
    return result;
  }

  /**
   * Saves user data back to the JSON file.
   * @param {string} username - The username.
   * @param {object} userData - The complete user data object to save.
   * @private
   */
  async saveUserData(username, userData) {
    if (!username || username === 'public') {
      // Optionally save public user data if needed, but generally avoid modifying it frequently
      // For now, prevent saving public user this way
      console.warn('[Auth] Attempted to save data for public user. Skipping.');
      return;
      // throw new Error('Cannot save data for public user.');
    }
    try {
      const userPath = path.join(this.userDir, `${username}.json`);
      await fs.writeFile(userPath, JSON.stringify(userData, null, 2));
      console.log(`[Auth] User data saved for ${username}.`);

      // If saving the currently loaded CLI user, update this.currentUser
      if (this.currentUser && this.currentUser.username === username) {
          this.currentUser = userData;
          console.log("[Auth CLI] Updated process user context after saving data.");
      }

    } catch (error) {
      console.error(`[Auth] Failed to save user data for ${username}: ${error.message}`);
      throw error; // Re-throw error to indicate failure
    }
  }


  async changePassword(username, currentPassword, newPassword) {
    if (!username || username === 'public') {
      throw new Error('Cannot change password for public or unspecified user');
    }

    const userData = await this.getUserData(username);
    if (!userData) {
        throw new Error(`User ${username} not found.`);
    }
    if (!userData.passwordHash) {
        throw new Error(`User ${username} does not have a password set.`);
    }

    if (!await argon2.verify(userData.passwordHash, currentPassword)) {
      throw new Error('Current password is incorrect');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }
    if (newPassword === currentPassword) {
        throw new Error('New password must be different from the current password.');
    }

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const newSalt = randomBytes(16).toString('hex'); // Generate a new salt regardless of keys

    // Re-encrypt API keys (Brave, Venice)
    if (userData.encryptedApiKeys && Object.keys(userData.encryptedApiKeys).length > 0) {
      console.log(`[Auth] Re-encrypting standard API keys for ${username} due to password change.`);
      const oldKey = await deriveKey(currentPassword, userData.salt);
      const decryptedKeys = {};
      try {
          for (const [service, enc] of Object.entries(userData.encryptedApiKeys)) {
            decryptedKeys[service] = await decryptApiKey(enc, oldKey);
          }
      } catch (decryptionError) {
          console.error(`[Auth] Failed to decrypt existing API keys during password change for ${username}: ${decryptionError.message}`);
          throw new Error(`Failed to decrypt existing API keys. Password change aborted. Please verify keys or reset them after changing password.`);
      }

      const newDerivedKey = await deriveKey(newPassword, newSalt); // Use new salt
      const reEncrypted = {};
      for (const [service, rawKey] of Object.entries(decryptedKeys)) {
        reEncrypted[service] = await encryptApiKey(rawKey, newDerivedKey);
      }
      userData.encryptedApiKeys = reEncrypted;
      console.log(`[Auth] Standard API keys re-encrypted successfully for ${username}.`);
    }

    // Re-encrypt GitHub Token
    if (userData.encryptedGitHubToken) {
        console.log(`[Auth] Re-encrypting GitHub token for ${username} due to password change.`);
        const oldKey = await deriveKey(currentPassword, userData.salt); // Use old salt for decryption
        try {
            const decryptedToken = await decryptApiKey(userData.encryptedGitHubToken, oldKey);
            const newDerivedKey = await deriveKey(newPassword, newSalt); // Use new salt for encryption
            userData.encryptedGitHubToken = await encryptApiKey(decryptedToken, newDerivedKey);
            console.log(`[Auth] GitHub token re-encrypted successfully for ${username}.`);
        } catch (decryptionError) {
            console.error(`[Auth] Failed to decrypt existing GitHub token during password change for ${username}: ${decryptionError.message}`);
            // Decide whether to abort or just warn and clear the token
            userData.encryptedGitHubToken = null; // Clear token on decryption failure
            console.warn(`[Auth] Cleared GitHub token for ${username} due to decryption failure during password change.`);
            // Optionally throw: throw new Error(`Failed to decrypt existing GitHub token...`);
        }
    }

    // Update hash and salt
    userData.passwordHash = newHash;
    userData.salt = newSalt; // Store the new salt
    userData.passwordChanged = new Date().toISOString(); // Track last change

    // Save updated user data using the new helper method
    await this.saveUserData(username, userData);

    console.log(`[Auth] Password changed successfully for user ${username}.`);

    // Update CLI session password cache if applicable
    if (this.currentUser && this.currentUser.username === username) {
        this.cliSessionPassword = newPassword;
        console.log("[Auth CLI] Updated cached CLI session password.");
    }

    return true;
  }


  /**
   * Sets an API key (Brave, Venice) for a specific user. Requires password verification.
   * @param {string} service - The service name ('brave', 'venice').
   * @param {string} apiKey - The API key value. Pass null or empty string to clear.
   * @param {string} password - The user's current password for verification.
   * @param {string} username - The user for whom to set the key.
   * @returns {Promise<boolean>} True on success.
   * @throws {Error} On failure.
   */
  async setApiKey(service, apiKey, password, username) {
    console.log(`[Auth] Setting API key for service: ${service}, user: ${username}`);

    if (service !== 'brave' && service !== 'venice') {
        throw new Error(`Invalid service type '${service}' for setApiKey. Use setGitHubConfig for GitHub.`);
    }
    if (!username || username === 'public') {
        throw new Error('Cannot set API keys for public or unspecified user');
    }

    const userData = await this.getUserData(username);
    if (!userData) throw new Error(`User ${username} not found.`);
    if (!userData.passwordHash) throw new Error(`User ${username} does not have a password set.`);

    console.log(`[Auth] Verifying password for user ${username}`);
    if (!await argon2.verify(userData.passwordHash, password)) {
        console.error(`[Auth] Password verification failed for ${username}`);
        throw new Error('Password is incorrect');
    }
    console.log('[Auth] Password verified successfully');

    if (!userData.salt) {
        console.log(`[Auth] Generating new salt for user ${username}`);
        userData.salt = randomBytes(16).toString('hex');
    }
    if (!userData.encryptedApiKeys) {
        userData.encryptedApiKeys = {};
    }

    if (apiKey === null || apiKey === '') {
        // Clear the key
        delete userData.encryptedApiKeys[service];
        console.log(`[Auth] Cleared API key for ${service} for user ${username}.`);
    } else {
        // Set/update the key
        console.log(`[Auth] Deriving encryption key for service: ${service}`);
        const key = await deriveKey(password, userData.salt);
        const encryptedKey = await encryptApiKey(apiKey, key);
        userData.encryptedApiKeys[service] = encryptedKey;
        console.log(`[Auth] API key for ${service} set/updated successfully for user ${username}.`);
    }

    // Save updated user data
    await this.saveUserData(username, userData);

    return true;
  }

  /**
   * Sets the GitHub configuration and optionally the token for a user.
   * @param {string} username - The username.
   * @param {string} password - The user's password for verification and encryption.
   * @param {object} config - GitHub config { owner?, repo?, branch?, token? }.
   * @returns {Promise<void>}
   */
  async setGitHubConfig(username, password, config) {
    const userData = await this.getUserData(username);
    if (!userData) {
        throw new Error(`User ${username} not found.`);
    }
    if (!userData.passwordHash) {
        throw new Error(`User ${username} does not have a password set.`);
    }

    // Verify password before proceeding
    outputManager.debug(`[Auth] Verifying password for ${username} to set GitHub config.`);
    if (!await argon2.verify(userData.passwordHash, password)) {
        outputManager.warn(`[Auth] Incorrect password provided for ${username} when setting GitHub config.`);
        throw new Error("Incorrect password provided.");
    }
    outputManager.debug(`[Auth] Password verified for ${username}.`);

    // Ensure salt exists if we need to encrypt a token
    if (config.token && !userData.salt) {
        outputManager.debug(`[Auth] Generating new salt for user ${username} before setting GitHub token.`);
        userData.salt = randomBytes(16).toString('hex');
    }

    // Update config fields if provided
    if (config.owner !== undefined) userData.githubOwner = config.owner;
    if (config.repo !== undefined) userData.githubRepo = config.repo;
    if (config.branch !== undefined) userData.githubBranch = config.branch;

    // Encrypt and store token if provided
    if (config.token) {
        try {
            outputManager.debug(`[Auth] Deriving key to encrypt GitHub token for ${username}.`);
            const key = await deriveKey(password, userData.salt);
            userData.encryptedGitHubToken = await encryptApiKey(config.token, key);
            outputManager.log(`[Auth] Encrypted and stored GitHub token for user ${username}.`);
        } catch (encryptionError) {
            outputManager.error(`[Auth] Failed to encrypt GitHub token for ${username}: ${encryptionError.message}`);
            throw new Error("Failed to encrypt GitHub token.");
        }
    } else if (config.token === null || config.token === '') {
        // Allow explicitly clearing the token
        userData.encryptedGitHubToken = null;
        outputManager.log(`[Auth] Cleared GitHub token for user ${username}.`);
    }

    await this.saveUserData(username, userData);
    outputManager.log(`[Auth] Updated GitHub configuration for user ${username}.`);

    // Update cached currentUser if it matches
    if (this.currentUser && this.currentUser.username === username) {
        this.currentUser = userData;
        outputManager.debug("[Auth CLI] Updated process user context after setting GitHub config.");
    }
  }

  /**
   * Retrieves and decrypts the GitHub token for a user.
   * @param {string} password - The user's password for decryption.
   * @param {string} username - The username.
   * @returns {Promise<string|null>} The decrypted GitHub token or null if not found/decryption fails.
   */
  async getGitHubToken(password, username) {
    const userData = await this.getUserData(username);
    if (!userData) {
        outputManager.warn(`[Auth] User ${username} not found when trying to get GitHub token.`);
        return null; // Or throw? Returning null seems safer for optional tokens.
    }
    if (!userData.encryptedGitHubToken) {
        outputManager.debug(`[Auth] No encrypted GitHub token found for user ${username}.`);
        return null;
    }
     if (!userData.passwordHash) {
        outputManager.error(`[Auth] User ${username} does not have a password hash, cannot verify for GitHub token retrieval.`);
        throw new Error(`User ${username} does not have a password set.`);
    }
     if (!userData.salt) {
        outputManager.error(`[Auth] User ${username} data is missing salt, cannot decrypt GitHub token.`);
        throw new Error(`User ${username} data is missing salt.`);
    }

    // Verify password before attempting decryption
    outputManager.debug(`[Auth] Verifying password for ${username} to get GitHub token.`);
    if (!await argon2.verify(userData.passwordHash, password)) {
         outputManager.warn(`[Auth] Password verification failed for user ${username} while retrieving GitHub token.`);
         throw new Error("Incorrect password provided for GitHub token decryption.");
    }
    outputManager.debug(`[Auth] Password verified for ${username}.`);

    try {
        outputManager.debug(`[Auth] Deriving key to decrypt GitHub token for ${username}.`);
        const key = await deriveKey(password, userData.salt);
        const decryptedToken = await decryptApiKey(userData.encryptedGitHubToken, key);
        outputManager.log(`[Auth] Successfully decrypted GitHub token for user ${username}.`);
        return decryptedToken;
    } catch (error) {
        outputManager.error(`[Auth] Failed to decrypt GitHub token for user ${username}: ${error.message}`);
        throw new Error("GitHub token decryption failed. Check password or token data.");
    }
  }

  /**
   * Checks if a GitHub token exists for the user (doesn't validate).
   * @param {string} username - The username.
   * @returns {Promise<boolean>} True if an encrypted token exists.
   */
  async hasGitHubToken(username) {
    const userData = await this.getUserData(username);
    // Check specifically for the encryptedGitHubToken field
    return !!userData?.encryptedGitHubToken;
  }

  /**
   * Retrieves the GitHub configuration for a user (excluding token).
   * @param {string} username - The username.
   * @returns {Promise<object|null>} GitHub config { owner, repo, branch } or null if not found/configured.
   */
  async getGitHubConfig(username) { // Renamed from previous getGitHubConfig to avoid clash, focuses on non-token parts
    const userData = await this.getUserData(username);
    if (!userData || !userData.githubOwner || !userData.githubRepo) {
        return null; // Return null if core config (owner, repo) is missing
    }
    return {
        owner: userData.githubOwner,
        repo: userData.githubRepo,
        branch: userData.githubBranch || 'main' // Default to main if not set
    };
  }

  /**
   * Checks if the core GitHub configuration (owner, repo, branch) is set for a user.
   * Does not check for the token.
   * @param {string} username - The username.
   * @returns {Promise<boolean>} True if owner, repo, and branch are configured.
   */
  async hasGitHubConfig(username) {
    const userData = await this.getUserData(username);
    // Check for the presence of owner and repo. Branch defaults to 'main' if not explicitly set, so its presence isn't strictly required.
    return !!userData?.githubOwner && !!userData.githubRepo;
  }

  /**
   * Gets decrypted GitHub configuration for a specific user, including the token. Requires password verification.
   * @param {string} username - The user whose config to retrieve.
   * @param {string} password - The user's current password.
   * @returns {Promise<{token: string|null, owner: string, repo: string, branch: string}|null>} Config object or null if incomplete/not found.
   * @throws {Error} If password verification or decryption fails.
   */
  async getDecryptedGitHubConfig(username, password) { // Renamed to be explicit
    const userData = await this.getUserData(username);
    if (!userData) {
        throw new Error(`User ${username} not found.`);
    }
    if (!userData.passwordHash) {
        throw new Error(`User ${username} does not have a password set.`);
    }

    // Verify password before proceeding
    outputManager.debug(`[Auth] Verifying password for ${username} to get decrypted GitHub config.`);
    if (!await argon2.verify(userData.passwordHash, password)) {
        outputManager.warn(`[Auth] Incorrect password provided for ${username} when getting decrypted GitHub config.`);
        throw new Error('Password is incorrect');
    }
    outputManager.debug(`[Auth] Password verified for ${username}.`);

    const config = {
        owner: userData.githubOwner || null,
        repo: userData.githubRepo || null,
        branch: userData.githubBranch || 'main', // Default to main
        token: null // Initialize token as null
    };

    // Check if essential parts are missing (excluding token for now)
    if (!config.owner || !config.repo) {
        outputManager.warn(`[Auth] GitHub owner or repo not configured for ${username}. Cannot return full config.`);
        return null; // Return null if core parts missing
    }

    // Decrypt token if it exists
    if (userData.encryptedGitHubToken) {
        try {
            if (!userData.salt) {
                throw new Error(`User ${username} data is missing salt, cannot decrypt GitHub token.`);
            }
            outputManager.debug(`[Auth] Decrypting GitHub token for ${username} as part of config retrieval.`);
            // Use the dedicated getGitHubToken method which includes verification (already done above, but safe) and decryption
            config.token = await this.getGitHubToken(password, username); // Re-uses decryption logic
            outputManager.debug(`[Auth] GitHub token included in decrypted config for ${username}.`);
        } catch (decryptionError) {
            outputManager.error(`[Auth] Failed to decrypt GitHub token for ${username} while getting config: ${decryptionError.message}`);
            // Throw error as token decryption failure is critical if token exists
            throw new Error(`Failed to decrypt GitHub token. Check password or token data.`);
        }
    } else {
        outputManager.debug(`[Auth] No encrypted GitHub token found for ${username} during config retrieval.`);
        // Token remains null in the config object
    }

    // Return the full config object (token might be null if not set)
    return config;
  }

  /**
   * Checks if an API key exists for the specified service and user.
   * @param {string} service - The service name ('brave', 'venice').
   * @param {string} username - The username.
   * @returns {Promise<boolean>} True if an encrypted key exists for the service.
   */
  async hasApiKey(service, username) {
    if (service === 'github') {
      // GitHub config/token is not stored in encryptedApiKeys
      console.warn(`[Auth][hasApiKey] 'github' is not a valid service for hasApiKey. Use hasGitHubConfig/hasGitHubToken instead.`);
      return false;
    }
    if (service !== 'brave' && service !== 'venice') {
      console.warn(`[Auth][hasApiKey] Invalid service '${service}' requested. Only 'brave' or 'venice' supported.`);
      return false;
    }
    const userData = await this.getUserData(username);
    return !!userData?.encryptedApiKeys?.[service];
  }

  /**
   * Retrieves and decrypts an API key for a user.
   * @param {object} options - Options object.
   * @param {string} options.username - The username.
   * @param {string} options.password - The user's password for decryption.
   * @param {string} options.service - The service name ('brave', 'venice', 'github').
   * @returns {Promise<string|null>} The decrypted API key or null if not found/decryption fails.
   * @throws {Error} If user not found, password verification fails, decryption fails, or service is invalid.
   */
  async getApiKey(options) { // Keep single 'options' argument
    // --- VERY FIRST LINE LOGGING ---
    // console.log('[Auth][getApiKey] ABSOLUTE ENTRY - Raw arguments[0]:', arguments[0]); // Reduced verbosity
    // --- END VERY FIRST LINE LOGGING ---

    // Destructure AFTER logging the raw input
    const { username, password, service } = options || {}; // Add default empty object to prevent destructuring error if options is undefined

    // --- ADD RAW ARGUMENT LOGGING ---
    // Log the destructured values (or undefined if options was missing)
    // console.log(`[Auth][getApiKey] RAW ENTRY (Post-Destructure) - Options received:`, { username, password: password ? '******' : 'MISSING', service }); // Reduced verbosity
    // --- END RAW ARGUMENT LOGGING ---

    // --- Add detailed logging ---
    // Log the exact values received by the function
    outputManager.debug(`[Auth][getApiKey] RECEIVED - username: "${username}", password: "${password ? '******' : 'MISSING'}", service: "${service}"`);
    if (typeof username !== 'string' || !username) {
        outputManager.error(`[Auth][getApiKey] CRITICAL: Invalid username received: ${username}`);
        throw new Error('Invalid username provided to getApiKey.'); // LINE ~897
    }
    // Add check for service type and value early
    if (typeof service !== 'string' || !service) {
         outputManager.error(`[Auth][getApiKey] CRITICAL: Invalid or missing service parameter received: ${service}`);
         throw new Error('Invalid or missing service provided to getApiKey.');
    }
    // --- End detailed logging ---

    // --- ADD SERVICE VALIDATION LOGGING ---
    outputManager.debug(`[Auth][getApiKey] Validating service parameter: "${service}"`);
    const validServices = ['brave', 'venice', 'github']; // Define valid services internally
    if (!validServices.includes(service)) {
        outputManager.error(`[Auth][getApiKey] Invalid service type received: "${service}". Valid types: ${validServices.join(', ')}`);
        // Refine the error message for clarity
        let errorMsg = `Invalid service type '${service}' received by getApiKey.`;
        // Provide specific guidance
        errorMsg += ` Valid services are: ${validServices.join(', ')}.`; // Simpler message
        outputManager.error(`[Auth][getApiKey] Throwing error: ${errorMsg}`); // Log the exact error message
        throw new Error(errorMsg); // Throw the refined error // LINE 895
    }
    // --- END SERVICE VALIDATION LOGGING ---

    if (!username || username === 'public') {
      console.log(`[Auth] Cannot get API key for public or unspecified user.`);
      return null;
    }

    // --- FIX: Allow 'github' service here for consistency, but handle it separately ---
    // if (service !== 'brave' && service !== 'venice') {
    //     throw new Error(`Invalid service type '${service}' for getApiKey. Use getGitHubConfig for GitHub.`);
    // }
    // --- END FIX ---


    const userData = await this.getUserData(username);
    if (!userData) {
        console.warn(`[Auth] User ${username} not found when trying to get API key.`);
        // Throw error? Or return null? Let's throw for clarity.
        throw new Error(`User ${username} not found.`);
    }
     if (!userData.passwordHash) {
        // Should not happen for non-public users, but good check.
        throw new Error(`User ${username} does not have a password set.`);
    }

    // --- Handle GitHub Token Decryption Separately ---
    if (service === 'github') {
        if (!userData.encryptedGitHubToken) {
            console.warn(`[Auth] No GitHub token found for user '${username}'.`);
            return null;
        }
        console.log(`[Auth] Verifying password to get GitHub token for user '${username}'`);
        if (!await argon2.verify(userData.passwordHash, password)) {
            console.warn(`[Auth] Incorrect password provided for user '${username}' when getting GitHub token.`);
            throw new Error('Password is incorrect');
        }
        try {
            if (!userData.salt) {
                throw new Error(`User ${username} data is missing salt, cannot decrypt GitHub token.`);
            }
            const key = await deriveKey(password, userData.salt);
            const decryptedToken = await decryptApiKey(userData.encryptedGitHubToken, key);
            console.log(`[Auth] GitHub token retrieved successfully for user ${username}.`);
            return decryptedToken;
        } catch (decryptionError) {
            console.error(`[Auth] Failed to decrypt GitHub token for user '${username}': ${decryptionError.message}`);
            throw new Error(`Failed to decrypt GitHub token. Check password or token data.`);
        }
    }
    // --- End GitHub Token Handling ---

    // --- Handle Brave/Venice Key Decryption ---
    if (!userData.encryptedApiKeys || !userData.encryptedApiKeys[service]) {
      console.warn(`[Auth] No API key found for service '${service}' for user '${username}'.`);
      return null;
    }

    console.log(`[Auth] Verifying password to get API key for service '${service}', user '${username}'`);
    // Add logging to see the password being attempted (MASKED)
    console.log(`[Auth] Verifying password hash against provided password (length: ${password?.length || 0})`);
    if (!await argon2.verify(userData.passwordHash, password)) {
      console.warn(`[Auth] Incorrect password provided for user '${username}' when getting API key.`);
      throw new Error('Password is incorrect');
    }

    try {
        if (!userData.salt) {
            throw new Error(`User ${username} data is missing salt, cannot decrypt key.`);
        }
        const key = await deriveKey(password, userData.salt);
        const decryptedKey = await decryptApiKey(userData.encryptedApiKeys[service], key);
        console.log(`[Auth] API key for ${service} retrieved successfully for user ${username}.`);
        return decryptedKey;
    } catch (decryptionError) {
        console.error(`[Auth] Failed to decrypt API key for service '${service}', user '${username}': ${decryptionError.message}`);
        throw new Error(`Failed to decrypt API key. Check password or key data.`);
    }
    // --- End Brave/Venice Handling ---
  }

  /**
   * Checks the configuration status of API keys and GitHub for a user.
   * @param {string} username - The username to check.
   * @returns {Promise<{brave: boolean, venice: boolean, github: boolean}>} Status object.
   */
  async checkApiKeys(username) {
    outputManager.debug(`[Auth] Checking API key status for user: ${username}`);
    const userData = await this.getUserData(username);
    if (!userData) {
      outputManager.warn(`[Auth] User ${username} not found during checkApiKeys.`);
      return { brave: false, venice: false, github: false };
    }

    const braveConfigured = !!userData.encryptedApiKeys?.brave;
    const veniceConfigured = !!userData.encryptedApiKeys?.venice;
    // GitHub config requires owner and repo. Token is optional for basic config status.
    const githubConfigured = !!userData.githubOwner && !!userData.githubRepo;

    outputManager.debug(`[Auth] Status for ${username} - Brave: ${braveConfigured}, Venice: ${veniceConfigured}, GitHub: ${githubConfigured}`);
    return {
      brave: braveConfigured,
      venice: veniceConfigured,
      github: githubConfigured,
    };
  }


  /**
   * Tests the validity of configured API keys and GitHub token for a user.
   * Requires the user's password to decrypt the keys/token.
   * @param {string} password - The user's current password.
   * @param {string} username - The username whose keys/token to test.
   * @returns {Promise<object>} An object with test results for each service (e.g., { brave: { success: true }, github: { success: false, error: 'Invalid Token' } }).
   */
  async testApiKeys(password, username) {
    console.log(`[Auth] Testing API keys and GitHub token for user: ${username}`);
    const results = {
      brave: { success: null, error: 'Not configured or test failed' },
      venice: { success: null, error: 'Not configured or test failed' },
      github: { success: null, error: 'Not configured or test failed' },
    };
    const API_TIMEOUT = 7000; // Increased timeout

    // Helper to test endpoint
    const testEndpoint = async (url, headers = {}, method = 'GET') => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            const response = await fetch(url, { method, headers, signal: controller.signal });
            clearTimeout(timeoutId);
            return { success: response.ok, status: response.status, statusText: response.statusText };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { success: false, error: `Request timed out (${API_TIMEOUT}ms)` };
            }
            return { success: false, error: error.message };
        }
    };

    // Test Brave
    try {
        const hasKey = await this.hasApiKey('brave', username);
        if (hasKey) {
            // Use getApiKey with options object
            const braveKey = await this.getApiKey({ username, password, service: 'brave' });
            if (braveKey) {
                const testResult = await testEndpoint(
                    'https://api.search.brave.com/res/v1/web/ping',
                    { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' }
                );
                results.brave = { success: testResult.success, error: testResult.success ? null : (testResult.error || `API returned ${testResult.status}: ${testResult.statusText}`) };
            } else {
                 results.brave = { success: false, error: 'Decryption failed (check password)' };
            }
        } else {
             results.brave = { success: null, error: 'Not configured' }; // Use null for success if not configured
        }
    } catch (error) {
        results.brave = { success: false, error: `Failed to get/test key: ${error.message}` };
    }

    // Test Venice
    try {
        const hasKey = await this.hasApiKey('venice', username);
         if (hasKey) {
            // Use getApiKey with options object
            const veniceKey = await this.getApiKey({ username, password, service: 'venice' });
            if (veniceKey) {
                const testResult = await testEndpoint(
                    'https://api.venice.ai/api/v1/models',
                    { 'Authorization': `Bearer ${veniceKey}` }
                );
                results.venice = { success: testResult.success, error: testResult.success ? null : (testResult.error || `API returned ${testResult.status}: ${testResult.statusText}`) };
            } else {
                 results.venice = { success: false, error: 'Decryption failed (check password)' };
            }
        } else {
             results.venice = { success: null, error: 'Not configured' };
        }
    } catch (error) {
        results.venice = { success: false, error: `Failed to get/test key: ${error.message}` };
    }

    // Test GitHub
    try {
        const hasConfig = await this.hasGitHubConfig(username); // Checks owner/repo/branch/token presence
        if (hasConfig) {
            // Use getDecryptedGitHubConfig which handles verification and decryption
            const githubConfig = await this.getDecryptedGitHubConfig(username, password);
            if (githubConfig && githubConfig.token) {
                // Basic check: Try to fetch user info using the token
                const octokit = new Octokit({ auth: githubConfig.token });
                try {
                    await octokit.rest.users.getAuthenticated({ request: { timeout: API_TIMEOUT } });
                    results.github = { success: true, error: null };
                    console.log(`[Auth] GitHub token validation successful for ${username}`);
                } catch (apiError) {
                    results.github = { success: false, error: `API Error: ${apiError.message}` };
                    console.log(`[Auth] GitHub token validation failed for ${username}: ${apiError.message}`);
                }
            } else if (githubConfig && !githubConfig.token) {
                 // Config exists but token doesn't (or failed decryption within getDecryptedGitHubConfig)
                 results.github = { success: false, error: 'GitHub token is not set or decryption failed' };
                 console.log(`[Auth] GitHub config found for ${username}, but token is missing or failed decryption.`);
            } else {
                 // getDecryptedGitHubConfig returned null (e.g., missing owner/repo) or threw an error caught below
                 results.github = { success: false, error: 'Failed to retrieve decrypted config (check password or config)' };
            }
        } else {
             results.github = { success: null, error: 'Not configured (missing owner, repo, branch, or token)' };
        }
    } catch (error) {
        // This catches errors from getDecryptedGitHubConfig (like password verification or decryption failure)
        results.github = { success: false, error: `Failed to get/test config: ${error.message}` };
         console.log(`[Auth] Error testing GitHub config for ${username}: ${error.message}`);
    }


    console.log(`[Auth] API key/token test results for ${username}:`, results);
    return results;
  }


  // --- Helper methods for CLI context ---

  isAdmin() {
    // Checks the currently loaded CLI user
    return this.currentUser && this.currentUser.role === 'admin';
  }

  isAuthenticated() {
    // Checks the currently loaded CLI user
    return this.currentUser && this.currentUser.username !== 'public';
  }

  getUsername() {
    // Gets the currently loaded CLI user's name
    return this.currentUser ? this.currentUser.username : 'public';
  }

  getRole() {
    // Gets the currently loaded CLI user's role
    return this.currentUser ? this.currentUser.role : 'public';
  }

  /**
   * Gets limits for a specific user, or defaults for public/unknown.
   * Authenticated users have no limits applied by default here.
   * @param {string} [username] - Optional username. Defaults to current CLI user.
   * @returns {object} Limits object.
   */
  getLimits(username = null) {
    const targetUsername = username || this.getUsername();
    let userForLimits = null;

    // If username matches CLI user, use that directly
    if (this.currentUser && this.currentUser.username === targetUsername) {
        userForLimits = this.currentUser;
    }
    // Otherwise, we'd need to load the specific user's data.
    // For WebSocket, the session should hold the user data.
    // Let's assume if we don't have the user loaded, it's public for now.
    // A better approach would involve passing the user object from the session.

    const publicLimits = { maxQueriesPerHour: 3, maxDepth: 2, maxBreadth: 3 }; // Public limits

    if (!userForLimits || userForLimits.username === 'public') {
      console.log(`[Auth] Applying public limits for user: ${targetUsername}`);
      return publicLimits;
    }

    // For authenticated users, return their specific limits (which might be empty)
    // or an empty object if none are defined.
    console.log(`[Auth] Applying user-specific limits (or none) for user: ${targetUsername}`);
    return userForLimits.limits || {}; // Return user limits or empty object
  }

  /**
   * Checks if the CLI session file is valid and not expired.
   * @returns {Promise<boolean>} True if session is valid, false otherwise.
   */
  async isSessionValid() {
    // This validates the CLI session file, not WebSocket sessions
    try {
      console.log('[Auth CLI] Validating CLI session file...');

      // Read the session file
      const sessionData = JSON.parse(await fs.readFile(this.sessionFile, 'utf8'));
      console.log('[Auth CLI] Session data loaded:', sessionData);

      if (!sessionData?.username || !sessionData?.expiresAt) {
        console.log('[Auth CLI] Invalid session format');
        return false;
      }

      // Check if session has expired
      const now = Date.now();
      if (now >= sessionData.expiresAt) {
        console.log('[Auth CLI] Session has expired');
        return false;
      }

      // Optional: Check if the user mentioned in the session file still exists
      const userExists = await this.getUserData(sessionData.username);
      if (!userExists) {
          console.log(`[Auth CLI] User ${sessionData.username} from session file no longer exists.`);
          return false;
      }

      console.log('[Auth CLI] Session file is valid');
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
          console.error(`[Auth CLI] Error validating session file: ${error.message}`);
      } else {
          console.log("[Auth CLI] No session file found.");
      }
      return false;
    }
  }

  /**
   * Validates current CLI session and logs CLI user out if invalid.
   * @returns {Promise<boolean>} True if session is valid, false if logged out.
   */
  async validateSession() {
    // This validates the CLI session file
    console.log('[Auth CLI] Validating current CLI session...');
    const isValid = await this.isSessionValid();
    if (!isValid && this.isAuthenticated()) { // Check if CLI user is authenticated
      console.log('[Auth CLI] Invalid session detected, logging out CLI user');
      await this.logout(); // Logs out the CLI user
      return false;
    }
    if (isValid && !this.isAuthenticated()) {
        // If session file is valid but CLI user isn't loaded, load them
        console.log("[Auth CLI] Valid session file found, loading user context.");
        try { // Add try-catch for reading session file here
            const sessionData = JSON.parse(await fs.readFile(this.sessionFile, 'utf8'));
            await this.loadUser(sessionData.username);
        } catch (error) {
             console.error(`[Auth CLI] Error loading user from valid session file: ${error.message}`);
             // Session file might be valid but user file deleted? Log out.
             await this.logout();
             return false;
        }
    }
    console.log('[Auth CLI] Session validation complete.');
    return isValid;
  }

  /**
   * List all users in the system (requires admin privileges).
   * @param {object} requestingUser - The user object making the request (e.g., from session).
   * @returns {Promise<Array>} Array of user objects (without sensitive data).
   */
  async listUsers(requestingUser) {
     // Check permissions using the requestingUser object
     if (!requestingUser || requestingUser.role !== 'admin') {
         console.error(`[Auth] Permission denied: User '${requestingUser?.username || 'N/A'}' (role: ${requestingUser?.role || 'N/A'}) attempted to list users. Admin required.`);
         throw new Error('Only administrators can list users');
     }
    // ... rest of existing listUsers logic ...
    try {
        await this.ensureUserDir(); // Ensure directory exists
        const files = await fs.readdir(this.userDir);
        const userFiles = files.filter(f => f.endsWith('.json') && f !== 'session.json');
        const usersList = [];
        for (const file of userFiles) {
            try {
                const username = path.basename(file, '.json');
                // Load user data to get role, but exclude sensitive info
                const userData = await this.getUserData(username);
                if (userData) {
                    usersList.push({ username: userData.username, role: userData.role });
                }
            } catch (readError) {
                 console.error(`[Auth] Error reading user file ${file} during list: ${readError.message}`);
                 // Optionally add a placeholder for corrupted files
                 // usersList.push({ username: path.basename(file, '.json'), role: '[Error Reading File]' });
            }
        }
        return usersList;
    } catch (error) {
        console.error(`[Auth] Error listing users from directory: ${error.message}`);
        throw new Error(`Failed to list users: ${error.message}`);
    }
  }

  /**
   * Delete a user from the system (requires admin privileges).
   * @param {string} usernameToDelete - Username of the user to delete.
   * @param {object} requestingUser - The user object making the request.
   * @returns {Promise<boolean>} Success status of the deletion.
   * @throws {Error} If the user doesn't exist or deletion fails.
   */
  async deleteUser(usernameToDelete, requestingUser) {
    // Only admins can delete users
    if (!requestingUser || requestingUser.role !== 'admin') {
        console.error(`[Auth] Permission denied: User '${requestingUser?.username || 'N/A'}' (role: ${requestingUser?.role || 'N/A'}) attempted to delete user '${usernameToDelete}'. Admin required.`);
        throw new Error('Permission denied: Only administrators can delete users.');
    }

    // Prevent deletion of the public user
    if (usernameToDelete === 'public') {
        throw new Error('Cannot delete the public user profile.');
    }

    // Prevent admins from deleting themselves
    if (usernameToDelete === requestingUser.username) {
        throw new Error('Administrators cannot delete their own account.');
    }

    const userPath = path.join(this.userDir, `${usernameToDelete}.json`);

    try {
        await fs.unlink(userPath);
        console.log(`[Auth] User '${usernameToDelete}' deleted successfully by '${requestingUser.username}'.`);
        // Remove from internal list if loaded
        if (this.users) {
            this.users = this.users.filter(u => u.username !== usernameToDelete);
        }
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`User '${usernameToDelete}' not found.`);
        }
        console.error(`[Auth] Error deleting user file ${userPath}: ${error.message}`);
        throw new Error(`Failed to delete user '${usernameToDelete}': ${error.message}`);
    }
  }

  /**
   * Gets the total number of registered users based on files.
   * @returns {Promise<number>} The number of users.
   */
  async getUserCount() {
    // Reads the directory each time for accuracy, could be cached if performance is critical
    try {
        await this.ensureUserDir();
        const files = await fs.readdir(this.userDir);
        // Count .json files excluding session.json
        const userFiles = files.filter(f => f.endsWith('.json') && f !== 'session.json');
        return userFiles.length;
    } catch (error) {
        console.error(`[Auth] Error counting users: ${error.message}`);
        return 0; // Return 0 on error
    }
  }

  /**
   * Gets the username of the currently authenticated user for the process.
   * Returns null if no user is authenticated for the process.
   * @returns {string|null} The current username or null.
   */
  getCurrentUsername() {
    return this.currentUser ? this.currentUser.username : null;
  }
}

export const userManager = new UserManager();
export default userManager; // Also export as default if needed elsewhere
