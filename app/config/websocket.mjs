/**
 * WebSocket Server Wiring
 * Why: Attach a guarded WebSocket server to the HTTP stack while restricting upgrades to the research channel.
 * What: Exposes a setup helper that validates upgrade paths, instantiates the WebSocket server, and delegates connections.
 * How: Intercepts upgrade events, filters by expected path, and logs lifecycle milestones through the shared logger.
 */

import { WebSocketServer } from 'ws';
import url from 'url'; // Import the 'url' module
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('config.websocket');

/**
 * Sets up the WebSocket server and attaches it to the provided HTTP server,
 * handling connections only for a specific path.
 * @param {http.Server} server - The HTTP server to attach the WebSocket server to.
 * @param {string} expectedPath - The WebSocket path to handle (e.g., '/api/research/ws').
 * @param {Function} connectionHandler - The handler function for valid WebSocket connections.
 */
export function setupWebSocket(server, expectedPath, connectionHandler) {
    // Create a WebSocketServer with noServer: true to manually handle upgrades
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const pathname = url.parse(request.url).pathname;

        if (pathname === expectedPath) {
            moduleLogger.info('Handling WebSocket upgrade request.', {
                path: pathname
            });
            wss.handleUpgrade(request, socket, head, (ws) => {
                // Emit connection event only for connections on the expected path
                wss.emit('connection', ws, request);
            });
        } else {
            // For other paths, destroy the socket to prevent hanging connections
            moduleLogger.warn('Rejected WebSocket upgrade for unexpected path. Destroying socket.', {
                requestedPath: pathname
            });
            socket.destroy();
        }
    });

    // The 'connection' event is now emitted by wss.handleUpgrade
    wss.on('connection', (ws, req) => {
        moduleLogger.info('WebSocket connection established.', {
            path: expectedPath,
            clientAddress: req.socket?.remoteAddress ?? null
        });
        connectionHandler(ws, req); // Call the provided handler
    });

    moduleLogger.info('WebSocket server initialized and listening for upgrades.', {
        path: expectedPath
    });
    return wss;
}
