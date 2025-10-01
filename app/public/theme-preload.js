(function initializeThemePreference() {
  const storageKey = 'bitcore-theme';
  const root = document.documentElement;
  const fallback = 'dark';

  try {
    const stored = localStorage.getItem(storageKey);
    let theme = fallback;

    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    } else if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      theme = prefersDark.matches ? 'dark' : fallback;
    }

    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
  } catch (error) {
    console.warn('[bitcore:theme] failed to initialize theme preference', error);
    root.classList.add('dark');
    root.dataset.theme = fallback;
  }
})();
