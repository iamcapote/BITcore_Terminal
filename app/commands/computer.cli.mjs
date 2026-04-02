/**
 * Computer CLI Command
 * Why: Provide CLI parity for machine-runtime controls surfaced in Nova.
 * What: Supports status/set/help subcommands for shell interface and SSH execution fields.
 * How: Delegates to the computer controller and prints either concise text or JSON snapshots.
 */

import { getComputerController } from '../features/tools/index.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.computer.cli', { emitToStdStreams: false });

function stringifyMessage(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
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
    moduleLogger[level](message, meta || null);
    if (target) {
      target(value);
      return;
    }
    stream.write(`${message}\n`);
  };
}

function sendAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseShellInterface(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['local', 'ssh'].includes(normalized) ? normalized : fallback;
}

export function getComputerHelpText() {
  return [
    '/computer status [--json]                               Show machine runtime snapshot.',
    '/computer set [--shellInterface=local|ssh] [--codeExecSshAddr=host] [--codeExecSshPort=55022] [--codeExecSshUser=root] [--codeExecSshEnabled=true|false] [--json]',
    '/computer help                                          Show this help message.',
  ].join('\n');
}

function printRuntime(outputFn, snapshot) {
  const runtime = snapshot.runtime;
  outputFn('--- Computer Runtime ---');
  outputFn(`shellInterface: ${runtime.shellInterface}`);
  outputFn(`codeExecSshEnabled: ${runtime.codeExecSshEnabled}`);
  outputFn(`codeExecSshAddr: ${runtime.codeExecSshAddr}`);
  outputFn(`codeExecSshPort: ${runtime.codeExecSshPort}`);
  outputFn(`codeExecSshUser: ${runtime.codeExecSshUser}`);
  outputFn(`codeExecSshHasPassword: ${runtime.codeExecSshHasPassword}`);
}

export async function executeComputer(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput || options.output, 'info');
  const errorFn = createEmitter(wsError || options.error, 'error');
  const controller = getComputerController();
  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || positionalArgs.shift()?.toLowerCase() || 'status';
  const wantsJson = parseBoolean(flags.json, false);

  try {
    switch (subcommand) {
      case 'status': {
        const snapshot = await controller.getRuntime();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          printRuntime(outputFn, snapshot);
          outputFn(`Updated: ${snapshot.updatedAt}`);
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'set': {
        const patch = {};
        const shellInterface = parseShellInterface(flags.shellInterface, null);
        if (shellInterface) patch.shellInterface = shellInterface;

        if (Object.prototype.hasOwnProperty.call(flags, 'codeExecSshEnabled')) {
          patch.codeExecSshEnabled = parseBoolean(flags.codeExecSshEnabled, false);
        }
        if (typeof flags.codeExecSshAddr === 'string') {
          patch.codeExecSshAddr = flags.codeExecSshAddr;
        }
        if (Object.prototype.hasOwnProperty.call(flags, 'codeExecSshPort')) {
          patch.codeExecSshPort = parseInteger(flags.codeExecSshPort, NaN);
        }
        if (typeof flags.codeExecSshUser === 'string') {
          patch.codeExecSshUser = flags.codeExecSshUser;
        }
        if (typeof flags.codeExecSshPass === 'string') {
          patch.codeExecSshPass = flags.codeExecSshPass;
        }

        if (Object.keys(patch).length === 0) {
          throw new Error('ValidationError: no runtime fields supplied.');
        }

        const snapshot = await controller.patchRuntime(patch);
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('Computer runtime updated.');
          printRuntime(outputFn, snapshot);
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'help': {
        getComputerHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: true, handled: true };
      }

      default: {
        const message = `Unknown computer subcommand: ${subcommand}`;
        errorFn(message, { code: 'unknown_computer_subcommand' });
        getComputerHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: false, handled: true, error: message };
      }
    }
  } catch (error) {
    const message = error?.message || String(error);
    errorFn(message, { code: 'computer_command_failure' });
    sendAck(wsOutput);
    return { success: false, error: message };
  }
}
