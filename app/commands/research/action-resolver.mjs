/**
 * Why: Resolve research command actions consistently across CLI and WebSocket surfaces.
 * What: Normalizes positional arguments and flags into a canonical action tuple.
 * How: Recognizes supported subcommands, falls back to run, and preserves remaining arguments.
 */

const SUPPORTED_ACTIONS = Object.freeze(['run', 'list', 'download', 'preferences']);

const ACTION_ALIASES = Object.freeze({
  prefs: 'preferences',
  preference: 'preferences',
  default: 'preferences',
  defaults: 'preferences'
});

function normalizeAction(value, fallback = 'run') {
  if (!value) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  const canonical = ACTION_ALIASES[normalized] || normalized;
  return SUPPORTED_ACTIONS.includes(canonical) ? canonical : fallback;
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

export function isResearchPreferencesAction(action) {
  return action === 'preferences';
}

export function getSupportedResearchActions() {
  return [...SUPPORTED_ACTIONS];
}
