import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';


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


class UserManager {
	constructor() {
		this.storageDir = DEFAULT_STORAGE_DIR;
		this.userFile = path.join(this.storageDir, USER_FILE_NAME);
		this.currentUser = null;
	}

	async initialize() {
		await ensureDir(this.storageDir);
		try {
			const data = JSON.parse(await fs.readFile(this.userFile, 'utf8'));
			this.currentUser = mergeUserData(DEFAULT_USER, data);
		} catch (err) {
			if (err.code === 'ENOENT') {
				this.currentUser = mergeUserData(DEFAULT_USER);
				await fs.writeFile(this.userFile, JSON.stringify(this.currentUser, null, 2));
			} else {
				console.warn(`[UserManager] Failed to read user file, using defaults: ${err.message}`);
				this.currentUser = mergeUserData(DEFAULT_USER);
			}
		}
		return this.currentUser;
	}

	async save() {
		if (!this.currentUser) await this.initialize();
		await ensureDir(this.storageDir);
		await fs.writeFile(this.userFile, JSON.stringify(this.currentUser, null, 2));
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
		if (!['brave', 'venice'].includes(service)) {
			throw new Error(`Invalid service '${service}'. Use 'brave' or 'venice'.`);
		}
		if (!this.currentUser) await this.initialize();
		this.currentUser.apiKeys[service] = apiKey || null;
		await this.save();
		return true;
	}

	async hasApiKey(service) {
		if (!this.currentUser) await this.initialize();
		return !!this.currentUser.apiKeys?.[service];
	}

	async getApiKey(arg) {
		if (!this.currentUser) await this.initialize();
		const service = typeof arg === 'string' ? arg : arg?.service;
		if (!service) throw new Error('Service is required');
		return this.currentUser.apiKeys?.[service] || null;
	}

	async setGitHubConfig(config) {
		if (!this.currentUser) await this.initialize();
		this.currentUser.github = {
			...this.currentUser.github,
			...config,
		};
		await this.save();
	}

	async hasGitHubConfig() {
		if (!this.currentUser) await this.initialize();
		const gh = this.currentUser.github || {};
		return !!(gh.owner && gh.repo);
	}

	async hasGitHubToken() {
		if (!this.currentUser) await this.initialize();
		return !!this.currentUser.github?.token;
	}

	async getGitHubToken() {
		if (!this.currentUser) await this.initialize();
		return this.currentUser.github?.token || null;
	}

	async getDecryptedGitHubConfig() {
		if (!this.currentUser) await this.initialize();
		const gh = this.currentUser.github || {};
		if (!gh.owner || !gh.repo) return null;
		return {
			owner: gh.owner,
			repo: gh.repo,
			branch: gh.branch || 'main',
			token: gh.token || null,
		};
	}

	async checkApiKeys() {
		if (!this.currentUser) await this.initialize();
		return {
			brave: !!this.currentUser.apiKeys?.brave,
			venice: !!this.currentUser.apiKeys?.venice,
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
}

export const userManager = new UserManager();
