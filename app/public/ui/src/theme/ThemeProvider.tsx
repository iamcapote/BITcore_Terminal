/**
 * Why: Coordinate skin switching across the application while persisting operator preferences.
 * What: Supplies a React context with helpers to set and cycle Hacker, Modern, and Retro themes, wiring listeners for keyboard chords.
 * How: Reads from localStorage, syncs the document data-theme attribute, and exposes a hook to consumers.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { CardProps } from '../components/primitives/Card';
import type { WindowProps } from '../components/primitives/Window';

const THEMES = ['hacker', 'modern', 'retro'] as const;
const DEFAULT_THEME = 'hacker';
const STORAGE_KEY = 'bitcore.ui.theme';
const KEYDOWN_COMBO = { key: 't', altKey: true } as const;

export type ThemeName = (typeof THEMES)[number];

export type ThemeComponentKey = 'card' | 'window';

type ThemeComponentPropsMap = {
  card: CardProps;
  window: WindowProps;
};

type ThemeComponentRenderer<K extends ThemeComponentKey> = (props: ThemeComponentPropsMap[K]) => JSX.Element;

type ThemeComponentOverrides = {
  [K in ThemeComponentKey]?: ThemeComponentRenderer<K>;
};

const componentRegistry: Partial<Record<ThemeName, ThemeComponentOverrides>> = {};

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function registerThemeComponentOverride<K extends ThemeComponentKey>(
  theme: ThemeName,
  key: K,
  renderer: ThemeComponentRenderer<K>
): void {
  componentRegistry[theme] = {
    ...(componentRegistry[theme] ?? {}),
    [key]: renderer
  };
}

export function getThemeComponentOverride<K extends ThemeComponentKey>(
  theme: ThemeName,
  key: K
): ThemeComponentRenderer<K> | undefined {
  return componentRegistry[theme]?.[key] as ThemeComponentRenderer<K> | undefined;
}

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.includes(stored as ThemeName)) {
    return stored as ThemeName;
  }

  const datasetTheme = document.documentElement.dataset.theme;
  if (datasetTheme && THEMES.includes(datasetTheme as ThemeName)) {
    return datasetTheme as ThemeName;
  }

  return DEFAULT_THEME;
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  if (document.body) {
    document.body.dataset.theme = theme;
  }
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeName>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    if (!THEMES.includes(nextTheme)) {
      return;
    }
    setThemeState(nextTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const index = THEMES.indexOf(current);
      const nextIndex = (index + 1) % THEMES.length;
      return THEMES[nextIndex];
    });
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== KEYDOWN_COMBO.key) {
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        cycleTheme();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [cycleTheme]);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return value;
}

export function listAvailableThemes(): readonly ThemeName[] {
  return THEMES;
}
