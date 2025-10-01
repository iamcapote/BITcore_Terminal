/**
 * Contract
 * Inputs:
 *   - options?: {
 *       testUserDir?: string;
 *       logger?: Pick<Console, 'log' | 'error' | 'warn'>;
 *     }
 * Outputs:
 *   - Promise<{
 *       testUserDir: string;
 *       sessionFile: string;
 *       repoRoot: string;
 *     }>
 * Error modes:
 *   - Throws when filesystem operations fail or when user management calls reject.
 * Performance:
 *   - Expected runtime < 1s; peak memory < 5 MB.
 * Side effects:
 *   - Creates/overwrites test user files, modifies environment variables, mutates userManager paths.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { userManager } from '../../features/auth/user-manager.mjs';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const DEFAULT_TEST_DIR_NAME = '.test-mcp-users';
const loggerDefaults = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const ADMIN_USER = {
  username: 'admin',
  role: 'admin',
  passwordHash:
    '$argon2id$v=19$m=65536,t=3,p=4$Cb5ucQ3bj3hL3UG9IDZREQ$YbAfsI9KgRP9W12cL0udXQeX3/aHFYOE55fKCcfqxE8',
  salt: '9f0464547bf28502423f6504f9130cc4',
  created: new Date().toISOString(),
  limits: { maxQueriesPerDay: 100, maxDepth: 5, maxBreadth: 10 },
  encryptedApiKeys: {
    venice:
      '{"iv":"a1fe3f01f9e6b2bd61802eb41a91b969","encrypted":"009379961fac2007eead8d5ad9ef3480ae8e8c4c382ceb6dc3d0c329ca4d0cfe1e54a78636d57db7b5b8","authTag":"3033373767de7a965da2075e1ce326b0"}',
    brave:
      '{"iv":"7faf480405a7d9f2cbd49ca0c4115891","encrypted":"e40ad8234a6110ed34402ab790d2e63398ceb543f09fa2d673f6011f23757d","authTag":"170d5615bc7f60b3c85510cab2f5ed3d"}'
  }
};

const CLIENT_USER = {
  username: 'validation-test-client',
  role: 'client',
  passwordHash:
    '$argon2id$v=19$m=65536,t=3,p=4$hdAkp1ZhWWpgDN0MhXrRNw$FRlxd6TFkQrOXWuSiJ7TZT5lGSrD0k48GbbEm+igELY',
  salt: 'c280ec8176b4e91c4c47fdb7db6018d2',
  created: new Date().toISOString(),
  limits: { maxQueriesPerDay: 20, maxDepth: 3, maxBreadth: 5 },
  encryptedApiKeys: {}
};

export function resolveValidationPaths(testUserDir = path.join(repoRoot, DEFAULT_TEST_DIR_NAME)) {
  const sessionFile = path.join(testUserDir, 'session.json');
  return { repoRoot, testUserDir, sessionFile };
}

export async function prepareValidationEnvironment(options = {}) {
  const { testUserDir: overrideDir, logger: providedLogger } = options;
  const logger = { ...loggerDefaults, ...providedLogger };
  const { testUserDir, sessionFile } = resolveValidationPaths(overrideDir);

  configureTestEnv(testUserDir, logger);
  await ensureDirectory(testUserDir, logger);

  await withTestUserManager(testUserDir, sessionFile, async () => {
    await userManager.createPublicProfile();
    await seedUserFile(path.join(testUserDir, 'admin.json'), ADMIN_USER, logger);
    await seedUserFile(path.join(testUserDir, `${CLIENT_USER.username}.json`), CLIENT_USER, logger);
    await ensureSession(sessionFile, logger);
  });

  return { repoRoot, testUserDir, sessionFile };
}

export async function withTestUserManager(testUserDir, sessionFile, fn) {
  const originalDir = userManager.userDir;
  const originalSession = userManager.sessionFile;

  userManager.userDir = testUserDir;
  userManager.sessionFile = sessionFile;

  try {
    return await fn();
  } finally {
    userManager.userDir = originalDir;
    userManager.sessionFile = originalSession;
  }
}

export async function validateAdminSession(testUserDir, sessionFile, logger = loggerDefaults) {
  const { log, warn } = { ...loggerDefaults, ...logger };

  return withTestUserManager(testUserDir, sessionFile, async () => {
    const isValid = await userManager.validateSession();

    if (!isValid) {
      warn('[Validation] Detected invalid admin session; recreating');
      await userManager.createSession('admin');
      log('[Validation] Session regenerated for admin user');
      return true;
    }

    log('[Validation] Admin session is valid');
    return true;
  });
}

function configureTestEnv(testUserDir, logger) {
  const { log } = { ...loggerDefaults, ...logger };
  process.env.MCP_TEST_USER_DIR = testUserDir;
  process.env.MCP_TEST_MODE = 'true';
  log(`[Validation] Using test user directory: ${testUserDir}`);
}

async function ensureDirectory(dir, logger) {
  const { log } = { ...loggerDefaults, ...logger };
  await fs.mkdir(dir, { recursive: true });
  log(`[Validation] Ensured directory exists: ${dir}`);
}

async function seedUserFile(filePath, userData, logger) {
  const { log } = { ...loggerDefaults, ...logger };
  const payload = { ...userData, created: new Date().toISOString() };
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  log(`[Validation] Wrote user fixture: ${path.basename(filePath)}`);
}

async function ensureSession(sessionFile, logger) {
  const { log } = { ...loggerDefaults, ...logger };
  const sessionData = {
    username: 'admin',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };

  await fs.writeFile(sessionFile, `${JSON.stringify(sessionData, null, 2)}\n`);
  log('[Validation] Seeded admin session file');
}

/**
 * Why: Offer a tiny utility for validation-related scripts to initialise the user manager once.
 * What: Wraps `userManager.initialize()` and returns the hydrated user data for callers.
 * How: Delegates to the singleton user manager and surfaces a descriptive message on success.
 * Contract
 * Inputs:
 *   - None.
 * Outputs:
 *   - Promise<{ user: object; message: string }> resolving with the current user and log line.
 * Error modes:
 *   - Propagates rejections from `userManager.initialize()`.
 * Performance:
 *   - <100ms, negligible memory.
 * Side effects:
 *   - Ensures the on-disk user store exists.
 */

export async function initialiseValidationEnvironment() {
  const user = await userManager.initialize();
  if (!user?.username) {
    throw new Error('User manager did not return a user during initialisation');
  }
  return { user, message: `Initialised user ${user.username} (${user.role})` };
}
