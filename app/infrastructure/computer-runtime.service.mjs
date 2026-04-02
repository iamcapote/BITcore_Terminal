/**
 * Computer Runtime Service
 * Why: Provide a dedicated machine-runtime seam aligned with Agent Zero code-execution configuration.
 * What: Exposes immutable getRuntime/updateRuntime snapshots for shell interface and SSH execution fields.
 * How: Maintains in-memory mock state with strict validation and deterministic snapshot envelopes.
 */

function nowIso() {
  return new Date().toISOString();
}

function normalizeShellInterface(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) {
    throw new Error('ValidationError: shellInterface is required.');
  }
  if (!['local', 'ssh'].includes(normalized)) {
    throw new Error('ValidationError: shellInterface must be "local" or "ssh".');
  }
  return normalized;
}

function normalizeHost(value) {
  const host = typeof value === 'string' ? value.trim() : '';
  if (!host) {
    throw new Error('ValidationError: codeExecSshAddr must be a non-empty string.');
  }
  return host;
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('ValidationError: codeExecSshPort must be an integer between 1 and 65535.');
  }
  return port;
}

function normalizeUser(value) {
  const user = typeof value === 'string' ? value.trim() : '';
  if (!user) {
    throw new Error('ValidationError: codeExecSshUser must be a non-empty string.');
  }
  return user;
}

function toSnapshot(state) {
  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    runtime: Object.freeze({
      shellInterface: state.shellInterface,
      codeExecSshEnabled: state.codeExecSshEnabled,
      codeExecSshAddr: state.codeExecSshAddr,
      codeExecSshPort: state.codeExecSshPort,
      codeExecSshUser: state.codeExecSshUser,
      codeExecSshHasPassword: state.codeExecSshHasPassword,
      updatedAt: state.updatedAt,
    }),
    updatedAt: state.updatedAt,
  });
}

let singletonService = null;

export function createComputerRuntimeService() {
  const state = {
    shellInterface: 'local',
    codeExecSshEnabled: false,
    codeExecSshAddr: 'localhost',
    codeExecSshPort: 55022,
    codeExecSshUser: 'root',
    codeExecSshHasPassword: false,
    updatedAt: nowIso(),
  };

  return Object.freeze({
    getRuntime() {
      return toSnapshot(state);
    },

    updateRuntime(patch = {}) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('ValidationError: runtime patch must be an object.');
      }

      if ('shellInterface' in patch) {
        state.shellInterface = normalizeShellInterface(patch.shellInterface);
        state.codeExecSshEnabled = state.shellInterface === 'ssh';
      }

      if ('codeExecSshEnabled' in patch) {
        state.codeExecSshEnabled = Boolean(patch.codeExecSshEnabled);
        state.shellInterface = state.codeExecSshEnabled ? 'ssh' : 'local';
      }

      if ('codeExecSshAddr' in patch) {
        state.codeExecSshAddr = normalizeHost(patch.codeExecSshAddr);
      }

      if ('codeExecSshPort' in patch) {
        state.codeExecSshPort = normalizePort(patch.codeExecSshPort);
      }

      if ('codeExecSshUser' in patch) {
        state.codeExecSshUser = normalizeUser(patch.codeExecSshUser);
      }

      if ('codeExecSshPass' in patch) {
        state.codeExecSshHasPassword = typeof patch.codeExecSshPass === 'string' && patch.codeExecSshPass.trim().length > 0;
      }

      state.updatedAt = nowIso();
      return toSnapshot(state);
    },
  });
}

export function getComputerRuntimeService() {
  if (!singletonService) {
    singletonService = createComputerRuntimeService();
  }
  return singletonService;
}

export function resetComputerRuntimeServiceSingleton() {
  singletonService = null;
}
