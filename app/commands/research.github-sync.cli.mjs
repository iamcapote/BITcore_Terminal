import { githubResearchSync } from '../features/research/github-sync/service.mjs';
import { handleCliError, ErrorTypes, logCommandStart, logCommandSuccess } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const VALID_ACTIONS = new Set(['verify', 'pull', 'list', 'push', 'upload', 'fetch']);

const moduleLogger = createModuleLogger('commands.research.github-sync.cli', { emitToStdStreams: false });

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
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

export function getGithubSyncHelpText() {
  return [
    '/github-sync verify [--repo=<local path>]                      Validate access to the configured research repository.',
    '/github-sync pull [--repo=<local path>] [--path=subdir]        List files under the research root (alias: list).',
    '/github-sync push --repo=<local path> --files=a.md,b.md [--branch=name] [--message="Commit"]',
    '/github-sync upload --repo=<local path> (--files=a.md|--path=repo/file.md --content="...") [--branch=name] [--message="Commit"]',
    '/github-sync fetch --path=repo/file.md [--ref=sha]             Fetch a single file and print metadata.'
  ].join('\n');
}

export async function executeGithubSync(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput, 'info');
  const errorFn = createEmitter(wsError, 'error');

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const actionInput = (declaredAction || positionalArgs.shift() || 'verify').toLowerCase();
  const action = actionInput === 'pull' ? 'list' : actionInput;

  let repo = flags.repo ?? options.repo ?? null;
  if (!repo && VALID_ACTIONS.has(action) && positionalArgs.length && action !== 'list') {
    repo = positionalArgs.shift();
  }
  const targetPath = flags.path ?? flags.target ?? options.path ?? null;
  const content = flags.content ?? options.content ?? null;
  const ref = flags.ref ?? options.ref ?? null;
  const branch = flags.branch ?? options.branch ?? null;
  const message = flags.message ?? flags.msg ?? options.message ?? null;
  const files = parseList(flags.files ?? flags.file ?? positionalArgs);

  logCommandStart(`github-sync ${action}`, { repo, files });
  moduleLogger.info('Executing github-sync command.', {
    action,
    repo: repo || null,
    files: files.length,
    hasWebSocketOutput: typeof wsOutput === 'function',
    hasWebSocketError: typeof wsError === 'function'
  });

  if (!VALID_ACTIONS.has(action)) {
    const message = `Unknown action "${action}". Use verify|pull|list|push|upload|fetch.`;
  handleCliError(message, ErrorTypes.INPUT_VALIDATION, { command: 'github-sync' });
    errorFn(message, { code: 'unknown_github_sync_action', action });
    moduleLogger.warn('Github-sync command received unknown action.', { action });
    sendWsAck(wsOutput);
    return { success: false };
  }

  try {
    const payload = {
      action,
      repo: repo ? String(repo).trim() : undefined,
      files: files.length ? files : undefined,
      path: targetPath,
      content,
      branch,
      message,
      ref
    };

    moduleLogger.debug('Github-sync payload prepared.', payload);
    const result = await githubResearchSync(payload);
    if (!result?.success) {
      const message = result?.message || 'GitHub sync failed.';
  handleCliError(message, ErrorTypes.SERVER, { command: `github-sync ${action}` });
      if (result?.details) {
        errorFn(typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2), { action, details: result.details });
      }
      moduleLogger.error('Github-sync operation failed.', {
        action,
        repo: payload.repo ?? null,
        branch: payload.branch ?? null,
        message,
        details: result?.details ?? null
      });
      sendWsAck(wsOutput);
      return { success: false, result };
    }

    outputFn(result.message || 'Operation complete.', {
      action,
      repo: payload.repo ?? null,
      branch: payload.branch ?? null
    });
    if (result.details) {
      if (action === 'list' && result.details?.entries) {
        const entries = result.details.entries;
        entries.forEach((entry) => {
          const size = entry.size != null ? ` (${entry.size} bytes)` : '';
          outputFn(`${entry.type === 'dir' ? '📁' : '📄'} ${entry.name}${size}`, {
            action,
            entry: entry.name,
            type: entry.type,
            size: entry.size ?? null
          });
        });
      } else if (typeof result.details === 'string') {
        outputFn(result.details, { action, detailType: 'string' });
      } else {
        outputFn(JSON.stringify(result.details, null, 2), { action, detailType: 'json' });
      }
    }
    sendWsAck(wsOutput);
    logCommandSuccess(`github-sync ${action}`, result);
    moduleLogger.info('Github-sync operation completed.', {
      action,
      repo: payload.repo ?? null,
      branch: payload.branch ?? null,
      filesProcessed: Array.isArray(payload.files) ? payload.files.length : null,
      success: true
    });
    return { success: true, result };
  } catch (error) {
    moduleLogger.error('Github-sync command failed.', {
      action,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    });
  handleCliError(error, ErrorTypes.UNKNOWN, { command: `github-sync ${action}` });
    errorFn(error instanceof Error ? error.message : String(error), { action });
    sendWsAck(wsOutput);
    return { success: false, error };
  }
}
