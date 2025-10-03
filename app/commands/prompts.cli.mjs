/**
 * Prompt CLI entrypoint.
 *
 * Provides list/get/save/delete/search operations over the prompt repository
 * while honouring the same command grammar used across the terminal. All
 * functionality is mirrored in the web console so every prompt action is
 * accessible from both surfaces.
 */

import { promises as fs } from 'node:fs';
import { getPromptController, getPromptGitHubSyncController, getPromptConfig } from '../features/prompts/index.mjs';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.prompts.cli', { emitToStdStreams: false });

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTags(input) {
  if (input == null || input === '') return [];
  if (Array.isArray(input)) return input;
  return String(input)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseMetadata(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('Prompt metadata must be valid JSON.');
  }
}

function logJson(outputFn, data) {
  outputFn(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function formatGitHubStatus(result) {
  const lines = [];
  lines.push(`Status: ${result.status}`);
  lines.push(`Message: ${result.message}`);
  if (result.statusReport) {
    const report = result.statusReport;
    if (report.branch) {
      lines.push(`Branch: ${report.branch}`);
      lines.push(`Ahead: ${report.ahead ?? 0}, Behind: ${report.behind ?? 0}`);
    }
    const prompts = report.prompts || {};
    const staged = prompts.staged?.length ? prompts.staged.join(', ') : 'none';
    const modified = prompts.modified?.length ? prompts.modified.join(', ') : 'none';
    const conflicts = prompts.conflicts?.length ? prompts.conflicts.join(', ') : 'none';
    lines.push(`Staged prompts: ${staged}`);
    lines.push(`Modified prompts: ${modified}`);
    lines.push(`Conflicts: ${conflicts}`);
    lines.push(`Working tree clean: ${report.clean === false ? 'no' : 'yes'}`);
  }
  return lines;
}

function sendWsAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
    moduleLogger[level](message, payloadMeta);
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

function requireId(positionalArgs, flags) {
  const id = flags.id || flags.prompt || positionalArgs.shift();
  if (!id || !String(id).trim()) {
    throw new Error('Prompt id is required for this operation.');
  }
  return id;
}

function formatPrompt(record) {
  return [
    `Id: ${record.id}`,
    `Title: ${record.title}`,
    `Description: ${record.description || '(none)'}`,
    `Tags: ${record.tags?.length ? record.tags.join(', ') : 'none'}`,
    `Version: ${record.version}`,
    `Updated: ${record.updatedAt}`
  ];
}

async function loadPayloadFromFile(filePath) {
  if (!filePath) return null;
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse prompt definition file: ${error.message}`);
  }
}

export function getPromptsHelpText() {
  return [
    '/prompts list [--tags=a,b] [--limit=20] [--json]                 List prompt summaries.',
    '/prompts get <id> [--json]                                      Fetch a prompt by id.',
    '/prompts save [--id=<id>] --title="..." --body="..." [--description="..."] [--tags=a,b] [--metadata="{}"] [--file=path] [--json]  Create or update a prompt.',
    '/prompts delete <id>                                            Remove a prompt.',
    '/prompts exists <id>                                            Check if a prompt exists.',
    '/prompts search [--query=text] [--tags=a,b] [--limit=10] [--include-body=false] [--json]  Search prompts.',
    '/prompts github <status|pull|push|sync> [--repo=<path>] [--directory=prompts] [--branch=main] [--remote=origin] [--json]  Manage GitHub prompt sync.'
  ].join('\n');
}

export async function executePrompts(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput, 'info');
  const errorFn = createEmitter(wsError, 'error');

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || (positionalArgs.shift()?.toLowerCase()) || 'list';
  const jsonOutput = isTruthy(flags.json ?? flags.JSON ?? options.json);

  const controller = getPromptController();
  const actor = options.user?.username || options.currentUser?.username || options.actor || 'cli';

  moduleLogger.info('Executing prompts command.', {
    subcommand,
    jsonOutput,
    hasWebSocketOutput: typeof wsOutput === 'function',
    hasWebSocketError: typeof wsError === 'function',
    actor
  });

  try {
    switch (subcommand) {
      case 'list': {
        const limit = toInteger(flags.limit ?? flags.top ?? options.limit, undefined);
        const tags = parseTags(flags.tags ?? flags.tag ?? options.tags);
        const summaries = await controller.list({ tags, limit });

        if (jsonOutput) {
          logJson(outputFn, summaries);
        } else if (!summaries.length) {
          outputFn('No prompts found.');
        } else {
          summaries.forEach((summary) => {
            formatPrompt(summary).forEach((line) => outputFn(line));
            outputFn('');
          });
        }

        sendWsAck(wsOutput);
        moduleLogger.info('Prompts list completed.', {
          subcommand,
          count: summaries.length,
          tags,
          limit,
          jsonOutput
        });
        return { success: true, prompts: summaries };
      }

      case 'get': {
        const id = requireId(positionalArgs, flags);
        const record = await controller.get(id);

        if (jsonOutput) {
          logJson(outputFn, record);
        } else {
          formatPrompt(record).forEach((line) => outputFn(line));
          outputFn('Body:');
          outputFn(record.body);
        }

        sendWsAck(wsOutput);
        moduleLogger.info('Prompts get completed.', {
          subcommand,
          id,
          jsonOutput
        });
        return { success: true, record };
      }

      case 'github': {
        const promptsConfig = getPromptConfig();
        if (!promptsConfig.github?.enabled) {
          const message = 'Prompt GitHub sync is disabled via configuration.';
          if (jsonOutput) {
            logJson(outputFn, { success: false, error: message });
          } else {
            outputFn(message);
          }
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }

        const githubController = getPromptGitHubSyncController();
        const actionArg = (flags.action ?? positionalArgs.shift() ?? options.githubAction ?? 'status').toString().toLowerCase();
        const overrides = {
          repoPath: flags.repo ?? flags.repoPath ?? options.repoPath ?? promptsConfig.github?.repoPath,
          directory: flags.directory ?? flags.dir ?? options.directory ?? promptsConfig.github?.directory,
          branch: flags.branch ?? options.branch ?? promptsConfig.github?.branch,
          remote: flags.remote ?? options.remote ?? promptsConfig.github?.remote,
          commitMessage: flags['commit-message'] ?? flags.commitMessage ?? options.commitMessage ?? promptsConfig.github?.commitMessage
        };

        if (!overrides.repoPath) {
          const message = 'Prompt GitHub sync requires repoPath to be configured.';
          if (jsonOutput) {
            logJson(outputFn, { success: false, error: message });
          } else {
            outputFn(message);
          }
          sendWsAck(wsOutput);
          return { success: false, error: message, handled: true };
        }

        let result;
        switch (actionArg) {
          case 'status':
            result = await githubController.status(overrides);
            break;
          case 'pull':
            result = await githubController.pull(overrides);
            break;
          case 'push':
            result = await githubController.push(overrides);
            break;
          case 'sync':
            result = await githubController.sync(overrides);
            break;
          default:
            throw new Error(`Unknown /prompts github action "${actionArg}". Use status, pull, push, or sync.`);
        }

        if (jsonOutput) {
          logJson(outputFn, result);
        } else {
          formatGitHubStatus(result).forEach((line) => outputFn(line));
        }

        sendWsAck(wsOutput);
        moduleLogger.info('Prompts GitHub action completed.', {
          subcommand,
          action: actionArg,
          status: result.status,
          jsonOutput
        });
        return { success: result.status === 'ok', result };
      }

      case 'save': {
        let payload = await loadPayloadFromFile(flags.file || flags.path || options.file);
        if (!payload) {
          const title = flags.title ?? options.title;
          const body = flags.body ?? options.body;
          if (!title || !String(title).trim()) {
            throw new Error('Prompt title is required.');
          }
          if (!body || !String(body).trim()) {
            throw new Error('Prompt body is required.');
          }

          payload = {
            id: flags.id ?? flags.prompt ?? options.id,
            title: String(title).trim(),
            body: String(body).trim(),
            description: flags.description ?? options.description ?? '',
            tags: parseTags(flags.tags ?? options.tags),
            metadata: parseMetadata(flags.metadata ?? options.metadata)
          };
        }

        const record = await controller.save(payload, { actor });

        if (jsonOutput) {
          logJson(outputFn, record);
        } else {
          outputFn('Prompt saved successfully.');
          formatPrompt(record).forEach((line) => outputFn(line));
        }

        sendWsAck(wsOutput);
        moduleLogger.info('Prompts save completed.', {
          subcommand,
          id: record.id,
          actor,
          jsonOutput
        });
        return { success: true, record };
      }

      case 'delete':
      case 'remove': {
        const id = requireId(positionalArgs, flags);
        await controller.remove(id, { actor });
        if (!jsonOutput) {
          outputFn(`Prompt "${id}" deleted.`);
        }
        sendWsAck(wsOutput);
        moduleLogger.warn('Prompt deleted.', {
          subcommand,
          id,
          actor,
          jsonOutput
        });
        return { success: true };
      }

      case 'exists': {
        const id = requireId(positionalArgs, flags);
        const exists = await controller.exists(id);
        if (jsonOutput) {
          logJson(outputFn, { id, exists });
        } else {
          outputFn(`Prompt "${id}" ${exists ? 'exists' : 'does not exist'}.`);
        }
        sendWsAck(wsOutput);
        moduleLogger.info('Prompts exists completed.', {
          subcommand,
          id,
          exists,
          jsonOutput
        });
        return { success: true, exists };
      }

      case 'search': {
        const query = flags.query ?? options.query ?? positionalArgs.join(' ');
        const tags = parseTags(flags.tags ?? options.tags);
        const limit = toInteger(flags.limit ?? options.limit, undefined);
        const includeBody = flags['include-body'] !== undefined
          ? isTruthy(flags['include-body'])
          : flags.body !== undefined
            ? isTruthy(flags.body)
            : true;

        const results = await controller.search({ query, tags, limit, includeBody });

        if (jsonOutput) {
          logJson(outputFn, results);
        } else if (!results.length) {
          outputFn('No prompts matched your search.');
        } else {
          results.forEach((record) => {
            formatPrompt(record).forEach((line) => outputFn(line));
            if (includeBody && record.body) {
              outputFn('Body:');
              outputFn(record.body);
            }
            outputFn('');
          });
        }

        sendWsAck(wsOutput);
        moduleLogger.info('Prompts search completed.', {
          subcommand,
          query,
          tags,
          limit,
          includeBody,
          count: results.length,
          jsonOutput
        });
        return { success: true, results };
      }

      default: {
        const errorMsg = `Unknown prompts action: ${subcommand}. See /prompts help for supported subcommands.`;
        errorFn(errorMsg, { code: 'unknown_prompts_action', subcommand });
        sendWsAck(wsOutput);
        return { success: false, error: errorMsg, handled: true };
      }
    }
  } catch (error) {
    moduleLogger.error('Prompts command failed.', {
      subcommand,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    const errResult = handleCliError(
      error,
      ErrorTypes.UNKNOWN,
      { command: `prompts ${subcommand}` },
      errorFn
    );
    sendWsAck(wsOutput);
    return { ...errResult, handled: true };
  }
}
