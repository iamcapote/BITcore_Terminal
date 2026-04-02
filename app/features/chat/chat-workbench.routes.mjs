/**
 * Why: Expose chat workbench bootstrap data so Nova and CLI can share the same startup suggestions.
 * What: Registers GET `/api/chat/workbench/bootstrap` with mock-first response semantics.
 * How: Uses a controller seam with optional injection for tests and phased live wiring.
 */

import { getChatWorkbenchController } from './index.mjs';

export function setupChatWorkbenchRoutes(app, { controller = null, enabled = true, logger = console } = {}) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupChatWorkbenchRoutes requires an Express app instance.');
  }

  if (!enabled) {
    logger?.info?.('[ChatWorkbenchRoutes] Disabled by configuration.');
    return;
  }

  const workbenchController = controller || getChatWorkbenchController();

  app.get('/api/chat/workbench/bootstrap', async (req, res) => {
    try {
      const snapshot = await workbenchController.getBootstrap();
      res.status(200).json(snapshot);
    } catch (error) {
      logger?.error?.('[ChatWorkbenchRoutes] Failed to get bootstrap snapshot.', {
        message: error?.message || String(error),
      });
      res.status(500).json({ error: 'Failed to load chat workbench bootstrap.' });
    }
  });
}

export default { setupChatWorkbenchRoutes };
