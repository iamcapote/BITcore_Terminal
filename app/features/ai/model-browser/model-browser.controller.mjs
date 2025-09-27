/**
 * Model Browser Controller
 *
 * Contract
 * Inputs:
 *   - options.service?: ModelBrowserService – provides the static catalog snapshot
 *   - options.userManager?: UserManager – resolves profile feature flags & API key presence
 *   - options.featureEnabled?: boolean – global kill-switch for the widget
 *   - options.cacheTtlMs?: number – cache lifetime for the static catalog snapshot
 * Outputs:
 *   - getCatalog({ refresh?: boolean }): Promise<ModelBrowserResponse>
 * Error modes:
 *   - Throws `FeatureDisabled` errors when the global flag or profile flag is off
 *   - Propagates unexpected errors from service or user manager lookups
 * Performance:
 *   - Single service call cached for `cacheTtlMs`; lightweight per-request metadata assembly
 * Side effects:
 *   - Reads profile preferences & API key state via the user manager
 */

import config from '../../../config/index.mjs';
import { userManager } from '../../auth/user-manager.mjs';
import { getModelBrowserService } from './model-browser.service.mjs';

const FEATURE_DISABLED_GLOBAL = 'FeatureDisabled: Terminal model browser is disabled via configuration.';
const FEATURE_DISABLED_PROFILE = 'FeatureDisabled: Model browser is disabled for this profile.';

function freezeResponse(baseSnapshot, { profileEnabled, hasApiKey }) {
  const featureMeta = Object.freeze({
    enabled: true,
    profileEnabled,
    requiresApiKey: true,
    hasApiKey,
  });

  const meta = Object.freeze({
    ...baseSnapshot.meta,
    hasVeniceApiKey: hasApiKey,
    profileEnabled,
  });

  return Object.freeze({
    models: baseSnapshot.models,
    defaults: baseSnapshot.defaults,
    categories: baseSnapshot.categories,
    meta,
    feature: featureMeta,
    updatedAt: baseSnapshot.updatedAt,
  });
}

export function createModelBrowserController(options = {}) {
  const {
    service = getModelBrowserService(),
    userManager: userManagerInstance = userManager,
    featureEnabled = config.terminal?.modelBrowserEnabled ?? true,
    cacheTtlMs = 60_000,
    logger = console,
  } = options;

  let cachedSnapshot = null;
  let cachedAt = 0;

  async function ensureAccess() {
    if (!featureEnabled) {
      throw new Error(FEATURE_DISABLED_GLOBAL);
    }
    if (typeof userManagerInstance?.hasFeature === 'function') {
      const allowed = await userManagerInstance.hasFeature('modelBrowser');
      if (!allowed) {
        throw new Error(FEATURE_DISABLED_PROFILE);
      }
    }
  }

  async function resolveProfileMetadata() {
    const profileEnabled = typeof userManagerInstance?.hasFeature === 'function'
      ? await userManagerInstance.hasFeature('modelBrowser')
      : true;
    const hasApiKey = typeof userManagerInstance?.hasApiKey === 'function'
      ? await userManagerInstance.hasApiKey('venice')
      : false;
    return { profileEnabled, hasApiKey };
  }

  return Object.freeze({
    async getCatalog({ refresh = false } = {}) {
      await ensureAccess();

      const now = Date.now();
      if (!refresh && cachedSnapshot && (now - cachedAt) < cacheTtlMs) {
        const metadata = await resolveProfileMetadata();
        return freezeResponse(cachedSnapshot, metadata);
      }

      const snapshot = service.listModels();
      cachedSnapshot = snapshot;
      cachedAt = now;

      const metadata = await resolveProfileMetadata();
      logger.debug?.('[ModelBrowserController] Catalog refreshed.', { updatedAt: snapshot.updatedAt });
      return freezeResponse(snapshot, metadata);
    },

    resetCache() {
      cachedSnapshot = null;
      cachedAt = 0;
    },
  });
}

let singletonController = null;

export function getModelBrowserController(options = {}) {
  if (!singletonController) {
    singletonController = createModelBrowserController(options);
  }
  return singletonController;
}

export function resetModelBrowserController() {
  singletonController = null;
}
