/**
 * Why: Keep CLI ANSI output and web themes synchronized from a single token source.
 * What: Pure conversion helpers — hex→RGB, RGB→ANSI-256, palette→ANSI map, palette→CSS.
 * How: No side effects; all functions accept scalar/plain-object inputs and return plain values.
 */

/**
 * Converts a hex color string to {r, g, b}.
 * Accepts 3-digit (#abc) and 6-digit (#aabbcc) forms with or without the leading hash.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  const normalized = hex.replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
  };
}

/**
 * Maps an {r,g,b} triple to the nearest ANSI-256 color-cube index (16–231).
 * Each channel is quantized to 0–5 then folded into the 6×6×6 cube.
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {number}
 */
export function rgbToAnsi256({ r, g, b }) {
  const ri = Math.round((r / 255) * 5);
  const gi = Math.round((g / 255) * 5);
  const bi = Math.round((b / 255) * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

/**
 * Builds a nested theme→token→{hex, rgb, ansi256} map from a color palette object.
 * @param {Record<string, Record<string, string>>} colorPalette  theme→token→hex
 * @returns {Record<string, Record<string, { hex: string, rgb: number[], ansi256: number }>>}
 */
export function buildAnsiMap(colorPalette) {
  const result = {};
  for (const [themeName, tokens] of Object.entries(colorPalette)) {
    result[themeName] = {};
    for (const [tokenName, hex] of Object.entries(tokens)) {
      const rgb = hexToRgb(hex);
      result[themeName][tokenName] = {
        hex,
        rgb: [rgb.r, rgb.g, rgb.b],
        ansi256: rgbToAnsi256(rgb),
      };
    }
  }
  return result;
}

/**
 * Renders a CSS :root block from a flat token map.
 * @param {string} _category  label used in a comment above the block
 * @param {Record<string, string | number>} tokenMap
 * @returns {string}
 */
export function renderGlobalCSS(_category, tokenMap) {
  if (!tokenMap || typeof tokenMap !== 'object') return '';
  const props = Object.entries(tokenMap)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n');
  return `:root {\n${props}\n}`;
}

/**
 * Renders a [data-theme="name"] selector block from a color palette.
 * @param {string} themeName
 * @param {Record<string, string>} palette  token→hex
 * @returns {string}
 */
export function renderThemeCSS(themeName, palette) {
  const props = Object.entries(palette)
    .map(([key, value]) => `  --color-${key}: ${value};`)
    .join('\n');
  return `[data-theme="${themeName}"] {\n${props}\n}`;
}
