/**
 * Research Preferences Panel
 * Why: Allow operators to persist default research depth/breadth/visibility from the web UI.
 * What: Fetches current preferences, renders editable controls, and syncs updates via the REST API.
 * How: Uses the research preferences HTTP endpoints with optimistic form state and status messaging.
 */

(function registerResearchPreferences(global) {
  const API_ENDPOINT = '/api/preferences/research';
  const RANGE = Object.freeze({
    depth: Object.freeze({ min: 1, max: 6, fallback: 2 }),
    breadth: Object.freeze({ min: 1, max: 6, fallback: 3 }),
  });

  const state = {
    snapshot: null,
    loading: false,
    saving: false,
    statusTimeoutId: null,
  };

  let form;
  let depthInput;
  let breadthInput;
  let visibilityInput;
  let statusEl;
  let resetButton;

  function clamp(value, { min, max }) {
    return Math.min(Math.max(value, min), max);
  }

  function coerceInteger(value, range, fallback) {
    if (value == null || value === '') {
      return clamp(fallback, range);
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return clamp(fallback, range);
    }
    return clamp(parsed, range);
  }

  function setStatus(message, tone = 'info', persist = false) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.tone = tone;
    if (state.statusTimeoutId) {
      clearTimeout(state.statusTimeoutId);
      state.statusTimeoutId = null;
    }
    if (message && !persist) {
      state.statusTimeoutId = setTimeout(() => {
        statusEl.textContent = '';
        statusEl.dataset.tone = '';
        state.statusTimeoutId = null;
      }, 3500);
    }
  }

  function setBusy(isBusy) {
    state.saving = isBusy;
    if (form) {
      form.classList.toggle('is-busy', isBusy);
    }
    [depthInput, breadthInput, visibilityInput, resetButton].forEach((control) => {
      if (control) control.disabled = isBusy || state.loading;
    });
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    if (form) {
      form.classList.toggle('is-loading', isLoading);
    }
    [depthInput, breadthInput, visibilityInput, resetButton].forEach((control) => {
      if (control) control.disabled = isLoading || state.saving;
    });
  }

  function populateForm(preferences) {
    if (!preferences || !preferences.defaults) return;
    state.snapshot = preferences;
    const { depth, breadth, isPublic } = preferences.defaults;
    if (depthInput) depthInput.value = depth;
    if (breadthInput) breadthInput.value = breadth;
    if (visibilityInput) visibilityInput.checked = Boolean(isPublic);

    if (statusEl) {
      if (preferences.updatedAt) {
        const updated = new Date(preferences.updatedAt);
        if (!Number.isNaN(updated.getTime())) {
          statusEl.textContent = `Last updated ${updated.toLocaleString()}`;
          statusEl.dataset.tone = 'muted';
        }
      } else {
        statusEl.textContent = '';
        statusEl.dataset.tone = '';
      }
    }
  }

  async function fetchPreferences() {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const preferences = await response.json();
      populateForm(preferences);
    } catch (error) {
      console.error('[research.preferences] Failed to load preferences:', error);
      setStatus('Unable to load research defaults.', 'error', true);
    } finally {
      setLoading(false);
    }
  }

  function buildPayload() {
    const fallbackDepth = state.snapshot?.defaults?.depth ?? RANGE.depth.fallback;
    const fallbackBreadth = state.snapshot?.defaults?.breadth ?? RANGE.breadth.fallback;
    const depth = coerceInteger(depthInput.value, RANGE.depth, fallbackDepth);
    const breadth = coerceInteger(breadthInput.value, RANGE.breadth, fallbackBreadth);
    const isPublic = Boolean(visibilityInput.checked);

    depthInput.value = depth;
    breadthInput.value = breadth;

    return {
      defaults: { depth, breadth, isPublic },
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.saving || state.loading) return;

    const payload = buildPayload();

    try {
      setBusy(true);
      setStatus('Saving preferences…', 'info', true);
      const response = await fetch(API_ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const { error } = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error || `Save failed (${response.status})`);
      }
      const preferences = await response.json();
      populateForm(preferences);
      setStatus('Research defaults saved.', 'success');
    } catch (error) {
      console.error('[research.preferences] Failed to save preferences:', error);
      setStatus(error.message || 'Failed to save research defaults.', 'error', true);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (state.saving || state.loading) return;
    try {
      setBusy(true);
      setStatus('Resetting preferences…', 'info', true);
      const response = await fetch(`${API_ENDPOINT}/reset`, { method: 'POST' });
      if (!response.ok) {
        const { error } = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error || `Reset failed (${response.status})`);
      }
      const preferences = await response.json();
      populateForm(preferences);
      setStatus('Research defaults reset.', 'success');
    } catch (error) {
      console.error('[research.preferences] Failed to reset preferences:', error);
      setStatus(error.message || 'Failed to reset research defaults.', 'error', true);
    } finally {
      setBusy(false);
    }
  }

  function captureElements() {
    form = document.getElementById('research-preferences-form');
    depthInput = document.getElementById('research-default-depth');
    breadthInput = document.getElementById('research-default-breadth');
    visibilityInput = document.getElementById('research-default-visibility');
    statusEl = document.getElementById('research-preferences-status');
    resetButton = document.getElementById('research-preferences-reset');
    return Boolean(form && depthInput && breadthInput && visibilityInput && statusEl && resetButton);
  }

  function bindEvents() {
    if (!form) return;
    form.addEventListener('submit', handleSubmit);
    resetButton.addEventListener('click', handleReset);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!captureElements()) {
      return;
    }
    bindEvents();
    fetchPreferences();
  });
})(window);
