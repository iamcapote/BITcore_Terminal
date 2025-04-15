import { scrypt, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function deriveKey(password, salt) {
  const saltBuffer = Buffer.from(salt, 'hex');
  return scryptAsync(password, saltBuffer, 32);
}

export async function encryptApiKey(apiKey, key) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex')
  });
}

export async function decryptApiKey(encryptedData, key) {
  const { iv, encrypted, authTag } = JSON.parse(encryptedData);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
