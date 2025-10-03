/**
 * Contract
 * Inputs:
 *   - Public methods log|warn|error|debug|command* with message payloads (string|Error|object).
 *   - broadcast(message) accepts strings or structured objects to relay to WebSocket clients.
 * Outputs:
 *   - Pushes normalized entries to logChannel.
 *   - Mirrors relevant events to connected WebSocket clients.
 * Error modes:
 *   - Swallows log handler errors after reporting through the module logger and default stream writer.
 *   - Broadcast failures are logged but do not throw.
 */

import { WebSocket } from 'ws';
import { createModuleLogger, formatLogMessage, normalizeLogLevel } from './logger.mjs';
import { logChannel } from './log-channel.mjs';

const MODULE_SOURCE = 'output-manager';

const DEFAULT_STREAM_WRITER = (level, message) => {
    const stream = level === 'error' ? process.stderr : process.stdout;
    const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
    stream.write(`${prefix}${message}\n`);
};

function ensureMessageEnvelope(message) {
    if (typeof message === 'string') {
        return { type: 'output', data: message };
    }
    if (message && typeof message === 'object') {
        return { ...message };
    }
    return { type: 'output', data: formatLogMessage(message) };
}

export class OutputManager {
    constructor({ logger = createModuleLogger(MODULE_SOURCE) } = {}) {
        this.webSocketClients = new Set();
        this.logHandler = DEFAULT_STREAM_WRITER;
        this.isBroadcasting = false;
        this.logger = logger;

        this.log = this.log.bind(this);
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.debug = this.debug.bind(this);
        this.commandStart = this.commandStart.bind(this);
        this.commandSuccess = this.commandSuccess.bind(this);
        this.commandError = this.commandError.bind(this);
        this.broadcast = this.broadcast.bind(this);
        this.setLogHandler = this.setLogHandler.bind(this);
        this.addWebSocketClient = this.addWebSocketClient.bind(this);
        this.removeWebSocketClient = this.removeWebSocketClient.bind(this);
        this._logInternal = this._logInternal.bind(this);
    }

    setLogHandler(handler) {
        if (typeof handler === 'function') {
            this.logHandler = handler;
        } else {
            this.logger.error('Attempted to configure log handler with a non-function.', { handlerType: typeof handler });
        }
    }

    addWebSocketClient(client) {
        this.webSocketClients.add(client);
        this.logger.debug('WebSocket client added.', { totalClients: this.webSocketClients.size });
    }

    removeWebSocketClient(client) {
        this.webSocketClients.delete(client);
        this.logger.debug('WebSocket client removed.', { totalClients: this.webSocketClients.size });
    }

    broadcast(message) {
        if (this.isBroadcasting) {
            return;
        }
        this.isBroadcasting = true;

        const envelope = ensureMessageEnvelope(message);
        if (!envelope.serverMessageId) {
            envelope.serverMessageId = `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        const serialized = JSON.stringify(envelope);

        for (const client of this.webSocketClients) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(serialized);
                } catch (error) {
                    this.logger.error('Failed to broadcast message to WebSocket client.', { error, readyState: client.readyState });
                }
            } else {
                this.logger.warn('Skipped broadcast to non-open WebSocket client.', { readyState: client.readyState });
            }
        }

        this.isBroadcasting = false;
    }

    _logInternal(level, rawMessage) {
        const normalizedLevel = normalizeLogLevel(level);
        const debugSuppressed = normalizedLevel === 'debug' && process.env.DEBUG_MODE !== 'true';
        if (debugSuppressed) {
            return;
        }

        const message = formatLogMessage(rawMessage);
        if (this.logHandler) {
            try {
                this.logHandler(normalizedLevel, message);
            } catch (handlerError) {
                this.logger.error('Custom log handler failed.', { error: handlerError });
                DEFAULT_STREAM_WRITER(normalizedLevel, message);
            }
        } else {
            DEFAULT_STREAM_WRITER(normalizedLevel, message);
        }

        const entry = logChannel.push({
            level: normalizedLevel,
            message,
            source: MODULE_SOURCE
        });

        if (!entry) {
            return;
        }

        if (this.webSocketClients.size === 0) {
            return;
        }

        const messageType = normalizedLevel === 'error' ? 'error' : 'output';
        const payload = {
            type: messageType,
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
            sequence: entry.sequence
        };

        if (messageType === 'error') {
            payload.error = entry.message;
        } else {
            const prefix = normalizedLevel !== 'info' ? `[${normalizedLevel.toUpperCase()}] ` : '';
            payload.data = `${prefix}${entry.message}`;
        }

        this.broadcast(payload);

        const logEventPayload = JSON.stringify({ type: 'log-event', data: entry });
        for (const client of this.webSocketClients) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(logEventPayload);
                } catch (error) {
                    this.logger.error('Failed to send log-event payload to WebSocket client.', { error, readyState: client.readyState });
                }
            }
        }
    }

    log(message) {
        this._logInternal('info', message);
    }

    error(message) {
        this._logInternal('error', message);
    }

    warn(message) {
        this._logInternal('warn', message);
    }

    debug(message) {
        if (process.env.DEBUG_MODE === 'true') {
            this._logInternal('debug', message);
        }
    }

    commandStart(command) {
        this.log(`[CMD START] ${command}`);
    }

    commandSuccess(command, message = 'Completed successfully.') {
        this.log(`[CMD SUCCESS] ${command}: ${message}`);
    }

    commandError(command, errorMessage) {
        this.error(`[CMD ERROR] ${command}: ${errorMessage}`);
    }
}

export const output = new OutputManager();
export { output as outputManager };
