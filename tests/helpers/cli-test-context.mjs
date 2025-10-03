/**
 * Why: Provides reusable utilities for CLI integration tests so suites can invoke command modules without
 *       duplicating login, session management, or output capture logic.
 * What: Exposes the `CliTestContext` helper that wraps command execution, tracks output, and handles the
 *       minimal user lifecycle required by system-level specs.
 * How: Maintains a shared `UserManager` instance, normalises credentials, and offers convenience methods
 *       for logging in/out and ensuring fixture users exist.
 * Contract
 *   Inputs:
 *     - options?: {
 *         autoInitialize?: boolean;
 *         adminCredentials?: { username?: string; password?: string; role?: string };
 *         clientCredentials?: { username?: string; password?: string; role?: string };
 *       }
 *   Outputs:
 *     - CliTestContext instance exposing:
 *         initialize(): Promise<void>;
 *         ensureAdminSession(): Promise<boolean>;
 *         ensureClientUser(): Promise<boolean>;
 *         loginAsAdmin(): Promise<boolean>;
 *         loginAsClient(): Promise<boolean>;
 *         logout(): Promise<boolean>;
 *         runCommand(fn, args?): Promise<{ result: unknown; output: string[] }>;
 *         flushOutput(): string[];
 *         getOutput(): string[];
 *         outputContains(text: string): boolean;
 *         outputContainsAny(texts: string[]): boolean;
 *         getRole(): string;
 *   Error modes:
 *     - Throws when mandatory credentials are missing or command execution rejects unexpectedly.
 *     - Annotates thrown errors with `error.output` so callers can assert on captured logs.
 *   Performance:
 *     - Guard operations < 200ms; command execution time is dominated by the invoked module.
 *   Side effects:
 *     - Persists user state through `UserManager` and command modules; creates fixture users when required.
 *   Telemetry:
 *     - None.
 */

import { userManager } from '../../app/features/auth/user-manager.mjs';
import { executeLogin } from '../../app/commands/login.cli.mjs';
import { executeLogout } from '../../app/commands/logout.cli.mjs';

const DEFAULT_ADMIN = Object.freeze({
  username: 'admin',
  password: process.env.ADMIN_PASSWORD ?? 'test1234',
  role: 'admin'
});

export class CliTestContext {
  constructor(options = {}) {
    const {
      autoInitialize = true,
      adminCredentials = {}
    } = options;

  this.userManager = userManager;
    this.autoInitialize = autoInitialize;
    this.admin = {
      ...DEFAULT_ADMIN,
      ...adminCredentials
    };

    this.outputLines = [];
    this.initialized = false;

    this.captureOutput = this.captureOutput.bind(this);
  }

  async initialize() {
    if (this.initialized) return;
    await this.userManager.initialize();
    if (this.autoInitialize) {
      await this.ensureAdminSession();
    }
    this.initialized = true;
  }

  getRole() {
    return this.userManager?.getRole();
  }

  isAdmin() {
    return this.getRole() === 'admin';
  }

  captureOutput(...segments) {
    this.outputLines.push(segments.join(' '));
  }

  flushOutput() {
    const snapshot = [...this.outputLines];
    this.outputLines.length = 0;
    return snapshot;
  }

  getOutput() {
    return [...this.outputLines];
  }

  outputContains(text) {
    return this.outputLines.some(line => line?.includes?.(text));
  }

  outputContainsAny(texts) {
    return texts.some(text => this.outputContains(text));
  }

  async runCommand(command, args = {}) {
    this.flushOutput();
    const finalArgs = {
      ...args,
      output: args.output ?? this.captureOutput
    };

    try {
      const result = await command(finalArgs);
      return { result, output: this.getOutput() };
    } catch (error) {
      const output = this.getOutput();
      if (error && typeof error === 'object') {
        error.output = output;
      }
      throw error;
    }
  }

  async runWithConsoleCapture(command, args = []) {
    this.flushOutput();
    const originalLog = console.log;
    const originalStdoutWrite = process.stdout.write;
    const capture = this.captureOutput;
    console.log = this.captureOutput;
    process.stdout.write = (chunk, encoding, callback) => {
      try {
        const text = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
        if (text) {
          const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
          capture(normalized);
        }
      } catch (error) {
        // Ignore capture errors to avoid masking command behavior.
      }
      if (typeof originalStdoutWrite === 'function') {
        return originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
      }
      if (typeof callback === 'function') {
        callback();
      }
      return true;
    };
    try {
      const result = await command(...args);
      return { result, output: this.getOutput() };
    } finally {
      console.log = originalLog;
      process.stdout.write = originalStdoutWrite;
    }
  }

  async ensureAdminSession() {
    await this.userManager.initialize();
    if (this.isAdmin()) {
      return true;
    }

    await this.runWithConsoleCapture(executeLogin, [
      {
        arg0: this.admin.username,
        arg1: this.admin.password
      }
    ]);

    await this.userManager.initialize();
    if (!this.isAdmin()) {
      throw new Error('Failed to establish admin session for CLI tests.');
    }

    return true;
  }

  async loginAsAdmin() {
    await this.ensureAdminSession();
    return this.isAdmin();
  }

  async logout() {
    await this.runWithConsoleCapture(executeLogout, []);
    await this.userManager.initialize();
    return true;
  }
}

export function createCliTestContext(options = {}) {
  return new CliTestContext(options);
}
