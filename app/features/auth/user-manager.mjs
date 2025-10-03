import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';
import {
	isSecureConfigAvailable,
	loadSecureConfig,
	getSecureConfigSection,
	getSecureConfigValue,
	updateSecureConfigSection,
} from '../config/secure-config.service.mjs';

/**
 * Why: Persist the single-operator profile while exposing hook points for optional multi-user adapters.
 * What: Loads and saves credentials, feature flags, and API keys from disk with environment fallbacks, and
 *       brokers access to pluggable user-directory adapters for self-hosted deployments.
 * How: Initializes a JSON-backed store, enforces immutability at boundaries, and offers guarded registration
 *       helpers for optional directory adapters without impacting the single-user baseline.
 */


const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function coerceBoolean(value, fallback = false) {
	if (value === undefined || value === null) {
		return fallback;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		return value !== 0;
	}
	const normalized = String(value).trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) {
		return true;
	}
	if (['0', 'false', 'no', 'off'].includes(normalized)) {
		return false;
	}
	return fallback;
}

// Single-user, no-auth configuration
const DEFAULT_USERNAME = process.env.BITCORE_USER || 'operator';
const DEFAULT_ROLE = process.env.BITCORE_ROLE || 'admin';
const DEFAULT_LIMITS = {};
const DEFAULT_FEATURE_FLAGS = Object.freeze({
	modelBrowser: coerceBoolean(process.env.TERMINAL_MODEL_BROWSER_PROFILE_DEFAULT, true),
});
const DEFAULT_STORAGE_DIR = process.env.BITCORE_STORAGE_DIR
  || path.join(os.homedir(), '.bitcore-terminal');
const USER_FILE_NAME = 'global-user.json';

const moduleLogger = createModuleLogger('auth.user-manager');

const VALID_API_SERVICES = ['brave', 'venice'];

const DEFAULT_USER = {
  username: DEFAULT_USERNAME,
  role: DEFAULT_ROLE,
  limits: DEFAULT_LIMITS,
  apiKeys: {
    brave: process.env.BRAVE_API_KEY || null,
    venice: process.env.VENICE_API_KEY || process.env.VENICE_PUBLIC_API_KEY || null,
  },
  github: {
    owner: process.env.GITHUB_OWNER || null,
    repo: process.env.GITHUB_REPO || null,
    branch: process.env.GITHUB_BRANCH || 'main',
    token: process.env.GITHUB_TOKEN || null,
  },
	features: { ...DEFAULT_FEATURE_FLAGS },
};

function mergeUserData(base, override = {}) {
  return {
    ...base,
    ...override,
    apiKeys: {
      ...base.apiKeys,
      ...(override.apiKeys || {}),
    },
    github: {
      ...base.github,
      ...(override.github || {}),
    },
		features: {
			...base.features,
			...(override.features || {}),
		},
  };
}

async function sanitizeUserForPersist(userSnapshot) {
  if (!isSecureConfigAvailable()) {
    return userSnapshot;
  }

  const clone = JSON.parse(JSON.stringify(userSnapshot));

  try {
    const braveSection = await getSecureConfigSection('brave');
    if (braveSection && Object.prototype.hasOwnProperty.call(braveSection, 'apiKey')) {
      clone.apiKeys = clone.apiKeys ? { ...clone.apiKeys } : {};
      clone.apiKeys.brave = null;
    }

    const veniceSection = await getSecureConfigSection('venice');
    if (veniceSection && Object.prototype.hasOwnProperty.call(veniceSection, 'apiKey')) {
      clone.apiKeys = clone.apiKeys ? { ...clone.apiKeys } : {};
      clone.apiKeys.venice = null;
    }

    const githubSection = await getSecureConfigSection('github');
    if (githubSection && Object.prototype.hasOwnProperty.call(githubSection, 'token')) {
      clone.github = { ...(clone.github || {}) };
      clone.github.token = null;
    }
  } catch (error) {
    moduleLogger.warn('Failed to sanitize user snapshot with secure config overlay.', {
      message: error?.message || String(error),
    });
  }

  return clone;
}


class UserManager {
	constructor() {
		this.storageDir = DEFAULT_STORAGE_DIR;
		this.userFile = path.join(this.storageDir, USER_FILE_NAME);
		this.currentUser = null;
		this.userDirectoryAdapter = null;
		this.secureStoreEnabled = isSecureConfigAvailable();
	}

