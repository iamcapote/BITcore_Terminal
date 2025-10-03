/**
 * Why: Inform operators that password changes are disabled in single-user mode while preserving CLI/Web parity.
 * What: Emits a structured notice through logger-aware output handlers whenever /password-change is invoked.
 * How: Injects an emitter that mirrors messages to the provided handler or stdout while recording telemetry metadata.
 */

import { userManager } from '../features/auth/user-manager.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.password.cli', { emitToStdStreams: false });

function createEmitter(handler) {
  if (typeof handler === 'function') {
    return (message, meta = null) => {
      moduleLogger.info(message, meta);
      handler(message);
    };
  }
  return (message, meta = null) => {
    moduleLogger.info(message, meta);
    process.stdout.write(`${message}\n`);
  };
}

/**
 * Provides help text for the /password-change command.
 * @returns {string} Help text.
 */
export function getPasswordChangeHelpText() {
  return `/password-change - Not applicable in single-user mode (no passwords).`;
}

/**
 * CLI command to change user password
 * @returns {Promise<Object>} Result of password change
 */
export async function executePasswordChange(options = {}) {
  const output = createEmitter(options.output);
  const current = userManager.getCurrentUser?.() || { username: 'operator', role: 'admin' };
  const message = `Single-user mode active as ${current.username} (${current.role}). Passwords are not used.`;
  output(message, { username: current.username, role: current.role });
  return { success: true, user: current };
}