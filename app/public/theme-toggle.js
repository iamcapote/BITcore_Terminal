/**
 * BITcore Theme Toggle Controller
 * Why: Give operators the ability to swap between the BITwiki light shell and the
 *       CORE-style dark terminal aesthetic with smooth transitions.
 * What: Binds to the "theme toggle" button, updates the document root class, and
 *       persists the selection in localStorage for subsequent sessions.
 * How: Emits a custom event when the theme changes so other widgets can respond.
 */

(function registerThemeToggle(global) {
  const STORAGE_KEY = 'bitcore-theme';
  const root = document.documentElement;
  const button = document.querySelector('[data-theme-toggle]');

  if (!button) {
    return;
  }

  function applyTheme(theme, { persist = true } = {}) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    root.classList.toggle('dark', nextTheme === 'dark');
    button.setAttribute('aria-pressed', String(nextTheme === 'dark'));
    updateToggleLabel(nextTheme);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch (error) {
        console.warn('[bitcore:theme] unable to persist theme preference', error);
      }
    }

    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      try {
        global.dispatchEvent(new CustomEvent('bitcore-theme:change', { detail: { theme: nextTheme } }));
      } catch (error) {
        console.warn('[bitcore:theme] unable to dispatch theme change event', error);
      }
    }
  }

  function updateToggleLabel(theme) {
    const label = button.querySelector('.theme-toggle-label');
    const icon = button.querySelector('.theme-toggle-icon');
    if (!label || !icon) return;

    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    icon.textContent = theme === 'dark' ? '☀' : '🌙';
    button.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.dataset.activeTheme = theme;
  }

  button.addEventListener('click', () => {
    const currentTheme = root.dataset.theme === 'light' ? 'light' : 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  // Sync initial UI state with whatever the preload script in <head> decided on.
  const initialTheme = root.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(initialTheme, { persist: false });
})(window);
