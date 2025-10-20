/**
 * Why: Guarantee the token normalization pipeline stays deterministic across future refactors.
 * What: Validates color conversion, ANSI mapping, and shared lookup helpers used by tooling and CLI output.
 * How: Exercises pure functions with representative samples and asserts parity with generated artifacts.
 */

import { describe, expect, it } from 'vitest';

import tokens from '../app/public/ui/tokens.json' assert { type: 'json' };
import {
  hexToRgb,
  rgbToAnsi256,
  buildAnsiMap
} from '../app/public/ui/token-normalizer.mjs';
import {
  getAnsiCode,
  getThemeColor,
  listThemes,
  listTokens
} from '../utils/ui-theme-ansi.mjs';

describe('token-normalizer', () => {
  it('converts hex colors to rgb tuples', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#14F1FF')).toEqual({ r: 20, g: 241, b: 255 });
  });

  it('maps rgb values to ansi-256 codes', () => {
    expect(rgbToAnsi256({ r: 0, g: 0, b: 0 })).toBe(16);
    expect(rgbToAnsi256({ r: 255, g: 255, b: 255 })).toBe(231);
    expect(rgbToAnsi256({ r: 20, g: 241, b: 255 })).toBe(51);
  });

  it('builds ansi map structures consistent with generated artifacts', () => {
    const ansiMap = buildAnsiMap(tokens.colors);
    expect(Object.keys(ansiMap)).toEqual(listThemes());
    for (const themeName of listThemes()) {
      expect(Object.keys(ansiMap[themeName])).toEqual(listTokens(themeName));
      for (const tokenName of listTokens(themeName)) {
        const descriptor = getThemeColor(themeName, tokenName);
        expect(descriptor.hex).toBe(tokens.colors[themeName][tokenName]);
        expect(descriptor.ansi256).toBe(ansiMap[themeName][tokenName].ansi256);
        expect(Array.isArray(descriptor.rgb)).toBe(true);
        expect(descriptor.rgb).toHaveLength(3);
      }
    }
  });

  it('provides ansi codes via helper', () => {
    expect(getAnsiCode('hacker', 'accent-primary')).toBe(51);
  });

  it('throws for unknown theme or token', () => {
    expect(() => getAnsiCode('unknown-theme', 'accent-primary')).toThrowError();
    expect(() => getAnsiCode('hacker', 'unknown-token')).toThrowError();
  });
});
