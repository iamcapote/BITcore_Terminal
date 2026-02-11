/**
 * Why: Expose CLI command metadata and runtime configuration to the Nova GUI for parity rendering.
 * What: Three endpoints — /api/commands (CLI metadata), /api/config (runtime config), /api/admin/settings (read/write admin prefs).
 * How: Reads cli-metadata.json, sanitizes runtime config (strips secrets), and proxies preferences services.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from '../../utils/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = createModuleLogger('routes.admin');

/* ── CLI metadata (cached at startup) ──────────────────────────────── */

let cachedCliMetadata = null;

function loadCliMetadata() {
  if (cachedCliMetadata) return cachedCliMetadata;
  try {
    const raw = readFileSync(resolve(__dirname, '../../config/cli-metadata.json'), 'utf-8');
    cachedCliMetadata = JSON.parse(raw);
    return cachedCliMetadata;
  } catch (error) {
    logger.error('Failed to load cli-metadata.json.', { message: error?.message });
    return { version: '0.0.0', commands: {} };
  }
}

/* ── Config sanitizer ──────────────────────────────────────────────── */

const SECRET_KEYS = new Set(['apiKey', 'token', 'secret', 'password', 'key']);

function sanitizeConfig(obj, depth = 0) {
  if (depth > 10 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeConfig(item, depth + 1));

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('__')) continue;
    const lower = key.toLowerCase();
    const isSecret = SECRET_KEYS.has(lower) || lower.includes('secret') || lower.includes('password') || lower.includes('apikey');
    if (isSecret && typeof value === 'string' && value.length > 0) {
      result[key] = '••••••••';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeConfig(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/* ── Feature flags (derived from config) ───────────────────────────── */

function deriveFeatureFlags(config) {
  return [
    { id: 'memory-github-sync', label: 'Memory GitHub Sync', description: 'Sync memory records to GitHub issues', enabled: Boolean(config.missions?.github?.enabled), category: 'integrations' },
    { id: 'streaming-responses', label: 'Streaming Responses', description: 'Stream LLM output token-by-token', enabled: true, category: 'ai' },
    { id: 'research-scheduler', label: 'Research Scheduler', description: 'Automatic scheduled research runs', enabled: Boolean(config.research?.scheduler?.enabled), category: 'automation' },
    { id: 'mission-scheduler', label: 'Mission Scheduler', description: 'Automatic mission scheduling and execution', enabled: Boolean(config.missions?.schedulerEnabled), category: 'automation' },
    { id: 'missions-enabled', label: 'Missions System', description: 'Mission automation pipelines', enabled: Boolean(config.missions?.enabled), category: 'features' },
    { id: 'missions-http', label: 'Missions HTTP API', description: 'REST endpoints for mission management', enabled: Boolean(config.missions?.httpEnabled), category: 'features' },
    { id: 'missions-telemetry', label: 'Missions Telemetry', description: 'Emit telemetry events for mission runs', enabled: Boolean(config.missions?.telemetryEnabled), category: 'features' },
    { id: 'prompts-enabled', label: 'Prompt Library', description: 'Prompt CRUD and search', enabled: Boolean(config.prompts?.enabled), category: 'features' },
    { id: 'prompts-http', label: 'Prompts HTTP API', description: 'REST endpoints for prompt management', enabled: Boolean(config.prompts?.httpEnabled), category: 'features' },
    { id: 'prompts-github', label: 'Prompts GitHub Sync', description: 'Pull/push prompts to GitHub repository', enabled: Boolean(config.prompts?.github?.enabled), category: 'integrations' },
    { id: 'chat-history', label: 'Chat History', description: 'Persist and browse chat conversations', enabled: Boolean(config.chat?.history?.enabled), category: 'features' },
    { id: 'research-archive', label: 'Research Archive', description: 'Store completed research runs', enabled: Boolean(config.research?.archive?.enabled), category: 'features' },
    { id: 'model-browser', label: 'Model Browser', description: 'Browse available Venice models', enabled: Boolean(config.terminal?.modelBrowserEnabled), category: 'ai' },
    { id: 'websocket-csrf', label: 'WebSocket CSRF Protection', description: 'Require CSRF tokens for WebSocket connections', enabled: Boolean(config.security?.research?.requireWebsocketCsrf), category: 'security' },
    { id: 'missions-github-sync', label: 'Missions GitHub Sync', description: 'Sync missions to GitHub repository', enabled: Boolean(config.missions?.github?.enabled), category: 'integrations' },
  ];
}

/* ── Surface visibility (persisted in localStorage on client, defaults here) ── */

const DEFAULT_SURFACE_VISIBILITY = {
  explorer: true, vectors: true, databases: true, memory: true,
  metrics: true, research: true, prompts: true, agents: true,
  instruments: true, missions: true, tasks: true, githubSync: true,
  logs: true, terminal: true, mcp: true, settings: true, chat: true,
  dashboard: true, browser: true,
};

/* ── Route setup ───────────────────────────────────────────────────── */

export function setupAdminRoutes(app, { logger: routeLogger } = {}) {
  const log = routeLogger || logger;

  /**
   * GET /api/commands — CLI metadata for parity rendering.
   * Returns the full cli-metadata.json so the GUI can render command docs, flags, and toggles.
   */
  app.get('/api/commands', (_req, res) => {
    try {
      const metadata = loadCliMetadata();
      res.json(metadata);
    } catch (error) {
      log.error('Failed to serve CLI metadata.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load command metadata.' });
    }
  });

  /**
   * GET /api/config — Sanitized runtime configuration for GUI settings panels.
   * Secrets are masked. Internal fields (prefixed __) are stripped.
   */
  app.get('/api/config', async (_req, res) => {
    try {
      const mod = await import('../../config/index.mjs');
      const raw = mod.default || mod;
      const sanitized = sanitizeConfig(raw);
      const flags = deriveFeatureFlags(raw);
      res.json({
        config: sanitized,
        featureFlags: flags,
        surfaceDefaults: DEFAULT_SURFACE_VISIBILITY,
      });
    } catch (error) {
      log.error('Failed to serve config.', { message: error?.message });
      res.status(500).json({ error: 'Failed to load configuration.' });
    }
  });

  /**
   * GET /api/admin/surfaces — Default surface visibility map.
   */
  app.get('/api/admin/surfaces', (_req, res) => {
    res.json({ surfaces: DEFAULT_SURFACE_VISIBILITY });
  });

  log.info('Admin routes registered.', { endpoints: ['/api/commands', '/api/config', '/api/admin/surfaces'] });
}
