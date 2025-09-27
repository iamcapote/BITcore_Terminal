/**
 * Controller: GitHub Research Sync HTTP/WS
 * Exposes: POST /api/research/github-sync { action, repo, files }
 * Returns: { success, message, details }
 */
import { githubResearchSync } from './service.mjs';

export async function githubSyncHandler(req, res) {
  try {
    const { action, repo, files } = req.body;
    const result = await githubResearchSync({ action, repo, files });
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}

// WebSocket handler (if using webcomm)
export function registerGithubSyncWS(webcomm) {
  webcomm.on('github-sync', async (payload, respond) => {
    try {
      const result = await githubResearchSync(payload);
      respond(result);
    } catch (e) {
      respond({ success: false, message: e.message });
    }
  });
}
