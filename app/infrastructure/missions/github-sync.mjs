/**
 * Mission GitHub Sync Infrastructure
 * Provides thin wrappers around git commands to support mission repository
 * synchronization, status inspection, and conflict resolution strategies.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

function escapeArg(value) {
  if (value == null) {
    return '';
  }
  const stringValue = String(value);
  if (/^[\w./-]+$/.test(stringValue)) {
    return stringValue;
  }
  const escaped = stringValue.replace(/'/g, "'\"'\"'");
  return `'${escaped}'`;
}

async function runGit(command, { cwd }) {
  return execAsync(command, { cwd });
}

function ensureRepoPath(repoPath) {
  if (!repoPath) {
    throw new Error('Mission GitHub sync requires a repoPath.');
  }
  return path.resolve(repoPath);
}

export async function verifyRepo(repoPath) {
  const cwd = ensureRepoPath(repoPath);
  try {
    await runGit('git rev-parse --is-inside-work-tree', { cwd });
    return { success: true, message: 'Repository is accessible.' };
  } catch (error) {
    return { success: false, message: 'Repository verification failed.', details: error.message };
  }
}

export async function pullRepo(repoPath, { remote = 'origin', branch = 'main' } = {}) {
  const cwd = ensureRepoPath(repoPath);
  try {
    await runGit(`git pull ${escapeArg(remote)} ${escapeArg(branch)}`, { cwd });
    return { success: true, message: 'Repository pulled successfully.' };
  } catch (error) {
    return { success: false, message: 'Pull failed.', details: error.message };
  }
}

export async function pushRepo(repoPath, { remote = 'origin', branch = 'main' } = {}) {
  const cwd = ensureRepoPath(repoPath);
  try {
    await runGit(`git push ${escapeArg(remote)} ${escapeArg(branch)}`, { cwd });
    return { success: true, message: 'Repository pushed successfully.' };
  } catch (error) {
    return { success: false, message: 'Push failed.', details: error.message };
  }
}

export async function statusRepo(repoPath) {
  const cwd = ensureRepoPath(repoPath);
  try {
    const { stdout } = await runGit('git status --porcelain=v1 --branch', { cwd });
    const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
    const conflicts = [];
    const staged = [];
    const modified = [];
    let ahead = 0;
    let behind = 0;
    let branch = null;

    for (const line of lines) {
      if (line.startsWith('##')) {
        branch = line.slice(2).trim();
        const aheadMatch = branch.match(/ahead (\d+)/);
        const behindMatch = branch.match(/behind (\d+)/);
        ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
        behind = behindMatch ? Number(behindMatch[1]) : 0;
        continue;
      }
      const statusCode = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (statusCode === 'UU') {
        conflicts.push(file);
      } else if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
        staged.push(file);
      } else {
        modified.push(file);
      }
    }

    return {
      success: true,
      message: 'Status captured.',
      branch,
      ahead,
      behind,
      conflicts,
      staged,
      modified,
      clean: conflicts.length === 0 && staged.length === 0 && modified.length === 0
    };
  } catch (error) {
    return { success: false, message: 'Status inspection failed.', details: error.message };
  }
}

export async function resolveConflicts(repoPath, { strategy = 'ours', filePath } = {}) {
  const cwd = ensureRepoPath(repoPath);
  if (!filePath) {
    throw new Error('resolveConflicts requires a target filePath relative to the repo.');
  }
  const normalizedStrategy = strategy === 'theirs' ? 'theirs' : 'ours';
  try {
    await runGit(`git checkout --${normalizedStrategy} ${escapeArg(filePath)}`, { cwd });
    await runGit(`git add ${escapeArg(filePath)}`, { cwd });
    return {
      success: true,
      message: `Resolved conflicts for ${filePath} using '${normalizedStrategy}' strategy.`
    };
  } catch (error) {
    return { success: false, message: 'Conflict resolution failed.', details: error.message };
  }
}

export async function commitRepo(repoPath, { filePath, message }) {
  const cwd = ensureRepoPath(repoPath);
  if (!filePath) {
    throw new Error('commitRepo requires a filePath relative to the repo.');
  }
  try {
    await runGit(`git add ${escapeArg(filePath)}`, { cwd });
    const escapedMessage = message.replace(/"/g, '\\"');
    await runGit(`git commit -m "${escapedMessage}"`, { cwd });
    return { success: true, message: 'Changes committed.' };
  } catch (error) {
    return { success: false, message: 'Commit failed.', details: error.message };
  }
}
