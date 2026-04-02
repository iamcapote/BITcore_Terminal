/**
 * Why: Provide CLI parity for the notification center so operators can inspect and manage alerts from the terminal.
 * What: Supports list/enqueue/dismiss/dismiss-all/clear-history subcommands with --json output and severity/category filters.
 * How: Delegates to notification-center.service; returns structured payloads for WebSocket and tty surfaces.
 */

import { getNotificationCenterService } from '../infrastructure/notification-center.service.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.notify.cli', { emitToStdStreams: false });

function stringifyMessage(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value == null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return '[unserializable payload]'; }
  }
  return String(value);
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = stringifyMessage(value);
    moduleLogger[level](message, meta || null);
    if (target) { target(value); return; }
    stream.write(`${message}\n`);
  };
}

function sendAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  return TRUE_VALUES.has(String(value).trim().toLowerCase()) ? true
    : new Set(['0', 'false', 'no', 'off']).has(String(value).trim().toLowerCase()) ? false
    : fallback;
}

function formatRecord(n) {
  const desc = n.description ? ` — ${n.description}` : '';
  return `[${n.severity.toUpperCase()}] ${n.title}${desc} (${n.category} · ${n.id})`;
}

export function getNotifyHelpText() {
  return [
    '/notify list [--severity=info|success|warning|error] [--category=...] [--active] [--json]  List notifications.',
    '/notify add <title> [--severity=info] [--category=general] [--desc=<text>] [--json]         Enqueue a notification.',
    '/notify dismiss <id> [--json]                          Dismiss one notification by id.',
    '/notify dismiss-all [--json]                           Dismiss all active notifications.',
    '/notify clear [--json]                                 Clear notification history.',
    '/notify help                                           Show this help message.',
  ].join('\n');
}

export async function executeNotify(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput || options.output, 'info');
  const errorFn = createEmitter(wsError || options.error, 'error');
  const service = getNotificationCenterService();

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || positionalArgs.shift()?.toLowerCase() || 'list';
  const wantsJson = parseBoolean(flags.json, false);

  try {
    switch (subcommand) {
      case 'list': {
        const filter = {};
        if (flags.severity) filter.severity = String(flags.severity);
        if (flags.category) filter.category = String(flags.category);
        if (parseBoolean(flags.active, false)) filter.dismissed = false;
        const snapshot = service.list(filter);
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn(`--- Notifications (${snapshot.queue.length} active / ${snapshot.history.length} total) ---`);
          if (snapshot.queue.length === 0) {
            outputFn('No active notifications.');
          } else {
            snapshot.queue.forEach((n) => outputFn(formatRecord(n)));
          }
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'add': {
        const title = positionalArgs.join(' ').trim();
        if (!title) throw new Error('ValidationError: title is required for /notify add.');
        const payload = {
          title,
          severity: typeof flags.severity === 'string' ? flags.severity.trim() : 'info',
          category: typeof flags.category === 'string' ? flags.category.trim() : 'general',
          description: typeof flags.desc === 'string' ? flags.desc.trim() : undefined,
          source: 'cli',
        };
        const record = service.enqueue(payload);
        outputFn(wantsJson ? JSON.stringify(record, null, 2) : `Notification enqueued: ${record.id} [${record.severity}] ${record.title}`);
        sendAck(wsOutput);
        return { success: true, record };
      }

      case 'dismiss': {
        const id = positionalArgs.shift() || '';
        if (!id) throw new Error('ValidationError: notification id is required for /notify dismiss.');
        const result = service.dismiss(id);
        outputFn(wantsJson ? JSON.stringify(result, null, 2) : `Dismissed: ${result.id}`);
        sendAck(wsOutput);
        return { success: true, result };
      }

      case 'dismiss-all': {
        const result = service.dismissAll();
        outputFn(wantsJson ? JSON.stringify(result, null, 2) : `Dismissed ${result.dismissed} notification(s).`);
        sendAck(wsOutput);
        return { success: true, result };
      }

      case 'clear': {
        const result = service.clearHistory();
        outputFn(wantsJson ? JSON.stringify(result, null, 2) : `Cleared ${result.cleared} history record(s).`);
        sendAck(wsOutput);
        return { success: true, result };
      }

      case 'help': {
        getNotifyHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: true, handled: true };
      }

      default: {
        const message = `Unknown notify subcommand: ${subcommand}`;
        errorFn(message, { code: 'unknown_notify_subcommand' });
        getNotifyHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: false, handled: true, error: message };
      }
    }
  } catch (error) {
    const message = error?.message || String(error);
    errorFn(message, { code: 'notify_command_failure' });
    sendAck(wsOutput);
    return { success: false, error: message };
  }
}
