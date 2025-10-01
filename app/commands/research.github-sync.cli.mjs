import { githubResearchSync } from '../features/research/github-sync/service.mjs';
import { handleCliError, ErrorTypes, logCommandStart, logCommandSuccess } from '../utils/cli-error-handler.mjs';

const VALID_ACTIONS = new Set(['verify', 'pull', 'list', 'push', 'upload', 'fetch']);

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
  const outputFn = typeof wsOutput === 'function' ? wsOutput : console.log;
  const errorFn = typeof wsError === 'function' ? wsError : console.error;

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

  if (!VALID_ACTIONS.has(action)) {
    handleCliError(`Unknown action "${action}". Use verify|pull|list|push|upload|fetch.`, ErrorTypes.INPUT_VALIDATION, { command: 'github-sync' });
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

    const result = await githubResearchSync(payload);
    if (!result?.success) {
      handleCliError(result?.message || 'GitHub sync failed.', ErrorTypes.SERVER, { command: `github-sync ${action}` });
      if (result?.details) {
        errorFn(typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2));
      }
      return { success: false, result };
    }

    outputFn(result.message || 'Operation complete.');
    if (result.details) {
      if (action === 'list' && result.details?.entries) {
        const entries = result.details.entries;
        entries.forEach((entry) => {
          const size = entry.size != null ? ` (${entry.size} bytes)` : '';
          outputFn(`${entry.type === 'dir' ? '📁' : '📄'} ${entry.name}${size}`);
        });
      } else if (typeof result.details === 'string') {
        outputFn(result.details);
      } else {
        outputFn(JSON.stringify(result.details, null, 2));
      }
    }
    sendWsAck(wsOutput);
    logCommandSuccess(`github-sync ${action}`, result);
    return { success: true, result };
  } catch (error) {
    handleCliError(error, ErrorTypes.UNKNOWN, { command: `github-sync ${action}` });
    if (errorFn !== console.error) {
      errorFn(error instanceof Error ? error.message : String(error));
    }
    return { success: false, error };
  }
}
