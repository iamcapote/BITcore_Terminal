import { defineConfig, defineProject } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/nova/src')
    }
  },
  projects: [
    defineProject({
      test: {
        name: 'node',
        environment: 'node',
        include: ['app/tests/**/*.test.mjs', 'tests/**/*.test.mjs'],
        coverage: {
          reporter: ['text', 'json', 'html']
        }
      }
    }),
    defineProject({
      test: {
        name: 'ui',
        environment: 'jsdom',
        include: ['app/public/ui/src/**/*.test.tsx'],
        setupFiles: ['app/public/ui/vitest.setup.ts']
      }
    }),
    defineProject({
      test: {
        name: 'nova',
        environment: 'jsdom',
        include: ['app/nova/src/**/*.test.ts'],
        globals: true,
        setupFiles: []
      }
    })
  ]
});