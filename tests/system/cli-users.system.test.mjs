/**
 * Why: Ensures the `/users` CLI command enforces administrator requirements and surfaces lists when
 *       the backing user manager provides data.
 * What: Verifies permission guards for non-admin callers and happy-path listing when an admin invokes
 *       the command with a stubbed directory.
 * How: Invokes `executeUsers` with captured output while patching the shared `userManager` to avoid
 *       touching real storage.
 */

import { describe, beforeAll, beforeEach, afterEach, test, expect, vi } from 'vitest';
import { createCliTestContext } from '../helpers/cli-test-context.mjs';
import { executeUsers } from '../../app/commands/users.cli.mjs';
import { userManager } from '../../app/features/auth/user-manager.mjs';

const ctx = createCliTestContext({ autoInitialize: false });
let originalListUsers;

describe('cli user management command', () => {
  beforeAll(async () => {
    originalListUsers = userManager.listUsers;
    await ctx.initialize();
  });

  beforeEach(() => {
    ctx.flushOutput();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalListUsers === undefined) {
      delete userManager.listUsers;
    } else {
      userManager.listUsers = originalListUsers;
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
    userManager.listUsers = vi.fn().mockResolvedValue([
      { username: 'admin', role: 'admin' },
      { username: 'operator', role: 'client' }
    ]);

    const { result, output } = await ctx.runCommand(executeUsers, {
      positionalArgs: ['list'],
      requestingUser: { username: 'admin', role: 'admin' },
      error: ctx.captureOutput
    });

    expect(result.success).toBe(true);
    expect(userManager.listUsers).toHaveBeenCalledTimes(1);
    expect(output.join('\n')).toMatch(/user list/i);
    expect(output.join('\n')).toMatch(/admin \(admin\)/i);
  });
});
