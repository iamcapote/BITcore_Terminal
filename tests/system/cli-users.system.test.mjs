/**
 * Why: Ensures the `/users` CLI command enforces administrator requirements and delegates to
 *       registered adapters only when present.
 * What: Verifies permission guards for non-admin callers and happy-path listing when an adapter is
 *       registered, without mutating real storage.
 * How: Invokes `executeUsers` with captured output while temporarily installing an in-memory adapter
 *       via `userManager.registerUserDirectoryAdapter`.
 */

import { describe, beforeAll, beforeEach, afterEach, test, expect, vi } from 'vitest';
import { createCliTestContext } from '../helpers/cli-test-context.mjs';
import { executeUsers } from '../../app/commands/users.cli.mjs';
import { userManager } from '../../app/features/auth/user-manager.mjs';

const ctx = createCliTestContext({ autoInitialize: false });
let originalAdapter;

describe('cli user management command', () => {
  beforeAll(async () => {
    originalAdapter = typeof userManager.getUserDirectoryAdapter === 'function'
      ? userManager.getUserDirectoryAdapter()
      : null;
    await ctx.initialize();
  });

  beforeEach(() => {
    ctx.flushOutput();
    vi.restoreAllMocks();
    if (typeof userManager.clearUserDirectoryAdapter === 'function') {
      userManager.clearUserDirectoryAdapter();
    }
  });

  afterEach(() => {
    if (originalAdapter && typeof userManager.registerUserDirectoryAdapter === 'function') {
      userManager.registerUserDirectoryAdapter(originalAdapter);
    }
  });

  test('rejects non-admin callers', async () => {
    const { result, output } = await ctx.runCommand(executeUsers, {
      positionalArgs: ['list'],
      requestingUser: { username: 'guest', role: 'public' },
      error: ctx.captureOutput
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
    expect(output.join('\n')).toMatch(/only administrators/i);
  });

  test('lists users for admin callers', async () => {
    const listUsers = vi.fn().mockResolvedValue([
      { username: 'admin', role: 'admin' },
      { username: 'operator', role: 'client' }
    ]);
    const createUser = vi.fn();
    const deleteUser = vi.fn();

    userManager.registerUserDirectoryAdapter?.({
      listUsers,
      createUser,
      deleteUser
    });

    const { result, output } = await ctx.runCommand(executeUsers, {
      positionalArgs: ['list'],
      requestingUser: { username: 'admin', role: 'admin' },
      error: ctx.captureOutput
    });

    expect(result.success).toBe(true);
    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(output.join('\n')).toMatch(/user list/i);
    expect(output.join('\n')).toMatch(/admin \(admin\)/i);
  });

  test('explains single-user mode when no adapter is registered', async () => {
    const { result, output } = await ctx.runCommand(executeUsers, {
      positionalArgs: ['list'],
      requestingUser: { username: 'admin', role: 'admin' },
      error: ctx.captureOutput
    });

    expect(result.success).toBe(false);
    expect(output.join('\n')).toMatch(/user management is disabled/i);
  });
});
