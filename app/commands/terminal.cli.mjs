/**
 * Terminal CLI Command
 * Why: Manage terminal preference toggles directly from the command plane.
 * What: Supports listing, updating, and resetting persisted operator preferences.
 * How: Delegates to the shared preferences service so web UI and CLI stay in sync.
 */

import {
  getTerminalPreferences,
  updateTerminalPreferences,
  resetTerminalPreferences,
} from '../features/preferences/index.mjs';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.terminal.cli', { emitToStdStreams: false });

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const BOOLEAN_FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

const WIDGET_FLAG_MAP = Object.freeze({
  'telemetry-panel': 'telemetryPanel',
  'memory-panel': 'memoryPanel',
  'model-browser': 'modelBrowser',
  'telemetry-indicator': 'telemetryIndicator',
  'log-indicator': 'logIndicator',
});

const TERMINAL_FLAG_MAP = Object.freeze({
  'retain-history': 'retainHistory',
  'auto-scroll': 'autoScroll',
});

function stringifyMessage(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[unserializable payload]';
    }
  }
  return String(value);
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = stringifyMessage(value);
    const payloadMeta = meta || (typeof value === 'object' && value !== null ? { payload: value } : null);
    moduleLogger[level](message, payloadMeta);
    if (target) {
      target(value);
    } else {
      stream.write(`${message}\n`);
    }
  };
}

function parseBooleanFlag(value) {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return false;
  }
  return undefined;
}

function buildPatchFromFlags(flags = {}) {
  const patch = {};
  let hasUpdates = false;

  for (const [flag, key] of Object.entries(WIDGET_FLAG_MAP)) {
    if (flag in flags) {
      const parsed = parseBooleanFlag(flags[flag]);
      if (parsed !== undefined) {
        patch.widgets ||= {};
        patch.widgets[key] = parsed;
        hasUpdates = true;
      }
    }
  }

  for (const [flag, key] of Object.entries(TERMINAL_FLAG_MAP)) {
    if (flag in flags) {
      const parsed = parseBooleanFlag(flags[flag]);
      if (parsed !== undefined) {
        patch.terminal ||= {};
        patch.terminal[key] = parsed;
        hasUpdates = true;
      }
    }
  }

  return hasUpdates ? patch : null;
}

function sendAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    const ack = { type: 'output', data: '', keepDisabled: false };
    moduleLogger.debug('Sending WebSocket acknowledgement.', ack);
    wsOutput(ack);
  }
}

function formatPreferences(preferences) {
  const lines = ['--- Terminal Preferences ---'];
  lines.push('Widgets:');
  lines.push(`  Telemetry Panel: ${preferences.widgets.telemetryPanel ? 'enabled' : 'disabled'}`);
  lines.push(`  Memory Panel: ${preferences.widgets.memoryPanel ? 'enabled' : 'disabled'}`);
  lines.push(`  Model Browser: ${preferences.widgets.modelBrowser ? 'enabled' : 'disabled'}`);
  lines.push(`  Telemetry Indicator: ${preferences.widgets.telemetryIndicator ? 'enabled' : 'disabled'}`);
  lines.push(`  Log Indicator: ${preferences.widgets.logIndicator ? 'enabled' : 'disabled'}`);
  lines.push('Terminal:');
  lines.push(`  Retain History: ${preferences.terminal.retainHistory ? 'enabled' : 'disabled'}`);
  lines.push(`  Auto Scroll: ${preferences.terminal.autoScroll ? 'enabled' : 'disabled'}`);
  if (preferences.updatedAt) {
    const timestamp = new Date(preferences.updatedAt).toISOString();
    lines.push(`Updated: ${timestamp}`);
  }
  return lines;
}

export function getTerminalHelpText() {
  return [
    '/terminal prefs [--telemetry-panel=true|false] [--memory-panel=true|false] [--model-browser=true|false] [--telemetry-indicator=true|false] [--log-indicator=true|false] [--retain-history=true|false] [--auto-scroll=true|false] [--json]  View or update terminal preferences.',
    '/terminal prefs --reset  Reset terminal preferences to defaults.',
    '/terminal reset  Alias for resetting terminal preferences.',
  ].join('\n');
}

export async function executeTerminal(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput, 'info');
  const errorFn = createEmitter(wsError, 'error');

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || positionalArgs.shift()?.toLowerCase() || 'prefs';
  const wantsJson = parseBooleanFlag(flags.json);

  moduleLogger.info('Executing terminal command.', {
    subcommand,
    wantsJson,
    hasWebSocketOutput: typeof wsOutput === 'function'
  });

  try {
    switch (subcommand) {
      case 'prefs':
      case 'preferences': {
        const shouldReset = parseBooleanFlag(flags.reset);
        let preferences;
        let action = 'read';

        if (shouldReset) {
          preferences = await resetTerminalPreferences();
          action = 'reset';
        } else {
          const patch = buildPatchFromFlags(flags);
          if (patch) {
            preferences = await updateTerminalPreferences(patch);
            action = 'update';
          } else {
            preferences = await getTerminalPreferences();
          }
        }

        if (wantsJson) {
          outputFn(JSON.stringify(preferences, null, 2), { format: 'json', subcommand: 'prefs', action });
        } else {
          outputFn('--- Terminal Preferences ---', { subcommand: 'prefs', action });
          formatPreferences(preferences).slice(1).forEach((line) => outputFn(line));
        }

        sendAck(wsOutput);
        moduleLogger.info('Terminal preferences processed.', {
          subcommand: 'prefs',
          action,
          wantsJson
        });
        return { success: true, preferences };
      }

      case 'reset': {
        const preferences = await resetTerminalPreferences();
        if (wantsJson) {
          outputFn(JSON.stringify(preferences, null, 2), { format: 'json', subcommand: 'reset' });
        } else {
          outputFn('Terminal preferences reset to defaults.', { subcommand: 'reset' });
          formatPreferences(preferences).forEach((line) => outputFn(line));
        }
        sendAck(wsOutput);
        moduleLogger.info('Terminal preferences reset via alias.', { wantsJson });
        return { success: true, preferences };
      }

      case 'help': {
        getTerminalHelpText().split('\n').forEach((line) => outputFn(line, { subcommand: 'help' }));
        sendAck(wsOutput);
        return { success: true, handled: true };
      }

      default: {
        const message = `Unknown terminal subcommand: ${subcommand}`;
        errorFn(message, { code: 'unknown_terminal_subcommand', subcommand });
        getTerminalHelpText().split('\n').forEach((line) => outputFn(line, { subcommand: 'help' }));
        sendAck(wsOutput);
        return { success: false, error: message, handled: true };
      }
    }
  } catch (error) {
    const errorType = error?.message?.startsWith('ValidationError')
      ? ErrorTypes.INPUT_VALIDATION
      : ErrorTypes.UNKNOWN;
    handleCliError(error, errorType, { command: 'terminal' });
    moduleLogger.error('Terminal command failed.', {
      subcommand,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    errorFn(error.message ?? String(error), { code: 'terminal_command_failure', subcommand });
    sendAck(wsOutput);
    return { success: false, error: error.message ?? String(error) };
  }
}