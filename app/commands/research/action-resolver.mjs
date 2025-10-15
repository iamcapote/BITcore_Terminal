/**
 * Why: Resolve research command actions consistently across CLI and WebSocket surfaces.
 * What: Normalizes positional arguments and flags into a canonical action tuple.
 * How: Recognizes supported subcommands, falls back to run, and preserves remaining arguments.
 */

const SUPPORTED_ACTIONS = Object.freeze(['run', 'list', 'download']);

function normalizeAction(value, fallback = 'run') {
  if (!value) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return SUPPORTED_ACTIONS.includes(normalized) ? normalized : fallback;
}

export function resolveResearchAction({ positionalArgs = [], flags = {}, defaultAction = 'run' } = {}) {
  const normalizedFlags = flags ?? {};
  const flagAction = normalizeAction(normalizedFlags.action, null) || normalizeAction(normalizedFlags.subcommand, null);

  if (flagAction && flagAction !== 'run') {
    return {
      action: flagAction,
      positionalArgs: Array.isArray(positionalArgs) ? [...positionalArgs] : [],
    };
  }

  if (!Array.isArray(positionalArgs) || positionalArgs.length === 0) {
    return {
      action: normalizeAction(flagAction || defaultAction, 'run'),
      positionalArgs: [],
    };
  }

  const [first, ...rest] = positionalArgs;
  const candidate = normalizeAction(first, null);

  if (candidate && candidate !== 'run') {
    return { action: candidate, positionalArgs: rest };
  }

  return {
    action: normalizeAction(flagAction || defaultAction, 'run'),
    positionalArgs: [...positionalArgs],
  };
}

export function isResearchArchiveAction(action) {
  return action === 'list' || action === 'download';
}

export function getSupportedResearchActions() {
  return [...SUPPORTED_ACTIONS];
}
