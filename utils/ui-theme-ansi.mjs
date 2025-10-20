/**
 * Why: Keep CLI output visually aligned with web themes by mapping shared tokens to ANSI-256 codes.
 * What: Provides lookup helpers that surface hex, RGB, and ANSI metadata for a given theme-token pair.
 * How: Loads the generated ansi-map.json artifact, validates access, and returns immutable color descriptors for consumers.
 */

import ansiMap from '../app/public/ui/ansi-map.json' assert { type: 'json' };

const THEMES = Object.freeze(Object.keys(ansiMap));

function requireTheme(themeName) {
  if (!ansiMap[themeName]) {
    const detail = THEMES.join(', ');
    throw new Error(`Unknown theme "${themeName}". Valid options: ${detail}`);
  }
}

function requireToken(themeName, tokenName) {
  if (!ansiMap[themeName][tokenName]) {
    const detail = Object.keys(ansiMap[themeName]).join(', ');
    throw new Error(`Unknown token "${tokenName}" for theme "${themeName}". Valid options: ${detail}`);
  }
}

/**
 * Returns the immutable theme descriptor for the requested token.
 * @param {string} themeName - Registered theme identifier (hacker, modern, retro).
 * @param {string} tokenName - Token key such as bg-primary or accent-primary.
 * @returns {{ hex: string, rgb: number[], ansi256: number }} Immutable color record.
 */
export function getThemeColor(themeName, tokenName) {
  requireTheme(themeName);
  requireToken(themeName, tokenName);
  const descriptor = ansiMap[themeName][tokenName];
  return Object.freeze({ ...descriptor });
}

/**
 * Returns the ANSI-256 code for the requested token to embed in escape sequences.
 * @param {string} themeName - Registered theme identifier.
 * @param {string} tokenName - Token key.
 * @returns {number} ANSI-256 color index.
 */
export function getAnsiCode(themeName, tokenName) {
  return getThemeColor(themeName, tokenName).ansi256;
}

/**
 * Returns available theme identifiers.
 * @returns {readonly string[]} immutable theme names.
 */
export function listThemes() {
  return THEMES;
}

/**
 * Returns available token keys for a theme.
 * @param {string} themeName - Registered theme identifier.
 * @returns {string[]} token names.
 */
export function listTokens(themeName) {
  requireTheme(themeName);
  return Object.keys(ansiMap[themeName]);
}
