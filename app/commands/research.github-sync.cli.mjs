import { githubResearchSync } from '../features/research/github-sync/service.mjs';
import { handleCliError, ErrorTypes, logCommandStart, logCommandSuccess } from '../utils/cli-error-handler.mjs';

const VALID_ACTIONS = new Set(['verify', 'pull', 'push', 'upload']);

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
    '/github-sync verify --repo=<owner/repo|local path>             Validate access to the configured repository.',
    '/github-sync pull --repo=<path>                                Pull latest changes into the working directory.',
    '/github-sync push --repo=<path>                                Push local commits to the remote.',
    '/github-sync upload --repo=<path> --files=a.md,b.md            Add files, commit, and push in a single step.'
  ].join('\n');
}

export async function executeGithubSync(options = {}, wsOutput, wsError) {
  const outputFn = typeof wsOutput === 'function' ? wsOutput : console.log;
  const errorFn = typeof wsError === 'function' ? wsError : console.error;

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const action = (declaredAction || positionalArgs.shift() || 'verify').toLowerCase();
  const repo = flags.repo ?? flags.path ?? positionalArgs.shift();
  const files = parseList(flags.files ?? flags.file ?? positionalArgs);

  logCommandStart(`github-sync ${action}`, { repo, files });

  if (!VALID_ACTIONS.has(action)) {
    handleCliError(`Unknown action "${action}". Use verify|pull|push|upload.`, ErrorTypes.INPUT_VALIDATION, { command: 'github-sync' });
    return { success: false };
  }

  if (!repo || !String(repo).trim()) {
    handleCliError('Repository path or remote URL is required. Provide --repo=<value>.', ErrorTypes.INPUT_VALIDATION, { command: 'github-sync' });
    return { success: false };
  }

  try {
    const payload = { action, repo: String(repo).trim() };
    if (action === 'upload') {
      if (!files.length) {
        handleCliError('Upload requires --files=<a.md,b.md> or positional file list.', ErrorTypes.INPUT_VALIDATION, { command: 'github-sync' });
        return { success: false };
      }
      payload.files = files;
    }

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
      outputFn(typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2));
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
