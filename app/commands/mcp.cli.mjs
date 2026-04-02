/**
 * MCP CLI Command
 * Why: Provide CLI parity for MCP server registry controls available in the web GUI.
 * What: Supports status/servers/tools/toggle/reconnect/help subcommands.
 * How: Calls the MCP controller, normalizes output, and returns machine-readable payloads when requested.
 */

import { getMcpController } from '../features/tools/index.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.mcp.cli', { emitToStdStreams: false });

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

function requireServerId(positionalArgs) {
  const serverId = typeof positionalArgs?.[0] === 'string' ? positionalArgs[0].trim() : '';
  if (!serverId) {
    throw new Error('ValidationError: server id is required.');
  }
  return serverId;
}

export function getMcpHelpText() {
  return [
    '/mcp status [--json]                                  Show MCP registry summary.',
    '/mcp servers [--json]                                 List MCP servers.',
    '/mcp tools <serverId> [--json]                        List tools for one MCP server.',
    '/mcp toggle <serverId> [--enabled=true|false] [--json] Toggle one server online/offline.',
    '/mcp reconnect <serverId> [--json]                    Reconnect one MCP server.',
    '/mcp oauth-status <serverId> [--json]                 Show OAuth lifecycle status for one server.',
    '/mcp oauth-initiate <serverId> [--json]               Start OAuth reconnect flow for one server.',
    '/mcp oauth-complete <serverId> --code=<code> --state=<state> [--json]  Complete OAuth callback.',
    '/mcp oauth-disconnect <serverId> [--json]             Clear OAuth token-state for one server.',
    '/mcp help                                             Show this help message.',
  ].join('\n');
}

function printServers(outputFn, servers) {
  outputFn('--- MCP Servers ---');
  servers.forEach((server) => {
    outputFn(`${server.id} · ${server.name} · ${server.status} · ${server.transport} · tools ${server.endpoints.length}`);
  });
}

export async function executeMcp(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput || options.output, 'info');
  const errorFn = createEmitter(wsError || options.error, 'error');
  const controller = getMcpController();
  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || positionalArgs.shift()?.toLowerCase() || 'status';
  const wantsJson = parseBoolean(flags.json, false);

  try {
    switch (subcommand) {
      case 'status':
      case 'servers': {
        const snapshot = await controller.listServers();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          printServers(outputFn, snapshot.servers);
          outputFn(`Updated: ${snapshot.updatedAt}`);
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'tools': {
        const serverId = requireServerId(positionalArgs);
        const payload = await controller.listTools(serverId);
        if (wantsJson) {
          outputFn(JSON.stringify(payload, null, 2));
        } else {
          outputFn(`--- MCP Tools (${payload.server.name}) ---`);
          payload.tools.forEach((tool) => outputFn(`${tool.name}`));
        }
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'toggle': {
        const serverId = requireServerId(positionalArgs);
        const enabled = parseBoolean(flags.enabled, true);
        const payload = await controller.toggleServer(serverId, { enabled });
        outputFn(wantsJson ? JSON.stringify(payload, null, 2) : `Server ${payload.server.id} is now ${payload.server.status}.`);
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'reconnect': {
        const serverId = requireServerId(positionalArgs);
        const payload = await controller.reconnectServer(serverId);
        outputFn(wantsJson ? JSON.stringify(payload, null, 2) : `Server ${payload.server.id} reconnected.`);
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'oauth-status': {
        const serverId = requireServerId(positionalArgs);
        const payload = await controller.getOAuthState(serverId);
        if (wantsJson) {
          outputFn(JSON.stringify(payload, null, 2));
        } else {
          outputFn(`OAuth status for ${payload.serverId}: ${payload.oauth.status}`);
        }
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'oauth-initiate': {
        const serverId = requireServerId(positionalArgs);
        const payload = await controller.initiateOAuth(serverId);
        if (wantsJson) {
          outputFn(JSON.stringify(payload, null, 2));
        } else {
          outputFn(`OAuth flow for ${payload.serverId}: ${payload.oauth.status}`);
          if (payload.oauth.authorizationUrl) {
            outputFn(payload.oauth.authorizationUrl);
          }
        }
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'oauth-complete': {
        const serverId = requireServerId(positionalArgs);
        const code = typeof flags.code === 'string' ? flags.code.trim() : '';
        const state = typeof flags.state === 'string' ? flags.state.trim() : '';
        if (!code || !state) {
          throw new Error('ValidationError: --code and --state are required for oauth-complete.');
        }
        const payload = await controller.completeOAuth(serverId, { code, state });
        outputFn(wantsJson ? JSON.stringify(payload, null, 2) : `OAuth for ${payload.serverId} is now ${payload.oauth.status}.`);
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'oauth-disconnect': {
        const serverId = requireServerId(positionalArgs);
        const payload = await controller.disconnectOAuth(serverId);
        outputFn(wantsJson ? JSON.stringify(payload, null, 2) : `OAuth for ${payload.serverId} is now ${payload.oauth.status}.`);
        sendAck(wsOutput);
        return { success: true, payload };
      }

      case 'help': {
        getMcpHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: true, handled: true };
      }

      default: {
        const message = `Unknown mcp subcommand: ${subcommand}`;
        errorFn(message, { code: 'unknown_mcp_subcommand' });
        getMcpHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: false, handled: true, error: message };
      }
    }
  } catch (error) {
    const message = error?.message || String(error);
    errorFn(message, { code: 'mcp_command_failure' });
    sendAck(wsOutput);
    return { success: false, error: message };
  }
}
