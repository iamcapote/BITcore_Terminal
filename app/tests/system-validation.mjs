/**
 * @deprecated This module is retained only for backward compatibility.
 * Run `npx vitest run tests/system` to execute the new modular suites.
 */
export async function runSystemValidation({ logger = console } = {}) {
  const target = logger ?? console;
  target.warn?.('[system-validation] Deprecated entrypoint invoked.');
  target.warn?.('Run `npx vitest run tests/system` for the modular system validation suites.');

  return Object.freeze({
    deprecated: true,
    nextSteps: 'Execute Vitest with the tests/system glob to run the updated suites.'
  });
}