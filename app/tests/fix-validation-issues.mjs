/**
 * Why: Provide a deterministic smoke harness for legacy validation workflows in the single-user terminal.
 * What: Executes critical CLI entrypoints (login, status, keys, logout) to verify behaviour that used to
 *       regress validation flows and reports the outcome.
 * How: Invokes command modules with captured output, records pass/fail results, and exits non-zero on failure.
 * Contract
 * Inputs:
 *   - None. Execute via `node app/tests/fix-validation-issues.mjs`.
 * Outputs:
 *   - Console summary and process exit code (0 success, 1 failure).
 * Error modes:
 *   - Throws when command handlers reject or unexpected errors surface.
 * Performance:
 *   - Runtime < 1s; memory footprint < 5 MB.
 * Side effects:
 *   - Mutates the user store by toggling API keys during the smoke run.
 */

import process from 'process';
import { executeLogin } from '../commands/login.cli.mjs';
import { executeStatus } from '../commands/status.cli.mjs';
import { executeKeys } from '../commands/keys.cli.mjs';
import { executeLogout } from '../commands/logout.cli.mjs';
import { initialiseValidationEnvironment } from './helpers/validation-env.mjs';
import { createCollector } from './helpers/validation-smoke-tests.mjs';

const CHECKS = [
  {
    name: 'userManager.initialize',
    run: async () => {
      const { message } = await initialiseValidationEnvironment();
      return message;
    }
  },
  {
    name: 'commands.login',
    run: async () => {
      const result = await executeLogin();
      if (!result?.success) {
        throw new Error('Login did not report success');
      }
      return 'Login reported success (expected no-op)';
    }
  },
  {
    name: 'commands.status',
    run: async () => {
      const collector = createCollector();
      const result = await executeStatus({ output: collector.push });
      if (!result?.success) {
        throw new Error('Status command failed');
      }
      if (!collector.lines.some((line) => /Username:/i.test(line))) {
        throw new Error('Status output missing username');
      }
      return 'Status emitted username line';
    }
  },
  {
    name: 'commands.keys:set/check',
    run: async () => {
      const outputCollector = createCollector();
      const errorCollector = createCollector();

      const setResult = await executeKeys({
        positionalArgs: ['set', 'brave', 'validation-smoke-key'],
        output: outputCollector.push,
        error: errorCollector.push
      });

      if (!setResult?.success) {
        throw new Error(`Setting key failed: ${errorCollector.lines.join(' | ') || 'unknown error'}`);
      }

      const checkResult = await executeKeys({
        positionalArgs: ['check'],
        output: outputCollector.push,
        error: errorCollector.push
      });

      if (!checkResult?.success) {
        throw new Error('Key check command failed');
      }

      const braveConfigured = outputCollector.lines.some((line) => /Brave API Key: Configured/i.test(line));
      if (!braveConfigured) {
        throw new Error('Key check did not report Brave key as configured');
      }

      await executeKeys({
        positionalArgs: ['set', 'brave'],
        output: outputCollector.push,
        error: errorCollector.push
      });

      return 'Brave key toggled and verified via /keys commands';
    }
  },
  {
    name: 'commands.logout',
    run: async () => {
      const result = await executeLogout();
      if (!result?.success) {
        throw new Error('Logout did not report success');
      }
      return 'Logout reported success (expected no-op)';
    }
  }
];

async function main() {
  const results = [];

  for (const check of CHECKS) {
    try {
      const detail = await check.run();
      results.push({ name: check.name, ok: true, detail });
      console.log(`✅ ${check.name}: ${detail}`);
    } catch (error) {
      results.push({ name: check.name, ok: false, detail: error.message });
      console.error(`❌ ${check.name}: ${error.message}`);
    }
  }

  const failures = results.filter((entry) => !entry.ok);
  if (failures.length > 0) {
    console.error(`\nValidation smoke harness detected ${failures.length} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nValidation smoke harness completed without issues.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Fatal error during validation harness: ${error.message}`);
    process.exitCode = 1;
  });
}