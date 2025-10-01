/**
 * Why: Confirms the `/keys` CLI command handles validation, status, and diagnostics gracefully with
 *       controlled user-manager responses.
 * What: Exercises `set`, `check`, and `test` actions to ensure messaging and error handling align with
 *       expectations in automation scenarios.
 * How: Stubs `userManager` interactions so the command can run deterministically under Vitest.
 */

import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';
import { createCliTestContext } from '../helpers/cli-test-context.mjs';
import { executeKeys } from '../../app/commands/keys.cli.mjs';
import { userManager } from '../../app/features/auth/user-manager.mjs';

const ctx = createCliTestContext({ autoInitialize: false });

describe('cli key management command', () => {
  beforeEach(async () => {
    await ctx.initialize();
    ctx.flushOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('set action requires a target service', async () => {
    const { result, output } = await ctx.runCommand(executeKeys, {
      positionalArgs: ['set'],
      error: ctx.captureOutput
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing service');
    expect(output.join('\n')).toMatch(/usage/i);
  });

  test('check action reports stored credential status', async () => {
    vi.spyOn(userManager, 'checkApiKeys').mockResolvedValue({
      brave: true,
      venice: false,
      github: true
    });
    vi.spyOn(userManager, 'hasGitHubToken').mockResolvedValue(false);

    const { result, output } = await ctx.runCommand(executeKeys, {
      positionalArgs: ['check']
    });

    expect(result.success).toBe(true);
    const report = output.join('\n');
    expect(report).toMatch(/Brave API Key: Configured/);
    expect(report).toMatch(/Venice API Key: Not Configured/);
    expect(report).toMatch(/GitHub Token: Not Set/);
  });

  test('test action surfaces credential failures', async () => {
    vi.spyOn(userManager, 'testApiKeys').mockResolvedValue({
      brave: { success: false, error: 'Bad key' },
      venice: { success: true },
      github: { success: null }
    });

    const { result, output } = await ctx.runCommand(executeKeys, {
      positionalArgs: ['test'],
      error: ctx.captureOutput
    });

    expect(result.success).toBe(false);
    const transcript = output.join('\n');
    expect(transcript).toMatch(/Brave API Key: Failed/);
    expect(transcript).toMatch(/Bad key/);
    expect(transcript).toMatch(/failed validation/i);
  });
});
