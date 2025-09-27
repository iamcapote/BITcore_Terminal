/**
 * Encrypted configuration store backed by AES-256-GCM.
 *
 * Contract
 * Inputs:
 *   - payloads that conform to validateSecureConfigPayload
 *   - options.secret: required symmetric key material (BITCORE_CONFIG_SECRET)
 * Outputs:
 *   - load(): sanitized config overlay object
 *   - save(payload): persists encrypted payload to disk
 *   - patch(partial): shallow merge + save helper
 *   - clear(): removes encrypted file
 * Error modes:
 *   - TypeError/RangeError on validation failures
 *   - Error when secret missing, file corrupted, or auth tag mismatch
 * Performance:
 *   - Single file read/write per operation; payloads expected to remain small (<10 KB)
 * Side effects:
 *   - Reads and writes `${storageDir}/${fileName}`
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import os from 'os';
import { ensureDir } from '../../utils/research.ensure-dir.mjs';

const DEFAULT_STORAGE_DIR = process.env.BITCORE_STORAGE_DIR
  || path.join(os.homedir(), '.bitcore-terminal');
const DEFAULT_FILE_NAME = 'secure-config.enc.json';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256-bit
const IV_LENGTH = 12; // recommended for GCM

function deriveKey(secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Encrypted config secret is required. Set BITCORE_CONFIG_SECRET.');
  }
  return crypto.createHash('sha256').update(secret).digest().subarray(0, KEY_LENGTH);
}

function encryptPayload(payloadJson, secret) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(payloadJson, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

function decryptPayload(record, secret) {
  const key = deriveKey(secret);
  const iv = Buffer.from(record.iv, 'base64');
  const authTag = Buffer.from(record.tag, 'base64');
  const ciphertext = Buffer.from(record.data, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function buildFilePayload(payload, secret, previousMeta = {}) {
  const now = new Date().toISOString();
  const cipher = encryptPayload(JSON.stringify(payload), secret);
  return {
    version: 1,
    createdAt: previousMeta.createdAt || now,
    updatedAt: now,
    cipher,
  };
}

async function readFileIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function readFileIfExistsSync(filePath) {
  try {
    const raw = fssync.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function createEncryptedConfigStore({
  storageDir = DEFAULT_STORAGE_DIR,
  fileName = DEFAULT_FILE_NAME,
  secret,
  validator,
  logger = console,
} = {}) {
  const filePath = path.resolve(storageDir, fileName);

  async function load() {
    if (!secret) {
      throw new Error('Encrypted config secret is required to load secure configuration.');
    }

    const filePayload = await readFileIfExists(filePath);
    if (!filePayload) {
      return {};
    }

    try {
      const decrypted = decryptPayload(filePayload.cipher, secret);
      const parsed = JSON.parse(decrypted);
      return validator ? validator(parsed) : parsed;
    } catch (error) {
      logger?.error?.('[EncryptedConfigStore] Failed to decrypt secure configuration.', { error: error.message });
      throw new Error('Unable to decrypt secure configuration. Check BITCORE_CONFIG_SECRET.');
    }
  }

  async function save(payload) {
    if (!secret) {
      throw new Error('Encrypted config secret is required to save secure configuration.');
    }

    const sanitised = validator ? validator(payload) : payload;
    await ensureDir(storageDir);

    const existing = await readFileIfExists(filePath);
    const filePayload = buildFilePayload(sanitised, secret, existing || {});
    await fs.writeFile(filePath, JSON.stringify(filePayload, null, 2));
    return sanitised;
  }

  async function patch(partial) {
    const current = await load();
    const next = mergeObjects(current, partial);
    return save(next);
  }

  async function clear() {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  return {
    load,
    save,
    patch,
    clear,
    filePath,
  };
}

export function loadEncryptedConfigSync({
  storageDir = DEFAULT_STORAGE_DIR,
  fileName = DEFAULT_FILE_NAME,
  secret,
  validator,
  logger = console,
} = {}) {
  if (!secret) {
    throw new Error('Encrypted config secret is required to load secure configuration.');
  }

  const filePath = path.resolve(storageDir, fileName);
  const filePayload = readFileIfExistsSync(filePath);
  if (!filePayload) {
    return {};
  }

  try {
    const decrypted = decryptPayload(filePayload.cipher, secret);
    const parsed = JSON.parse(decrypted);
    return validator ? validator(parsed) : parsed;
  } catch (error) {
    logger?.error?.('[EncryptedConfigStore] Failed to decrypt secure configuration.', { error: error.message });
    throw new Error('Unable to decrypt secure configuration. Check BITCORE_CONFIG_SECRET.');
  }
}

function mergeObjects(base, patchObject) {
  if (!patchObject || typeof patchObject !== 'object') {
    return base;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(patchObject)) {
    if (value == null) {
      result[key] = null;
      continue;
    }

    if (Array.isArray(value)) {
      throw new TypeError('Secure configuration does not support array values.');
    }

    if (typeof value === 'object') {
      const current = base[key] && typeof base[key] === 'object' ? base[key] : {};
      result[key] = mergeObjects(current, value);
      continue;
    }

    result[key] = value;
  }
  return result;
}

export default {
  createEncryptedConfigStore,
  loadEncryptedConfigSync,
};
