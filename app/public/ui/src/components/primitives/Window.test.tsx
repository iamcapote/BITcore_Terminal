/* @vitest-environment jsdom */
/**
 * Why: Confirm the window primitive reflects theme-specific chrome supplied through the override registry.
 * What: Renders the Window under different themes and inspects the computed inline styles on the outer section.
 * How: Drives theme changes via a helper component that sets the active theme immediately after mount.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEffect } from 'react';

import { Window } from './Window';
import { ThemeProvider, useTheme } from '../../theme/ThemeProvider';

function WindowWithTheme({ theme }: { theme: 'hacker' | 'modern' | 'retro' }): JSX.Element {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  return (
    <Window title="Frame" subtitle="Surface">
      <div>Content</div>
    </Window>
  );
}

describe('Window theme overrides', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    if (document.body) {
      document.body.dataset.theme = '';
    }
  });

  it('applies retro styling for the retro theme', () => {
    render(
      <ThemeProvider>
        <WindowWithTheme theme="retro" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Frame' });
    const surface = heading.closest('section') as HTMLElement | null;
    expect(surface).not.toBeNull();
    expect(surface?.style.border).toBe('2px solid var(--panel-border-dark)');
    expect(surface?.style.background).toBe('linear-gradient(180deg, var(--panel-gradient-top), var(--panel-gradient-bottom))');
  });

  it('applies hacker styling for the hacker theme', () => {
    render(
      <ThemeProvider>
        <WindowWithTheme theme="hacker" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Frame' });
    const surface = heading.closest('section') as HTMLElement | null;
    expect(surface).not.toBeNull();
    expect(surface?.style.background).toBe('var(--terminal-grid-overlay, transparent), var(--terminal-bg, var(--color-bg-secondary))');
    expect(surface?.style.overflow).toBe('hidden');
  });

  it('falls back to the modern styling by default', () => {
    render(
      <ThemeProvider>
        <WindowWithTheme theme="modern" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Frame' });
    const surface = heading.closest('section') as HTMLElement | null;
    expect(surface).not.toBeNull();
    expect(surface?.style.border).toBe('1px solid var(--color-border)');
    expect(surface?.style.background).toBe('var(--color-bg-secondary)');
  });
});
