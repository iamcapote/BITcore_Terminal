/**
 * Why: Centralize token normalization helpers so scripts and tests operate on identical logic.
 * What: Exposes utilities to transform design tokens into CSS custom properties and ANSI metadata.
 * How: Provides pure functions for var naming, CSS rendering, and color conversions without side effects.
 */

export function toCSSVarName(prefix, key) {
  return `--${prefix}-${key}`;
}

export function renderThemeCSS(themeName, colors) {
  const lines = Object.entries(colors).map(([key, value]) => `  ${toCSSVarName('color', key)}: ${value};`);
  return `:root[data-theme="${themeName}"] {\n${lines.join('\n')}\n}\n`;
}

export function renderGlobalCSS(groupName, tokens) {
  const lines = Object.entries(tokens).map(([key, value]) => `  ${toCSSVarName(groupName, key)}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

export function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const bigint = Number.parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

export function rgbToAnsi256({ r, g, b }) {
  if ([r, g, b].some((value) => value < 0 || value > 255)) {
    throw new Error(`RGB channel out of bounds: ${r},${g},${b}`);
  }

  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }

  const red = Math.round((r / 255) * 5);
  const green = Math.round((g / 255) * 5);
  const blue = Math.round((b / 255) * 5);
  return 16 + 36 * red + 6 * green + blue;
}

export function buildAnsiMap(colors) {
  return Object.fromEntries(
    Object.entries(colors).map(([themeName, palette]) => {
      const entries = Object.entries(palette).map(([token, hex]) => {
        const rgb = hexToRgb(hex);
        return [token, { hex, rgb: [rgb.r, rgb.g, rgb.b], ansi256: rgbToAnsi256(rgb) }];
      });
      return [themeName, Object.fromEntries(entries)];
    })
  );
}
