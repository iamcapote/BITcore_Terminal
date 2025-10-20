import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true
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
    })
  ]
});