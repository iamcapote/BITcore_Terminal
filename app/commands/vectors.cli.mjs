/**
 * Vectors CLI Command
 * Why: Provide command-plane parity for vector admin inspect and mock document process workflows.
 * What: Supports status, accepts, process, and help subcommands.
 * How: Delegates operations to the vector admin controller and emits normalized output across terminal/web channels.
 */

import { getVectorAdminController } from '../features/ai/vector-admin/index.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.vectors.cli', { emitToStdStreams: false });

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

export function getVectorsHelpText() {
  return [
    '/vectors status [--backend=name] [--json]                                 Show vector store overview.',
    '/vectors accepts [--json]                                                 Show accepted MIME types for ingestion.',
    '/vectors process --index=name --file=doc.md --mime=text/markdown [--size=4096] [--json]  Run mock document ingestion.',
    '/vectors help                                                             Show this help message.',
  ].join('\n');
}

export async function executeVectors(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput || options.output, 'info');
  const errorFn = createEmitter(wsError || options.error, 'error');
  const controller = getVectorAdminController();

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || positionalArgs.shift()?.toLowerCase() || 'status';
  const wantsJson = parseBoolean(flags.json, false);

  try {
    switch (subcommand) {
      case 'status': {
        const snapshot = await controller.getOverview({ backend: flags.backend });
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Vector Store Overview ---');
          outputFn(`Mode: ${snapshot.feature.mode}`);
          outputFn(`Stores: ${snapshot.stores.length}`);
          snapshot.stores.forEach((store) => {
            outputFn(`${store.index} · ${store.backend} · ${store.dimension}d · ${store.size} · ${store.status}`);
          });
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'accepts': {
        const payload = await controller.getAcceptedMimes();
        if (wantsJson) {
          outputFn(JSON.stringify(payload, null, 2));
        } else {
          outputFn('--- Accepted MIME Types ---');
          payload.acceptedMimes.forEach((mime) => outputFn(mime));
        }
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'process': {
        const index = typeof flags.index === 'string' ? flags.index.trim() : '';
        const filename = typeof flags.file === 'string' ? flags.file.trim() : '';
        const mimeType = typeof flags.mime === 'string' ? flags.mime.trim() : '';
        const sizeBytes = typeof flags.size === 'string' ? Number.parseInt(flags.size, 10) : 0;

        if (!index || !filename || !mimeType) {
          throw new Error('ValidationError: --index, --file, and --mime are required for /vectors process.');
        }

        const result = await controller.processDocument({ index, filename, mimeType, sizeBytes });
        if (wantsJson) {
          outputFn(JSON.stringify(result, null, 2));
        } else {
          outputFn(result.success ? 'Process accepted.' : 'Process rejected.');
          outputFn(`${result.reason}`);
        }
        sendAck(wsOutput);
        return { success: result.success, result };
      }

      case 'help': {
        getVectorsHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: true, handled: true };
      }

      default: {
        const message = `Unknown vectors subcommand: ${subcommand}`;
        errorFn(message, { code: 'unknown_vectors_subcommand' });
        getVectorsHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: false, handled: true, error: message };
      }
    }
  } catch (error) {
    const message = error?.message || String(error);
    errorFn(message, { code: 'vectors_command_failure' });
    sendAck(wsOutput);
    return { success: false, error: message };
  }
}
