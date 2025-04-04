import fs from 'fs/promises';

/**
 * Ensures a directory exists, creating it if necessary
 */
export async function ensureDir(path) {
  try {
    await fs.access(path);
  } catch {
    await fs.mkdir(path, { recursive: true });
  }
}