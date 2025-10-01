/**
 * Why: Validates high-level authentication CLI commands remain operational in single-user mode.
 * What: Exercises `/status`, `/login`, `/logout`, and `/password-change` handlers to ensure they
 *       surface informative messaging and maintain stable return contracts.
 * How: Uses the shared `CliTestContext` helper to capture output without mutating shared state.
 */

import { describe, beforeAll, beforeEach, test, expect } from 'vitest';
import { createCliTestContext } from '../helpers/cli-test-context.mjs';
import { executeStatus } from '../../app/commands/status.cli.mjs';
import { executeLogin } from '../../app/commands/login.cli.mjs';
import { executeLogout } from '../../app/commands/logout.cli.mjs';
import { executePasswordChange } from '../../app/commands/password.cli.mjs';

const ctx = createCliTestContext();

describe('cli authentication commands', () => {
  beforeAll(async () => {
    await ctx.initialize();
  });

  beforeEach(() => {
    ctx.flushOutput();
  });

  test('status reports current username and role', async () => {
    const { output } = await ctx.runCommand(executeStatus);
    expect(output.some(line => line.startsWith('Username:'))).toBe(true);
    expect(output.some(line => line.startsWith('Role:'))).toBe(true);
  });

  test('login reports single-user mode', async () => {
    const { output } = await ctx.runWithConsoleCapture(executeLogin, []);
    expect(output.join('\n')).toMatch(/single-user mode/i);
  });

  test('logout communicates no-op', async () => {
    const { output } = await ctx.runWithConsoleCapture(executeLogout, []);
    expect(output.join('\n')).toMatch(/does nothing/i);
  });

  test('password change emits explanatory message', async () => {
    const { output } = await ctx.runCommand(executePasswordChange);
    expect(output.join('\n')).toMatch(/passwords are not used/i);
  });
});
