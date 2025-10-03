import express from 'express';
import { cleanupInactiveSessions, handleWebSocketConnection } from './websocket/connection.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

/**
 * Contract
 * Why: Host HTTP entry points for research features and surface the WebSocket orchestrator.
 * What: Exposes a minimal Express router (with legacy notices) and re-exports WebSocket lifecycle utilities.
 * How: Delegates all real-time behaviour to websocket/connection.mjs while keeping HTTP endpoints thin.
 */

const moduleLogger = createModuleLogger('research.routes');
const router = express.Router();

router.all('/github/:legacyAction', (req, res) => {
    res.status(410).json({
        error: 'Legacy GitHub sync endpoints have been retired. Use POST /api/research/github-sync instead.',
        path: req.path,
        action: req.params.legacyAction,
        hint: {
            endpoint: '/api/research/github-sync',
            payload: '{ action, path?, files?, message?, branch?, ref? }',
        },
    });
});

router.post('/', async (req, res) => {
    try {
        const { query, depth = 2, breadth = 3 } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required and must be a string' });
        }

        moduleLogger.warn('Research HTTP endpoint invoked.', {
            method: 'POST',
            path: '/api/research'
        });
        res.status(501).json({ error: 'HTTP research endpoint not fully implemented/secured.' });
    } catch (error) {
        moduleLogger.error('Error handling research HTTP request.', {
            message: error?.message || String(error),
            stack: error?.stack || null
        });
        res.status(500).json({ error: error.message });
    }
});

export { handleWebSocketConnection, cleanupInactiveSessions };
export default router;