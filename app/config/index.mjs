/**
 * Runtime Configuration Loader
 * Why: Centralize environment, secure overlay, and default settings for server features.
 * What: Builds a normalized config object consumed by features, optionally merging encrypted overrides.
 * How: Parses env vars, applies type coercion helpers, and hydrates secure overlays with structured logging.
 */

import dotenv from 'dotenv';
import path from 'path';
import { loadEncryptedConfigSync } from '../infrastructure/config/encrypted-config.store.mjs';
import { validateSecureConfigPayload, mergeSecureConfig } from '../features/config/config.schema.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

// Load environment variables from .env file
dotenv.config();

const moduleLogger = createModuleLogger('config.index');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const baseConfig = {
  venice: {
    // Use a specific public key env var, or fallback if needed
    apiKey: process.env.VENICE_PUBLIC_API_KEY || process.env.VENICE_API_KEY,
    // Add other Venice-related configs if needed
  },
  brave: {
    apiKey: process.env.BRAVE_API_KEY,
    // Add other Brave-related configs if needed
  },
  github: {
    // Add GitHub related configs if needed (e.g., default repo, path)
    // Note: User-specific tokens are handled by userManager
  },
  research: {
    scheduler: {
      enabled: parseBoolean(process.env.RESEARCH_SCHEDULER_ENABLED, false),
      cron: process.env.RESEARCH_SCHEDULER_CRON || '*/15 * * * *',
      timezone: process.env.RESEARCH_SCHEDULER_TZ || null,
      runOnStart: parseBoolean(process.env.RESEARCH_SCHEDULER_RUN_ON_START, true),
      maxRequestsPerTick: parseInteger(process.env.RESEARCH_SCHEDULER_MAX_REQUESTS, 10)
    },
    github: {
      requestsPath: process.env.RESEARCH_GITHUB_REQUESTS_PATH || 'requests',
      processedPath: process.env.RESEARCH_GITHUB_PROCESSED_PATH || null
    }
  },
  chat: {
    history: {
      enabled: parseBoolean(process.env.CHAT_HISTORY_ENABLED, true),
      retentionDays: parseInteger(process.env.CHAT_HISTORY_RETENTION_DAYS, 30),
      maxMessagesPerConversation: parseInteger(process.env.CHAT_HISTORY_MAX_MESSAGES, 500),
      dataDir: process.env.CHAT_HISTORY_DIR
        ? path.resolve(process.env.CHAT_HISTORY_DIR)
        : path.resolve(process.cwd(), '.data', 'chat-history')
    }
  },
  server: {
    port: process.env.PORT || 3000,
    websocketPath: '/api/research/ws',
  },
  missions: {
    enabled: parseBoolean(process.env.MISSIONS_ENABLED, true),
    schedulerEnabled: parseBoolean(
      process.env.MISSIONS_SCHEDULER_ENABLED,
      parseBoolean(process.env.MISSIONS_ENABLED, true)
    ),
    httpEnabled: parseBoolean(
      process.env.MISSIONS_HTTP_ENABLED,
      parseBoolean(process.env.MISSIONS_ENABLED, true)
    ),
    telemetryEnabled: parseBoolean(
      process.env.MISSIONS_TELEMETRY_ENABLED,
      parseBoolean(process.env.MISSIONS_ENABLED, true)
    ),
    pollingIntervalMs: parseInteger(process.env.MISSIONS_POLL_INTERVAL_MS, 30_000),
    github: {
      enabled: parseBoolean(process.env.MISSIONS_GITHUB_ENABLED, false),
      repoPath: process.env.MISSIONS_GITHUB_REPO_PATH
        ? path.resolve(process.env.MISSIONS_GITHUB_REPO_PATH)
        : path.resolve(process.cwd(), '.data', 'missions'),
      filePath: process.env.MISSIONS_GITHUB_FILE_PATH || 'missions.json',
      defaultBranch: process.env.MISSIONS_GITHUB_BRANCH || 'main',
      remote: process.env.MISSIONS_GITHUB_REMOTE || 'origin',
      strategy: process.env.MISSIONS_GITHUB_STRATEGY || 'ours',
      commitMessage: process.env.MISSIONS_GITHUB_COMMIT_MESSAGE || 'chore(missions): sync mission manifest'
    }
  },
  prompts: {
    enabled: parseBoolean(process.env.PROMPTS_ENABLED, true),
    httpEnabled: parseBoolean(
      process.env.PROMPTS_HTTP_ENABLED,
      parseBoolean(process.env.PROMPTS_ENABLED, true)
    ),
    github: {
      enabled: parseBoolean(process.env.PROMPTS_GITHUB_ENABLED, false),
      repoPath: process.env.PROMPTS_GITHUB_REPO_PATH
        ? path.resolve(process.env.PROMPTS_GITHUB_REPO_PATH)
        : path.resolve(process.cwd()),
      directory: process.env.PROMPTS_GITHUB_DIRECTORY || 'prompts',
      branch: process.env.PROMPTS_GITHUB_BRANCH || 'main',
      remote: process.env.PROMPTS_GITHUB_REMOTE || 'origin',
      commitMessage: process.env.PROMPTS_GITHUB_COMMIT_MESSAGE || 'chore(prompts): sync prompt library'
    }
  },
  terminal: {
    modelBrowserEnabled: parseBoolean(process.env.TERMINAL_MODEL_BROWSER_ENABLED, true),
    modelBrowserHttpEnabled: parseBoolean(
      process.env.TERMINAL_MODEL_BROWSER_HTTP_ENABLED,
      parseBoolean(process.env.TERMINAL_MODEL_BROWSER_ENABLED, true)
    ),
  },
};

let resolvedConfig = baseConfig;

const secureSecret = process.env.BITCORE_CONFIG_SECRET;

if (secureSecret) {
  try {
    const overlay = loadEncryptedConfigSync({
      secret: secureSecret,
      validator: validateSecureConfigPayload,
      logger: moduleLogger,
    });

    if (overlay && Object.keys(overlay).length) {
      resolvedConfig = mergeSecureConfig(baseConfig, overlay);
      resolvedConfig.__secureOverlay = Object.freeze({ loaded: true });
    } else {
      resolvedConfig = { ...baseConfig, __secureOverlay: Object.freeze({ loaded: false }) };
    }
  } catch (error) {
    moduleLogger.warn('Failed to apply secure configuration overlay.', {
      message: error.message,
      stack: error.stack || null
    });
    resolvedConfig = baseConfig;
  }
} else {
  resolvedConfig = { ...baseConfig, __secureOverlay: Object.freeze({ loaded: false }) };
}

export default resolvedConfig;
