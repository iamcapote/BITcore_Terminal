import { WebSocketServer } from 'ws';
import url from 'url'; // Import the 'url' module

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
            console.log(`[WebSocket] Handling upgrade request for path: ${pathname}`);
            wss.handleUpgrade(request, socket, head, (ws) => {
                // Emit connection event only for connections on the expected path
                wss.emit('connection', ws, request);
            });
        } else {
            // For other paths, destroy the socket to prevent hanging connections
            console.log(`[WebSocket] Ignoring upgrade request for path: ${pathname}. Destroying socket.`);
            socket.destroy();
        }
    });

    // The 'connection' event is now emitted by wss.handleUpgrade
    wss.on('connection', (ws, req) => {
        console.log(`[WebSocket] Connection established on path: ${expectedPath}`);
        connectionHandler(ws, req); // Call the provided handler
    });

    console.log(`[WebSocket] WebSocket server initialized, listening for upgrades on path: ${expectedPath}`);
    return wss;
}
