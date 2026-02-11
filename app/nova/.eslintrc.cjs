/**
 * Why: Provide a shared lint baseline for Nova React + TypeScript sources.
 * What: ESLint configuration with React hooks and refresh rules plus TypeScript parsing.
 * How: Apply recommended rule sets and keep settings minimal for local development.
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "react-refresh/only-export-components": "off",
    "react-hooks/exhaustive-deps": "off",
  },
};
