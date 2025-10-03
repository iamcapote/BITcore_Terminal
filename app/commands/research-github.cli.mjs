/**
 * GitHub Research Sync CLI entrypoint.
 *
 * Provides operators with parity between the terminal and web dashboards for
 * managing the research repository without leaving BITcore. The command wraps
 * the `GitHubResearchSyncController` surface to expose verification, browsing,
 * download, and upload/push primitives with structured feedback that works in
 * both interactive CLI and WebSocket sessions.
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { getGitHubResearchSyncController } from '../features/research/research.github-sync.controller.mjs';
import { handleCliError, ErrorTypes, logCommandStart, logCommandSuccess } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const JSON_SPACING = 2;
const DEFAULT_ENCODING = 'utf8';
const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'on']);

const moduleLogger = createModuleLogger('commands.research-github.cli', { emitToStdStreams: false });

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE.has(String(value).trim().toLowerCase());
}

function logJson(outputFn, payload) {
  outputFn(typeof payload === 'string' ? payload : JSON.stringify(payload, null, JSON_SPACING));
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = typeof value === 'string' ? value : JSON.stringify(value, null, JSON_SPACING);
    const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
    moduleLogger[level](message, payloadMeta);
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

function sendWsAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

function requirePath(positionalArgs, flags) {
  const candidate = flags.path ?? flags.target ?? positionalArgs.shift();
  if (!candidate || !String(candidate).trim()) {
    throw new Error('Target path is required for this operation. Provide --path="repo/file.md".');
  }
  return String(candidate).trim();
}

function resolveOutputPath(repoPath, positionalArgs, flags) {
  const explicit = flags.out ?? flags.output ?? positionalArgs.shift();
  if (explicit) {
    return String(explicit).trim();
  }
  const basename = path.basename(repoPath);
  return basename || `${repoPath.replace(/\//g, '_') || 'download'}.txt`;
}

function formatVerification(result) {
  const lines = [];
  if (!result?.ok) {
    lines.push('GitHub verification failed.');
    return lines;
  }
  const { config, repository, branch } = result;
  lines.push(`Repository: ${config.owner}/${config.repo}`);
  lines.push(`Branch: ${config.branch}`);
  if (repository) {
    lines.push(`Visibility: ${repository.private ? 'private' : 'public'}`);
    if (repository.htmlUrl) {
      lines.push(`URL: ${repository.htmlUrl}`);
    }
  }
  if (branch?.commitSha) {
    lines.push(`Latest commit: ${branch.commitSha}`);
  }
  return lines;
}

function formatList(entries) {
  if (!entries?.length) {
    return ['(empty directory)'];
  }
  return entries.map((entry) => {
    const sizeLabel = entry.size == null ? '' : ` (${entry.size} bytes)`;
    return `${entry.type === 'dir' ? '📁' : '📄'} ${entry.name}${sizeLabel}`;
  });
}

function formatSummaries(summaries) {
  if (!Array.isArray(summaries) || !summaries.length) {
    return ['No files committed.'];
  }
  return summaries.map((summary) => {
    const { path: repoPath, branch, commitSha } = summary;
    return `Committed ${repoPath} to ${branch}${commitSha ? ` (sha ${commitSha})` : ''}`;
  });
}

async function loadManifest(manifestPath) {
  if (!manifestPath) {
    throw new Error('Push requires --manifest=<file> pointing to a JSON array of { path, content } records.');
  }
  const raw = await fs.readFile(manifestPath, DEFAULT_ENCODING);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse manifest JSON: ${error.message}`);
  }
  if (!Array.isArray(data) || !data.length) {
    throw new Error('Manifest must contain a non-empty array of file descriptors.');
  }
  data.forEach((entry, index) => {
    if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
      throw new Error(`Manifest entry ${index + 1} is missing a path.`);
    }
    if (typeof entry.content !== 'string') {
      throw new Error(`Manifest entry ${index + 1} content must be a UTF-8 string.`);
    }
  });
  return data.map((entry) => ({ path: entry.path.trim(), content: entry.content }));
}

export function getResearchGitHubHelpText() {
  return [
    '/research-github verify [--json]                                 Validate GitHub credentials and show repository metadata.',
    '/research-github list [path] [--ref=branchOrSha] [--json]        List files under the research directory (defaults to repo root).',
    '/research-github fetch <path> [--ref=...] [--stdout] [--json]    Fetch a file, optionally print to stdout or emit JSON metadata.',
    '/research-github download <path> [--out=local] [--ref=...]       Save a repository file to the local filesystem.',
    '/research-github upload --path=repo/file.md [--file=local.md|--content="..."] [--message="Commit msg"] [--branch=name] [--json]  Upload or update a single file.',
    '/research-github push --manifest=files.json [--message="Commit" ] [--branch=name] [--json]  Push multiple files using a JSON manifest.'
  ].join('\n');
}

export async function executeResearchGitHub(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput, 'info');
  const errorFn = createEmitter(wsError, 'error');

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || (positionalArgs.shift()?.toLowerCase()) || 'verify';
  const jsonOutput = isTruthy(flags.json ?? options.json);

  const controller = getGitHubResearchSyncController();

  logCommandStart(`research-github ${subcommand}`, { positionalArgs, flags });
  moduleLogger.info('Executing research-github command.', {
    subcommand,
    jsonOutput,
    hasWebSocketOutput: typeof wsOutput === 'function',
    hasWebSocketError: typeof wsError === 'function'
  });

  let ackSent = false;
  try {
    switch (subcommand) {
      case 'verify':
      case 'status': {
        const result = await controller.verify();
        if (jsonOutput) {
          logJson(outputFn, result);
        } else {
          formatVerification(result).forEach((line) => outputFn(line));
        }
        sendWsAck(wsOutput);
        ackSent = true;
        logCommandSuccess(`research-github ${subcommand}`, result);
        moduleLogger.info('Research GitHub verification completed.', {
          jsonOutput,
          repository: result?.config ? `${result.config.owner}/${result.config.repo}` : null,
          branch: result?.config?.branch ?? null,
          ok: result?.ok ?? false
        });
        return { success: true, verification: result };
      }

      case 'list':
      case 'ls': {
        const pathArg = positionalArgs.shift() ?? flags.path ?? '';
        const ref = flags.ref ?? flags.sha ?? options.ref;
        const listing = await controller.listEntries({ path: pathArg ?? '', ref });
        if (jsonOutput) {
          logJson(outputFn, listing);
        } else {
          outputFn(`Path: ${listing.path || '/'} @ ${listing.ref || 'default branch'}`);
          formatList(listing.entries).forEach((line) => outputFn(line));
        }
        sendWsAck(wsOutput);
        ackSent = true;
        logCommandSuccess('research-github list', listing);
        moduleLogger.info('Research GitHub list completed.', {
          path: listing.path || '/',
          ref,
          count: listing.entries?.length ?? 0,
          jsonOutput
        });
        return { success: true, listing };
      }

      case 'fetch':
      case 'show':
      case 'cat': {
        const repoPath = requirePath(positionalArgs, flags);
        const ref = flags.ref ?? options.ref;
        const file = await controller.fetchFile({ path: repoPath, ref });
        const stdout = isTruthy(flags.stdout ?? flags.print ?? options.stdout);
        if (jsonOutput) {
          logJson(outputFn, file);
        } else {
          outputFn(`Path: ${file.path} (${file.size ?? 'unknown'} bytes)`);
          if (stdout) {
            outputFn(file.content);
          } else {
            outputFn('Content preview:');
            outputFn(file.content.split('\n').slice(0, 40).join('\n'));
            if ((file.content.match(/\n/g) || []).length >= 40) {
              outputFn('…');
            }
          }
        }
        sendWsAck(wsOutput);
        ackSent = true;
        logCommandSuccess('research-github fetch', file);
        moduleLogger.info('Research GitHub fetch completed.', {
          path: file?.path,
          ref,
          size: file?.size ?? null,
          stdout,
          jsonOutput
        });
        return { success: true, file };
      }

      case 'download':
      case 'save': {
        const repoPath = requirePath(positionalArgs, flags);
        const ref = flags.ref ?? options.ref;
        const outFile = resolveOutputPath(repoPath, positionalArgs, flags);
        const file = await controller.fetchFile({ path: repoPath, ref });
        const absoluteOut = path.resolve(outFile);
        await fs.mkdir(path.dirname(absoluteOut), { recursive: true });
        await fs.writeFile(absoluteOut, file.content, DEFAULT_ENCODING);
        if (jsonOutput) {
          logJson(outputFn, { ...file, savedAs: absoluteOut });
        } else {
          outputFn(`Saved ${file.path} (${file.size ?? 'unknown'} bytes) to ${absoluteOut}`);
        }
        sendWsAck(wsOutput);
        ackSent = true;
        logCommandSuccess('research-github download', { path: repoPath, savedAs: absoluteOut });
        moduleLogger.info('Research GitHub download completed.', {
          path: repoPath,
          savedAs: absoluteOut,
          ref,
          jsonOutput
        });
        return { success: true, file, savedAs: absoluteOut };
      }

      case 'upload': {
        const repoPath = requirePath(positionalArgs, flags);
        const branch = flags.branch ?? options.branch;
        const message = flags.message ?? flags.msg ?? options.message;
        let content = flags.content ?? options.content ?? null;
        const localFile = flags.file ?? flags.source ?? options.file;
        if (content == null && localFile) {
          const absolute = path.resolve(String(localFile));
          content = await fs.readFile(absolute, DEFAULT_ENCODING);
        }
        if (typeof content !== 'string') {
          throw new Error('upload requires either --content="..." or --file=/path/to/local/file');
        }
        const summary = await controller.uploadFile({ path: repoPath, content, message, branch });
        if (jsonOutput) {
          logJson(outputFn, summary);
        } else {
          outputFn(`Uploaded ${summary.path} -> commit ${summary.commitSha ?? 'unknown'}`);
          if (summary.commitUrl) {
            outputFn(`Commit URL: ${summary.commitUrl}`);
          }
          if (summary.fileUrl) {
            outputFn(`File URL: ${summary.fileUrl}`);
          }
        }
        sendWsAck(wsOutput);
        ackSent = true;
        logCommandSuccess('research-github upload', summary);
        moduleLogger.info('Research GitHub upload completed.', {
          path: summary?.path ?? repoPath,
          branch: summary?.branch ?? branch ?? null,
          commitSha: summary?.commitSha ?? null,
          jsonOutput
        });
        return { success: true, summary };
      }

      case 'push': {
        const manifestPath = flags.manifest ?? options.manifest;
        const files = await loadManifest(manifestPath);
        const branch = flags.branch ?? options.branch;
        const message = flags.message ?? flags.msg ?? options.message;
        const result = await controller.pushBatch({ files, branch, message });
        if (jsonOutput) {
          logJson(outputFn, result);
        } else {
          formatSummaries(result.summaries ?? result).forEach((line) => outputFn(line));
        }
        sendWsAck(wsOutput);
        ackSent = true;
        logCommandSuccess('research-github push', { count: result.summaries?.length ?? result.length ?? 0 });
        moduleLogger.info('Research GitHub push completed.', {
          branch: branch ?? null,
          files: files.length,
          summaries: result.summaries?.length ?? result.length ?? 0,
          jsonOutput
        });
        return { success: true, summaries: result.summaries ?? result };
      }

      default: {
        const message = `Unknown research-github action: ${subcommand}. Run /research-github help for options.`;
        errorFn(message, { code: 'unknown_research_github_action', subcommand });
        sendWsAck(wsOutput);
        ackSent = true;
        moduleLogger.warn('Research GitHub command received unknown action.', { subcommand });
        return { success: false, error: message, handled: true };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    moduleLogger.error('Research GitHub command failed.', {
      subcommand,
      message,
      stack: error instanceof Error ? error.stack : null
    });
    errorFn(message, { code: 'research_github_command_failed' });
    handleCliError(error, ErrorTypes.UNKNOWN, { command: `research-github ${subcommand}` });
    if (!ackSent) {
      sendWsAck(wsOutput);
    }
    return { success: false, error: message, handled: true };
  }
}
