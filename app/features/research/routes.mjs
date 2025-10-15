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

router.post('/', (req, res) => {
    moduleLogger.info('Rejected legacy HTTP research request. CLI/Web terminal remain the supported interfaces.', {
        method: req.method,
        path: req.originalUrl,
        client: req.ip
    });
    return res.status(410).json({
        error: 'HTTP research endpoint is no longer available. Use the CLI or Web terminal to run /research.',
        nextSteps: {
            cli: 'npm start -- cli',
            web: 'npm start'
        }
    });
});

export { handleWebSocketConnection, cleanupInactiveSessions };
export default router;