/**
 * API Key Resolution Helpers
 * Why: Centralize credential discovery for Brave, Venice, and GitHub across CLI and WebSocket flows.
 * What: Reads session caches, falls back to the single-user profile via userManager, and finally to environment variables.
 * How: Provides async helpers that return resolved keys/configs and transparently hydrate session caches for re-use.
 */

import { userManager } from '../features/auth/user-manager.mjs';

const SERVICE_ENV_FALLBACK = Object.freeze({
  brave: () => process.env.BRAVE_API_KEY ?? null,
  venice: () => process.env.VENICE_API_KEY ?? process.env.VENICE_PUBLIC_API_KEY ?? null,
});

function readSessionCachedKey(session, service) {
  if (!session) return undefined;
  if (session.apiKeyCache?.[service]) return session.apiKeyCache[service];
  const legacyProp = session[`${service}ApiKey`];
  if (legacyProp) return legacyProp;
  if (session.currentUser?.apiKeys?.[service]) return session.currentUser.apiKeys[service];
  return undefined;
}

function writeSessionCache(session, service, key) {
  if (!session) return;
  session.apiKeyCache ??= {};
  session.apiKeyCache[service] = key ?? null;
  session[`${service}ApiKey`] = key ?? null;
  if (session.currentUser) {
    session.currentUser.apiKeys ??= {};
    session.currentUser.apiKeys[service] = key ?? null;
  }
}

async function readUserProfileApiKey(service) {
  try {
    return await userManager.getApiKey(service);
  } catch (error) {
    console.warn(`[ApiKeys] Unable to read ${service} key from user profile: ${error?.message ?? error}`);
    return null;
  }
}

export async function resolveServiceApiKey(service, options = {}) {
  const { session } = options;
  if (!['brave', 'venice'].includes(service)) {
    throw new Error(`Unsupported service "${service}". Expected 'brave' or 'venice'.`);
  }

  const cached = readSessionCachedKey(session, service);
  if (cached) {
    return cached;
  }

  const profileKey = await readUserProfileApiKey(service);
  const envKey = SERVICE_ENV_FALLBACK[service]?.() ?? null;
  const resolved = profileKey ?? envKey ?? null;

  if (session) {
    writeSessionCache(session, service, resolved);
  }

  return resolved;
}

export async function resolveApiKeys(options = {}) {
  const [brave, venice] = await Promise.all([
    resolveServiceApiKey('brave', options),
    resolveServiceApiKey('venice', options),
  ]);
  return { brave, venice };
}

function readEnvGitHubConfig() {
  const owner = process.env.GITHUB_OWNER ?? process.env.GITHUB_REPO_OWNER ?? null;
  const repo = process.env.GITHUB_REPO ?? process.env.GITHUB_REPO_NAME ?? null;
  const branch = process.env.GITHUB_BRANCH ?? 'main';
  const token = process.env.GITHUB_TOKEN ?? null;
  return { owner, repo, branch, token };
}

export async function resolveGitHubConfig(options = {}) {
  const { session } = options;
  if (session?.githubConfig) {
    return session.githubConfig;
  }

  let profileConfig = null;
  try {
    profileConfig = await userManager.getDecryptedGitHubConfig();
  } catch (error) {
    console.warn(`[ApiKeys] Unable to read GitHub config from user profile: ${error?.message ?? error}`);
    profileConfig = null;
  }

  const envConfig = readEnvGitHubConfig();
  const resolved = {
    owner: profileConfig?.owner ?? envConfig.owner ?? null,
    repo: profileConfig?.repo ?? envConfig.repo ?? null,
    branch: profileConfig?.branch ?? envConfig.branch ?? 'main',
    token: profileConfig?.token ?? envConfig.token ?? null,
  };

  const hasRepoConfig = Boolean(resolved.owner && resolved.repo);
  const finalConfig = hasRepoConfig ? resolved : (resolved.owner || resolved.repo || resolved.token ? resolved : null);

  if (session) {
    session.githubConfig = finalConfig;
  }

  return finalConfig;
}
