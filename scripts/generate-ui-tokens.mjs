/**
 * Why: Keep design tokens authoritative and synchronized across web skins and CLI ANSI themes.
 * What: Reads app/public/ui/tokens.json, emits tokens.css for browser consumption, and ansi-map.json for CLI color parity.
 * How: Normalizes token keys into CSS custom properties, approximates ANSI-256 codes from hex values, and writes both artifacts atomically.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGlobalCSS,
  renderThemeCSS,
  buildAnsiMap
} from '../app/public/ui/token-normalizer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, '../app/public/ui/tokens.json');
const cssOutputPath = resolve(here, '../app/public/ui/tokens.css');
const ansiOutputPath = resolve(here, '../app/public/ui/ansi-map.json');

async function main() {
  const raw = await readFile(tokensPath, 'utf-8');
  const tokens = JSON.parse(raw);

  const sections = [];
  sections.push(renderGlobalCSS('typography', tokens.typography));
  sections.push(renderGlobalCSS('spacing', tokens.spacing));
  sections.push(renderGlobalCSS('radii', tokens.radii));
  sections.push(renderGlobalCSS('shadow', tokens.shadows));
  sections.push(renderGlobalCSS('motion', tokens.motion));

  const themeCss = Object.entries(tokens.colors)
    .map(([themeName, palette]) => renderThemeCSS(themeName, palette))
    .join('\n');

  const cssOutput = `${sections.join('\n')}\n${themeCss}`;
  await writeFile(cssOutputPath, `${cssOutput}\n`, 'utf-8');

  const ansiMap = buildAnsiMap(tokens.colors);
  await writeFile(ansiOutputPath, `${JSON.stringify(ansiMap, null, 2)}\n`, 'utf-8');
}

main().catch((error) => {
  console.error('[generate-ui-tokens] failed', error);
  process.exitCode = 1;
});
