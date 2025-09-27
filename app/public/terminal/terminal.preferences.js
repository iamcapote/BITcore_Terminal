/**
 * Terminal Preferences Client Manager
 * Why: Keep the web terminal UI aligned with persisted operator preferences.
 * What: Fetches preferences, renders toggle controls, and syncs updates back to the API.
 * How: Applies widget visibility + terminal behaviour flags while coordinating with the Terminal instance.
 */

(function registerTerminalPreferences(global) {
  const API_ENDPOINT = '/api/preferences/terminal';
  const STORAGE_KEY = 'bitcore-terminal-history';
  const SAVE_DEBOUNCE_MS = 150;

  const state = {
    preferences: null,
    terminal: null,
    saving: false,
    pendingSave: null,
    pendingStatusTimeout: null,
    controls: new Map(),
    statusElement: null,
  };

  function coalesceBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  function markSaving(isSaving) {
    state.saving = isSaving;
    if (state.statusElement) {
      state.statusElement.textContent = isSaving ? 'Saving…' : '';
    }
    for (const control of state.controls.values()) {
      control.disabled = isSaving;
    }
  }

  function setStatusMessage(message, timeoutMs = 2500) {
    if (!state.statusElement) return;
    state.statusElement.textContent = message;
    if (message && timeoutMs > 0) {
      window.clearTimeout(state.pendingStatusTimeout);
      state.pendingStatusTimeout = window.setTimeout(() => {
        if (state.statusElement?.textContent === message) {
          state.statusElement.textContent = '';
        }
      }, timeoutMs);
    }
  }

  function ensureControls() {
    if (state.controls.size > 0) {
      return;
    }

    const panel = document.getElementById('terminal-preferences-panel');
    if (!panel) {
      return;
    }

    const heading = document.createElement('h2');
    heading.textContent = 'Terminal Preferences';
    panel.appendChild(heading);

    const description = document.createElement('p');
    description.className = 'preferences-description';
    description.textContent = 'Toggle terminal widgets and ergonomics. Changes persist across CLI and web interfaces.';
    panel.appendChild(description);

    const list = document.createElement('div');
    list.className = 'preferences-toggle-grid';
    panel.appendChild(list);

    const controls = [
      { key: 'widgets.telemetryPanel', label: 'Research telemetry widget' },
      { key: 'widgets.memoryPanel', label: 'Memory telemetry widget' },
      { key: 'widgets.modelBrowser', label: 'Model browser widget' },
      { key: 'widgets.telemetryIndicator', label: 'Telemetry presence indicator' },
      { key: 'widgets.logIndicator', label: 'Log presence indicator' },
      { key: 'terminal.autoScroll', label: 'Auto-scroll output' },
      { key: 'terminal.retainHistory', label: 'Retain terminal history (browser)' },
    ];

    controls.forEach(({ key, label }) => {
      const controlId = `pref-${key.replace('.', '-')}`;
      const wrapper = document.createElement('label');
      wrapper.className = 'preferences-toggle';
      wrapper.setAttribute('for', controlId);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = controlId;
      checkbox.dataset.prefKey = key;

      const span = document.createElement('span');
      span.textContent = label;

      wrapper.appendChild(checkbox);
      wrapper.appendChild(span);
      list.appendChild(wrapper);

      checkbox.addEventListener('change', (event) => {
        const value = Boolean(event.target.checked);
        queuePreferenceUpdate(key, value);
      });

      state.controls.set(key, checkbox);
    });

    const status = document.createElement('div');
    status.className = 'preferences-status';
    panel.appendChild(status);
    state.statusElement = status;

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'gradient-btn control-button preferences-reset-btn';
    resetButton.textContent = 'Reset to defaults';
    resetButton.addEventListener('click', () => {
      if (state.saving) return;
      resetPreferences();
    });
    panel.appendChild(resetButton);
  }

  function queuePreferenceUpdate(key, value) {
    if (!state.preferences) {
      return;
    }

    const nextPreferences = JSON.parse(JSON.stringify(state.preferences));
    const [section, field] = key.split('.');
    if (!section || !field) {
      return;
    }

    if (!nextPreferences[section]) {
      nextPreferences[section] = {};
    }
    nextPreferences[section][field] = value;

    applyPreferences(nextPreferences, { source: 'local-update' });

    window.clearTimeout(state.pendingSave);
    state.pendingSave = window.setTimeout(() => {
      savePreferencePatch({ [section]: { [field]: value } });
    }, SAVE_DEBOUNCE_MS);
  }

  async function savePreferencePatch(patch) {
    if (!patch) return;

    try {
      markSaving(true);
      const response = await fetch(API_ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error(`Failed to save preferences (${response.status})`);
      }
      const preferences = await response.json();
      applyPreferences(preferences, { source: 'server-save' });
      setStatusMessage('Preferences updated');
    } catch (error) {
      console.error('[terminal.preferences] Failed to save preferences:', error);
      setStatusMessage('Failed to save preferences');
      if (state.preferences) {
        updateControls(state.preferences);
      }
    } finally {
      markSaving(false);
    }
  }

  async function resetPreferences() {
    try {
      markSaving(true);
      const response = await fetch(`${API_ENDPOINT}/reset`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Failed to reset preferences (${response.status})`);
      }
      const preferences = await response.json();
      applyPreferences(preferences, { source: 'server-reset' });
      setStatusMessage('Preferences reset');
    } catch (error) {
      console.error('[terminal.preferences] Reset failed:', error);
      setStatusMessage('Failed to reset preferences');
    } finally {
      markSaving(false);
    }
  }

  function updateControls(preferences) {
    for (const [key, control] of state.controls.entries()) {
      const [section, field] = key.split('.');
      const currentValue = coalesceBoolean(preferences?.[section]?.[field], true);
      control.checked = currentValue;
    }
  }

  function toggleWidgetVisibility(preferences) {
    const researchPanel = document.getElementById('research-telemetry');
    if (researchPanel) {
      researchPanel.classList.toggle('is-hidden', !preferences.widgets?.telemetryPanel);
    }

    const memoryPanel = document.getElementById('memory-telemetry');
    if (memoryPanel) {
      memoryPanel.classList.toggle('is-hidden', !preferences.widgets?.memoryPanel);
    }

    document.body.classList.toggle('model-browser-enabled', Boolean(preferences.widgets?.modelBrowser));
  }

  function handleHistoryPersistence(preferences) {
    if (!state.terminal) {
      return;
    }

    const retainHistory = Boolean(preferences.terminal?.retainHistory);
    if (!retainHistory) {
      sessionStorage.removeItem(STORAGE_KEY);
    }

    if (retainHistory) {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored && state.terminal.outputArea) {
        state.terminal.outputArea.innerHTML = stored;
        state.terminal.scrollToBottom();
      }
      window.addEventListener('beforeunload', persistHistory, { once: true });
    }
  }

  function persistHistory() {
    if (!state.preferences?.terminal?.retainHistory) {
      return;
    }
    if (!state.terminal?.outputArea) {
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, state.terminal.outputArea.innerHTML);
    } catch (error) {
      console.warn('[terminal.preferences] Failed to persist history:', error);
    }
  }

  function applyPreferences(preferences, { source } = {}) {
    state.preferences = preferences;
    global.__terminalPreferences = preferences;

    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      try {
        global.dispatchEvent(new CustomEvent('terminal-preferences:updated', { detail: { preferences, source } }));
      } catch (error) {
        console.warn('[terminal.preferences] Failed to dispatch preferences event:', error);
      }
    }

    if (preferences.widgets) {
      toggleWidgetVisibility(preferences);
    }

    if (preferences.terminal && state.terminal) {
      if (typeof state.terminal.setAutoScrollEnabled === 'function') {
        state.terminal.setAutoScrollEnabled(Boolean(preferences.terminal.autoScroll));
      }
      if (typeof state.terminal.setRetainHistoryEnabled === 'function') {
        state.terminal.setRetainHistoryEnabled(Boolean(preferences.terminal.retainHistory));
      }
      handleHistoryPersistence(preferences);
    }

    updateControls(preferences);

    if (source && state.terminal && typeof state.terminal.appendOutput === 'function') {
      const message = source === 'server-save'
        ? 'Terminal preferences updated.'
        : source === 'server-reset'
          ? 'Terminal preferences reset to defaults.'
          : null;
      if (message) {
        state.terminal.appendOutput(message, 'output-info');
      }
    }
  }

  async function loadPreferences() {
    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Failed to load preferences (${response.status})`);
      }
      const preferences = await response.json();
      applyPreferences(preferences, { source: 'initial-load' });
    } catch (error) {
      console.error('[terminal.preferences] Failed to load preferences:', error);
      setStatusMessage('Unable to load preferences');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureControls();
    loadPreferences();
  });

  global.addEventListener('terminal-ready', (event) => {
    state.terminal = event?.detail?.terminal || null;
    if (state.preferences) {
      applyPreferences(state.preferences, { source: 'terminal-ready' });
      handleHistoryPersistence(state.preferences);
    }
  });
})(window);
