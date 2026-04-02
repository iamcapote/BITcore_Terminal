/**
 * WorkspaceGitController
 * Why: Keep HTTP handlers focused on transport while preserving a stable git snapshot contract.
 * What: Wraps workspace git service operations (status, branches, history, revert).
 * How: Delegates calls, then returns timestamped immutable payloads.
 */

import { createWorkspaceGitService } from './workspace-git.service.mjs';

let singleton = null;

function stamp(payload) {
  return Object.freeze({
    source: 'live',
    feature: Object.freeze({ enabled: true, mode: 'live', wiring: 'scaffolded' }),
    ...payload,
    updatedAt: new Date().toISOString(),
  });
}

export function createWorkspaceGitController(options = {}) {
  const service = options.service ?? createWorkspaceGitService(options);

  return Object.freeze({
    async getStatus() {
      return stamp(await service.getStatus());
    },
    async listBranches() {
      return stamp(await service.listBranches());
    },
    async createBranch(name, from = null) {
      return stamp(await service.createBranch(name, from));
    },
    async checkoutBranch(name) {
      return stamp(await service.checkoutBranch(name));
    },
    async getFileHistory(path, options = {}) {
      return stamp(await service.getFileHistory(path, options));
    },
    async revertFile(path) {
      return stamp(await service.revertFile(path));
    },
  });
}

export function getWorkspaceGitController(options = {}) {
  if (!singleton) {
    singleton = createWorkspaceGitController(options);
  }
  return singleton;
}

export function resetWorkspaceGitController() {
  singleton = null;
}
