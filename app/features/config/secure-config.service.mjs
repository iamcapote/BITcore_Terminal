/**
 * Why: Provide a single access point for encrypted configuration reads and writes.
 * What: Wraps the encrypted config store with caching, write guards, and high-level helpers used across the app.
 * How: Lazily instantiates the encrypted store when a secret is present, tracks an overlay cache, and exposes
 *      utilities to load sections, update credential fields, and clear state for tests.
 */

import { createEncryptedConfigStore } from '../../infrastructure/config/encrypted-config.store.mjs';
import { validateSecureConfigPayload } from './config.schema.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';

const moduleLogger = createModuleLogger('config.secure-service');

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  return TRUTHY_VALUES.has(String(value ?? '').trim().toLowerCase());
}

function clone(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

let storeInstance = null;
let overlayCache = null;

function getSecret() {
  return process.env.BITCORE_CONFIG_SECRET || null;
}

function getStore() {
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  if (!storeInstance) {
    storeInstance = createEncryptedConfigStore({
      secret,
      validator: validateSecureConfigPayload,
      logger: moduleLogger,
    });
  }
  return storeInstance;
}

export function isSecureConfigAvailable() {
  return !!getStore();
}

async function ensureOverlay() {
  const store = getStore();
  if (!store) {
    return {};
  }
  if (overlayCache) {
    return overlayCache;
  }
  try {
    overlayCache = await store.load();
  } catch (error) {
    overlayCache = {};
    moduleLogger.error('Failed to load secure configuration.', {
      error: error?.message || String(error)
    });
    throw error;
  }
  return overlayCache;
}

function envAllowsWrites() {
  return isTruthy(process.env.BITCORE_ALLOW_CONFIG_WRITES);
}

export async function secureConfigWritesEnabled() {
  if (!isSecureConfigAvailable()) {
    return false;
  }
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  if (envAllowsWrites()) {
    return true;
  }
  const overlay = await ensureOverlay();
  return overlay?.terminal?.experimental?.allowConfigWrites === true;
}

export async function requireSecureConfigWriteAccess() {
  if (!(await secureConfigWritesEnabled())) {
    throw new Error('Secure config writes are disabled. Set BITCORE_ALLOW_CONFIG_WRITES=1 or enable terminal.experimental.allowConfigWrites via the encrypted config.');
  }
}

export async function loadSecureConfig() {
  if (!isSecureConfigAvailable()) {
    return {};
  }
  const overlay = await ensureOverlay();
  return clone(overlay) || {};
}

export async function getSecureConfigSection(section) {
  const overlay = await loadSecureConfig();
  if (!overlay || typeof overlay !== 'object') {
    return null;
  }
  return overlay[section] ? clone(overlay[section]) : null;
}

export async function getSecureConfigValue(section, key) {
  const sectionPayload = await getSecureConfigSection(section);
  if (!sectionPayload || typeof sectionPayload !== 'object') {
    return null;
  }
  if (!key) {
    return clone(sectionPayload);
  }
  return sectionPayload[key] ?? null;
}

export async function updateSecureConfigSection(section, values) {
  if (!isSecureConfigAvailable()) {
    throw new Error('Secure config store is not available. Set BITCORE_CONFIG_SECRET to enable encrypted storage.');
  }
  if (values === undefined) {
    return getSecureConfigSection(section);
  }
  await requireSecureConfigWriteAccess();
  const store = getStore();
  try {
    overlayCache = await store.patch({ [section]: values });
  } catch (error) {
    moduleLogger.error('Failed to update secure configuration section.', {
      section,
      error: error?.message || String(error)
    });
    throw error;
  }
  return getSecureConfigSection(section);
}

export async function clearSecureConfig() {
  const store = getStore();
  if (!store) {
    return false;
  }
  await store.clear();
  overlayCache = {};
  return true;
}

export function resetSecureConfigCache() {
  overlayCache = null;
}