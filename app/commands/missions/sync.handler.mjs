/**
 * Why: Pull mission GitHub sync operations into a focused module for clarity and reuse.
 * What: Implements status/pull/push/resolve logic plus supporting flag parsers for sync commands.
 * How: Delegates Git interactions to the provided controller, shaping CLI responses and performing light file IO for content ingestion.
 * Contract
 *   Inputs:
 *     - positionalArgs: string[] representing remaining CLI segments after the /missions sync subcommand.
 *     - flags: Record<string, unknown> containing parsed CLI flags for overrides.
 *     - jsonOutput: boolean toggling JSON formatting.
 *     - outputFn: (message: string) => void for normal output.
 *     - errorFn: (message: string) => void for error output.
 *     - githubSyncController: object exposing status/load/save/resolve helpers and config defaults.
 *   Outputs:
 *     - Resolves to `{ success: boolean, result?, error?, handled? }` consistent with existing CLI expectations.
 *   Error modes:
 *     - User mistakes (missing content, unknown actions) return handled=false objects; filesystem/IO errors are surfaced via thrown exceptions.
 *   Performance:
 *     - O(1) aside from delegated Git operations or reading optional input files.
 *   Side effects:
 *     - Reads optional manifest content from disk when `--from-file`/`--source` supplied.
 */

import fs from 'fs/promises';
import path from 'path';
import { logJson } from './helpers.mjs';

export async function handleSyncCommand({
  positionalArgs,
  flags,
  jsonOutput,
  outputFn,
  errorFn,
  githubSyncController
}) {
  const syncAction = (positionalArgs.shift() || flags.action || 'status').toLowerCase();
  const overrides = buildGitHubSyncOverrides(flags);

  switch (syncAction) {
    case 'status': {
      const result = await githubSyncController.status(overrides);
      if (jsonOutput) {
        logJson(outputFn, result);
      } else {
        outputFn(`Repo: ${overrides.repoPath ?? githubSyncController.config.repoPath}`);
        outputFn(`Branch: ${overrides.branch ?? githubSyncController.config.branch}`);
        const report = result.statusReport;
        if (!report) {
          outputFn(result.message);
        } else {
          outputFn(`Ahead: ${report.ahead} | Behind: ${report.behind}`);
          if (report.conflicts.length) {
            outputFn(`Conflicts: ${report.conflicts.join(', ')}`);
          }
          if (report.modified.length) {
            outputFn(`Modified: ${report.modified.join(', ')}`);
          }
          if (report.staged.length) {
            outputFn(`Staged: ${report.staged.join(', ')}`);
          }
          if (report.clean) {
            outputFn('Working tree is clean.');
          }
        }
      }
      return { success: result.status !== 'error', result };
    }

    case 'pull':
    case 'load': {
      const result = await githubSyncController.load(overrides);
      if (jsonOutput) {
        logJson(outputFn, result);
      } else {
        outputFn(result.message);
        if (typeof result.payload === 'string') {
          outputFn(result.payload);
        }
      }
      return { success: result.status === 'ok', result };
    }

    case 'push':
    case 'save': {
      const content = await getSyncContent(flags);
      if (content == null) {
        const message = 'Provide --content="..." or --from-file=<path> for sync push.';
        errorFn(message);
        return { success: false, error: message, handled: true };
      }
      const result = await githubSyncController.save(overrides, { content });
      if (jsonOutput) {
        logJson(outputFn, result);
      } else {
        outputFn(result.message);
        if (result.status === 'conflict' && result.statusReport?.conflicts?.length) {
          outputFn(`Conflicts detected: ${result.statusReport.conflicts.join(', ')}`);
        }
      }
      return { success: result.status === 'ok', result };
    }

    case 'resolve': {
      const result = await githubSyncController.resolve(overrides, {
        filePath: flags['file-path'] || flags.file,
        strategy: flags.strategy
      });
      if (jsonOutput) {
        logJson(outputFn, result);
      } else {
        outputFn(result.message);
        if (result.statusReport?.conflicts?.length) {
          outputFn(`Remaining conflicts: ${result.statusReport.conflicts.join(', ')}`);
        }
      }
      return { success: result.status === 'ok', result };
    }

    default: {
      const message = `Unknown missions sync action: ${syncAction}.`;
      errorFn(message);
      return { success: false, error: message, handled: true };
    }
  }
}

export function buildGitHubSyncOverrides(flags = {}) {
  const overrides = {};
  if (flags['repo-path']) {
    overrides.repoPath = path.resolve(flags['repo-path']);
  }
  if (flags.repo) {
    overrides.repoPath = path.resolve(flags.repo);
  }
  if (flags['file-path']) {
    overrides.filePath = flags['file-path'];
  }
  if (flags.file) {
    overrides.filePath = flags.file;
  }
  if (flags.branch) {
    overrides.branch = flags.branch;
  }
  if (flags.remote) {
    overrides.remote = flags.remote;
  }
  if (flags['commit-message']) {
    overrides.commitMessage = flags['commit-message'];
  }
  if (flags.message) {
    overrides.commitMessage = flags.message;
  }
  if (flags.strategy) {
    overrides.strategy = flags.strategy;
  }
  return overrides;
}

export async function getSyncContent(flags = {}) {
  if (typeof flags.content === 'string') {
    return flags.content;
  }
  const fromFile = flags['from-file'] || flags.source;
  if (fromFile) {
    const filePath = path.resolve(fromFile);
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read content from ${filePath}: ${error.message}`);
    }
  }
  return null;
}