	async initialize() {
		await ensureDir(this.storageDir);
		try {
			const data = JSON.parse(await fs.readFile(this.userFile, 'utf8'));
			this.currentUser = mergeUserData(DEFAULT_USER, data);
		} catch (err) {
			if (err.code === 'ENOENT') {
				this.currentUser = mergeUserData(DEFAULT_USER);
				await this.save();
					} else {
						moduleLogger.warn('Failed to read user file, using defaults.', {
							message: err.message,
							stack: err.stack || null
						});
				this.currentUser = mergeUserData(DEFAULT_USER);
			}
		}
		if (this.secureStoreEnabled) {
			try {
				await loadSecureConfig();
			} catch (error) {
				moduleLogger.warn('Secure configuration overlay failed to load.', {
					message: error?.message || String(error),
				});
			}
		}
		return this.currentUser;
	}

	async save() {
		if (!this.currentUser) await this.initialize();
		await ensureDir(this.storageDir);
		const snapshot = await sanitizeUserForPersist(this.currentUser);
		await fs.writeFile(this.userFile, JSON.stringify(snapshot, null, 2));
	}

	getCurrentUser() {
		if (!this.currentUser) {
			this.currentUser = mergeUserData(DEFAULT_USER);
		}
		return this.currentUser;
	}

	async getUserData() {
		if (!this.currentUser) await this.initialize();
		return this.currentUser;
	}

	async getUserCount() {
		if (!this.currentUser) await this.initialize();
		return 1;
	}

	async getFeatureFlags() {
		if (!this.currentUser) await this.initialize();
		return { ...(this.currentUser.features || {}) };
	}

	async hasFeature(featureName) {
		if (!featureName) {
			return false;
		}
		const features = await this.getFeatureFlags();
		return !!features[featureName];
	}

	async setFeatureFlag(featureName, value) {
		if (!featureName) {
			throw new Error('Feature name is required');
		}
		if (typeof value !== 'boolean') {
			throw new Error('Feature flag value must be a boolean');
		}
		if (!this.currentUser) await this.initialize();
		if (!this.currentUser.features) {
			this.currentUser.features = { ...DEFAULT_FEATURE_FLAGS };
		}
		this.currentUser.features[featureName] = value;
		await this.save();
	}

	// --- Compatibility (no-auth) helpers ---
	isAuthenticated() {
		// Single-user mode is always authenticated
		return true;
	}

	getUsername() {
		return this.getCurrentUser().username;
	}

	getRole() {
		return this.getCurrentUser().role;
	}

	async login(username, _password) {
		// No real login; optionally update username for compatibility flows
		await this.initialize();
		if (username && this.currentUser.username !== username) {
			this.currentUser.username = username;
			await this.save();
		}
		return this.getCurrentUser();
	}

	async logout() {
		// No-op in single-user mode
		return true;
	}

	async changePassword(_current, _next) {
		// No-op in single-user mode
		return true;
	}
	// --- End compatibility helpers ---

	async setApiKey(service, apiKey) {
		if (!VALID_API_SERVICES.includes(service)) {
			throw new Error(`Invalid service '${service}'. Use 'brave' or 'venice'.`);
		}
		if (!this.currentUser) await this.initialize();
		const normalized = typeof apiKey === 'string' ? apiKey.trim() : apiKey;
		if (this.secureStoreEnabled) {
			await updateSecureConfigSection(service, { apiKey: normalized || null });
			this.currentUser.apiKeys[service] = null;
		} else {
			this.currentUser.apiKeys[service] = normalized || null;
		}
		await this.save();
		return true;
	}

	async hasApiKey(service) {
		if (!VALID_API_SERVICES.includes(service)) {
			return false;
		}
		if (this.secureStoreEnabled) {
			const section = await getSecureConfigSection(service);
			if (section && typeof section.apiKey === 'string' && section.apiKey.trim()) {
				return true;
			}
		}
		if (!this.currentUser) await this.initialize();
		return !!this.currentUser.apiKeys?.[service];
	}

	async getApiKey(arg) {
		if (!this.currentUser) await this.initialize();
		const service = typeof arg === 'string' ? arg : arg?.service;
		if (!service) throw new Error('Service is required');
		if (this.secureStoreEnabled) {
			const value = await getSecureConfigValue(service, 'apiKey');
			if (value) {
				return value;
			}
		}
		return this.currentUser.apiKeys?.[service] || null;
	}

	async setGitHubConfig(config) {
		if (!this.currentUser) await this.initialize();
		const nextConfig = {
			...this.currentUser.github,
			...config,
		};
		nextConfig.branch = nextConfig.branch || 'main';
		const tokenProvided = Object.prototype.hasOwnProperty.call(config, 'token');
		if (this.secureStoreEnabled) {
			const secureUpdate = {
				owner: nextConfig.owner ?? null,
				repo: nextConfig.repo ?? null,
				branch: nextConfig.branch ?? null,
			};
			if (tokenProvided) {
				secureUpdate.token = config.token || null;
			}
			await updateSecureConfigSection('github', secureUpdate);
			if (tokenProvided) {
				nextConfig.token = null;
			} else {
				nextConfig.token = this.currentUser.github?.token ?? null;
			}
		} else if (tokenProvided) {
			nextConfig.token = config.token || null;
		}
		this.currentUser.github = nextConfig;
		await this.save();
	}

