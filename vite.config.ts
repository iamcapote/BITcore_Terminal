/**
 * Why: Provide a single Vite entrypoint that builds the new multi-skin UI without disturbing legacy assets.
 * What: Configures React + SWC, sets the project root to app/public/ui, and emits bundles into a predictable dist folder.
 * How: Relies on Vite's defineConfig helper, aligning aliases and test options for Vitest-driven component coverage.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'app/public/ui'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'app/public/ui/dist'),
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@ui': resolve(__dirname, 'app/public/ui/src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: resolve(__dirname, 'app/public/ui/vitest.setup.ts')
  }
});
