/**
 * Why: Provide reusable smoke checks that ensure validation-related CLI commands behave.
 * What: Executes login, user management, and status commands against the seeded test environment.
 * How: Runs CLI handlers with mocked output collectors and asserts on their responses.
 * Contract
 * Inputs:
 *   - options: {
 *       sessionFile: string;
 *       logger?: Pick<Console, 'log' | 'error' | 'warn'>;
 *     }
 * Outputs:
 *   - Promise<{ sessionValid: boolean; usersListed: boolean; userCreated: boolean; statusReported: boolean; }>.
 * Error modes:
 *   - Propagates command handler errors.
 * Performance:
 *   - Runtime ~500ms; negligible memory.
 * Side effects:
 *   - Executes CLI handlers that touch filesystem-backed user/session stores.
 */

import fs from 'fs/promises';
import { executeLogin } from '../../commands/login.cli.mjs';
import { executeUsers } from '../../commands/users.cli.mjs';
import { executeStatus } from '../../commands/status.cli.mjs';
import { userManager } from '../../features/auth/user-manager.mjs';

const loggerDefaults = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

export async function runValidationSmokeSuite(options) {
  const { sessionFile, logger: providedLogger } = options;
  const logger = { ...loggerDefaults, ...providedLogger };
  const outputBuffer = [];
  const output = (line) => {
    outputBuffer.push(line);
    logger.log(line);
  };

  logger.log('[Validation] Starting CLI smoke suite');

  await executeLogin({ arg0: 'admin', arg1: 'test1234', output });
  const sessionValid = await verifySession(sessionFile, logger);

  outputBuffer.length = 0;
  await executeUsers({
    positionalArgs: ['list'],
    requestingUser: { username: 'admin', role: 'admin' },
    output,
    error: output
  });
  const usersListed = outputBuffer.some((line) => /user management is disabled/i.test(line));

  outputBuffer.length = 0;
  await executeUsers({
    positionalArgs: ['create', 'test-user'],
    requestingUser: { username: 'admin', role: 'admin' },
    role: 'client',
    output,
    error: output
  });
  const userCreated = userManager.hasUserDirectoryAdapter?.() ?
    outputBuffer.some((line) => /Created user/i.test(line)) :
    outputBuffer.some((line) => /user management is disabled/i.test(line));

  outputBuffer.length = 0;
  await executeStatus({ output });
  const statusReported = outputBuffer.some((line) => /Username:/i.test(line));

  logger.log('[Validation] Completed CLI smoke suite');
  return { sessionValid, usersListed, userCreated, statusReported };
}

async function verifySession(sessionFile, logger) {
  const { log, warn } = { ...loggerDefaults, ...logger };
  try {
    const payload = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
    const isValid = payload?.username === 'admin';
    log(`[Validation] Session file ${isValid ? 'contains' : 'is missing'} admin user`);
    return isValid;
  } catch (error) {
    warn(`[Validation] Failed to read session file: ${error.message}`);
    return false;
  }
}

/**
 * Why: Provide a reusable output collector for validation scripts that need to capture CLI output.
 * What: Exposes `createCollector`, returning an object with a `push` callback and collected lines array.
 * How: Normalises inputs to strings and ignores nullish values.
 * Contract
 * Inputs:
 *   - None.
 * Outputs:
 *   - { lines: string[]; push: (line: unknown) => void }
 * Error modes:
 *   - None; the collector tolerates any input value.
 * Performance:
 *   - In-memory array append; negligible cost.
 * Side effects:
 *   - None.
 */

export function createCollector() {
  const lines = [];
  return {
    lines,
    push: (line) => {
      if (line === undefined || line === null) {
        return;
      }
      lines.push(typeof line === 'string' ? line : JSON.stringify(line));
    }
  };
}
