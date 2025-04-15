export default {
  test: {
    globals: true,
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
};