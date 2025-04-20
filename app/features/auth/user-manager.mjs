import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import argon2 from 'argon2';
import { encryptApiKey, decryptApiKey, deriveKey } from './encryption.mjs';
import readline from 'readline'; // Keep for potential future CLI interactions
import fetch from 'node-fetch'; // Needed for testApiKeys

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
        limits: { maxQueriesPerDay: 100, maxDepth: 5, maxBreadth: 10 },
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
      limits: { maxQueriesPerHour: 3, maxDepth: 2, maxBreadth: 3 } // Example limits
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
              return JSON.parse(publicData);
          } catch (error) {
              console.error(`[Auth] Failed to get public user data: ${error.message}`);
              return null;
          }
      }
      try {
          const userPath = path.join(this.userDir, `${username}.json`);
          const userData = await fs.readFile(userPath, 'utf8');
          return JSON.parse(userData);
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
      limits: role === 'admin'
        ? { maxQueriesPerDay: 100, maxDepth: 5, maxBreadth: 10 } // Example admin limits
        : { maxQueriesPerDay: 20, maxDepth: 3, maxBreadth: 5 } // Example client limits
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
   * Changes password for a given user. Requires current password verification.
   * Re-encrypts API keys.
   * @param {string} username - The user whose password to change.
   * @param {string} currentPassword - The user's current password.
   * @param {string} newPassword - The desired new password.
   * @returns {Promise<boolean>} True on success.
   * @throws {Error} On failure (user not found, incorrect password, etc.).
   */
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

    // Re-encrypt API keys
    if (userData.encryptedApiKeys && Object.keys(userData.encryptedApiKeys).length > 0) {
      console.log(`[Auth] Re-encrypting API keys for ${username} due to password change.`);
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

      const newSalt = randomBytes(16).toString('hex'); // Generate a new salt
      const newKey = await deriveKey(newPassword, newSalt);
      const reEncrypted = {};
      for (const [service, rawKey] of Object.entries(decryptedKeys)) {
        reEncrypted[service] = await encryptApiKey(rawKey, newKey);
      }
      userData.encryptedApiKeys = reEncrypted;
      userData.salt = newSalt; // Store the new salt
      console.log(`[Auth] API keys re-encrypted successfully for ${username}.`);
    } else {
      // If no keys, still generate a new salt
      userData.salt = randomBytes(16).toString('hex');
    }

    userData.passwordHash = newHash;
    userData.passwordChanged = new Date().toISOString(); // Track last change

    // Save updated user data
    const userPath = path.join(this.userDir, `${username}.json`);
    await fs.writeFile(userPath, JSON.stringify(userData, null, 2));

    console.log(`[Auth] Password changed successfully for user ${username}.`);

    // If changing password for the currently loaded CLI user, update this.currentUser
    if (this.currentUser && this.currentUser.username === username) {
        this.currentUser = userData;
        console.log("[Auth CLI] Updated process user context after password change.");
    }

    return true;
  }


  /**
   * Sets an API key for a specific user. Requires password verification.
   * @param {string} service - The service name (e.g., 'venice', 'brave', 'github').
   * @param {string} apiKey - The API key value.
   * @param {string} password - The user's current password for verification.
   * @param {string} username - The user for whom to set the key.
   * @returns {Promise<boolean>} True on success.
   * @throws {Error} On failure.
   */
  async setApiKey(service, apiKey, password, username) { // Added username param
    console.log(`[Auth] Setting API key for service: ${service}, user: ${username}`);

    if (!username || username === 'public') {
        throw new Error('Cannot set API keys for public or unspecified user');
    }

    const userData = await this.getUserData(username);
    if (!userData) {
        throw new Error(`User ${username} not found.`);
    }
     if (!userData.passwordHash) {
        throw new Error(`User ${username} does not have a password set.`);
    }

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
        console.log(`[Auth] Initializing encryptedApiKeys object for ${username}`);
        userData.encryptedApiKeys = {};
    }

    console.log(`[Auth] Deriving encryption key for service: ${service}`);
    const key = await deriveKey(password, userData.salt);
    const encryptedKey = await encryptApiKey(apiKey, key);
    userData.encryptedApiKeys[service] = encryptedKey;

    const userFilePath = path.join(this.userDir, `${username}.json`);
    console.log(`[Auth] Writing updated user profile to: ${userFilePath}`);
    await fs.writeFile(userFilePath, JSON.stringify(userData, null, 2));

    console.log(`[Auth] API key for ${service} set successfully for user ${username}.`);

    // If setting key for the currently loaded CLI user, update this.currentUser
    if (this.currentUser && this.currentUser.username === username) {
        this.currentUser = userData;
        console.log("[Auth CLI] Updated process user context after setting API key.");
    }
    return true;
  }

  /**
   * Gets a decrypted API key for a specific user. Requires password verification.
   * @param {string} service - The service name.
   * @param {string} password - The user's current password.
   * @param {string} username - The user whose key to retrieve.
   * @returns {Promise<string|null>} Decrypted API key or null if not found.
   * @throws {Error} If password verification fails or decryption error occurs.
   */
  async getApiKey(service, password, username) {
    // Removed session validation here - password check is the primary gate.
    // Session validation should happen at the command/route level before calling this.

    if (!username || username === 'public') {
      console.log(`[Auth] Cannot get API key for public or unspecified user.`);
      return null;
    }

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
        const key = await deriveKey(password, userData.salt);
        const decryptedKey = await decryptApiKey(userData.encryptedApiKeys[service], key);
        console.log(`[Auth] API key for ${service} retrieved successfully for user ${username}.`);
        return decryptedKey;
    } catch (decryptionError) {
        console.error(`[Auth] Failed to decrypt API key for service '${service}', user '${username}': ${decryptionError.message}`);
        throw new Error(`Failed to decrypt API key. Check password or key data.`);
    }
  }

  /**
   * Checks if an API key is stored for a specific user and service.
   * Does not require password.
   * @param {string} service - The service name.
   * @param {string} [username] - The username. Defaults to current CLI user if null.
   * @returns {Promise<boolean>} True if key exists, false otherwise.
   */
  async hasApiKey(service, username = null) {
    const targetUsername = username || this.getUsername(); // Use provided or CLI user
    console.log(`[Auth] Checking if API key exists for service: ${service}, user: ${targetUsername}`);

    if (!targetUsername || targetUsername === 'public') {
        return false;
    }

    // Use getUserData to avoid modifying this.currentUser
    const userData = await this.getUserData(targetUsername);

    if (!userData?.encryptedApiKeys?.[service]) {
      console.log(`[Auth] No API key found for service: ${service}, user: ${targetUsername}`);
      return false;
    }
    console.log(`[Auth] API key exists for service: ${service}, user: ${targetUsername}`);
    return true;
  }

  /**
   * Checks the configuration status of API keys for a given user.
   * @param {string} username - The username to check.
   * @returns {Promise<object>} An object indicating the status of each key (e.g., { brave: true, venice: false, github: true }).
   */
  async checkApiKeys(username) {
    console.log(`[Auth] Checking API key configuration status for user: ${username}`);
    if (!username || username === 'public') {
      return { brave: false, venice: false, github: false };
    }
    const userData = await this.getUserData(username);
    const keys = userData?.encryptedApiKeys || {};
    return {
      brave: !!keys.brave,
      venice: !!keys.venice,
      github: !!keys.github,
    };
  }

  /**
   * Tests the validity of configured API keys for a user by making simple API calls.
   * Requires the user's password to decrypt the keys.
   * @param {string} password - The user's current password.
   * @param {string} username - The username whose keys to test.
   * @returns {Promise<object>} An object with test results for each service (e.g., { brave: { success: true }, venice: { success: false, error: 'Invalid Key' } }).
   */
  async testApiKeys(password, username) {
    console.log(`[Auth] Testing API keys for user: ${username}`);
    const results = {
      brave: { success: false, error: 'Not configured or test failed' },
      venice: { success: false, error: 'Not configured or test failed' },
      github: { success: false, error: 'Not configured or test failed' },
    };
    const API_TIMEOUT = 5000; // 5 seconds timeout for tests

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
        const braveKey = await this.getApiKey('brave', password, username);
        if (braveKey) {
            const testResult = await testEndpoint(
                'https://api.search.brave.com/res/v1/web/ping',
                { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' }
            );
            if (testResult.success) {
                results.brave = { success: true };
            } else {
                results.brave = { success: false, error: testResult.error || `API returned ${testResult.status}: ${testResult.statusText}` };
            }
        } else {
             results.brave = { success: false, error: 'Not configured' };
        }
    } catch (error) {
        results.brave = { success: false, error: `Failed to get/test key: ${error.message}` };
    }

    // Test Venice
    try {
        const veniceKey = await this.getApiKey('venice', password, username);
        if (veniceKey) {
            const testResult = await testEndpoint(
                'https://api.venice.ai/api/v1/models',
                { 'Authorization': `Bearer ${veniceKey}` }
            );
             if (testResult.success) {
                results.venice = { success: true };
            } else {
                results.venice = { success: false, error: testResult.error || `API returned ${testResult.status}: ${testResult.statusText}` };
            }
        } else {
             results.venice = { success: false, error: 'Not configured' };
        }
    } catch (error) {
        results.venice = { success: false, error: `Failed to get/test key: ${error.message}` };
    }

    // Test GitHub
    try {
        const githubKey = await this.getApiKey('github', password, username);
        if (githubKey) {
            const testResult = await testEndpoint(
                'https://api.github.com/user',
                { 'Authorization': `Bearer ${githubKey}`, 'Accept': 'application/vnd.github.v3+json' }
            );
             if (testResult.success) {
                results.github = { success: true };
            } else {
                 // GitHub returns 401 for bad credentials, 403 for rate limit/permissions
                results.github = { success: false, error: testResult.error || `API returned ${testResult.status}: ${testResult.statusText}` };
            }
        } else {
             results.github = { success: false, error: 'Not configured' };
        }
    } catch (error) {
        results.github = { success: false, error: `Failed to get/test key: ${error.message}` };
    }

    console.log(`[Auth] API key test results for ${username}:`, results);
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
    // Otherwise, we'd need to load the specific user's data (potentially expensive)
    // For now, let's simplify: if it's not the CLI user, return public limits.
    // A better approach might involve caching user data or passing it explicitly.

    const defaultLimits = { maxQueriesPerHour: 3, maxDepth: 2, maxBreadth: 3 }; // Public limits

    if (!userForLimits || userForLimits.username === 'public') {
      return defaultLimits;
    }
    return userForLimits.limits || defaultLimits; // Return user limits or default if missing
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