	async hasGitHubConfig() {
		if (!this.currentUser) await this.initialize();
		const gh = this.currentUser.github || {};
		return !!(gh.owner && gh.repo);
	}

	async hasGitHubToken() {
		if (this.secureStoreEnabled) {
			const token = await getSecureConfigValue('github', 'token');
			if (typeof token === 'string' && token.trim()) {
				return true;
			}
		}
		if (!this.currentUser) await this.initialize();
		return !!this.currentUser.github?.token;
	}

	async getGitHubToken() {
		if (this.secureStoreEnabled) {
			const token = await getSecureConfigValue('github', 'token');
			if (token) {
				return token;
			}
		}
		if (!this.currentUser) await this.initialize();
		return this.currentUser.github?.token || null;
	}

	async getDecryptedGitHubConfig() {
		if (!this.currentUser) await this.initialize();
		const gh = this.currentUser.github || {};
		if (!gh.owner || !gh.repo) return null;
		const token = await this.getGitHubToken();
		return {
			owner: gh.owner,
			repo: gh.repo,
			branch: gh.branch || 'main',
			token: token || null,
		};
	}

	async checkApiKeys() {
		if (!this.currentUser) await this.initialize();
		return {
			brave: await this.hasApiKey('brave'),
			venice: await this.hasApiKey('venice'),
			github: await this.hasGitHubConfig(),
		};
	}

	async testApiKeys() {
		if (!this.currentUser) await this.initialize();
		const results = {
			brave: { success: null, error: 'Not configured' },
			venice: { success: null, error: 'Not configured' },
			github: { success: null, error: 'Not configured' },
		};

		const API_TIMEOUT = 7000;
		const testEndpoint = async (url, headers = {}, method = 'GET') => {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
				const response = await fetch(url, { method, headers, signal: controller.signal });
				clearTimeout(timeoutId);
				return { success: response.ok, status: response.status, statusText: response.statusText };
			} catch (error) {
				if (error.name === 'AbortError') return { success: false, error: `Request timed out (${API_TIMEOUT}ms)` };
				return { success: false, error: error.message };
			}
		};

		if (await this.hasApiKey('brave')) {
			const braveKey = await this.getApiKey('brave');
			const res = await testEndpoint('https://api.search.brave.com/res/v1/web/ping', {
				'X-Subscription-Token': braveKey,
				'Accept': 'application/json',
			});
			results.brave = { success: res.success, error: res.success ? null : (res.error || `API ${res.status}: ${res.statusText}`) };
		}

		if (await this.hasApiKey('venice')) {
			const veniceKey = await this.getApiKey('venice');
			const res = await testEndpoint('https://api.venice.ai/api/v1/models', {
				Authorization: `Bearer ${veniceKey}`,
			});
			results.venice = { success: res.success, error: res.success ? null : (res.error || `API ${res.status}: ${res.statusText}`) };
		}

		if (await this.hasGitHubConfig()) {
			const cfg = await this.getDecryptedGitHubConfig();
			if (cfg?.token) {
				const octokit = new Octokit({ auth: cfg.token });
				try {
					await octokit.rest.users.getAuthenticated({ request: { timeout: API_TIMEOUT } });
					results.github = { success: true, error: null };
				} catch (apiError) {
					results.github = { success: false, error: `API Error: ${apiError.message}` };
				}
			} else {
				results.github = { success: false, error: 'GitHub token is not set' };
			}
		}

		return results;
	}

	registerUserDirectoryAdapter(adapter) {
		if (!adapter || typeof adapter !== 'object') {
			throw new Error('User directory adapter must be an object with list/create/delete functions.');
		}
		const requiredFns = ['listUsers', 'createUser', 'deleteUser'];
		requiredFns.forEach((fnName) => {
			if (typeof adapter[fnName] !== 'function') {
				throw new Error(`User directory adapter is missing required function: ${fnName}`);
			}
		});
		this.userDirectoryAdapter = adapter;
		return Object.freeze({ registered: true });
	}

	clearUserDirectoryAdapter() {
		this.userDirectoryAdapter = null;
	}

	getUserDirectoryAdapter() {
		return this.userDirectoryAdapter;
	}

	hasUserDirectoryAdapter() {
		return !!this.userDirectoryAdapter;
	}
}

export const userManager = new UserManager();
