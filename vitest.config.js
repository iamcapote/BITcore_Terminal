export default {
  test: {
    globals: true,
    // Run only the Vitest-based suites co-located under app/tests
  include: ['app/tests/**/*.test.mjs', 'tests/**/*.test.mjs'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
};